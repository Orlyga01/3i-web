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
const MAX_OBJECT_POSITION_AU = 100;

const HORIZONS_BASE_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

// ─────────────────────────────────────────────────────────────
// MODULE: HorizonsClient
// ─────────────────────────────────────────────────────────────

class NotFoundError extends Error { constructor(msg) { super(msg); this.name = 'NotFoundError'; } }
class AmbiguousError extends Error { constructor(msg) { super(msg); this.name = 'AmbiguousError'; } }
class NetworkError extends Error { constructor(msg) { super(msg); this.name = 'NetworkError'; } }
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

        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const points = [];

        for (let i = 0; i < lines.length; i += 3) {
            const jdLine = lines[i];
            const xyzLine = lines[i + 1];
            if (!jdLine || !xyzLine) break;

            const jdMatch = jdLine.match(/^([\d.]+)\s*=\s*A\.D\.\s*(\d{4}-\w{3}-\d{2})/);
            if (!jdMatch) continue;

            const jd = parseFloat(jdMatch[1]);
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
                au: { x: auX, y: auY, z: auZ },
                wx: auX * AU_TO_PX,
                wy: auY * AU_TO_PX,
                wz: auZ * AU_TO_PX,
                camera: null,
                description: null,
                image: null,
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
    let _designation = '';
    let _points = [];
    let _isUpdateMode = false;
    let _createdAt = null;
    let _source = 'JPL Horizons VECTORS';
    let _defaultSpeedMultiplier;

    function init(designation, points) {
        _designation = designation;
        _points = points;
        _isUpdateMode = false;
        _createdAt = null;
        _source = 'JPL Horizons VECTORS';
        _defaultSpeedMultiplier = undefined;
    }

    function initFromSaved(designation, points, createdAt, options = {}) {
        _designation = designation;
        _points = points;
        _isUpdateMode = true;
        _createdAt = createdAt || null;
        _source = options.source || 'JPL Horizons VECTORS';
        _defaultSpeedMultiplier = options.defaultSpeedMultiplier;
    }

    function getPoints() { return _points; }
    function getDesignation() { return _designation; }
    function getPoint(i) { return _points[i] || null; }
    function isUpdateMode() { return _isUpdateMode; }
    function getCreatedAt() { return _createdAt; }

    function savedCount() {
        return _points.filter(p => p.camera !== null).length;
    }

    function allSaved() {
        return _points.length > 0 && _points.every(p => p.camera !== null);
    }

    function saveCamera(index, cameraState) {
        if (_points[index]) _points[index].camera = normalizeCameraState(cameraState);
    }

    function saveDescription(index, text) {
        if (_points[index]) _points[index].description = (text || '').trim() || null;
    }

    function saveImage(index, file) {
        if (_points[index]) _points[index].image = file;
    }

    function saveDurationPct(index, val) {
        if (_points[index]) {
            const n = Math.round(val);
            _points[index].durationPct = (isNaN(n) || n < 1) ? 100 : Math.min(n, 1000);
        }
    }

    function saveStoppable(index, val) {
        if (_points[index]) _points[index].stoppable = Boolean(val);
    }

    function saveObjectPosition(index, nextAu) {
        const point = _points[index];
        if (!point) return;
        const au = normalizeAuPosition(nextAu);
        point.au = au;
        point.wx = au.x * AU_TO_PX;
        point.wy = au.y * AU_TO_PX;
        point.wz = au.z * AU_TO_PX;
    }

    function deletePoint(index) {
        if (index < 0 || index >= _points.length) return null;
        return _points.splice(index, 1)[0] || null;
    }

    function toPlainObject() {
        const now = new Date().toISOString();
        const pts = _points;
        const plain = {
            object: _designation,
            designation: _designation,
            createdAt: _createdAt || now,
            updatedAt: now,
            source: _source || 'JPL Horizons VECTORS',
            dateRange: pts.length ? `${pts[0].date} \u2192 ${pts[pts.length - 1].date}` : '',
            scale: { auToPx: AU_TO_PX },
            // Preserve arbitrary per-point metadata such as color, video, and
            // future fields while still canonicalizing the core trajectory keys.
            points: pts.map((p, i) => {
                const {
                    jd,
                    date,
                    au,
                    wx,
                    wy,
                    wz,
                    camera,
                    description,
                    image,
                    durationPct,
                    stoppable,
                    ...extraFields
                } = p;

                return {
                    ...extraFields,
                    jd,
                    date,
                    au,
                    px: {
                        wx,
                        wy,
                        wz,
                    },
                    durationPct: durationPct ?? 100,
                    stoppable: stoppable ?? false,
                    camera: normalizeCameraState(camera),
                    description,
                    image: image instanceof File ? image.name : image,
                };
            }),
        };
        if (_defaultSpeedMultiplier != null) {
            plain.defaultSpeedMultiplier = _defaultSpeedMultiplier;
        }
        return plain;
    }

    return {
        init, initFromSaved,
        getPoints, getDesignation, getPoint,
        isUpdateMode, getCreatedAt,
        savedCount, allSaved,
        saveCamera, saveDescription, saveImage, saveDurationPct, saveStoppable, saveObjectPosition, deletePoint,
        toPlainObject,
    };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: WorkflowController
// ─────────────────────────────────────────────────────────────

const WorkflowController = (() => {
    let _currentIndex = 0;
    let _hasUnsavedChanges = false;
    let _hasSavedFile = false;

    function start(points) {
        _currentIndex = 0;
        _hasUnsavedChanges = false;
        _hasSavedFile = false;
    }

    function getCurrent() { return _currentIndex; }

    function hasUnsavedChanges() { return _hasUnsavedChanges; }
    function setUnsavedChanges(val) { _hasUnsavedChanges = Boolean(val); }
    function hasSavedFile() { return _hasSavedFile; }
    function setHasSavedFile(val) { _hasSavedFile = Boolean(val); }

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

    function adjustAfterDelete(deletedIndex, remainingCount) {
        if (remainingCount <= 0) {
            _currentIndex = 0;
            return -1;
        }
        if (_currentIndex > deletedIndex) {
            _currentIndex -= 1;
        } else if (_currentIndex >= remainingCount) {
            _currentIndex = remainingCount - 1;
        }
        return _currentIndex;
    }

    return {
        start, getCurrent, advanceToNextUnsaved, goTo, adjustAfterDelete,
        hasUnsavedChanges, setUnsavedChanges,
        hasSavedFile, setHasSavedFile,
    };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: ObjectMarker  (Story 2.6)
// Canvas layer that draws a pulsing dot at the active point.
// Registered with SolarSystem.layers.register('object-marker', fn).
// ─────────────────────────────────────────────────────────────

const ObjectMarker = (() => {
    let _point = null;
    let _name = '';
    let _frame = 0;

    function setPoint(point, name) {
        _point = point;
        _name = name || '';
    }

    function draw() {
        if (!_point) return;
        _frame++;

        const { sx, sy, depth } = project3(_point.wx, _point.wy, _point.wz);

        const onScreen = sx >= 0 && sx <= canvas.width && sy >= 0 && sy <= canvas.height;

        if (!onScreen) {
            _drawOffScreenArrow(sx, sy);
            return;
        }

        if (depth < 10) return;

        // Outer pulsing ring (10–14 px, ~60-frame cycle)
        const pulse = 10 + 4 * (0.5 + 0.5 * Math.sin(_frame * Math.PI / 30));
        ctx.beginPath();
        ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(120,255,200,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner filled dot
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,255,200,1.0)';
        ctx.fill();

        // Label above the dot
        const label = `${_point.date} \u00B7 ${_name}`;
        ctx.font = '11px Georgia';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(200,235,255,0.9)';
        ctx.fillText(label, sx, sy - 18);
    }

    function _drawOffScreenArrow(sx, sy) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const dx = sx - cx;
        const dy = sy - cy;
        const angle = Math.atan2(dy, dx);

        const margin = 24;
        // Use a wider right margin when the sidebar is open so the arrow is never hidden behind it
        const sidebarEl = document.getElementById('om-sidebar');
        const rightMargin = (sidebarEl && sidebarEl.classList.contains('visible')) ? 268 : margin;
        let ex, ey;
        if (Math.abs(dx) * canvas.height >= Math.abs(dy) * canvas.width) {
            ex = dx > 0 ? canvas.width - rightMargin : margin;
            ey = cy + (ex - cx) * (dy / (dx || 0.001));
        } else {
            ey = dy > 0 ? canvas.height - margin : margin;
            ex = cx + (ey - cy) * (dx / (dy || 0.001));
        }
        ey = Math.max(margin, Math.min(canvas.height - margin, ey));
        ex = Math.max(margin, Math.min(canvas.width - rightMargin, ex));

        // Equilateral triangle arrow (10 px)
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -6);
        ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.fillStyle = 'rgba(120,255,200,1.0)';
        ctx.fill();
        ctx.restore();

        const label = `${_point.date} \u00B7 ${_name}`;
        ctx.font = '11px Georgia';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(200,235,255,0.9)';
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
    let _onDelete = null;

    function setNavigateCallback(fn) { _onNavigate = fn; }
    function setDeleteCallback(fn) { _onDelete = fn; }

    function render(points, activeIndex) {
        const list = document.getElementById('om-point-list');
        const summary = document.getElementById('om-sidebar-summary');
        if (!list || !summary) return;

        const saved = points.filter(p => p.camera !== null).length;
        summary.textContent = `${saved} of ${points.length} saved`;

        list.innerHTML = '';

        points.forEach((p, i) => {
            const row = document.createElement('div');
            row.className = 'om-point-row' + (i === activeIndex ? ' active' : '');
            row.dataset.index = i;
            row.setAttribute('role', 'listitem');

            // Row number
            const num = document.createElement('span');
            num.className = 'om-row-num';
            num.textContent = i + 1;

            // Thumbnail
            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'om-row-thumb-wrap';
            _buildThumb(p, thumbWrap);

            // Date
            const dateEl = document.createElement('span');
            dateEl.className = 'om-row-date';
            dateEl.textContent = formatTrajDate(p.date);

            // Save badge
            const badge = document.createElement('span');
            badge.className = 'om-row-badge ' + (p.camera !== null ? 'saved' : 'pending');
            badge.textContent = p.camera !== null ? '\u2713' : '\u00B7';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'om-row-delete';
            deleteBtn.textContent = '\u2715';
            deleteBtn.title = `Delete point ${i + 1}`;
            deleteBtn.setAttribute('aria-label', `Delete point ${i + 1} (${formatTrajDate(p.date)})`);
            deleteBtn.addEventListener('click', e => {
                e.stopPropagation();
                if (_onDelete) _onDelete(i);
            });

            row.append(num, thumbWrap, dateEl, badge, deleteBtn);
            row.addEventListener('click', () => { if (_onNavigate) _onNavigate(i); });
            list.appendChild(row);
        });
    }

    function setActive(index) {
        const rows = document.querySelectorAll('.om-point-row');
        rows.forEach((row, i) => row.classList.toggle('active', i === index));

        const activeRow = document.querySelector('.om-point-row.active');
        if (activeRow) activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

        const points = TrajectoryStore.getPoints();
        const saved = points.filter(p => p.camera !== null).length;
        const summary = document.getElementById('om-sidebar-summary');
        if (summary) summary.textContent = `${saved} of ${points.length} saved`;
    }

    function updateRowBadge(index) {
        const rows = document.querySelectorAll('.om-point-row');
        const row = rows[index];
        if (!row) return;
        const badge = row.querySelector('.om-row-badge');
        if (!badge) return;
        const p = TrajectoryStore.getPoint(index);
        if (!p) return;
        badge.className = 'om-row-badge ' + (p.camera !== null ? 'saved' : 'pending');
        badge.textContent = p.camera !== null ? '\u2713' : '\u00B7';
    }

    function updateRowThumb(index, url) {
        const rows = document.querySelectorAll('.om-point-row');
        const row = rows[index];
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
            const img = document.createElement('img');
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

    return { setNavigateCallback, setDeleteCallback, render, setActive, updateRowBadge, updateRowThumb };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: MediaAnnotator  (Story 2.9)
// Handles image upload, preview in the annotation panel,
// and thumbnail updates in the sidebar.
// ─────────────────────────────────────────────────────────────

const MediaAnnotator = (() => {
    const _MIME_EXT = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
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

    function removePoint(pointIndex) {
        const shiftedUrls = {};

        Object.keys(_objectUrls).forEach(key => {
            const idx = Number(key);
            const url = _objectUrls[idx];
            if (idx === pointIndex) {
                URL.revokeObjectURL(url);
                return;
            }
            shiftedUrls[idx > pointIndex ? idx - 1 : idx] = url;
        });

        Object.keys(_objectUrls).forEach(key => delete _objectUrls[key]);
        Object.assign(_objectUrls, shiftedUrls);
    }

    /** Populate the annotation panel for the given point index. */
    function loadAnnotationPanel(pointIndex) {
        const p = TrajectoryStore.getPoint(pointIndex);
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
        const preview = document.getElementById('om-img-preview');
        const previewWrap = document.getElementById('om-img-preview-wrap');
        const btn = document.getElementById('om-img-btn');
        if (preview) preview.src = url;
        if (previewWrap) previewWrap.style.display = 'flex';
        if (btn) btn.style.display = 'none';
    }

    function _hidePreview() {
        const preview = document.getElementById('om-img-preview');
        const previewWrap = document.getElementById('om-img-preview-wrap');
        const btn = document.getElementById('om-img-btn');
        if (preview) preview.src = '';
        if (previewWrap) previewWrap.style.display = 'none';
        if (btn) btn.style.display = '';
    }

    function _updateSizeWarning(file) {
        const warnEl = document.getElementById('om-img-warn');
        if (!warnEl) return;
        if (file.size > 5 * 1024 * 1024) {
            const mb = (file.size / (1024 * 1024)).toFixed(1);
            warnEl.textContent = `Large image (${mb} MB) — this will increase your saved data size.`;
            warnEl.style.display = '';
        } else {
            warnEl.style.display = 'none';
        }
    }

    return { handleImageUpload, clearImage, removePoint, loadAnnotationPanel };
})();


// ─────────────────────────────────────────────────────────────
// MODULE: FileIO  (Story 2.12)
// JSON serialisation, browser download, File System Access API.
// ─────────────────────────────────────────────────────────────

const FileIO = (() => {
    const _MIME_EXT = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
    };

    /**
     * Serialise TrajectoryStore to the canonical JSON schema.
     * Camera values are rounded to 2 decimal places.
     * AU coordinates are stored at full precision.
     * Image filename strings are injected for points with File objects.
     */
    function serialize(store) {
        const plain = store.toPlainObject();
        const pts = store.getPoints();

        plain.points.forEach((p, i) => {
            // Round camera to 2 dp
            if (p.camera) {
                p.camera = {
                    el: _round2(p.camera.el),
                    az: _round2(p.camera.az),
                    zoom: _round2(p.camera.zoom),
                    tx: _round2(p.camera.tx ?? 0),
                    ty: _round2(p.camera.ty ?? 0),
                    tz: _round2(p.camera.tz ?? 0),
                };
            }
            // Ensure durationPct is a valid integer, stoppable is boolean
            p.durationPct = Math.round(p.durationPct ?? 100);
            p.stoppable = Boolean(p.stoppable);
            // Resolve image filename
            const raw = pts[i]?.image;
            if (raw instanceof File) {
                const ext = _MIME_EXT[raw.type] || '.bin';
                p.image = `point_${i}${ext}`;
            }
        });

        return plain;
    }

    /** Download trajectory.json + all image files via programmatic <a> click. */
    function download(json, points) {
        const jsonText = JSON.stringify(json, null, 2);
        _triggerDownload(
            new Blob([jsonText], { type: 'application/json' }),
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
                const ext = _MIME_EXT[p.image.type] || '.bin';
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
        const a = Object.assign(document.createElement('a'), { href: url, download: filename });
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

function normalizeRequestedSource(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return (normalized === 'local' || normalized === 'web') ? normalized : '';
}

let objectMotionSource = '';

function syncObjectMotionUrl(designation, source = objectMotionSource) {
    const value = (designation || '').trim();
    if (!value || !window.history?.replaceState) return;
    const params = new URLSearchParams({ designation: value });
    const normalizedSource = normalizeRequestedSource(source);
    objectMotionSource = normalizedSource;
    if (normalizedSource) params.set('source', normalizedSource);
    params.set('lang', objectMotionLocale);
    window.history.replaceState(null, '', `object_motion?${params.toString()}`);
}

function normalizeCameraState(camera) {
    if (!camera) return null;
    return {
        ...camera,
        tx: Number(camera.tx ?? 0),
        ty: Number(camera.ty ?? 0),
        tz: Number(camera.tz ?? 0),
    };
}

function normalizeAuPosition(position) {
    return {
        x: Number(position?.x ?? 0) || 0,
        y: Number(position?.y ?? 0) || 0,
        z: Number(position?.z ?? 0) || 0,
    };
}

function worldToAuPosition(position) {
    return normalizeAuPosition({
        x: Number(position?.wx ?? 0) / AU_TO_PX,
        y: Number(position?.wy ?? 0) / AU_TO_PX,
        z: Number(position?.wz ?? 0) / AU_TO_PX,
    });
}

const MoreInfoHelpers = window.MoreInfoShared || {};
const APP_CONFIG = window.AppConfigShared?.readAppConfig?.(window.AppConfig) || { useLocalStorage: false };
const objectMotionTranslations = window.AppTranslations || {};
const objectMotionLocale = objectMotionTranslations.getLocaleFromSearch?.(window.location.search) || 'en';
const objectMotionUrlParams = new URLSearchParams(window.location.search);

objectMotionSource = normalizeRequestedSource(objectMotionUrlParams.get('source') || objectMotionUrlParams.get('s'));

objectMotionTranslations.setDocumentLocale?.(objectMotionLocale);

function ot(name, fallback = '', params = null) {
    const sourceText = fallback || (typeof name === 'string' ? name : '');
    return objectMotionTranslations.translate?.(sourceText, {
        locale: objectMotionLocale,
        params,
        fallback: sourceText,
    }) || sourceText;
}

function isLocalStorageEnabled() {
    return APP_CONFIG.useLocalStorage && typeof window.localStorage !== 'undefined';
}

function resolveStep(dropdownEl, customEl) {
    const custom = (customEl.value || '').trim();
    return custom || dropdownEl.value;
}

const _MONTH_ABBR = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};
const _MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    const designationEl = document.getElementById('om-designation');
    const searchBtn = document.getElementById('om-search-btn');
    const statusEl = document.getElementById('om-status');

    const draftCard = document.getElementById('om-draft-card');
    const draftCardMsg = document.getElementById('om-draft-card-msg');
    const resumeBtn = document.getElementById('om-resume-btn');
    const startFreshBtn = document.getElementById('om-start-fresh-btn');

    const jsonUploadInput = document.getElementById('om-json-upload-input');
    const jsonUploadBtn = document.getElementById('om-json-upload-btn');
    const jsonUploadName = document.getElementById('om-json-upload-name');

    const dateSection = document.getElementById('om-date-section');
    const startDateEl = document.getElementById('om-start-date');
    const endDateEl = document.getElementById('om-end-date');
    const stepDropdownEl = document.getElementById('om-step-dropdown');
    const stepCustomEl = document.getElementById('om-step-custom');
    const validationMsg = document.getElementById('om-validation-msg');
    const fetchBtn = document.getElementById('om-fetch-btn');

    const formOverlay = document.getElementById('om-form-overlay');
    const viewerControls = document.getElementById('om-viewer-controls');
    const newSearchBtn = document.getElementById('om-new-search-btn');

    const sidebar = document.getElementById('om-sidebar');
    const savePointBtn = document.getElementById('om-save-point-btn');
    const saveFileBtn = document.getElementById('om-save-file-btn');
    const saveDirBtn = document.getElementById('om-save-dir-btn');
    const viewerStatus = document.getElementById('om-viewer-status');
    const saveFileModal = document.getElementById('om-save-file-modal');
    const saveFileJsonEl = document.getElementById('om-save-file-json');
    const saveFileStatusEl = document.getElementById('om-save-file-status');
    const saveFileCopyBtn = document.getElementById('om-save-file-copy');
    const saveFileDownloadBtn = document.getElementById('om-save-file-download');
    const saveFileCloseBtn = document.getElementById('om-save-file-close');
    const imgInput = document.getElementById('om-img-input');
    const imgBtn = document.getElementById('om-img-btn');
    const imgRemoveBtn = document.getElementById('om-img-remove');
    const dropZone = document.getElementById('om-drop-zone');

    // Story 2.14
    const durationPctEl = document.getElementById('om-duration-pct');
    const stoppableEl = document.getElementById('om-stoppable');
    const settingsBtn = document.getElementById('om-settings-btn');
    const settingsModal = document.getElementById('om-settings-modal');
    const settingsAuXEl = document.getElementById('om-settings-au-x');
    const settingsAuYEl = document.getElementById('om-settings-au-y');
    const settingsAuZEl = document.getElementById('om-settings-au-z');
    const settingsErrorEl = document.getElementById('om-settings-error');
    const settingsApplyBtn = document.getElementById('om-settings-apply');
    const settingsCloseBtn = document.getElementById('om-settings-modal-close');

    // Story 2.15
    const playVideoBtn = document.getElementById('om-play-video-btn');
    const playConfirmModal = document.getElementById('om-play-confirm-modal');
    const playConfirmMsg = document.getElementById('om-play-confirm-msg');
    const playSaveFirstBtn = document.getElementById('om-play-save-first-btn');
    const playAnywayBtn = document.getElementById('om-play-anyway-btn');

    const moreInfoBtn = document.getElementById('om-more-info-btn');
    const moreInfoModal = document.getElementById('om-more-info-modal');
    let moreInfoModalController = null;
    try {
        if (window.MoreInfoModalShared?.createModalController && moreInfoModal) {
            moreInfoModalController = window.MoreInfoModalShared.createModalController(
                moreInfoModal,
                { title: ot('ui.objectMotion.moreInfoTitle', 'Point More Info') }
            );
        }
    } catch (error) {
        console.error('[object_motion] More Info modal bootstrap failed:', error);
        moreInfoModalController = null;
    }

    function applyObjectMotionPageText() {
        document.title = `${ot('ui.objectMotion.pageTitle', 'Object Motion Tracker')} · 3I/ATLAS`;
        const backLink = document.getElementById('om-back-link');
        const titleEl = document.getElementById('om-title');
        const subtitleEl = document.getElementById('om-subtitle');

        if (backLink) {
            backLink.textContent = ot('ui.objectMotion.backToProjects', '← Projects');
            backLink.href = objectMotionTranslations.withLangParam?.('index.html', objectMotionLocale) || 'index.html';
        }
        if (titleEl) titleEl.textContent = ot('ui.objectMotion.pageTitle', 'Object Motion Tracker');
        if (subtitleEl) subtitleEl.textContent = ot('ui.objectMotion.subtitle', 'Fetch & annotate a heliocentric trajectory');
    }

    applyObjectMotionPageText();

    // ── Form status helpers ───────────────────────────────────

    function setStatus(mode, text) {
        statusEl.style.display = '';
        statusEl.className = mode;
        statusEl.textContent = text;
    }

    function clearStatus() {
        statusEl.className = '';
        statusEl.textContent = '';
        statusEl.style.display = 'none';
    }

    // ── Viewer status helpers ─────────────────────────────────

    function setViewerStatus(mode, text) {
        if (!viewerStatus) return;
        viewerStatus.className = mode;
        viewerStatus.textContent = text;
    }

    function clearViewerStatus() {
        if (!viewerStatus) return;
        viewerStatus.className = '';
        viewerStatus.textContent = '';
        viewerStatus.style.display = 'none';
    }

    function setSaveFileStatus(mode, text) {
        if (!saveFileStatusEl) return;
        saveFileStatusEl.className = mode;
        saveFileStatusEl.textContent = text;
    }

    function clearSaveFileStatus() {
        if (!saveFileStatusEl) return;
        saveFileStatusEl.className = '';
        saveFileStatusEl.textContent = '';
    }

    let pendingSavePayload = null;

    function closeSaveFileModal() {
        if (!saveFileModal) return;
        saveFileModal.classList.remove('visible');
        clearSaveFileStatus();
        pendingSavePayload = null;
    }

    function openSaveFileModal(options = {}) {
        if (!saveFileModal || !saveFileJsonEl) return;
        const {
            json = null,
            points = [],
            onSaved = null,
        } = options;
        if (!json) return;
        saveFileJsonEl.value = JSON.stringify(json, null, 2);
        saveFileJsonEl.scrollTop = 0;
        saveFileJsonEl.setSelectionRange?.(0, 0);
        pendingSavePayload = { json, points, onSaved };
        clearSaveFileStatus();
        saveFileModal.classList.add('visible');
    }

    function finalizeFileSave(json, points, onSaved = null) {
        const imgCount = FileIO.download(json, points);
        const shouldDelayDraftClear = typeof onSaved === 'function';
        WorkflowController.setHasSavedFile(true);
        WorkflowController.setUnsavedChanges(false);
        setViewerStatus(
            'success',
            `Saved \u2014 ${points.length} points \u00B7 ${imgCount} image${imgCount !== 1 ? 's' : ''} \u00B7 trajectory.json`
        );
        closeSaveFileModal();
        if (typeof onSaved === 'function') onSaved();
        if (shouldDelayDraftClear) {
            window.setTimeout(() => _clearDraft(), 4000);
        } else {
            _clearDraft();
        }
    }

    function pointHasMoreInfo(point) {
        if (typeof MoreInfoHelpers.hasMoreInfoContent === 'function') {
            return MoreInfoHelpers.hasMoreInfoContent(point, TrajectoryStore.getDesignation());
        }
        return false;
    }

    function syncMoreInfoButton(point) {
        if (!moreInfoBtn) return;
        moreInfoBtn.classList.toggle('visible', pointHasMoreInfo(point));
    }

    function closeMoreInfoModal() {
        moreInfoModalController?.hide();
    }

    function clearSettingsError() {
        if (!settingsErrorEl) return;
        settingsErrorEl.textContent = '';
        settingsErrorEl.classList.remove('visible');
    }

    function setSettingsError(message) {
        if (!settingsErrorEl) return;
        settingsErrorEl.textContent = message;
        settingsErrorEl.classList.add('visible');
    }

    function populateSettingsForm(index) {
        const point = TrajectoryStore.getPoint(index);
        const au = point?.au ? normalizeAuPosition(point.au) : worldToAuPosition(point);
        if (settingsAuXEl) settingsAuXEl.value = String(au.x);
        if (settingsAuYEl) settingsAuYEl.value = String(au.y);
        if (settingsAuZEl) settingsAuZEl.value = String(au.z);
        clearSettingsError();
    }

    function applySettingsForm(closeOnSuccess = true) {
        const index = WorkflowController.getCurrent();
        const point = TrajectoryStore.getPoint(index);
        if (!point) return false;

        const rawValues = [
            String(settingsAuXEl?.value ?? '').trim(),
            String(settingsAuYEl?.value ?? '').trim(),
            String(settingsAuZEl?.value ?? '').trim(),
        ];

        if (rawValues.some(value => value === '')) {
            setSettingsError('Enter numeric X, Y, and Z values before applying the point position.');
            return false;
        }

        const nextAu = {
            x: Number(rawValues[0]),
            y: Number(rawValues[1]),
            z: Number(rawValues[2]),
        };

        if (![nextAu.x, nextAu.y, nextAu.z].every(Number.isFinite)) {
            setSettingsError('Enter numeric X, Y, and Z values before applying the point position.');
            return false;
        }

        if ([nextAu.x, nextAu.y, nextAu.z].some(value => Math.abs(value) > MAX_OBJECT_POSITION_AU)) {
            setSettingsError(`Object position values must stay within ±${MAX_OBJECT_POSITION_AU} AU.`);
            return false;
        }

        TrajectoryStore.saveObjectPosition(index, nextAu);
        ObjectMarker.setPoint(TrajectoryStore.getPoint(index), TrajectoryStore.getDesignation());
        WorkflowController.setUnsavedChanges(true);
        _saveDraft();
        clearSettingsError();
        setViewerStatus('success', `Updated object position for point ${index + 1}.`);
        if (closeOnSuccess) settingsModal.classList.remove('visible');
        return true;
    }

    function openMoreInfoModal() {
        const point = TrajectoryStore.getPoint(WorkflowController.getCurrent());
        if (!pointHasMoreInfo(point) || !moreInfoModalController) return;
        moreInfoModalController.show({
            point,
            designation: TrajectoryStore.getDesignation(),
            dateText: formatTrajDate(point?.date),
        });
    }

    // ── UI state helpers ─────────────────────────────────────

    function hideDraftCard() { draftCard.classList.remove('visible'); }

    function showDraftCard(designation, savedCount, total) {
        if (!isLocalStorageEnabled()) return;
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
        hideDraftCard();
        hideDateSection();
        clearStatus();
    }

    // ── Viewer activation / deactivation ─────────────────────

    function activateViewer(points) {
        // Story 2.15: a saved file exists when entering Update Mode
        if (TrajectoryStore.isUpdateMode()) {
            WorkflowController.setHasSavedFile(true);
        }

        if (window.SolarSystem) {
            SolarSystem.engine.pause();
            SolarSystem.engine.setDate(parseTrajDate(points[0].date));
            const pauseBtn = document.getElementById('ss-pause');
            if (pauseBtn) pauseBtn.textContent = '\u25B6 Play';
        }

        formOverlay.style.display = 'none';
        viewerControls.style.display = 'block';
        viewerControls.removeAttribute('aria-hidden');

        // Sidebar + marker setup
        ProgressPanel.setNavigateCallback(navigateToPoint);
        ProgressPanel.setDeleteCallback(deletePoint);
        const idx = WorkflowController.getCurrent();
        ProgressPanel.render(points, idx);

        ObjectMarker.setPoint(points[idx], TrajectoryStore.getDesignation());
        if (window.SolarSystem) {
            SolarSystem.layers.register('object-marker', () => ObjectMarker.draw());
            SolarSystem.layers.toggle('object-marker', true);
        }

        sidebar.classList.add('visible');
        MediaAnnotator.loadAnnotationPanel(idx);
        syncMoreInfoButton(points[idx]);
        populateSettingsForm(idx);
        updateCounter();
        updateSaveButtons();

        // Expose File System Access API save button if available
        if (typeof window.showDirectoryPicker === 'function') {
            if (saveDirBtn) saveDirBtn.style.display = '';
        }

        // Apply camera LAST — after all setup — so it is not overridden by _init().
        // If the starting point has a saved camera, restore it; otherwise snap to
        // top-down so the object is always in view when the editor first opens.
        if (window.SolarSystem) {
            const startCam = points[idx]?.camera;
            if (startCam) {
                SolarSystem.camera.setRawState(startCam);
                console.log('[PAN] activateViewer: applied camera for pt', idx,
                    '| tx:', startCam.tx, 'ty:', startCam.ty, 'tz:', startCam.tz,
                    '| "tx" in cam:', 'tx' in startCam);
            } else {
                SolarSystem.camera.setPreset('topdown');
                aEl = 89;
                console.log('[PAN] activateViewer: no camera for pt', idx, '— using topdown');
            }
        }
    }

    function deactivateViewer() {
        if (window.SolarSystem) SolarSystem.layers.toggle('object-marker', false);
        sidebar.classList.remove('visible');
        viewerControls.style.display = 'none';
        viewerControls.setAttribute('aria-hidden', 'true');
        formOverlay.style.display = '';
        syncMoreInfoButton(null);
        closeMoreInfoModal();
        clearViewerStatus();
    }

    newSearchBtn.addEventListener('click', deactivateViewer);

    // ── Navigate to a point ───────────────────────────────────

    function navigateToPoint(index) {
        const pts = TrajectoryStore.getPoints();
        const p = pts[index];
        if (!p) return;

        WorkflowController.goTo(index);
        ObjectMarker.setPoint(p, TrajectoryStore.getDesignation());

        if (window.SolarSystem) {
            SolarSystem.engine.setDate(parseTrajDate(p.date));
            if (p.camera) {
                SolarSystem.camera.setRawState(p.camera);
                console.log('[PAN] navigateToPoint:', index,
                    '| tx:', p.camera.tx, 'ty:', p.camera.ty, 'tz:', p.camera.tz,
                    '| "tx" in cam:', 'tx' in p.camera);
            } else {
                console.log('[PAN] navigateToPoint:', index, '— no camera saved for this point');
            }
        }

        ProgressPanel.setActive(index);
        MediaAnnotator.loadAnnotationPanel(index);
        syncMoreInfoButton(p);
        populateSettingsForm(index);

        // Story 2.14: reflect saved (or default) duration & stoppable
        if (durationPctEl) durationPctEl.value = p.durationPct ?? 100;
        if (stoppableEl) stoppableEl.checked = p.stoppable ?? false;

        updateCounter();
        clearViewerStatus();
    }

    function deletePoint(index) {
        const point = TrajectoryStore.getPoint(index);
        if (!point) return;

        MediaAnnotator.removePoint(index);
        TrajectoryStore.deletePoint(index);

        const remaining = TrajectoryStore.getPoints().length;
        WorkflowController.adjustAfterDelete(index, remaining);
        WorkflowController.setUnsavedChanges(true);

        if (remaining <= 0) {
            ObjectMarker.setPoint(null, TrajectoryStore.getDesignation());
            _clearDraft();
            closeMoreInfoModal();
            deactivateViewer();
            setStatus('success', 'All points deleted from the draft.');
            return;
        }

        const nextIndex = WorkflowController.getCurrent();
        ProgressPanel.render(TrajectoryStore.getPoints(), nextIndex);
        navigateToPoint(nextIndex);
        updateSaveButtons();
        _saveDraft();
        setViewerStatus('success', `Deleted point ${index + 1}.`);
    }

    // ── Counter + save-button state ───────────────────────────

    function updateCounter() {
        const pts = TrajectoryStore.getPoints();
        const idx = WorkflowController.getCurrent();
        const counter = document.getElementById('om-point-counter');
        if (counter) counter.textContent = `Point ${idx + 1} of ${pts.length}`;
    }

    function updateSaveButtons() {
        const anySaved = TrajectoryStore.savedCount() > 0;
        const allDone = TrajectoryStore.allSaved();
        const msg = document.getElementById('om-all-saved-msg');
        if (msg) msg.style.display = allDone ? '' : 'none';
        if (saveFileBtn) saveFileBtn.classList.toggle('enabled', anySaved);
        if (saveDirBtn) saveDirBtn.classList.toggle('enabled', anySaved);
        if (playVideoBtn) playVideoBtn.classList.toggle('enabled', anySaved);
    }

    // ── Save current point (Story 2.8) ────────────────────────

    function saveCurrentPoint() {
        const pts = TrajectoryStore.getPoints();
        const idx = WorkflowController.getCurrent();
        const cam = normalizeCameraState(
            (window.SolarSystem) ? SolarSystem.camera.getRawState() : { el: 5, az: 0, zoom: 0 }
        );
        console.log('[PAN] saveCurrentPoint: pt', idx,
            '| tx:', cam.tx, 'ty:', cam.ty, 'tz:', cam.tz,
            '| "tx" in cam:', 'tx' in cam,
            '| full cam:', JSON.stringify(cam));
        TrajectoryStore.saveCamera(idx, cam);

        const textarea = document.getElementById('om-description');
        TrajectoryStore.saveDescription(idx, textarea ? textarea.value : '');

        // Story 2.14: capture duration and stoppable
        const durVal = parseInt(durationPctEl ? durationPctEl.value : '100', 10);
        TrajectoryStore.saveDurationPct(idx, isNaN(durVal) ? 100 : durVal);
        TrajectoryStore.saveStoppable(idx, stoppableEl ? stoppableEl.checked : false);

        // Story 2.15: mark unsaved changes since last file save
        WorkflowController.setUnsavedChanges(true);

        // Auto-save draft to localStorage (Story 2.11)
        _saveDraft();

        // Update sidebar badge for the just-saved row and refresh UI in place
        ProgressPanel.updateRowBadge(idx);
        ProgressPanel.setActive(idx);
        updateCounter();
        updateSaveButtons();
    }

    savePointBtn.addEventListener('click', saveCurrentPoint);

    // Keyboard shortcut: Space or Enter when no input is focused
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && moreInfoModal?.classList.contains('visible')) {
            closeMoreInfoModal();
            return;
        }
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
        const json = FileIO.serialize(TrajectoryStore);
        openSaveFileModal({
            json,
            points: TrajectoryStore.getPoints(),
        });
    });

    if (saveDirBtn) {
        saveDirBtn.addEventListener('click', async () => {
            if (!saveDirBtn.classList.contains('enabled')) return;
            const name = sanitize(TrajectoryStore.getDesignation());
            const points = TrajectoryStore.getPoints();
            const json = FileIO.serialize(TrajectoryStore);
            try {
                const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                const imgCount = await FileIO.saveToDirectory(dirHandle, name, json, points);
                _clearDraft();
                WorkflowController.setHasSavedFile(true);
                WorkflowController.setUnsavedChanges(false);
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

    // ── Settings modal (Story 2.14) ───────────────────────────

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            populateSettingsForm(WorkflowController.getCurrent());
            settingsModal.classList.add('visible');
        });
    }
    if (settingsApplyBtn) {
        settingsApplyBtn.addEventListener('click', () => {
            applySettingsForm(true);
        });
    }
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', () => {
            settingsModal.classList.remove('visible');
            clearSettingsError();
        });
    }
    if (settingsModal) {
        settingsModal.addEventListener('click', e => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('visible');
                clearSettingsError();
            }
        });
    }

    // ── Play Video button & confirm modal (Story 2.15) ────────

    function _openPlayer(sourceOverride = '') {
        const designation = (TrajectoryStore.getDesignation() || '').trim() || '3I';
        const source = normalizeRequestedSource(sourceOverride)
            || normalizeRequestedSource(objectMotionSource)
            || 'local';
        const params = new URLSearchParams({ designation, source, lang: objectMotionLocale });
        window.open(`trajectory_player?${params.toString()}`, '_blank');
    }

    if (playVideoBtn) {
        playVideoBtn.addEventListener('click', () => {
            if (!playVideoBtn.classList.contains('enabled')) return;

            if (!WorkflowController.hasSavedFile()) {
                playConfirmMsg.textContent =
                    "This trajectory hasn\u2019t been saved to file yet. Save it first so the player can load it.";
                if (playAnywayBtn) playAnywayBtn.style.display = 'none';
                playConfirmModal.classList.add('visible');
            } else if (WorkflowController.hasUnsavedChanges()) {
                playConfirmMsg.textContent =
                    "Your latest annotations haven\u2019t been saved to file yet. The player will show the last saved version.";
                if (playAnywayBtn) playAnywayBtn.style.display = '';
                playConfirmModal.classList.add('visible');
            } else {
                _openPlayer();
            }
        });
    }

    if (playSaveFirstBtn) {
        playSaveFirstBtn.addEventListener('click', () => {
            playConfirmModal.classList.remove('visible');
            if (!saveFileBtn.classList.contains('enabled')) return;
            openSaveFileModal({
                json: FileIO.serialize(TrajectoryStore),
                points: TrajectoryStore.getPoints(),
                onSaved: () => {
                    if (!isLocalStorageEnabled()) {
                        setViewerStatus(
                            'success',
                            'Saved to file. To play this updated version, use Save to Project Folder while local drafts are disabled.'
                        );
                        return;
                    }
                    _openPlayer('local');
                },
            });
        });
    }

    if (playAnywayBtn) {
        playAnywayBtn.addEventListener('click', () => {
            playConfirmModal.classList.remove('visible');
            _openPlayer();
        });
    }

    if (playConfirmModal) {
        playConfirmModal.addEventListener('click', e => {
            if (e.target === playConfirmModal) playConfirmModal.classList.remove('visible');
        });
    }

    if (saveFileCopyBtn) {
        saveFileCopyBtn.addEventListener('click', async () => {
            if (!saveFileJsonEl) return;
            const text = saveFileJsonEl.value || '';
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    saveFileJsonEl.focus();
                    saveFileJsonEl.select();
                    const copied = document.execCommand('copy');
                    saveFileJsonEl.setSelectionRange?.(0, 0);
                    if (!copied) throw new Error('Clipboard copy failed.');
                }
                setSaveFileStatus('success', 'Copied trajectory.json content to the clipboard.');
            } catch (err) {
                setSaveFileStatus('error', `Copy failed: ${err.message}`);
            }
        });
    }

    if (saveFileDownloadBtn) {
        saveFileDownloadBtn.addEventListener('click', () => {
            if (!pendingSavePayload) return;
            finalizeFileSave(
                pendingSavePayload.json,
                pendingSavePayload.points,
                pendingSavePayload.onSaved
            );
        });
    }

    if (saveFileCloseBtn) {
        saveFileCloseBtn.addEventListener('click', closeSaveFileModal);
    }

    if (saveFileModal) {
        saveFileModal.addEventListener('click', e => {
            if (e.target === saveFileModal) closeSaveFileModal();
        });
    }

    if (moreInfoBtn) {
        moreInfoBtn.addEventListener('click', openMoreInfoModal);
    }

    // ── LocalStorage helpers (Story 2.11) ────────────────────

    function _draftKey(name) { return `objectMotion:${name}`; }

    function _saveDraft() {
        if (!isLocalStorageEnabled()) return;
        const rawDesignation = TrajectoryStore.getDesignation();
        const name = sanitize(rawDesignation);
        const key = _draftKey(name);
        const idx = WorkflowController.getCurrent();
        try {
            const plain = TrajectoryStore.toPlainObject();
            // Normalize every saved camera so tx/ty/tz are always explicit.
            // Points loaded from old files only have {el,az,zoom}; without this
            // normalization setRawState would silently reset pan to 0 on reload.
            plain.points.forEach(p => {
                if (p.camera) {
                    p.camera.tx = p.camera.tx ?? 0;
                    p.camera.ty = p.camera.ty ?? 0;
                    p.camera.tz = p.camera.tz ?? 0;
                }
            });
            const curCam = plain.points?.[idx]?.camera;
            console.log('[PAN] _saveDraft: pt', idx, 'camera in draft:',
                'tx:', curCam?.tx, 'ty:', curCam?.ty, 'tz:', curCam?.tz,
                '| full:', JSON.stringify(curCam));
            const serialized = JSON.stringify(plain);
            localStorage.setItem(key, serialized);
        } catch (err) {
            console.error('[PAN] _saveDraft FAILED:', err);
        }
    }

    function _clearDraft() {
        if (!isLocalStorageEnabled()) return;
        const name = sanitize(TrajectoryStore.getDesignation());
        try { localStorage.removeItem(_draftKey(name)); } catch (_) { }
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
        setStatus('loading', 'Searching for trajectory data\u2026');

        try {
            const res = await window.fetch(`data/${name}/trajectory.json`);
            if (res.ok) {
                const json = await res.json();
                clearStatus();
                loadTrajectoryFromData(json, 'web');
                _saveDraft();
            } else {
                clearStatus();
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
        const name = sanitize(designation);

        resetToStep1();

        // Check for a localStorage draft first (Story 2.11)
        if (isLocalStorageEnabled()) {
            try {
                const raw = localStorage.getItem(_draftKey(name));
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const saved = (parsed.points || []).filter(p => p.camera !== null).length;
                    const total = (parsed.points || []).length;
                    updateSearchButton();
                    showDraftCard(designation, saved, total);
                    return;
                }
            } catch (_) { }
        }

        await _runNormalSearch(designation);
    });

    searchBtn.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); searchBtn.click(); }
    });

    // ── Draft card buttons (Story 2.11) ──────────────────────

    resumeBtn.addEventListener('click', () => {
        if (!isLocalStorageEnabled()) {
            setStatus('error', 'Local draft storage is disabled in this build.');
            return;
        }
        const designation = designationEl.value.trim();
        const name = sanitize(designation);
        hideDraftCard();
        try {
            const raw = localStorage.getItem(_draftKey(name));
            if (!raw) { setStatus('error', 'Draft not found.'); return; }
            clearStatus();
            loadTrajectoryFromData(JSON.parse(raw), 'local');
        } catch (_) {
            setStatus('error', 'Could not load the draft.');
        }
    });

    startFreshBtn.addEventListener('click', async () => {
        const designation = designationEl.value.trim();
        const name = sanitize(designation);
        if (isLocalStorageEnabled()) {
            try { localStorage.removeItem(_draftKey(name)); } catch (_) { }
        }
        hideDraftCard();
        await _runNormalSearch(designation);
    });

    // ── Load trajectory from JSON object ─────────────────────

    function loadTrajectoryFromData(json, source = objectMotionSource) {
        const designation = json.designation || json.object || designationEl.value.trim();
        const createdAt = json.createdAt || null;
        const defaultSpeedMultiplier = json.defaultSpeedMultiplier;
        const raw = json.points || [];

        const points = raw.map(p => {
            const {
                px,
                wx,
                wy,
                wz,
                camera,
                description,
                image,
                durationPct,
                stoppable,
                ...extraFields
            } = p;

            const resolvedWx = wx ?? px?.wx ?? (p.au?.x * AU_TO_PX) ?? 0;
            const resolvedWy = wy ?? px?.wy ?? (p.au?.y * AU_TO_PX) ?? 0;
            const resolvedWz = wz ?? px?.wz ?? (p.au?.z * AU_TO_PX) ?? 0;
            const resolvedAu = p.au && typeof p.au === 'object'
                ? normalizeAuPosition(p.au)
                : worldToAuPosition({ wx: resolvedWx, wy: resolvedWy, wz: resolvedWz });

            return {
                ...extraFields,
                jd: p.jd,
                date: p.date,
                au: resolvedAu,
                wx: resolvedWx,
                wy: resolvedWy,
                wz: resolvedWz,
                camera: normalizeCameraState(camera),
                description: description ?? null,
                image: image ?? null,
                durationPct: durationPct ?? 100,
                stoppable: stoppable ?? false,
            };
        });

        if (points.length === 0) {
            setStatus('error', 'No trajectory points found in this file.');
            return;
        }

        TrajectoryStore.initFromSaved(designation, points, createdAt, {
            source: json.source,
            defaultSpeedMultiplier,
        });
        WorkflowController.start(points);

        designationEl.value = designation;
        syncObjectMotionUrl(designation, source);
        updateSearchButton();

        const saved = TrajectoryStore.savedCount();
        const total = points.length;
        const withTx = points.filter(p => p.camera && 'tx' in p.camera).length;
        console.log('[PAN] loadTrajectoryFromData: total pts:', total, '| saved cameras:', saved,
            '| cameras with tx field:', withTx,
            '| pt[0] cam:', JSON.stringify(points[0]?.camera),
            '| updateMode:', TrajectoryStore.isUpdateMode());
        const modeTag = saved > 0
            ? ` \u00B7 ${saved} of ${total} annotated \u2014 Update Mode`
            : ` \u00B7 0 of ${total} annotated`;

        setStatus('success', `${total} points loaded${modeTag}`);
        activateViewer(TrajectoryStore.getPoints());
    }

    // ── JSON file upload (Story 2.16) ─────────────────────────

    jsonUploadBtn.addEventListener('click', () => jsonUploadInput.click());

    jsonUploadInput.addEventListener('change', () => {
        const file = jsonUploadInput.files[0];
        if (!file) return;

        jsonUploadName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = e => {
            try {
                const json = JSON.parse(e.target.result);
                loadTrajectoryFromData(json, '');
                _saveDraft();
            } catch (_) {
                setStatus('error', 'Could not parse the uploaded file. Make sure it is a valid trajectory.json.');
            }
        };
        reader.readAsText(file);
        jsonUploadInput.value = '';
    });

    // ── Fetch button enable/disable ──────────────────────────

    function updateFetchButton() {
        const ready =
            designationEl.value.trim() !== '' &&
            startDateEl.value !== '' &&
            endDateEl.value !== '';
        fetchBtn.classList.toggle('enabled', ready);
    }

    [startDateEl, endDateEl].forEach(el => {
        el.addEventListener('input', updateFetchButton);
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
        const startDate = startDateEl.value;
        const endDate = endDateEl.value;
        const step = resolveStep(stepDropdownEl, stepCustomEl);

        clearValidationError();
        setStatus('loading', 'Fetching trajectory\u2026');
        fetchBtn.classList.remove('enabled');

        try {
            const points = await HorizonsClient.fetch(designation, startDate, endDate, step);

            TrajectoryStore.init(designation, points);
            WorkflowController.start(points);
            syncObjectMotionUrl(designation, '');

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

    // ── Story 2.13: Deep-link via URL parameter ───────────────
    // Supports ?designation=3I  or  ?d=3I
    // Priority: localStorage draft → disk file → search form.
    // Auto-loads without any confirmation card so a page refresh
    // silently restores in-progress work.
    (async function _applyUrlParam() {
        const params = new URLSearchParams(location.search);
        const paramVal = params.get('designation') || params.get('d');
        if (!paramVal) return;
        const value = decodeURIComponent(paramVal).trim();
        if (!value) return;
        const requestedSource = normalizeRequestedSource(params.get('source') || params.get('s'));
        designationEl.value = value;
        updateSearchButton();

        const name = sanitize(value);
        const key = _draftKey(name);

        // 1. Auto-restore localStorage draft if present unless the URL explicitly asks for web.
        if (requestedSource === 'local' && !isLocalStorageEnabled()) {
            setStatus('error', `Local draft storage is disabled for '${value}'. Falling back to bundled data if available.`);
        } else if (requestedSource !== 'web' && isLocalStorageEnabled()) {
            try {
                const draftRaw = localStorage.getItem(key);
                if (draftRaw) {
                    const parsed = JSON.parse(draftRaw);
                    const withTx = (parsed.points || []).filter(p => p.camera && 'tx' in p.camera).length;
                    console.log('[PAN] _applyUrlParam: restoring draft — pts:', parsed.points?.length,
                        '| cameras with tx field:', withTx,
                        '| pt[0] cam:', JSON.stringify(parsed.points?.[0]?.camera));
                    if (parsed && (parsed.points || []).length > 0) {
                        // Defer until after DOMContentLoaded so solar_system.js _init() has run
                        // before activateViewer sets the camera (otherwise _init() resets aEl=5).
                        if (document.readyState === 'loading') {
                            await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
                        }
                        loadTrajectoryFromData(parsed, requestedSource || 'local');
                        return;
                    }
                }
            } catch (err) {
                console.error('[PAN] _applyUrlParam: ERROR reading draft:', err);
            }
        } else if (requestedSource === 'web') {
            console.log('[PAN] _applyUrlParam: source=web, skipping draft restore');
        }

        if (requestedSource === 'local' && isLocalStorageEnabled()) {
            setStatus('error', `No local draft found for '${value}'. Falling back to bundled data if available.`);
        }

        // 2. Fall back to bundled data file on disk
        try {
            const res = await window.fetch(`data/${name}/trajectory.json`);
            console.log('[PAN] _applyUrlParam: loading disk file —', res.status, res.ok);
            if (res.ok) {
                loadTrajectoryFromData(await res.json(), requestedSource || 'web');
                _saveDraft();
                return;
            }
        } catch (err) {
            console.error('[PAN] _applyUrlParam: ERROR fetching disk file:', err);
        }

        // 3. Nothing found — show search form
        searchBtn.click();
    })();

})();
