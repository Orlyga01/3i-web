// ═══════════════════════════════════════════════════════════════
// OBJECT MOTION TRACKER  —  object_motion.js
// Epic 2 — Fetch, display and annotate heliocentric trajectories
//           via JPL Horizons API.
//
// Module structure:
//   HorizonsClient      — fetch & parse JPL Horizons trajectory data
//   TrajectoryStore     — canonical Point[] with camera/image/description
//   WorkflowController  — tracks current index, advance-to-next-unsaved
//   ObjectMarker        — canvas layer: moving dot + label + off-screen arrow
//   ProgressPanel       — sidebar: point list, summary, click-to-navigate
//   MediaAnnotator      — per-point image upload, preview, sidebar thumb
//   FileIO              — JSON serialisation, browser download, FSAPI save
// ═══════════════════════════════════════════════════════════════

'use strict';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

/** Canonical AU-to-pixel scale used throughout all epics. */
const AU_TO_PX = 175;

const HORIZONS_BASE_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

// ─────────────────────────────────────────────────────────────
// MODULE: HorizonsClient
// ─────────────────────────────────────────────────────────────

class NotFoundError  extends Error { constructor(msg) { super(msg); this.name = 'NotFoundError';  } }
class AmbiguousError extends Error { constructor(msg) { super(msg); this.name = 'AmbiguousError'; } }
class NetworkError   extends Error { constructor(msg) { super(msg); this.name = 'NetworkError';   } }
class EmptyDataError extends Error { constructor(msg) { super(msg); this.name = 'EmptyDataError'; } }

