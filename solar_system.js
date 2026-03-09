// ═══════════════════════════════════════════════════════════════
// SOLAR SYSTEM · Interactive Viewer  —  solar_system.js
// Epic 1 — Standalone, encapsulated, layered canvas architecture
// ═══════════════════════════════════════════════════════════════
//
// Depends on shared_render.js which must load first.
// Globals consumed from shared_render.js:
//   canvas, ctx, buildCamera, project3, lerp, clamp,
//   drawStars, drawEclipticPlane, drawOrbit, drawPlanet, drawSun,
//   planets, N_PLANETS, planeFlash,
//   aEl, aAz, aDist, aTx, aTy, aTz, CAM
//
// Public API (window.SolarSystem):
//   .layers.register(name, fn)   — add/replace a draw layer
//   .layers.remove(name)         — remove a layer by name
//   .layers.toggle(name, state)  — show/hide; state optional (boolean)
//   .camera.setPreset(name)      — animate to named preset
//   .camera.getState()           — { zoom, elevation, azimuth }
//   .engine.setDate(date)        — jump simulation to date
//   .engine.pause() / resume()
// ═══════════════════════════════════════════════════════════════

window.SolarSystem = (() => {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // MODULE: PlanetaryEngine
    // Computes planet angles from real J2000 orbital elements.
    // Drives a simulation clock that advances by speedMultiplier
    // days per real second.
    // ─────────────────────────────────────────────────────────────
    const PlanetaryEngine = (() => {

        // J2000.0 epoch: Jan 1.5, 2000 TT  (as UTC ms, close enough for visual accuracy)
        const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

        // Keplerian elements at J2000.0 epoch.
        // Source: JPL/Standish 1992, Table 1 (valid 1800–2050 AD).
        //   period = 360 / (mean-motion °/century / 36525)  [days]
        //   L0     = mean ecliptic longitude at J2000 [°]
        //   e      = orbital eccentricity
        //   W      = longitude of perihelion = Ω + ω [°]
        // Order MUST match shared_render.js planets[] array:
        // Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus
        const ORBITAL = [
            { period:    87.969, L0: 252.25032, e: 0.20563593, W:  77.45780 }, // Mercury
            { period:   224.701, L0: 181.97910, e: 0.00677672, W: 131.60247 }, // Venus
            { period:   365.257, L0: 100.46457, e: 0.01671123, W: 102.93768 }, // Earth  ← was 365.25; fixes ~1° error by 2025
            { period:   686.971, L0: 355.44657, e: 0.09339410, W: 336.05637 }, // Mars
            { period:  4332.60,  L0:  34.39644, e: 0.04838624, W:  14.72848 }, // Jupiter
            { period: 10759.70,  L0:  49.95424, e: 0.05386179, W:  92.59888 }, // Saturn
            { period: 30687.2,   L0: 313.23810, e: 0.04725744, W: 170.95428 }, // Uranus
        ];

        // Visual mode: planets orbit at a cosmetic rate, date stays fixed at today.
        // Time-simulation mode: date advances at _speed days/real-second, positions are date-accurate.
        // Default is visual mode — smooth live-feeling motion without racing dates.
        const VISUAL_DAYS_PER_FRAME = 0.12; // cosmetic rate: Mercury ~0.6 px/frame, slow gentle drift

        let _date        = new Date();
        let _speed       = 30;
        let _visualMode  = true;           // default: gentle cosmetic animation, date fixed
        let _paused      = false;
        let _lastTS      = null;

        function _daysSinceJ2000(date) {
            return (date.getTime() - J2000_MS) / 86400000;
        }

        // Solve Kepler's equation E - e*sin(E) = M via Newton-Raphson (6 iterations).
        function _solveKepler(M, e) {
            let E = M;
            for (let i = 0; i < 6; i++) {
                E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
            }
            return E;
        }

        // Snap all planet angles to a specific date's accurate J2000 positions.
        // Uses the equation of center (Kepler's equation) for sub-degree accuracy.
        function _applyDateToAngles(date) {
            const DEG = Math.PI / 180;
            const d   = _daysSinceJ2000(date);
            for (let i = 0; i < planets.length && i < ORBITAL.length; i++) {
                const o  = ORBITAL[i];
                const L  = (o.L0 + (360 / o.period) * d) * DEG;  // mean longitude (rad)
                const M  = ((L - o.W * DEG) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); // mean anomaly [0, 2π]
                const E  = _solveKepler(M, o.e);                   // eccentric anomaly
                const nu = Math.atan2(Math.sqrt(1 - o.e * o.e) * Math.sin(E), Math.cos(E) - o.e); // true anomaly
                planets[i].angle = ((nu + o.W * DEG) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            }
        }

        // Called every animation frame with performance.now() timestamp.
        function tick(ts) {
            if (_lastTS === null) { _lastTS = ts; }
            if (_paused) { _lastTS = ts; return; }

            if (_visualMode) {
                // Cosmetic: increment each planet's angle per-frame by its real orbital rate.
                // Date does not advance — it stays fixed showing today (or user-selected date).
                _lastTS = ts;
                for (let i = 0; i < planets.length && i < ORBITAL.length; i++) {
                    planets[i].angle += (2 * Math.PI / ORBITAL[i].period) * VISUAL_DAYS_PER_FRAME;
                }
            } else {
                // Time-simulation: advance date, positions computed from date each frame.
                const dtReal = Math.min((ts - _lastTS) / 1000, 0.1);
                _lastTS = ts;
                _date = new Date(_date.getTime() + dtReal * _speed * 86400000);
            }
        }

        // In visual mode this is a no-op (tick() already incremented angles).
        // In simulation mode this recomputes angles from the current date.
        function applyToPlanets() {
            if (!_visualMode) {
                _applyDateToAngles(_date);
            }
        }

        // Jump to a specific date: snaps planet positions to that date,
        // then visual mode continues animating from those positions.
        function setDate(date) {
            _date      = date instanceof Date ? new Date(date) : new Date(date);
            _lastTS    = null;
            _applyDateToAngles(_date); // immediate snap in both modes
        }

        function setVisualMode(on) {
            _visualMode = !!on;
            _lastTS = null;
            if (!on) _applyDateToAngles(_date); // ensure positions are date-accurate on switch
        }

        return {
            get date()        { return _date;        },
            get speed()       { return _speed;       },
            set speed(v)      { _speed = v;          },
            get paused()      { return _paused;      },
            get visualMode()  { return _visualMode;  },
            tick,
            applyToPlanets,
            setDate,
            setVisualMode,
            pause()  { _paused = true;  },
            resume() { _paused = false; _lastTS = null; },
        };
    })();


    // ─────────────────────────────────────────────────────────────
    // MODULE: CameraController
    // Manages arcball drag, zoom rulers, and preset animations.
    // Writes to shared_render.js globals: aEl, aAz, aDist, aTx,
    // aTy, aTz, CAM each frame via update().
    // ─────────────────────────────────────────────────────────────
    const CameraController = (() => {

        const BASE_DIST   = 1200;
        const LERP_COAST  = 0.09;   // lerp factor when not dragging (smooth stop)
        const LERP_DRAG   = 0.30;   // lerp factor while dragging (responsive)
        const DRAG_SENS   = 0.40;   // degrees per pixel

        const PAN_SENS = 0.0022;    // pan scale relative to camera distance

        let _elTgt   = 5;           // default: slight ecliptic tilt
        let _azTgt   = 0;
        let _zoom    = 0;           // -100..100 (negative = zoom out, positive = zoom in)

        // Arcball rotate drag
        let _dragging = false;
        let _dStartX = 0, _dStartY = 0, _dElStart = 0, _dAzStart = 0;

        // Pan drag (right-click)
        let _panning  = false;
        let _pStartX  = 0, _pStartY  = 0;
        let _txStart  = 0, _tyStart  = 0, _tzStart = 0;

        // Camera target (pan offset from Sun)
        let _txTgt = 0, _tyTgt = 0, _tzTgt = 0;

        const PRESETS = {
            topdown:  { el:  89,  az: 0              },
            ecliptic: { el:   5,  az: 0              },
            side:     { el:   0,  az: Math.PI / 2    },
            iso:      { el:  35,  az: Math.PI / 4    },
            below:    { el: -89,  az: 0              },
        };

        // Compute target camera distance from single zoom value — direct, no lerp
        function _targetDist() {
            if (_zoom >= 0) return lerp(BASE_DIST, 80,   _zoom / 100);   // 1200 → 80
            return             lerp(BASE_DIST, 6000, -_zoom / 100);      // 1200 → 6000
        }

        // Called every frame — writes to shared_render.js globals
        function update() {
            const lf = _dragging ? LERP_DRAG : LERP_COAST;
            aEl   = lerp(aEl,  _elTgt, lf);
            aAz   = lerp(aAz,  _azTgt, lf * 0.75);
            aEl   = clamp(aEl, -89, 89);

            // Distance: ruler-driven = no lerp (instant, per PRD FR-3.3)
            aDist = _targetDist();

            // Pan target — smooth lerp so release feels fluid
            const lp = _panning ? LERP_DRAG : LERP_COAST;
            aTx = lerp(aTx, _txTgt, lp);
            aTy = lerp(aTy, _tyTgt, lp);
            aTz = lerp(aTz, _tzTgt, lp);

            CAM = buildCamera(aEl, aAz, aDist, aTx, aTy, aTz);
        }

        // ── Drag API (used by both main canvas and arcball widget) ──
        function startDrag(x, y) {
            _dragging  = true;
            _dStartX   = x;    _dStartY   = y;
            _dElStart  = _elTgt;
            _dAzStart  = _azTgt;
        }

        function moveDrag(x, y) {
            if (!_dragging) return;
            const dx = x - _dStartX;
            const dy = y - _dStartY;
            _elTgt = clamp(_dElStart - dy * DRAG_SENS, -89, 89);
            _azTgt = _dAzStart + dx * DRAG_SENS * (Math.PI / 180);
        }

        function endDrag() { _dragging = false; }

        // ── Direct target setters (used by arcball widget) ──
        function setElTarget(v) { _elTgt = clamp(v, -89, 89); }
        function setAzTarget(v) { _azTgt = v; }
        function getElTarget()  { return _elTgt; }
        function getAzTarget()  { return _azTgt; }

        // ── Zoom ruler ──
        function setZoom(v) { _zoom = clamp(v, -100, 100); }

        // ── Pan drag API (right-click drag) ──
        function startPan(x, y) {
            _panning  = true;
            _pStartX  = x;   _pStartY  = y;
            _txStart  = _txTgt;
            _tyStart  = _tyTgt;
            _tzStart  = _tzTgt;
        }

        function movePan(x, y) {
            if (!_panning) return;
            const dx = x - _pStartX;
            const dy = y - _pStartY;
            const scale = aDist * PAN_SENS;
            // Use camera's right (rx,ry,rz) and up (Ux,Uy,Uz) vectors so pan
            // always aligns with what you see regardless of view angle.
            // Negate dx/dy so dragging left moves scene right (standard pan feel).
            _txTgt = _txStart - (CAM.rx * dx - CAM.Ux * dy) * scale;
            _tyTgt = _tyStart - (CAM.ry * dx - CAM.Uy * dy) * scale;
            _tzTgt = _tzStart - (CAM.rz * dx - CAM.Uz * dy) * scale;
        }

        function endPan() { _panning = false; }

        function getPanTarget() { return { tx: _txTgt, ty: _tyTgt, tz: _tzTgt }; }
        function setPanTarget(tx, ty, tz) { _txTgt = tx; _tyTgt = ty; _tzTgt = tz; }

        // ── Reset — returns all camera state to default ecliptic view ──
        function resetAll() {
            _elTgt = 5;  _azTgt = 0;
            _zoom  = 0;
            _txTgt = 0;  _tyTgt = 0;  _tzTgt = 0;
        }

        // ── Presets ──
        function setPreset(name) {
            const p = PRESETS[name];
            if (p) { _elTgt = p.el; _azTgt = p.az; }
        }

        // ── State for HUD ──
        function getState() {
            const zVal = _zoom > 0
                ? '+' + Math.round(_zoom)
                : _zoom < 0
                    ? String(Math.round(_zoom))
                    : '0';
            const azDeg = Math.round(((aAz * 180 / Math.PI) % 360 + 360) % 360);
            return {
                zoom:      zVal,
                elevation: (aEl >= 0 ? '+' : '') + Math.round(aEl) + '°',
                azimuth:   azDeg + '°',
            };
        }

        return {
            update,
            startDrag, moveDrag, endDrag,
            startPan,  movePan,  endPan,
            resetAll,
            setElTarget, setAzTarget, getElTarget, getAzTarget,
            setZoom,
            getPanTarget, setPanTarget,
            setPreset,
            getState,
            get isDragging() { return _dragging; },
            get isPanning()  { return _panning;  },
            get zoom() { return _zoom; },
        };
    })();


    // ─────────────────────────────────────────────────────────────
    // MODULE: HUD
    // Interactive HTML panel — bottom-left corner.
    // Displays ZOOM / ELEV / AZ / DATE with +/- buttons so the
    // user can nudge each value precisely without using the slider
    // or drag controls.
    // ─────────────────────────────────────────────────────────────
    const HUD = (() => {

        const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN',
                        'JUL','AUG','SEP','OCT','NOV','DEC'];

        function _formatDate(d) {
            return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
        }

        let _zoomSpan, _elSpan, _azSpan, _txSpan, _tySpan, _tzSpan, _dateSpan;

        // Keep the zoom slider in the controls panel in sync
        function _syncZoomSlider(z) {
            const slider = document.getElementById('ss-zoom');
            const label  = document.getElementById('ss-zoom-val');
            if (slider) slider.value = z;
            if (label)  label.textContent = z > 0 ? '+' + Math.round(z) : String(Math.round(z));
        }

        // Create a button that fires adjustFn once on click and repeatedly while held
        function _makeBtn(label, adjustFn) {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.className   = 'ss-hud-btn';
            let _iv;
            const _run = () => { adjustFn(); sync(); };
            btn.addEventListener('mousedown', e => {
                e.preventDefault();   // keep canvas focus
                _run();
                _iv = setInterval(_run, 80);
            });
            const _stop = () => clearInterval(_iv);
            btn.addEventListener('mouseup',    _stop);
            btn.addEventListener('mouseleave', _stop);
            document.addEventListener('mouseup', _stop, { passive: true });
            return btn;
        }

        function _makeRow(labelText, decFn, incFn) {
            const row = document.createElement('div');
            row.className = 'ss-hud-row';

            const lbl = document.createElement('span');
            lbl.className   = 'ss-hud-label';
            lbl.textContent = labelText;

            const val = document.createElement('span');
            val.className = 'ss-hud-val';

            row.append(lbl, _makeBtn('−', decFn), val, _makeBtn('+', incFn));
            return { row, val };
        }

        function _makeDateRow() {
            const row = document.createElement('div');
            row.className = 'ss-hud-row';

            const lbl = document.createElement('span');
            lbl.className   = 'ss-hud-label';
            lbl.textContent = 'DATE';

            const val = document.createElement('span');
            val.className = 'ss-hud-val ss-hud-date-val';

            row.append(lbl, val);
            return { row, val };
        }

        function init() {
            const style = document.createElement('style');
            style.textContent = `
                #ss-hud-panel {
                    position: fixed;
                    bottom: 18px;
                    left: 18px;
                    background: rgba(0, 5, 20, 0.82);
                    border: 1px solid rgba(130, 180, 255, 0.28);
                    border-radius: 7px;
                    padding: 8px 12px;
                    z-index: 20;
                    user-select: none;
                    min-width: 190px;
                }
                .ss-hud-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 3px 0;
                }
                .ss-hud-label {
                    font: 10px Georgia, serif;
                    color: rgba(130, 180, 255, 0.70);
                    letter-spacing: 0.5px;
                    width: 34px;
                    flex-shrink: 0;
                }
                .ss-hud-val {
                    font: bold 13px Georgia, serif;
                    color: rgba(220, 235, 255, 1.0);
                    min-width: 52px;
                    text-align: center;
                    flex: 1;
                }
                .ss-hud-date-val {
                    font: 11px Georgia, serif !important;
                    font-weight: normal !important;
                    color: rgba(200, 220, 255, 0.85) !important;
                }
                .ss-hud-btn {
                    background: rgba(30, 50, 110, 0.70);
                    border: 1px solid rgba(130, 180, 255, 0.35);
                    border-radius: 4px;
                    color: rgba(200, 225, 255, 0.90);
                    font-size: 15px;
                    line-height: 1;
                    width: 22px;
                    height: 22px;
                    cursor: pointer;
                    padding: 0;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ss-hud-btn:hover  { background: rgba(60,  90, 180, 0.80); border-color: rgba(130,180,255,0.65); }
                .ss-hud-btn:active { background: rgba(80, 120, 220, 0.90); }
                .ss-hud-divider {
                    border: none;
                    border-top: 1px solid rgba(130, 180, 255, 0.15);
                    margin: 4px 0;
                }
            `;
            document.head.appendChild(style);

            const panel = document.createElement('div');
            panel.id = 'ss-hud-panel';

            const zoomRow = _makeRow('ZOOM',
                () => { const z = clamp(CameraController.zoom - 5, -100, 100); CameraController.setZoom(z); _syncZoomSlider(z); },
                () => { const z = clamp(CameraController.zoom + 5, -100, 100); CameraController.setZoom(z); _syncZoomSlider(z); }
            );
            _zoomSpan = zoomRow.val;

            const elevRow = _makeRow('ELEV',
                () => CameraController.setElTarget(clamp(CameraController.getElTarget() - 1, -89, 89)),
                () => CameraController.setElTarget(clamp(CameraController.getElTarget() + 1, -89, 89))
            );
            _elSpan = elevRow.val;

            const azRow = _makeRow('AZ',
                () => CameraController.setAzTarget(CameraController.getAzTarget() - Math.PI / 180),
                () => CameraController.setAzTarget(CameraController.getAzTarget() + Math.PI / 180)
            );
            _azSpan = azRow.val;

            const divider = document.createElement('hr');
            divider.className = 'ss-hud-divider';

            const txRow = _makeRow('TX',
                () => { const p = CameraController.getPanTarget(); const nx = p.tx - 10; CameraController.setPanTarget(nx, p.ty, p.tz); aTx = nx; console.log('[PAN] TX-: tx now', nx); },
                () => { const p = CameraController.getPanTarget(); const nx = p.tx + 10; CameraController.setPanTarget(nx, p.ty, p.tz); aTx = nx; console.log('[PAN] TX+: tx now', nx); }
            );
            _txSpan = txRow.val;

            const tyRow = _makeRow('TY',
                () => { const p = CameraController.getPanTarget(); const ny = p.ty - 10; CameraController.setPanTarget(p.tx, ny, p.tz); aTy = ny; console.log('[PAN] TY-: ty now', ny); },
                () => { const p = CameraController.getPanTarget(); const ny = p.ty + 10; CameraController.setPanTarget(p.tx, ny, p.tz); aTy = ny; console.log('[PAN] TY+: ty now', ny); }
            );
            _tySpan = tyRow.val;

            const tzRow = _makeRow('TZ',
                () => { const p = CameraController.getPanTarget(); const nz = p.tz - 10; CameraController.setPanTarget(p.tx, p.ty, nz); aTz = nz; console.log('[PAN] TZ-: tz now', nz); },
                () => { const p = CameraController.getPanTarget(); const nz = p.tz + 10; CameraController.setPanTarget(p.tx, p.ty, nz); aTz = nz; console.log('[PAN] TZ+: tz now', nz); }
            );
            _tzSpan = tzRow.val;

            const dateRow = _makeDateRow();
            _dateSpan = dateRow.val;

            panel.append(zoomRow.row, elevRow.row, azRow.row, divider,
                         txRow.row, tyRow.row, tzRow.row, dateRow.row);
            document.body.appendChild(panel);
        }

        function sync() {
            if (!_zoomSpan) return;

            const z = CameraController.zoom;
            _zoomSpan.textContent = z > 0 ? '+' + Math.round(z) : String(Math.round(z));

            const el = CameraController.getElTarget();
            _elSpan.textContent = (el >= 0 ? '+' : '') + Math.round(el) + '°';

            const azRad = CameraController.getAzTarget();
            const azDeg = Math.round(((azRad * 180 / Math.PI) % 360 + 360) % 360);
            _azSpan.textContent = azDeg + '°';

            const pan = CameraController.getPanTarget();
            const _fmt = v => (v >= 0 ? '+' : '') + Math.round(v);
            _txSpan.textContent = _fmt(pan.tx);
            _tySpan.textContent = _fmt(pan.ty);
            _tzSpan.textContent = _fmt(pan.tz);

            _dateSpan.textContent = _formatDate(PlanetaryEngine.date);
        }

        return { init, sync };
    })();


    // ─────────────────────────────────────────────────────────────
    // MODULE: LayerManager
    // Ordered draw stack. Future epics register additional layers
    // without modifying this file.
    //
    // Usage (from any external script):
    //   SolarSystem.layers.register('my-layer', () => { /* draw */ });
    // ─────────────────────────────────────────────────────────────
    const LayerManager = (() => {

        const _stack = []; // [{ name, fn, visible }]

        function register(name, fn) {
            const idx = _stack.findIndex(l => l.name === name);
            if (idx >= 0) { _stack[idx].fn = fn; return; }
            _stack.push({ name, fn, visible: true });
        }

        function remove(name) {
            const i = _stack.findIndex(l => l.name === name);
            if (i >= 0) _stack.splice(i, 1);
        }

        // toggle(name)        — flip visibility
        // toggle(name, true)  — force visible
        // toggle(name, false) — force hidden
        function toggle(name, state) {
            const l = _stack.find(l => l.name === name);
            if (l) l.visible = (state !== undefined) ? !!state : !l.visible;
        }

        function draw() {
            for (const layer of _stack) {
                if (!layer.visible) continue;
                ctx.save();
                try {
                    layer.fn();
                } catch (e) {
                    console.error(`[LayerManager] Layer "${layer.name}" threw:`, e);
                }
                ctx.restore();
            }
        }

        return { register, remove, toggle, draw };
    })();


    // ─────────────────────────────────────────────────────────────
    // MODULE: ArcballWidget
    // Small 90×90 canvas overlay (bottom-right).
    // Visual: 3D sphere showing current camera orientation.
    //   - Ecliptic ring squishes with elevation
    //   - Glowing dot shows current viewpoint direction
    // Interaction: drag the widget to rotate the camera (same as
    // dragging the main canvas).
    // ─────────────────────────────────────────────────────────────
    const ArcballWidget = (() => {

        const SIZE = 90;
        let _canvas, _ctx;
        let _dragging  = false;
        let _dStartX   = 0, _dStartY = 0;
        let _elStart   = 0, _azStart = 0;
        const SENS = 0.55; // slightly higher sensitivity for small widget

        function init() {
            _canvas = document.getElementById('ss-arcball');
            _canvas.width  = SIZE;
            _canvas.height = SIZE;
            _ctx = _canvas.getContext('2d');

            _canvas.addEventListener('mousedown', e => {
                _dragging = true;
                _dStartX  = e.clientX;
                _dStartY  = e.clientY;
                _elStart  = CameraController.getElTarget();
                _azStart  = CameraController.getAzTarget();
                e.stopPropagation(); // prevent main canvas drag starting
            });

            // Shared document handlers catch the rest of the drag
            document.addEventListener('mousemove', e => {
                if (!_dragging) return;
                const dx = e.clientX - _dStartX;
                const dy = e.clientY - _dStartY;
                CameraController.setElTarget(clamp(_elStart - dy * SENS, -89, 89));
                CameraController.setAzTarget(_azStart + dx * SENS * (Math.PI / 180));
            });

            document.addEventListener('mouseup', () => { _dragging = false; });
        }

        function draw() {
            if (!_ctx) return;

            const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 3;
            _ctx.clearRect(0, 0, SIZE, SIZE);

            // ── Sphere body (radial gradient highlight) ──
            const grad = _ctx.createRadialGradient(
                cx - r * 0.28, cy - r * 0.28, 1,
                cx, cy, r
            );
            grad.addColorStop(0,   'rgba(70, 110, 190, 0.90)');
            grad.addColorStop(0.5, 'rgba(12, 25,  65, 0.90)');
            grad.addColorStop(1,   'rgba( 0,  5,  18, 0.80)');

            _ctx.beginPath();
            _ctx.arc(cx, cy, r, 0, Math.PI * 2);
            _ctx.fillStyle = grad;
            _ctx.fill();
            _ctx.strokeStyle = 'rgba(130, 180, 255, 0.55)';
            _ctx.lineWidth   = 1.5;
            _ctx.stroke();

            // ── Ecliptic ring (horizontal ellipse, squishes with elevation) ──
            const elR    = aEl * Math.PI / 180;
            const ringR  = r * 0.68;
            const squish = Math.max(0.04, Math.abs(Math.sin(elR)));

            _ctx.save();
            _ctx.translate(cx, cy);
            _ctx.scale(1, squish);
            _ctx.beginPath();
            _ctx.arc(0, 0, ringR, 0, Math.PI * 2);
            _ctx.strokeStyle = 'rgba(100, 180, 255, 0.45)';
            _ctx.lineWidth   = 1;
            _ctx.stroke();
            _ctx.restore();

            // ── Camera viewpoint dot ──
            // Projects (el, az) onto sphere surface in 2D
            const dotX = cx + ringR * Math.sin(aAz) * Math.cos(elR);
            const dotY = cy - ringR * Math.sin(elR);

            // Glow ring
            _ctx.beginPath();
            _ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
            _ctx.strokeStyle = 'rgba(100, 220, 255, 0.35)';
            _ctx.lineWidth   = 1;
            _ctx.stroke();

            // Core dot
            _ctx.beginPath();
            _ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
            _ctx.fillStyle = 'rgba(160, 235, 255, 0.95)';
            _ctx.fill();

            // ── Label ──
            _ctx.font      = '9px Georgia';
            _ctx.fillStyle = 'rgba(130, 180, 255, 0.55)';
            _ctx.textAlign = 'center';
            _ctx.fillText('POV', cx, SIZE - 2);
        }

        return { init, draw };
    })();


    // ─────────────────────────────────────────────────────────────
    // MODULE: UIControls
    // Wires all DOM elements to PlanetaryEngine and CameraController.
    // ─────────────────────────────────────────────────────────────
    const UIControls = (() => {

        function _toInputDate(date) {
            const y  = date.getFullYear();
            const m  = String(date.getMonth() + 1).padStart(2, '0');
            const d  = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        function init() {
            // ── Date picker ──
            const dateInput = document.getElementById('ss-date');
            dateInput.value = _toInputDate(new Date());
            dateInput.addEventListener('input', () => {
                if (!dateInput.value) return;
                const d = new Date(dateInput.value + 'T12:00:00');
                PlanetaryEngine.setDate(d); // snaps planet positions to this date
                // Stay in whatever mode we're in; visual mode will continue animating
                // from the snapped positions; simulation mode will advance from this date
            });

            // ── Pause / play ──
            const pauseBtn = document.getElementById('ss-pause');
            pauseBtn.addEventListener('click', () => {
                if (PlanetaryEngine.paused) {
                    PlanetaryEngine.resume();
                    pauseBtn.textContent = '❚❚ Pause';
                } else {
                    PlanetaryEngine.pause();
                    pauseBtn.textContent = '▶ Play';
                }
            });

            // ── Speed selector ──
            document.getElementById('ss-speed').addEventListener('change', e => {
                if (e.target.value === 'visual') {
                    PlanetaryEngine.setVisualMode(true);
                } else {
                    PlanetaryEngine.setVisualMode(false);
                    PlanetaryEngine.speed = parseFloat(e.target.value);
                }
            });

            // ── Single zoom ruler (−100 → 0 → +100, 0 = neutral) ──
            const zoomSlider = document.getElementById('ss-zoom');
            const zoomVal    = document.getElementById('ss-zoom-val');
            zoomSlider.addEventListener('input', () => {
                const v = parseInt(zoomSlider.value);
                CameraController.setZoom(v);
                zoomVal.textContent = v > 0 ? '+' + v : String(v);
            });

            // ── Preset buttons ──
            document.querySelectorAll('.ss-preset').forEach(btn => {
                btn.addEventListener('click', () => {
                    CameraController.setPreset(btn.dataset.preset);
                });
            });

            // ── Main canvas — arcball drag (left-click) + pan (right-click) ──
            const arcballEl = document.getElementById('ss-arcball');

            canvas.addEventListener('contextmenu', e => e.preventDefault());

            canvas.addEventListener('mousedown', e => {
                const r = arcballEl.getBoundingClientRect();
                const overWidget = e.clientX >= r.left && e.clientX <= r.right &&
                                   e.clientY >= r.top  && e.clientY <= r.bottom;

                if (e.button === 2) {
                    // Right-click: pan
                    canvas.classList.add('panning');
                    CameraController.startPan(e.clientX, e.clientY);
                } else if (e.button === 0 && !overWidget) {
                    // Left-click (not on arcball): rotate
                    canvas.classList.add('dragging');
                    CameraController.startDrag(e.clientX, e.clientY);
                }
            });

            document.addEventListener('mousemove', e => {
                CameraController.moveDrag(e.clientX, e.clientY);
                CameraController.movePan(e.clientX, e.clientY);
            });

            document.addEventListener('mouseup', e => {
                if (e.button === 2) {
                    canvas.classList.remove('panning');
                    CameraController.endPan();
                } else {
                    canvas.classList.remove('dragging');
                    CameraController.endDrag();
                }
            });

            // ── Reset View button ──
            document.getElementById('ss-reset').addEventListener('click', () => {
                CameraController.resetAll();
                document.getElementById('ss-zoom').value        = 0;
                document.getElementById('ss-zoom-val').textContent = '0';
            });

            // ── Scroll wheel → zoom ruler ──
            canvas.addEventListener('wheel', e => {
                e.preventDefault();
                const delta  = e.deltaY > 0 ? -5 : 5;
                const newVal = clamp(CameraController.zoom + delta, -100, 100);
                CameraController.setZoom(newVal);
                zoomSlider.value       = newVal;
                zoomVal.textContent    = newVal > 0 ? '+' + newVal : String(newVal);
            }, { passive: false });
        }

        // Called each frame to keep the date input showing the live simulation date,
        // but only when the input is not being actively edited by the user.
        function syncDateDisplay() {
            const el = document.getElementById('ss-date');
            if (document.activeElement === el) return;
            el.value = _toInputDate(PlanetaryEngine.date);
        }

        return { init, syncDateDisplay };
    })();


    // ─────────────────────────────────────────────────────────────
    // Register Epic 1 core draw layers
    // ─────────────────────────────────────────────────────────────
    function _registerCoreLayers() {

        LayerManager.register('background', () => {
            ctx.fillStyle = '#00010e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawStars();
        });

        LayerManager.register('ecliptic', () => {
            drawEclipticPlane();
        });

        LayerManager.register('orbits', () => {
            for (let i = 0; i < N_PLANETS; i++) drawOrbit(planets[i], 0.48);
        });

        LayerManager.register('planets', () => {
            for (let i = 0; i < N_PLANETS; i++) drawPlanet(planets[i], true);
        });

        LayerManager.register('sun', () => {
            drawSun();
        });

        // HUD is now an HTML panel — no canvas layer needed
    }


    // ─────────────────────────────────────────────────────────────
    // Main animation loop
    // ─────────────────────────────────────────────────────────────
    function _frame(ts) {
        requestAnimationFrame(_frame);

        // 1. Advance simulation clock
        PlanetaryEngine.tick(ts);
        PlanetaryEngine.applyToPlanets();

        // 2. Update camera (writes aEl/aAz/aDist → CAM)
        CameraController.update();

        // 3. Sync DOM date input and HUD panel (non-intrusively)
        UIControls.syncDateDisplay();
        HUD.sync();

        // 4. Draw all registered layers onto main canvas
        LayerManager.draw();

        // 5. Draw arcball widget onto its own small canvas
        ArcballWidget.draw();
    }


    // ─────────────────────────────────────────────────────────────
    // Init — called once after DOM is ready
    // ─────────────────────────────────────────────────────────────
    function _init() {
        // Set initial camera to slight ecliptic tilt (overrides shared_render.js defaults)
        aEl = 5; aAz = 0; aDist = 1200;

        _registerCoreLayers();
        UIControls.init();
        HUD.init();
        ArcballWidget.init();

        // Compute planet positions for today on first frame
        PlanetaryEngine.applyToPlanets();

        requestAnimationFrame(_frame);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }


    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────
    return {
        layers: LayerManager,

        camera: {
            setPreset: name => CameraController.setPreset(name),
            getState:  ()   => CameraController.getState(),

            /** Returns raw camera angles, zoom, and pan offset for serialisation. */
            getRawState: () => {
                const pan = CameraController.getPanTarget();
                return {
                    el:   CameraController.getElTarget(),
                    az:   CameraController.getAzTarget(),
                    zoom: CameraController.zoom,
                    tx:   pan.tx,
                    ty:   pan.ty,
                    tz:   pan.tz,
                };
            },

            /** Restores camera angles, zoom, and pan; snaps animation globals
             *  immediately so the view matches exactly on load.
             *  Accepts both new { zoom } and legacy { zoomIn, zoomOut } formats. */
            setRawState: (s) => {
                if (!s) return;
                if (s.el != null) { CameraController.setElTarget(s.el); aEl = s.el; }
                if (s.az != null) { CameraController.setAzTarget(s.az); aAz = s.az; }
                let z = 0;
                if (s.zoom    != null) { z = s.zoom; }
                else if (s.zoomIn != null || s.zoomOut != null) {
                    z = (s.zoomIn ?? 0) - (s.zoomOut ?? 0);
                }
                CameraController.setZoom(z);
                const zoomEl    = document.getElementById('ss-zoom');
                const zoomValEl = document.getElementById('ss-zoom-val');
                if (zoomEl)    zoomEl.value          = z;
                if (zoomValEl) zoomValEl.textContent = z > 0 ? '+' + Math.round(z) : String(Math.round(z));
                // Restore pan only when the saved state has explicit tx/ty/tz.
                // Old-format cameras {el,az,zoom} have no pan keys; applying ?? 0
                // there would silently reset any pan the user set on a previous point.
                if ('tx' in s || 'ty' in s || 'tz' in s) {
                    const tx = s.tx ?? 0;
                    const ty = s.ty ?? 0;
                    const tz = s.tz ?? 0;
                    CameraController.setPanTarget(tx, ty, tz);
                    aTx = tx; aTy = ty; aTz = tz;
                }
            },
        },

        engine: {
            get date()   { return PlanetaryEngine.date;  },
            get speed()  { return PlanetaryEngine.speed; },
            set speed(v) { PlanetaryEngine.speed = v;    },
            setDate: d   => PlanetaryEngine.setDate(d),
            pause:   ()  => PlanetaryEngine.pause(),
            resume:  ()  => PlanetaryEngine.resume(),
        },
    };

})();
