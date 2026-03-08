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

        // Sidereal orbital periods (days) and mean ecliptic longitude at J2000 (degrees).
        // Source: Astronomical Almanac simplified VSOP87.
        // Order MUST match shared_render.js planets[] array:
        // Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus
        const ORBITAL = [
            { period:    87.97, L0: 252.25 }, // Mercury
            { period:   224.70, L0: 181.98 }, // Venus
            { period:   365.25, L0: 100.46 }, // Earth
            { period:   686.97, L0: 355.43 }, // Mars
            { period:  4332.59, L0:  34.33 }, // Jupiter
            { period: 10759.22, L0:  50.08 }, // Saturn
            { period: 30688.50, L0: 314.20 }, // Uranus
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

        // Snap all planet angles to a specific date's accurate J2000 positions.
        function _applyDateToAngles(date) {
            const d = _daysSinceJ2000(date);
            for (let i = 0; i < planets.length && i < ORBITAL.length; i++) {
                const o   = ORBITAL[i];
                const lon = o.L0 + (360 / o.period) * d;
                planets[i].angle = (lon % 360) * (Math.PI / 180);
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
        let _zIn     = 0;           // 0..100  (zoom in ruler)
        let _zOut    = 0;           // 0..100  (zoom out ruler, internally positive)

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

        // Compute target camera distance from both ruler values — direct, no lerp
        function _targetDist() {
            const inDist  = lerp(BASE_DIST, 80,   _zIn  / 100);  // 1200 → 80
            const outDist = lerp(BASE_DIST, 6000, _zOut / 100);  // 1200 → 6000
            return inDist + (outDist - BASE_DIST);                // additive combination
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

        // ── Zoom rulers ──
        function setZoomIn(v)  { _zIn  = clamp(v,    0, 100); }
        function setZoomOut(v) { _zOut = clamp(v,    0, 100); }

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

        // ── Reset — returns all camera state to default ecliptic view ──
        function resetAll() {
            _elTgt = 5;  _azTgt = 0;
            _zIn   = 0;  _zOut  = 0;
            _txTgt = 0;  _tyTgt = 0;  _tzTgt = 0;
        }

        // ── Presets ──
        function setPreset(name) {
            const p = PRESETS[name];
            if (p) { _elTgt = p.el; _azTgt = p.az; }
        }

        // ── State for HUD ──
        function getState() {
            const zVal = _zIn > 0
                ? '+' + Math.round(_zIn)
                : _zOut > 0
                    ? '-' + Math.round(_zOut)
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
            setZoomIn, setZoomOut,
            setPreset,
            getState,
            get isDragging() { return _dragging; },
            get isPanning()  { return _panning;  },
            get zIn()  { return _zIn;  },
            get zOut() { return _zOut; },
        };
    })();


    // ─────────────────────────────────────────────────────────────
    // MODULE: HUD
    // Live camera state overlay drawn on the main canvas each frame.
    // Top-right corner. Always visible. Read-only in Epic 1.
    // ─────────────────────────────────────────────────────────────
    const HUD = (() => {

        const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN',
                        'JUL','AUG','SEP','OCT','NOV','DEC'];

        function _formatDate(d) {
            return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
        }

        function draw() {
            const state   = CameraController.getState();
            const dateStr = _formatDate(PlanetaryEngine.date);

            const rows = [
                { label: 'ZOOM', value: state.zoom      },
                { label: 'ELEV', value: state.elevation  },
                { label: 'AZ',   value: state.azimuth    },
                { label: 'DATE', value: dateStr           },
            ];

            const PAD_H  = 12, PAD_V = 10, ROW_H = 20;
            const panelW = 180;
            const panelH = PAD_V * 2 + rows.length * ROW_H;
            const panelX = canvas.width - panelW - 18;
            const panelY = 18;

            ctx.beginPath();
            ctx.roundRect(panelX, panelY, panelW, panelH, 7);
            ctx.fillStyle   = 'rgba(0, 5, 20, 0.72)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(130, 180, 255, 0.28)';
            ctx.lineWidth   = 1;
            ctx.stroke();

            rows.forEach((row, i) => {
                const y = panelY + PAD_V + 14 + i * ROW_H;
                ctx.font      = '10px Georgia';
                ctx.fillStyle = 'rgba(130, 180, 255, 0.70)';
                ctx.textAlign = 'left';
                ctx.fillText(row.label, panelX + PAD_H, y);

                ctx.font      = row.label === 'DATE'
                    ? '11px Georgia'
                    : 'bold 13px Georgia';
                ctx.fillStyle = 'rgba(220, 235, 255, 1.0)';
                ctx.textAlign = 'right';
                ctx.fillText(row.value, panelX + panelW - PAD_H, y);
            });
        }

        return { draw };
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

            // ── Zoom In ruler (0–100) — input fires on every pixel of drag ──
            const zInSlider  = document.getElementById('ss-zoom-in');
            const zInVal     = document.getElementById('ss-zin-val');
            zInSlider.addEventListener('input', () => {
                const v = parseInt(zInSlider.value);
                CameraController.setZoomIn(v);
                zInVal.textContent = v > 0 ? '+' + v : '0';
            });

            // ── Zoom Out ruler (0 to -100) — input fires on every pixel of drag ──
            const zOutSlider = document.getElementById('ss-zoom-out');
            const zOutVal    = document.getElementById('ss-zout-val');
            zOutSlider.addEventListener('input', () => {
                const v = parseInt(zOutSlider.value); // -100..0
                CameraController.setZoomOut(-v);       // store as 0..100 internally
                zOutVal.textContent = v < 0 ? String(v) : '0';
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
                // Sync zoom rulers back to 0 visually
                document.getElementById('ss-zoom-in').value  = 0;
                document.getElementById('ss-zoom-out').value = 0;
                document.getElementById('ss-zin-val').textContent  = '0';
                document.getElementById('ss-zout-val').textContent = '0';
            });

            // ── Scroll wheel → Zoom In ruler ──
            canvas.addEventListener('wheel', e => {
                e.preventDefault();
                const delta  = e.deltaY > 0 ? -5 : 5;
                const newVal = clamp((CameraController.zIn) + delta, 0, 100);
                CameraController.setZoomIn(newVal);

                // Sync the DOM slider visually
                zInSlider.value    = newVal;
                zInVal.textContent = newVal > 0 ? '+' + newVal : '0';
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

        // 'hud' is last so it always renders on top of all other layers
        LayerManager.register('hud', () => {
            HUD.draw();
        });
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

        // 3. Sync DOM date input (non-intrusively)
        UIControls.syncDateDisplay();

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