const HorizonsClient = (() => {

    function _buildUrl(designation, startDate, endDate, step) {
        const encodedDes = encodeURIComponent(designation);
        return (
            `${HORIZONS_BASE_URL}` +
            `?format=json` +
            `&COMMAND='DES=${encodedDes}'` +
            `&EPHEM_TYPE=VECTORS` +
            `&CENTER=500%4010` +
            `&START_TIME=${encodeURIComponent(startDate)}` +
            `&STOP_TIME=${encodeURIComponent(endDate)}` +
            `&STEP_SIZE=${encodeURIComponent(step)}` +
            `&VEC_TABLE=2`
        );
    }

    function _parseResult(resultText, designation) {
        if (/Matching\s+small-bodies:/i.test(resultText) ||
            /Multiple\s+major-bodies\s+match/i.test(resultText) ||
            /ambiguous\s+target/i.test(resultText)) {
            throw new AmbiguousError(
                'Multiple matches found. Please enter a more specific designation (e.g., use the full provisional designation).'
            );
        }

        if (/No\s+matches\s+found/i.test(resultText) ||
            /No\s+target\s+body\s+name\s+matching/i.test(resultText) ||
            /No\s+matching\s+record/i.test(resultText) ||
            /ERROR:/i.test(resultText)) {
            throw new NotFoundError(
                `Object '${designation}' was not found in the JPL Horizons database. Check the designation and try again.`
            );
        }

        const soeIdx = resultText.indexOf('$$SOE');
        const eoeIdx = resultText.indexOf('$$EOE');

        if (soeIdx === -1 || eoeIdx === -1) {
            throw new NotFoundError(
                `Object '${designation}' was not found in the JPL Horizons database. Check the designation and try again.`
            );
        }

        const block = resultText.slice(soeIdx + 5, eoeIdx).trim();

        if (!block) {
            throw new EmptyDataError(
                `No ephemeris data found for '${designation}' in the specified date range.`
            );
        }

        const lines  = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const points = [];

        for (let i = 0; i < lines.length; i += 3) {
            const jdLine  = lines[i];
            const xyzLine = lines[i + 1];
            if (!jdLine || !xyzLine) break;

            const jdMatch = jdLine.match(/^([\d.]+)\s*=\s*A\.D\.\s*(\d{4}-\w{3}-\d{2})/);
            if (!jdMatch) continue;

            const jd   = parseFloat(jdMatch[1]);
            const date = jdMatch[2];

            const xMatch = xyzLine.match(/X\s*=\s*([-+]?\d+\.?\d*[Ee][-+]?\d+)/);
            const yMatch = xyzLine.match(/Y\s*=\s*([-+]?\d+\.?\d*[Ee][-+]?\d+)/);
            const zMatch = xyzLine.match(/Z\s*=\s*([-+]?\d+\.?\d*[Ee][-+]?\d+)/);

            if (!xMatch || !yMatch || !zMatch) continue;

            const auX = parseFloat(xMatch[1]);
            const auY = parseFloat(yMatch[1]);
            const auZ = parseFloat(zMatch[1]);

            points.push({
                jd,
                date,
                au:          { x: auX, y: auY, z: auZ },
                wx:          auX * AU_TO_PX,
                wy:          auY * AU_TO_PX,
                wz:          auZ * AU_TO_PX,
                camera:      null,
                description: null,
                image:       null,
            });
        }

        if (points.length === 0) {
            throw new EmptyDataError(
                `No ephemeris data found for '${designation}' in the specified date range.`
            );
        }

        return points;
    }

    async function fetch(designation, startDate, endDate, step) {
        const url = _buildUrl(designation, startDate, endDate, step);

        let response;
        try {
            response = await window.fetch(url);
        } catch (err) {
            throw new NetworkError('Could not reach the JPL Horizons API. Check your connection and try again.');
        }

        if (!response.ok) {
            throw new NetworkError('Could not reach the JPL Horizons API. Check your connection and try again.');
        }

        let data;
        try {
            data = await response.json();
        } catch (err) {
            throw new NetworkError('Could not reach the JPL Horizons API. Check your connection and try again.');
        }

        return _parseResult(data.result || '', designation);
    }

    return { fetch, _buildUrl, _parseResult };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: TrajectoryStore
// ─────────────────────────────────────────────────────────────

const TrajectoryStore = (() => {
    let _designation  = '';
    let _points       = [];
    let _isUpdateMode = false;
    let _createdAt    = null;

    function init(designation, points) {
        _designation  = designation;
        _points       = points;
        _isUpdateMode = false;
        _createdAt    = null;
    }

    function initFromSaved(designation, points, createdAt) {
        _designation  = designation;
        _points       = points;
        _isUpdateMode = true;
        _createdAt    = createdAt || null;
    }

    function getPoints()      { return _points; }
    function getDesignation() { return _designation; }
    function getPoint(i)      { return _points[i] || null; }
    function isUpdateMode()   { return _isUpdateMode; }
    function getCreatedAt()   { return _createdAt; }

    function savedCount() {
        return _points.filter(p => p.camera !== null).length;
    }

    function allSaved() {
        return _points.length > 0 && _points.every(p => p.camera !== null);
    }

    function saveCamera(index, cameraState) {
        if (_points[index]) _points[index].camera = cameraState;
    }

    function saveDescription(index, text) {
        if (_points[index]) _points[index].description = (text || '').trim() || null;
    }

    function saveImage(index, file) {
        if (_points[index]) _points[index].image = file;
    }

    function toPlainObject() {
        const now = new Date().toISOString();
        const pts = _points;
        return {
            object:      _designation,
            designation: _designation,
            createdAt:   _createdAt || now,
            updatedAt:   now,
            source:      'JPL Horizons VECTORS',
            dateRange:   pts.length ? `${pts[0].date} \u2192 ${pts[pts.length - 1].date}` : '',
            scale:       { auToPx: AU_TO_PX },
            points:      pts.map((p, i) => ({
                index:       i,
                jd:          p.jd,
                date:        p.date,
                au:          p.au,
                px: {
                    wx: p.wx,
                    wy: p.wy,
                    wz: p.wz,
                },
                camera:      p.camera,
                description: p.description,
                image:       p.image instanceof File ? p.image.name : p.image,
            })),
        };
    }

    return {
        init, initFromSaved,
        getPoints, getDesignation, getPoint,
        isUpdateMode, getCreatedAt,
        savedCount, allSaved,
        saveCamera, saveDescription, saveImage,
        toPlainObject,
    };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: WorkflowController
// ─────────────────────────────────────────────────────────────

const WorkflowController = (() => {
    let _currentIndex = 0;

    function start(points) {
        _currentIndex = 0;
    }

    function getCurrent() { return _currentIndex; }

    function advanceToNextUnsaved(points) {
        for (let i = _currentIndex + 1; i < points.length; i++) {
            if (points[i].camera === null) { _currentIndex = i; return _currentIndex; }
        }
        for (let i = 0; i < _currentIndex; i++) {
            if (points[i].camera === null) { _currentIndex = i; return _currentIndex; }
        }
        return _currentIndex;
    }

    function goTo(index) { _currentIndex = index; return _currentIndex; }

    return { start, getCurrent, advanceToNextUnsaved, goTo };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: ObjectMarker  (Story 2.6)
// Canvas layer that draws a pulsing dot at the active point.
// Registered with SolarSystem.layers.register('object-marker', fn).
// ─────────────────────────────────────────────────────────────

const ObjectMarker = (() => {
    let _point = null;
    let _name  = '';
    let _frame = 0;

    function setPoint(point, name) {
        _point = point;
        _name  = name || '';
    }

    function draw() {
        if (!_point) return;
        _frame++;

        const { sx, sy, depth } = project3(_point.wx, _point.wy, _point.wz);
        if (depth < 10) return;

        const onScreen = sx >= 0 && sx <= canvas.width && sy >= 0 && sy <= canvas.height;

        if (!onScreen) {
            _drawOffScreenArrow(sx, sy);
            return;
        }

        // Outer pulsing ring (10–14 px, ~60-frame cycle)
        const pulse = 10 + 4 * (0.5 + 0.5 * Math.sin(_frame * Math.PI / 30));
        ctx.beginPath();
        ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(120,255,200,0.35)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Inner filled dot
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,255,200,1.0)';
        ctx.fill();

        // Label above the dot
        const label = `${_point.date} \u00B7 ${_name}`;
        ctx.font         = '11px Georgia';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle    = 'rgba(200,235,255,0.9)';
        ctx.fillText(label, sx, sy - 18);
    }

    function _drawOffScreenArrow(sx, sy) {
        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;
        const dx = sx - cx;
        const dy = sy - cy;
        const angle = Math.atan2(dy, dx);

        const margin = 24;
        let ex, ey;
        if (Math.abs(dx) * canvas.height >= Math.abs(dy) * canvas.width) {
            ex = dx > 0 ? canvas.width - margin : margin;
            ey = cy + (ex - cx) * (dy / (dx || 0.001));
        } else {
            ey = dy > 0 ? canvas.height - margin : margin;
            ex = cx + (ey - cy) * (dx / (dy || 0.001));
        }
        ey = Math.max(margin, Math.min(canvas.height - margin, ey));
        ex = Math.max(margin, Math.min(canvas.width  - margin, ex));

        // Equilateral triangle arrow (10 px)
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -6);
        ctx.lineTo(-5,  6);
        ctx.closePath();
        ctx.fillStyle = 'rgba(120,255,200,1.0)';
        ctx.fill();
        ctx.restore();

        const label = `${_point.date} \u00B7 ${_name}`;
        ctx.font         = '11px Georgia';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = 'rgba(200,235,255,0.9)';
        ctx.fillText(label, ex, ey - 16);
    }

    return { setPoint, draw };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: ProgressPanel  (Story 2.7)
// Renders the scrollable point list in #om-sidebar.
// ─────────────────────────────────────────────────────────────

const ProgressPanel = (() => {
    let _onNavigate = null;

    function setNavigateCallback(fn) { _onNavigate = fn; }

    function render(points, activeIndex) {
        const list    = document.getElementById('om-point-list');
        const summary = document.getElementById('om-sidebar-summary');
        if (!list || !summary) return;

        const saved = points.filter(p => p.camera !== null).length;
        summary.textContent = `${saved} of ${points.length} saved`;

        list.innerHTML = '';

        points.forEach((p, i) => {
            const row = document.createElement('div');
            row.className    = 'om-point-row' + (i === activeIndex ? ' active' : '');
            row.dataset.index = i;
            row.setAttribute('role', 'listitem');

            // Row number
            const num = document.createElement('span');
            num.className   = 'om-row-num';
            num.textContent = i + 1;

            // Thumbnail
            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'om-row-thumb-wrap';
            _buildThumb(p, thumbWrap);

            // Date
            const dateEl = document.createElement('span');
            dateEl.className   = 'om-row-date';
            dateEl.textContent = formatTrajDate(p.date);

            // Save badge
            const badge = document.createElement('span');
            badge.className   = 'om-row-badge ' + (p.camera !== null ? 'saved' : 'pending');
            badge.textContent = p.camera !== null ? '\u2713' : '\u00B7';

            row.append(num, thumbWrap, dateEl, badge);
            row.addEventListener('click', () => { if (_onNavigate) _onNavigate(i); });
            list.appendChild(row);
        });
    }

    function setActive(index) {
        const rows = document.querySelectorAll('.om-point-row');
        rows.forEach((row, i) => row.classList.toggle('active', i === index));

        const activeRow = document.querySelector('.om-point-row.active');
        if (activeRow) activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

        const points  = TrajectoryStore.getPoints();
        const saved   = points.filter(p => p.camera !== null).length;
        const summary = document.getElementById('om-sidebar-summary');
        if (summary) summary.textContent = `${saved} of ${points.length} saved`;
    }

    function updateRowBadge(index) {
        const rows = document.querySelectorAll('.om-point-row');
        const row  = rows[index];
        if (!row) return;
        const badge = row.querySelector('.om-row-badge');
        if (!badge) return;
        const p = TrajectoryStore.getPoint(index);
        if (!p) return;
        badge.className   = 'om-row-badge ' + (p.camera !== null ? 'saved' : 'pending');
        badge.textContent = p.camera !== null ? '\u2713' : '\u00B7';
    }

    function updateRowThumb(index, url) {
        const rows = document.querySelectorAll('.om-point-row');
        const row  = rows[index];
        if (!row) return;
        const wrap = row.querySelector('.om-row-thumb-wrap');
        if (!wrap) return;
        wrap.innerHTML = '';
        if (url) {
            const img = document.createElement('img');
            img.className = 'om-row-thumb';
            img.src = url;
            img.alt = '';
            wrap.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'om-row-thumb om-row-thumb-empty';
            wrap.appendChild(placeholder);
        }
    }

    function _buildThumb(p, wrap) {
        if (p.image instanceof File) {
            const img = document.createElement('img');
            img.className = 'om-row-thumb';
            img.src = URL.createObjectURL(p.image);
            img.alt = '';
            wrap.appendChild(img);
        } else if (typeof p.image === 'string' && p.image) {
            const name = sanitize(TrajectoryStore.getDesignation());
            const img  = document.createElement('img');
            img.className = 'om-row-thumb';
            img.src = `data/${name}/${p.image}`;
            img.alt = '';
            wrap.appendChild(img);
        } else {
            const ph = document.createElement('div');
            ph.className = 'om-row-thumb om-row-thumb-empty';
            wrap.appendChild(ph);
        }
    }

    return { setNavigateCallback, render, setActive, updateRowBadge, updateRowThumb };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: MediaAnnotator  (Story 2.9)
// Handles image upload, preview in the annotation panel,
// and thumbnail updates in the sidebar.
// ─────────────────────────────────────────────────────────────

const MediaAnnotator = (() => {
    const _MIME_EXT = {
        'image/jpeg': '.jpg',
        'image/png':  '.png',
        'image/webp': '.webp',
        'image/gif':  '.gif',
    };
    const _objectUrls = {};

    function handleImageUpload(file, pointIndex) {
        if (_objectUrls[pointIndex]) URL.revokeObjectURL(_objectUrls[pointIndex]);

        TrajectoryStore.saveImage(pointIndex, file);
        const url = URL.createObjectURL(file);
        _objectUrls[pointIndex] = url;

        _showPreview(url);
        _updateSizeWarning(file);
        ProgressPanel.updateRowThumb(pointIndex, url);
    }

    function clearImage(pointIndex) {
        if (_objectUrls[pointIndex]) {
            URL.revokeObjectURL(_objectUrls[pointIndex]);
            delete _objectUrls[pointIndex];
        }
        TrajectoryStore.saveImage(pointIndex, null);
        _hidePreview();
        ProgressPanel.updateRowThumb(pointIndex, null);
    }

    /** Populate the annotation panel for the given point index. */
    function loadAnnotationPanel(pointIndex) {
        const p        = TrajectoryStore.getPoint(pointIndex);
        const textarea = document.getElementById('om-description');

        if (textarea) textarea.value = p ? (p.description || '') : '';

        const warnEl = document.getElementById('om-img-warn');
        if (warnEl) warnEl.style.display = 'none';

        if (!p || !p.image) {
            _hidePreview();
            return;
        }

        if (p.image instanceof File) {
            const url = _objectUrls[pointIndex] || URL.createObjectURL(p.image);
            _objectUrls[pointIndex] = url;
            _showPreview(url);
        } else if (typeof p.image === 'string') {
            const name = sanitize(TrajectoryStore.getDesignation());
            _showPreview(`data/${name}/${p.image}`);
        } else {
            _hidePreview();
        }
    }

    function _showPreview(url) {
        const preview    = document.getElementById('om-img-preview');
        const previewWrap = document.getElementById('om-img-preview-wrap');
        const btn        = document.getElementById('om-img-btn');
        if (preview)     preview.src              = url;
        if (previewWrap) previewWrap.style.display = 'flex';
        if (btn)         btn.style.display         = 'none';
    }

    function _hidePreview() {
        const preview    = document.getElementById('om-img-preview');
        const previewWrap = document.getElementById('om-img-preview-wrap');
        const btn        = document.getElementById('om-img-btn');
        if (preview)     preview.src               = '';
        if (previewWrap) previewWrap.style.display  = 'none';
        if (btn)         btn.style.display           = '';
    }

    function _updateSizeWarning(file) {
        const warnEl = document.getElementById('om-img-warn');
        if (!warnEl) return;
        if (file.size > 5 * 1024 * 1024) {
            const mb = (file.size / (1024 * 1024)).toFixed(1);
            warnEl.textContent  = `Large image (${mb} MB) — this will increase your saved data size.`;
            warnEl.style.display = '';
        } else {
            warnEl.style.display = 'none';
        }
    }

    return { handleImageUpload, clearImage, loadAnnotationPanel };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: FileIO  (Story 2.12)
// JSON serialisation, browser download, File System Access API.
// ─────────────────────────────────────────────────────────────

const FileIO = (() => {
    const _MIME_EXT = {
        'image/jpeg': '.jpg',
        'image/png':  '.png',
        'image/webp': '.webp',
        'image/gif':  '.gif',
    };

    /**
     * Serialise TrajectoryStore to the canonical JSON schema.
     * Camera values are rounded to 2 decimal places.
     * AU coordinates are stored at full precision.
     * Image filename strings are injected for points with File objects.
     */
    function serialize(store) {
        const plain = store.toPlainObject();
        const pts   = store.getPoints();

        plain.points.forEach((p, i) => {
            // Round camera to 2 dp
            if (p.camera) {
                p.camera = {
                    el:      _round2(p.camera.el),
                    az:      _round2(p.camera.az),
                    zoomIn:  _round2(p.camera.zoomIn),
                    zoomOut: _round2(p.camera.zoomOut),
                };
            }
            // Resolve image filename
            const raw = pts[i]?.image;
            if (raw instanceof File) {
                const ext = _MIME_EXT[raw.type] || '.bin';
                p.image   = `point_${i}${ext}`;
            }
        });

        return plain;
    }

    /** Download trajectory.json + all image files via programmatic <a> click. */
    function download(json, points) {
        _triggerDownload(
            new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }),
            'trajectory.json'
        );

        let imgCount = 0;
        points.forEach((p, i) => {
            if (p.image instanceof File) {
                const ext = _MIME_EXT[p.image.type] || '.bin';
                _triggerDownload(p.image, `point_${i}${ext}`);
                imgCount++;
            }
        });

        return imgCount;
    }

    /** Save all files into data/{sanitizedName}/ via File System Access API. */
    async function saveToDirectory(dirHandle, sanitizedName, json, points) {
        const subDir = await dirHandle.getDirectoryHandle(sanitizedName, { create: true });

        const jsonWS = await (await subDir.getFileHandle('trajectory.json', { create: true })).createWritable();
        await jsonWS.write(JSON.stringify(json, null, 2));
        await jsonWS.close();

        let imgCount = 0;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.image instanceof File) {
                const ext  = _MIME_EXT[p.image.type] || '.bin';
                const imgWS = await (await subDir.getFileHandle(`point_${i}${ext}`, { create: true })).createWritable();
                await imgWS.write(p.image);
                await imgWS.close();
                imgCount++;
            }
        }

        return imgCount;
    }

    function _round2(v) { return Math.round((v ?? 0) * 100) / 100; }

    function _triggerDownload(blobOrFile, filename) {
        const url = URL.createObjectURL(blobOrFile);
        const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 15000);
    }

    return { serialize, download, saveToDirectory };
})();


// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function sanitize(name) { return name.replace(/[\s/]/g, '_'); }

function resolveStep(dropdownEl, customEl) {
    const custom = (customEl.value || '').trim();
    return custom || dropdownEl.value;
}

const _MONTH_ABBR = {
    Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
    Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
};
const _MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Parse "2025-Jul-01" or "2025-07-01" → Date object (noon UTC). */
function parseTrajDate(str) {
    if (!str) return new Date();
    const iso = str.replace(
        /^(\d{4})-([A-Za-z]{3})-(\d{2})$/,
        (_, y, m, d) => `${y}-${_MONTH_ABBR[m] || '01'}-${d}`
    );
    return new Date(iso + 'T12:00:00');
}

/** Format "2025-Jul-01" or "2025-07-01" → "Jul 01, 2025". */
function formatTrajDate(str) {
    if (!str) return '';
    const m1 = str.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})/);
    if (m1) return `${m1[2]} ${m1[3]}, ${m1[1]}`;
    const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return `${_MONTH_NAMES[parseInt(m2[2], 10) - 1] || m2[2]} ${m2[3]}, ${m2[1]}`;
    return str;
}


// ─────────────────────────────────────────────────────────────
// UI CONTROLLER
// ─────────────────────────────────────────────────────────────

(function initUI() {

    // ── Element refs ─────────────────────────────────────────
    const designationEl  = document.getElementById('om-designation');
    const searchBtn      = document.getElementById('om-search-btn');
    const statusEl       = document.getElementById('om-status');

    const draftCard      = document.getElementById('om-draft-card');
    const draftCardMsg   = document.getElementById('om-draft-card-msg');
    const resumeBtn      = document.getElementById('om-resume-btn');
    const startFreshBtn  = document.getElementById('om-start-fresh-btn');

    const savedCard      = document.getElementById('om-saved-card');
    const savedCardMsg   = document.getElementById('om-saved-card-msg');
    const loadSavedBtn   = document.getElementById('om-load-saved-btn');
    const refetchBtn     = document.getElementById('om-refetch-btn');

    const dateSection    = document.getElementById('om-date-section');
    const startDateEl    = document.getElementById('om-start-date');
    const endDateEl      = document.getElementById('om-end-date');
    const stepDropdownEl = document.getElementById('om-step-dropdown');
    const stepCustomEl   = document.getElementById('om-step-custom');
    const validationMsg  = document.getElementById('om-validation-msg');
    const fetchBtn       = document.getElementById('om-fetch-btn');

    const formOverlay    = document.getElementById('om-form-overlay');
    const viewerControls = document.getElementById('om-viewer-controls');
    const newSearchBtn   = document.getElementById('om-new-search-btn');

    const sidebar        = document.getElementById('om-sidebar');
    const savePointBtn   = document.getElementById('om-save-point-btn');
    const saveFileBtn    = document.getElementById('om-save-file-btn');
    const saveDirBtn     = document.getElementById('om-save-dir-btn');
    const viewerStatus   = document.getElementById('om-viewer-status');
    const imgInput       = document.getElementById('om-img-input');
    const imgBtn         = document.getElementById('om-img-btn');
    const imgRemoveBtn   = document.getElementById('om-img-remove');
    const dropZone       = document.getElementById('om-drop-zone');

    // ── Form status helpers ───────────────────────────────────

    function setStatus(mode, text) {
        statusEl.style.display = '';
        statusEl.className     = mode;
        statusEl.textContent   = text;
    }

    function clearStatus() {
        statusEl.className     = '';
        statusEl.textContent   = '';
        statusEl.style.display = 'none';
    }

    // ── Viewer status helpers ─────────────────────────────────

    function setViewerStatus(mode, text) {
        if (!viewerStatus) return;
        viewerStatus.className   = mode;
        viewerStatus.textContent = text;
    }

    function clearViewerStatus() {
        if (!viewerStatus) return;
        viewerStatus.className   = '';
        viewerStatus.textContent = '';
        viewerStatus.style.display = 'none';
    }

    // ── UI state helpers ─────────────────────────────────────

    function hideSavedCard()  { savedCard.classList.remove('visible'); }
    function hideDraftCard()  { draftCard.classList.remove('visible'); }

    function showSavedCard(designation) {
        savedCardMsg.textContent = `A saved trajectory for '${designation}' already exists.`;
        savedCard.classList.add('visible');
    }

    function showDraftCard(designation, savedCount, total) {
        draftCardMsg.textContent =
            `Resume unsaved session for '${designation}' \u2014 ${savedCount} of ${total} points saved`;
        draftCard.classList.add('visible');
    }

    function showDateSection() {
        dateSection.classList.add('visible');
        updateFetchButton();
    }

    function hideDateSection() { dateSection.classList.remove('visible'); }

    function resetToStep1() {
        hideSavedCard();
        hideDraftCard();
        hideDateSection();
        clearStatus();
    }

    // ── Viewer activation / deactivation ─────────────────────

    function activateViewer(points) {
        if (window.SolarSystem) {
            SolarSystem.engine.pause();
            SolarSystem.engine.setDate(parseTrajDate(points[0].date));
            const pauseBtn = document.getElementById('ss-pause');
            if (pauseBtn) pauseBtn.textContent = '\u25B6 Play';
        }

        formOverlay.style.display    = 'none';
        viewerControls.style.display = 'block';
        viewerControls.removeAttribute('aria-hidden');

        // Sidebar + marker setup
        ProgressPanel.setNavigateCallback(navigateToPoint);
        const idx = WorkflowController.getCurrent();
        ProgressPanel.render(points, idx);

        ObjectMarker.setPoint(points[idx], TrajectoryStore.getDesignation());
        if (window.SolarSystem) {
            SolarSystem.layers.register('object-marker', () => ObjectMarker.draw());
            SolarSystem.layers.toggle('object-marker', true);
        }

        sidebar.classList.add('visible');
        MediaAnnotator.loadAnnotationPanel(idx);
        updateCounter();
        updateSaveButtons();

        // Expose File System Access API save button if available
        if (typeof window.showDirectoryPicker === 'function') {
            if (saveDirBtn) saveDirBtn.style.display = '';
        }
    }

    function deactivateViewer() {
        if (window.SolarSystem) SolarSystem.layers.toggle('object-marker', false);
        sidebar.classList.remove('visible');
        viewerControls.style.display = 'none';
        viewerControls.setAttribute('aria-hidden', 'true');
        formOverlay.style.display    = '';
        clearViewerStatus();
    }

    newSearchBtn.addEventListener('click', deactivateViewer);

    // ── Navigate to a point ───────────────────────────────────

    function navigateToPoint(index) {
        const pts = TrajectoryStore.getPoints();
        const p   = pts[index];
        if (!p) return;

        WorkflowController.goTo(index);
        ObjectMarker.setPoint(p, TrajectoryStore.getDesignation());

        if (window.SolarSystem) {
            SolarSystem.engine.setDate(parseTrajDate(p.date));
        }

        ProgressPanel.setActive(index);
        MediaAnnotator.loadAnnotationPanel(index);
        updateCounter();
        clearViewerStatus();
    }

    // ── Counter + save-button state ───────────────────────────

    function updateCounter() {
        const pts     = TrajectoryStore.getPoints();
        const idx     = WorkflowController.getCurrent();
        const counter = document.getElementById('om-point-counter');
        if (counter) counter.textContent = `Point ${idx + 1} of ${pts.length}`;
    }

    function updateSaveButtons() {
        const allDone = TrajectoryStore.allSaved();
        const msg     = document.getElementById('om-all-saved-msg');
        if (msg)      msg.style.display = allDone ? '' : 'none';
        if (saveFileBtn) saveFileBtn.classList.toggle('enabled', allDone);
        if (saveDirBtn)  saveDirBtn.classList.toggle('enabled', allDone);
    }

    // ── Save current point (Story 2.8) ────────────────────────

    function saveCurrentPoint() {
        const pts = TrajectoryStore.getPoints();
        const idx = WorkflowController.getCurrent();

        const cam = (window.SolarSystem) ? SolarSystem.camera.getRawState() : { el: 5, az: 0, zoomIn: 0, zoomOut: 0 };
        TrajectoryStore.saveCamera(idx, cam);

        const textarea = document.getElementById('om-description');
        TrajectoryStore.saveDescription(idx, textarea ? textarea.value : '');

        // Auto-save draft to localStorage (Story 2.11)
        _saveDraft();

        // Update sidebar badge for the just-saved row
        ProgressPanel.updateRowBadge(idx);

        // Advance to next unsaved
        const nextIdx = WorkflowController.advanceToNextUnsaved(pts);
        ProgressPanel.setActive(nextIdx);
        navigateToPoint(nextIdx);
        updateSaveButtons();
    }

    savePointBtn.addEventListener('click', saveCurrentPoint);

    // Keyboard shortcut: Space or Enter when no input is focused
    document.addEventListener('keydown', e => {
        if (viewerControls.style.display === 'none' ||
            viewerControls.getAttribute('aria-hidden') === 'true') return;
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            saveCurrentPoint();
        }
    });

    // ── Image upload wiring (Story 2.9) ──────────────────────

    imgBtn.addEventListener('click', () => imgInput.click());

    dropZone.addEventListener('click', e => {
        if (e.target === dropZone) imgInput.click();
    });

    imgInput.addEventListener('change', () => {
        const file = imgInput.files[0];
        if (file) MediaAnnotator.handleImageUpload(file, WorkflowController.getCurrent());
        imgInput.value = '';
    });

    imgRemoveBtn.addEventListener('click', () => {
        MediaAnnotator.clearImage(WorkflowController.getCurrent());
    });

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/')) {
            MediaAnnotator.handleImageUpload(file, WorkflowController.getCurrent());
        }
    });

    // ── File save (Story 2.12) ────────────────────────────────

    saveFileBtn.addEventListener('click', () => {
        if (!saveFileBtn.classList.contains('enabled')) return;
        const json     = FileIO.serialize(TrajectoryStore);
        const imgCount = FileIO.download(json, TrajectoryStore.getPoints());
        _clearDraft();
        setViewerStatus(
            'success',
            `Saved \u2014 ${TrajectoryStore.getPoints().length} points \u00B7 ${imgCount} image${imgCount !== 1 ? 's' : ''} \u00B7 trajectory.json`
        );
    });

    if (saveDirBtn) {
        saveDirBtn.addEventListener('click', async () => {
            if (!saveDirBtn.classList.contains('enabled')) return;
            const name   = sanitize(TrajectoryStore.getDesignation());
            const points = TrajectoryStore.getPoints();
            const json   = FileIO.serialize(TrajectoryStore);
            try {
                const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                const imgCount  = await FileIO.saveToDirectory(dirHandle, name, json, points);
                _clearDraft();
                setViewerStatus(
                    'success',
                    `Saved to folder \u2014 ${points.length} points \u00B7 ${imgCount} image${imgCount !== 1 ? 's' : ''}`
                );
            } catch (err) {
                if (err.name !== 'AbortError') {
                    setViewerStatus('error', `Save failed: ${err.message}`);
                }
            }
        });
    }

    // ── LocalStorage helpers (Story 2.11) ────────────────────

    function _draftKey(name) { return `objectMotion:${name}`; }

    function _saveDraft() {
        const name = sanitize(TrajectoryStore.getDesignation());
        try {
            localStorage.setItem(_draftKey(name), JSON.stringify(TrajectoryStore.toPlainObject()));
        } catch (_) {}
    }

    function _clearDraft() {
        const name = sanitize(TrajectoryStore.getDesignation());
        try { localStorage.removeItem(_draftKey(name)); } catch (_) {}
    }

    // ── Search button enable/disable ─────────────────────────

    function updateSearchButton() {
        const ready = designationEl.value.trim() !== '';
        searchBtn.classList.toggle('enabled', ready);
    }

    designationEl.addEventListener('input', () => {
        updateSearchButton();
        resetToStep1();
    });

    updateSearchButton();

    // ── Step 1: Search ───────────────────────────────────────

    async function _runNormalSearch(designation) {
        const name = sanitize(designation);
        searchBtn.classList.remove('enabled');
        setStatus('loading', 'Checking for saved data\u2026');

        try {
            const res = await window.fetch(`data/${name}/trajectory.json`, { method: 'HEAD' });
            clearStatus();
            if (res.ok) {
                showSavedCard(designation);
            } else {
                showDateSection();
            }
        } catch (_) {
            clearStatus();
            showDateSection();
        } finally {
            updateSearchButton();
        }
    }

    searchBtn.addEventListener('click', async () => {
        if (!searchBtn.classList.contains('enabled')) return;

        const designation = designationEl.value.trim();
        const name        = sanitize(designation);

        resetToStep1();

        // Check for a localStorage draft first (Story 2.11)
        try {
            const raw = localStorage.getItem(_draftKey(name));
            if (raw) {
                const parsed = JSON.parse(raw);
                const saved  = (parsed.points || []).filter(p => p.camera !== null).length;
                const total  = (parsed.points || []).length;
                updateSearchButton();
                showDraftCard(designation, saved, total);
                return;
            }
        } catch (_) {}

        await _runNormalSearch(designation);
    });

    searchBtn.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); searchBtn.click(); }
    });

    // ── Draft card buttons (Story 2.11) ──────────────────────

    resumeBtn.addEventListener('click', () => {
        const designation = designationEl.value.trim();
        const name        = sanitize(designation);
        hideDraftCard();
        try {
            const raw = localStorage.getItem(_draftKey(name));
            if (!raw) { setStatus('error', 'Draft not found.'); return; }
            clearStatus();
            loadTrajectoryFromData(JSON.parse(raw));
        } catch (_) {
            setStatus('error', 'Could not load the draft.');
        }
    });

    startFreshBtn.addEventListener('click', async () => {
        const designation = designationEl.value.trim();
        const name        = sanitize(designation);
        try { localStorage.removeItem(_draftKey(name)); } catch (_) {}
        hideDraftCard();
        await _runNormalSearch(designation);
    });

    // ── Load trajectory from JSON object ─────────────────────

    function loadTrajectoryFromData(json) {
        const designation = json.designation || json.object || designationEl.value.trim();
        const createdAt   = json.createdAt || null;
        const raw         = json.points || [];

        const points = raw.map(p => ({
            jd:          p.jd,
            date:        p.date,
            au:          p.au,
            wx:          p.wx  ?? p.px?.wx ?? (p.au?.x * AU_TO_PX) ?? 0,
            wy:          p.wy  ?? p.px?.wy ?? (p.au?.y * AU_TO_PX) ?? 0,
            wz:          p.wz  ?? p.px?.wz ?? (p.au?.z * AU_TO_PX) ?? 0,
            camera:      p.camera      ?? null,
            description: p.description ?? null,
            image:       p.image       ?? null,
        }));

        if (points.length === 0) {
            setStatus('error', 'No trajectory points found in this file.');
            return;
        }

        TrajectoryStore.initFromSaved(designation, points, createdAt);
        WorkflowController.start(points);

        designationEl.value = designation;
        updateSearchButton();

        const saved   = TrajectoryStore.savedCount();
        const total   = points.length;
        const modeTag = saved > 0
            ? ` \u00B7 ${saved} of ${total} annotated \u2014 Update Mode`
            : ` \u00B7 0 of ${total} annotated`;

        setStatus('success', `${total} points loaded${modeTag}`);
        activateViewer(TrajectoryStore.getPoints());
    }

    // ── Saved-card buttons ───────────────────────────────────

    loadSavedBtn.addEventListener('click', async () => {
        const designation = designationEl.value.trim();
        const name        = sanitize(designation);

        setStatus('loading', 'Loading saved trajectory\u2026');
        try {
            const res  = await window.fetch(`data/${name}/trajectory.json`);
            const json = await res.json();
            hideSavedCard();
            loadTrajectoryFromData(json);
        } catch (_) {
            setStatus('error', 'Could not load the saved trajectory file.');
        }
    });

    refetchBtn.addEventListener('click', () => {
        hideSavedCard();
        clearStatus();
        showDateSection();
    });

    // ── Fetch button enable/disable ──────────────────────────

    function updateFetchButton() {
        const ready =
            designationEl.value.trim() !== '' &&
            startDateEl.value          !== '' &&
            endDateEl.value            !== '';
        fetchBtn.classList.toggle('enabled', ready);
    }

    [startDateEl, endDateEl].forEach(el => {
        el.addEventListener('input',  updateFetchButton);
        el.addEventListener('change', updateFetchButton);
    });

    // ── Date validation ──────────────────────────────────────

    function showValidationError(msg) {
        validationMsg.textContent = msg;
        validationMsg.classList.add('visible');
    }

    function clearValidationError() {
        validationMsg.textContent = '';
        validationMsg.classList.remove('visible');
    }

    function validateDates() {
        if (endDateEl.value && startDateEl.value && endDateEl.value <= startDateEl.value) {
            showValidationError('End date must be after Start date.');
            return false;
        }
        clearValidationError();
        return true;
    }

    endDateEl.addEventListener('change', validateDates);
    startDateEl.addEventListener('change', validateDates);

    // ── Step 2: Fetch Trajectory ─────────────────────────────

    fetchBtn.addEventListener('click', async () => {
        if (!fetchBtn.classList.contains('enabled')) return;
        if (!validateDates()) return;

        const designation = designationEl.value.trim();
        const startDate   = startDateEl.value;
        const endDate     = endDateEl.value;
        const step        = resolveStep(stepDropdownEl, stepCustomEl);

        clearValidationError();
        setStatus('loading', 'Fetching trajectory\u2026');
        fetchBtn.classList.remove('enabled');

        try {
            const points = await HorizonsClient.fetch(designation, startDate, endDate, step);

            TrajectoryStore.init(designation, points);
            WorkflowController.start(points);

            setStatus('success', `${points.length} points loaded`);
            activateViewer(TrajectoryStore.getPoints());

        } catch (err) {
            setStatus('error', err.message || 'An unexpected error occurred.');
        } finally {
            updateFetchButton();
        }
    });

    fetchBtn.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fetchBtn.click(); }
    });

})();
