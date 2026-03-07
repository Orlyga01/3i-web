// ═══════════════════════════════════════════════════════════════
// 3I/ATLAS JOURNEY
// Scenes: Approach → Entering System → Mars/Perihelion → Earth → Jupiter
// ═══════════════════════════════════════════════════════════════

// ── 3I/ATLAS TRAJECTORY ───────────────────────────────────────

function catmullRom(p0, p1, p2, p3, t) {
    return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

function atlasPos(frac) {
    frac = clamp(frac, 0, 1);
    const n = ATLAS_PATH.length - 1;
    const tf = frac * n, i = Math.min(Math.floor(tf), n - 1), t = tf - i;
    const i0 = Math.max(0, i - 1), i1 = i, i2 = Math.min(n, i + 1), i3 = Math.min(n, i + 2);
    return {
        wx: catmullRom(ATLAS_PATH[i0][1], ATLAS_PATH[i1][1], ATLAS_PATH[i2][1], ATLAS_PATH[i3][1], t),
        wy: catmullRom(ATLAS_PATH[i0][2], ATLAS_PATH[i1][2], ATLAS_PATH[i2][2], ATLAS_PATH[i3][2], t),
        wz: catmullRom(ATLAS_PATH[i0][3], ATLAS_PATH[i1][3], ATLAS_PATH[i2][3], ATLAS_PATH[i3][3], t),
    };
}

function atlasVelocity(frac) {
    const epsilon = 0.002;
    const p1 = atlasPos(Math.max(0, frac - epsilon));
    const p2 = atlasPos(Math.min(1, frac + epsilon));
    return {
        vx: p2.wx - p1.wx,
        vy: p2.wy - p1.wy,
        vz: p2.wz - p1.wz
    };
}

let atlasFrac = -0.05;
let atlasTrail = [];
let atlasFullTrail = [];

function resetAtlas(sceneIdx) {
    const idx = Math.max(0, Math.min(7, sceneIdx));
    atlasFrac = SC_FRAC[idx][0];
    atlasTrail = atlasFullTrail.filter(p => p.frac <= atlasFrac);
}

function drawAtlasTrail() {
    if (atlasTrail.length < 2) return;
    for (let i = 1; i < atlasTrail.length; i++) {
        const a = atlasTrail[i - 1], b = atlasTrail[i];
        const pct = i / atlasTrail.length;
        const { sx: ax, sy: ay } = project3(a.wx, a.wy, a.wz);
        const { sx: bx, sy: by } = project3(b.wx, b.wy, b.wz);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = `rgba(120,255,200,${pct * .7})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
    }
}

function drawMilestone(frac, label, col, yOff) {
    const p = atlasPos(frac);
    const { sx, sy, depth } = project3(p.wx, p.wy, p.wz);
    if (depth < 10) return;
    const sc = clamp(getScale(depth), .4, 1.8);
    ctx.beginPath();
    ctx.arc(sx, sy, 4 * sc, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 8 * sc, 0, Math.PI * 2);
    ctx.strokeStyle = col.replace('.85', '.35').replace('.9', '.3');
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = (11 * sc) + 'px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(label, sx, (yOff || 0) + sy - 13 * sc);
}

// ── SCENE DEFINITIONS ─────────────────────────────────────────
let currentScene = 0, sceneTime = 0;
let isPaused = false;
let globalTimelineProgress = 0;
const TIMELINE_SPEED = 0.00008;

const SCENES = [
    { label: 'THE ECLIPTIC PLANE', sub: 'The flat orbital disc of our solar system' },
    { label: 'ZOOMING TO THE PLANE', sub: 'Camera approaching the entry point' },
    { label: 'REFRAMING VIEW', sub: 'Adjusting perspective to watch for the visitor' },
    { label: 'SPOTTING 3I/ATLAS', sub: 'The interstellar visitor enters the solar system' },
    { label: 'ENTERING THE SYSTEM', sub: 'Retrograde · 5° from ecliptic — camera: 3I/ATLAS perspective' },
    { label: 'OCT 3 — NEAR MARS', sub: 'Oct 29 perihelion · 1.36 AU from Sun · 68 km/s' },
    { label: 'DEC 19 — EARTH ALIGNMENT', sub: 'Earth enters 3I/ATLAS ion tail · comet heads for Jupiter' },
    { label: 'MAR 16 — JUPITER FLYBY', sub: '0.36 AU from Jupiter · exits solar system forever' },
];

function setLabels(n) {
    document.getElementById('sceneLabel').textContent = SCENES[n].label;
    document.getElementById('subLabel').textContent = SCENES[n].sub;
}

function goToScene(n) {
    if (n < 0) {
        // Go back to solar_comet.html
        window.location.href = 'solar_comet.html';
        return;
    }
    if (n >= SCENES.length) return;
    const prev = currentScene;
    currentScene = n;
    sceneTime = 0;
    planeFlash.strength = 0;
    if (n < prev || atlasTrail.length === 0) resetAtlas(n);
    else { atlasFrac = clamp(atlasFrac, SC_FRAC[n][0], SC_FRAC[n][1]); }
    setLabels(n);
    updateTimeline();
}

function updateTimeline() {
    const progress = globalTimelineProgress * 100;
    document.getElementById('timelineProgress').style.width = progress + '%';
    document.getElementById('timelineThumb').style.left = progress + '%';

    const timeEl = document.getElementById('timeIndicator');
    const sceneBounds = [];
    for (let i = 0; i < SCENES.length; i++) {
        sceneBounds.push(i / (SCENES.length - 1));
    }

    const dateMarkers = [
        { pos: sceneBounds[0], label: 'Ecliptic Plane' },
        { pos: sceneBounds[1], label: 'Zooming to Entry Point' },
        { pos: sceneBounds[2], label: 'Reframing View' },
        { pos: sceneBounds[3], label: 'JUL 1, 2025 · Discovery' },
        { pos: (sceneBounds[3] + sceneBounds[4]) / 2, label: 'SEP 2025 · Approaching' },
        { pos: sceneBounds[4], label: 'OCT 3, 2025 · Near Mars' },
        { pos: (sceneBounds[4] + sceneBounds[5]) / 2, label: 'OCT 29, 2025 · Perihelion' },
        { pos: sceneBounds[5], label: 'NOV 2025 · Outbound' },
        { pos: sceneBounds[6], label: 'DEC 19, 2025 · Earth Alignment' },
        { pos: (sceneBounds[6] + sceneBounds[7]) / 2, label: 'FEB 2026 · Heading to Jupiter' },
        { pos: sceneBounds[7], label: 'MAR 16, 2026 · Jupiter Flyby' }
    ];

    let closestIdx = 0, minDist = 999;
    for (let i = 0; i < dateMarkers.length; i++) {
        const dist = Math.abs(dateMarkers[i].pos - globalTimelineProgress);
        if (dist < minDist) { minDist = dist; closestIdx = i; }
    }
    timeEl.textContent = dateMarkers[closestIdx].label;
}

document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentScene < SCENES.length - 1) {
        const nextScene = currentScene + 1;
        globalTimelineProgress = nextScene / SCENES.length;
        goToScene(nextScene);
    }
});
document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentScene > 0) {
        const prevScene = currentScene - 1;
        globalTimelineProgress = prevScene / SCENES.length;
        goToScene(prevScene);
    } else {
        // Go back to solar_comet.html
        window.location.href = 'solar_comet.html';
    }
});
document.getElementById('pauseBtn').addEventListener('click', () => {
    isPaused = !isPaused;
    document.getElementById('pauseBtn').textContent = isPaused ? '▶ Play' : '❚❚ Pause';
});

// Timeline slider interaction
const timeline = document.getElementById('timeline');
let isDragging = false;
let wasPlayingBeforeDrag = false;

function setSceneFromTimeline(clientX) {
    const rect = timeline.getBoundingClientRect();
    const x = clientX - rect.left;
    globalTimelineProgress = clamp(x / rect.width, 0, 1);

    const scene = Math.floor(globalTimelineProgress * SCENES.length);
    const newScene = Math.min(scene, SCENES.length - 1);

    // Calculate progress within the current scene (0 to 1)
    const sceneStart = newScene / SCENES.length;
    const sceneEnd = (newScene + 1) / SCENES.length;
    const sceneProgress = clamp((globalTimelineProgress - sceneStart) / (sceneEnd - sceneStart), 0, 1);

    if (newScene !== currentScene) {
        const prev = currentScene;
        currentScene = newScene;
        planeFlash.strength = 0;
        if (currentScene < prev || atlasTrail.length === 0) resetAtlas(currentScene);
        setLabels(currentScene);
    }

    // Set the atlas fraction and scene time based on where in the scene we are
    const [fracLo, fracHi] = SC_FRAC[currentScene];
    atlasFrac = lerp(fracLo, fracHi, sceneProgress);
    sceneTime = Math.floor(sceneProgress * 800); // Approximate scene duration

    updateTimeline();
}

timeline.addEventListener('mousedown', (e) => {
    isDragging = true;
    wasPlayingBeforeDrag = !isPaused;
    isPaused = true; // Pause while dragging
    setSceneFromTimeline(e.clientX);
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) setSceneFromTimeline(e.clientX);
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        // Resume playing if it was playing before drag
        if (wasPlayingBeforeDrag) {
            isPaused = false;
        }
    }
});

timeline.addEventListener('click', (e) => {
    setSceneFromTimeline(e.clientX);
});

// Click anywhere on canvas to pause/play (except UI area)
canvas.addEventListener('click', (e) => {
    const uiElement = document.getElementById('ui');
    const uiRect = uiElement.getBoundingClientRect();

    // Check if click is outside UI area
    if (e.clientY < uiRect.top - 20) {
        isPaused = !isPaused;
        document.getElementById('pauseBtn').textContent = isPaused ? '▶ Play' : '❚❚ Pause';
    }
});

// Add scene markers to timeline with index numbers
const timelineContainer = document.getElementById('timelineContainer');
for (let i = 0; i < SCENES.length; i++) {
    const marker = document.createElement('div');
    marker.className = 'scene-marker';
    marker.style.left = ((i / SCENES.length) * 100) + '%';
    timeline.appendChild(marker);

    const label = document.createElement('div');
    label.className = 'scene-marker-label';
    label.textContent = i;
    label.style.left = ((i / SCENES.length) * 600) + 'px'; // 600px = timeline width
    timelineContainer.appendChild(label);
}

// Initialize
setLabels(0);
updateTimeline();
resetAtlas(0);

// ── MAIN LOOP ─────────────────────────────────────────────────
function frame() {
    requestAnimationFrame(frame);

    if (!isPaused) {
        sceneTime++;
        for (const p of planets) p.angle += p.speed * .065;

        // Special handling for Scene 0, 1, 2: auto-advance
        if (currentScene === 0 && sceneTime >= 120) {
            currentScene = 1;
            sceneTime = 0;
            globalTimelineProgress = 1 / SCENES.length; // Move to start of Scene 1
            planeFlash.strength = 0;
            resetAtlas(currentScene);
            setLabels(currentScene);
            updateTimeline();
        } else if (currentScene === 1 && sceneTime >= 180) {
            currentScene = 2;
            sceneTime = 0;
            globalTimelineProgress = 2 / SCENES.length; // Move to start of Scene 2
            planeFlash.strength = 0;
            resetAtlas(currentScene);

            // Initialize trail for Scene 2: extends in -Y direction (screen left)
            // Comet moves from Y=-1500 to Y=-787 (+Y direction = screen right)
            // Trail extends from Y=-1500 further left
            atlasTrail = [];
            atlasFullTrail = [];
            const trailLength = 50;
            for (let j = trailLength - 1; j >= 0; j--) {
                const dist = (j / trailLength) * 800;
                atlasTrail.push({
                    wx: 50,              // Same X as comet
                    wy: -1500 - dist,    // Extend further left (Y from -1500 to -2300)
                    wz: 51,              // Same Z
                    frac: 0
                });
            }

            setLabels(currentScene);
            updateTimeline();
        } else if (currentScene === 2 && sceneTime >= 120) {
            currentScene = 3;
            sceneTime = 0;
            globalTimelineProgress = 3 / SCENES.length; // Move to start of Scene 3
            planeFlash.strength = 0;
            resetAtlas(currentScene);
            setLabels(currentScene);
            updateTimeline();
        } else {
            globalTimelineProgress = Math.min(1, globalTimelineProgress + TIMELINE_SPEED);

            const prevScene = currentScene;
            currentScene = Math.floor(globalTimelineProgress * SCENES.length);
            if (currentScene >= SCENES.length) currentScene = SCENES.length - 1;

            if (currentScene !== prevScene) {
                sceneTime = 0;
                planeFlash.strength = 0;
                if (currentScene < prevScene || atlasTrail.length === 0) resetAtlas(currentScene);
                else atlasFrac = clamp(atlasFrac, SC_FRAC[currentScene][0], SC_FRAC[currentScene][1]);
                setLabels(currentScene);
            }

            updateTimeline();
        }
    }

    // ── CAMERA TARGETS ──
    let elTgt = 90, azTgt = 0, distTgt = 1200, txTgt = 0, tyTgt = 0, tzTgt = 0;

    const scIdx = currentScene;
    const [fracLo, fracHi] = SC_FRAC[scIdx];
    // Progress atlasFrac from Scene 3 onward (Scene 2 uses hard-coded position)
    if (!isPaused && currentScene >= 3 && atlasFrac < fracHi) {
        atlasFrac = Math.min(atlasFrac + 0.00038, fracHi);
    }

    // Hard-coded linear interpolation for Scene 2 (no spline curves)
    let ap;
    if (currentScene === 2) {
        const progress = clamp(sceneTime / 120, 0, 1); // 2 seconds
        // With camera az=1.57, -Y direction = screen left, +Y = screen right
        const startX = 48, startY = -1500, startZ = 51;  // Start far in -Y (screen left)
        const endX = 48, endY = -787, endZ = 51;         // End at discovery position
        ap = {
            wx: lerp(startX, endX, progress),
            wy: lerp(startY, endY, progress),
            wz: lerp(startZ, endZ, progress)
        };
    } else {
        ap = atlasPos(atlasFrac);
    }

    // Accumulate trail (from Scene 2 onward)
    if (!isPaused && currentScene >= 2) {
        const trailFrac = currentScene === 2 ? 0 : atlasFrac;
        atlasTrail.push({ wx: ap.wx, wy: ap.wy, wz: ap.wz, frac: trailFrac });
        atlasFullTrail.push({ wx: ap.wx, wy: ap.wy, wz: ap.wz, frac: trailFrac });
    }
    if (atlasTrail.length > 800) atlasTrail.shift();
    if (atlasFullTrail.length > 3000) atlasFullTrail.shift();

    // ── Scene 0: See plane, then move to edge-on view (NO 3I/ATLAS yet) ──
    if (currentScene === 0) {
        const t3 = sceneTime;
        const progress = clamp(t3 / 120, 0, 1); // 2 seconds total (120 frames at 60fps)

        // First part: Show the ecliptic plane from above
        if (progress < 0.4) {
            const p1 = progress / 0.4;
            elTgt = lerp(45, 30, eio(p1));
            azTgt = 0;
            distTgt = 1200;
            txTgt = 0;
            tyTgt = 0;
            tzTgt = 0;
        }
        // Second part: Move camera to edge-on view (elevation 10, slightly tilted)
        else {
            const p2 = (progress - 0.4) / 0.6;
            elTgt = lerp(30, 10, eio(p2));
            azTgt = lerp(0, 1.57, p2); // 90 degrees = 1.57 radians
            distTgt = 1400;
            txTgt = 0;
            tyTgt = 0;
            tzTgt = 0;
        }
    }

    // ── Scene 1: Zoom to 3I/ATLAS entry point (48, -787, 51) ──
    else if (currentScene === 1) {
        // Set final targets - smooth camera interpolation will create the zoom
        elTgt = 12; // Tilt up to see above the plane
        azTgt = 1.50; // Rotate slightly for better viewing angle
        distTgt = 1; // Pull back from close-up
        txTgt = 48; // Stay focused on entry point
        tyTgt = -787;
        tzTgt = 51;
    }

    // ── Scene 2: Watch 3I/ATLAS fly from screen left ──
    else if (currentScene === 2) {
        // Camera tracks comet's motion from Y=-1500 to Y=-787
        elTgt = 8; // SAME as Scene 1
        azTgt = 1.57; // SAME as Scene 1
        distTgt = 30; // SAME as Scene 1 - NO ZOOM CHANGE
        txTgt = ap.wx; // Track comet's X
        tyTgt = ap.wy; // Track comet's Y as it moves
        tzTgt = ap.wz; // Track comet's Z
    }

    // ── Scene 3: Continue tracking 3I/ATLAS ──
    else if (currentScene === 3) {
        const t3 = sceneTime;
        const progress = clamp(t3 / 180, 0, 1); // 3 seconds
        const ap3 = atlasPos(atlasFrac);

        // Keep SAME zoom as Scene 2 (no zoom change)
        const p3 = eio(progress);
        elTgt = lerp(8, 12, p3); // Gradually tilt up
        azTgt = 1.57; // Keep edge-on view
        distTgt = 30; // SAME distance as Scene 2 - NO ZOOM
        txTgt = ap3.wx; // Track 3I's actual moving position
        tyTgt = ap3.wy; // Track 3I's Y position
        tzTgt = ap3.wz * 0.6; // Track near 3I's height
    }

    // ── Scene 4: Entering the system — 3I/ATLAS POV ──
    else if (currentScene === 4) {
        const ap2 = atlasPos(atlasFrac);
        elTgt = 5;
        azTgt = 5.24;
        const perihelionFrac = (atlasFrac - SC_FRAC[4][0]) / (SC_FRAC[4][1] - SC_FRAC[4][0]);
        distTgt = lerp(1100, 700, clamp(perihelionFrac, 0, 1));
        txTgt = lerp(ap2.wx, 0, .45);
        tyTgt = lerp(ap2.wy, 0, .45);
        tzTgt = ap2.wz * .3;
    }

    // ── Scene 5: Near Mars → Perihelion ──
    else if (currentScene === 5) {
        const ap5 = atlasPos(atlasFrac);
        const mwx = Math.cos(planets[3].angle) * 235, mwy = Math.sin(planets[3].angle) * 235;
        const ewx = Math.cos(planets[2].angle) * 170, ewy = Math.sin(planets[2].angle) * 170;

        const sf = clamp((atlasFrac - AT_MARS) / (AT_PERIHELION - AT_MARS), 0, 1);

        if (sf < 0.4) {
            const vel = atlasVelocity(atlasFrac);
            const vLen = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy + vel.vz * vel.vz) || 1;
            const vx = vel.vx / vLen, vy = vel.vy / vLen, vz = vel.vz / vLen;

            txTgt = mwx;
            tyTgt = mwy;
            tzTgt = 0;

            const backDist = 220;
            const camX = ap5.wx - vx * backDist;
            const camY = ap5.wy - vy * backDist;
            const camZ = ap5.wz - vz * backDist;

            const dx = camX - txTgt, dy = camY - tyTgt, dz = camZ - tzTgt;
            distTgt = Math.sqrt(dx * dx + dy * dy + dz * dz);
            azTgt = Math.atan2(dx, -dy);
            elTgt = Math.atan2(dz, Math.sqrt(dx * dx + dy * dy)) * 180 / Math.PI;
        } else {
            const earthAz = Math.atan2(ewx, -ewy);
            azTgt = earthAz;
            elTgt = lerp(18, 25, eio((sf - 0.4) / 0.6));
            distTgt = lerp(520, 650, eio((sf - 0.4) / 0.6));
            txTgt = 0;
            tyTgt = 0;
            tzTgt = 0;
        }
    }

    // ── Scene 6: Dec 19 — Earth tail alignment ──
    else if (currentScene === 6) {
        const ap6 = atlasPos(atlasFrac);
        const ewx = Math.cos(planets[2].angle) * 170, ewy = Math.sin(planets[2].angle) * 170;
        elTgt = 25;
        azTgt = 4.7;
        distTgt = 900;
        txTgt = (ap6.wx + ewx) * .4;
        tyTgt = (ap6.wy + ewy) * .4;
    }

    // ── Scene 7: Jupiter flyby ──
    else if (currentScene === 7) {
        const ap7 = atlasPos(atlasFrac);
        const jx = planets[4].orbit * Math.cos(planets[4].angle);
        const jy = planets[4].orbit * Math.sin(planets[4].angle);
        elTgt = 32;
        azTgt = 4.5;
        distTgt = lerp(900, 1200, clamp((atlasFrac - .88) / .12, 0, 1));
        txTgt = lerp(jx, ap7.wx, .4);
        tyTgt = lerp(jy, ap7.wy, .4);
    }

    // ── SMOOTH CAMERA ──
    const sp = .022;
    aEl = lerp(aEl, elTgt, sp);
    aAz = lerp(aAz, azTgt, sp * .75);
    aDist = lerp(aDist, distTgt, sp * .65);
    aTx = lerp(aTx, txTgt, sp);
    aTy = lerp(aTy, tyTgt, sp);
    aTz = lerp(aTz, tzTgt, sp);
    CAM = buildCamera(aEl, aAz, aDist, aTx, aTy, aTz);

    if (!isPaused) planeFlash.strength *= .90;

    // ── DRAW ──────────────────────────────────────────────────────
    ctx.fillStyle = '#00010e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStars();
    drawEclipticPlane();

    const oA = .48;
    for (let i = 0; i < N_PLANETS; i++) drawOrbit(planets[i], oA);
    for (let i = 0; i < N_PLANETS; i++) drawPlanet(planets[i], currentScene >= 5);
    drawSun();

    // Trail (show from Scene 2 onward when 3I flies in)
    if (currentScene >= 2) {
        drawAtlasTrail();
    }

    // Comet (show from Scene 2 onward when 3I flies in)
    if (currentScene >= 2) {
        // Make comet much smaller in Scene 2, normal size from Scene 3 onward
        const cometSize = currentScene === 2 ? 0.05 : 1;
        drawComet(ap.wx, ap.wy, ap.wz, 1, '120,255,200', cometSize);
    }

    // ── Milestone annotations ──
    if (currentScene === 2 || currentScene === 3) {
        drawMilestone(AT_ENTRY, 'Jul 1 · Discovery at 4.5 AU', 'rgba(180,220,255,.9)');
    }

    if (currentScene === 4) {
        const { sx: cx, sy: cy } = project3(0, 0, 0);
        ctx.fillStyle = 'rgba(160,210,255,.6)';
        ctx.font = '12px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('← Ecliptic Plane →', cx, cy + 28);
        const pp = atlasPos(AT_PERIHELION);
        const { sx: px, sy: py, depth: pd } = project3(pp.wx, pp.wy, pp.wz);
        if (pd > 10) {
            const sc = clamp(getScale(pd), .3, 1.5);
            ctx.beginPath();
            ctx.arc(px, py, 6 * sc, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,100,.7)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,245,150,.8)';
            ctx.font = (10 * sc) + 'px Georgia';
            ctx.textAlign = 'center';
            ctx.fillText('Oct 29 · Perihelion ahead', px, py - 12 * sc);
        }
    }

    if (currentScene >= 5) {
        drawMilestone(AT_MARS, 'Oct 3 · Near Mars  0.19 AU', 'rgba(255,150,80,.9)');
        drawMilestone(AT_PERIHELION, 'Oct 29 · Perihelion  1.36 AU', 'rgba(255,255,120,.92)');
    }

    if (currentScene === 6) {
        drawMilestone(AT_EARTH, 'Dec 19 · Closest to Earth  1.8 AU', 'rgba(100,210,255,.9)');
        const ewx = Math.cos(planets[2].angle) * 170, ewy = Math.sin(planets[2].angle) * 170;
        const { sx: esx, sy: esy } = project3(ewx, ewy, 0);
        const { sx: csx, sy: csy } = project3(ap.wx, ap.wy, ap.wz);
        ctx.save();
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(csx, csy);
        ctx.lineTo(esx, esy);
        ctx.strokeStyle = 'rgba(100,220,255,.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        const midSx = (csx + esx) * .5, midSy = (csy + esy) * .5;
        ctx.fillStyle = 'rgba(120,220,255,.75)';
        ctx.font = '11px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Earth in ion tail', midSx, midSy - 10);
    }

    if (currentScene === 7) {
        drawMilestone(AT_MARS, 'Oct 3 · Mars', 'rgba(255,150,80,.75)');
        drawMilestone(AT_PERIHELION, 'Oct 29 · Perihelion', 'rgba(255,255,120,.8)');
        drawMilestone(AT_EARTH, 'Dec 19 · Earth', 'rgba(100,210,255,.75)');

        const ewx = Math.cos(planets[2].angle) * 170, ewy = Math.sin(planets[2].angle) * 170;
        const { sx: esx, sy: esy } = project3(ewx, ewy, 0);
        const { sx: csx, sy: csy } = project3(ap.wx, ap.wy, ap.wz);
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(csx, csy);
        ctx.lineTo(esx, esy);
        ctx.strokeStyle = 'rgba(100,220,255,.25)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        const jx = planets[4].orbit * Math.cos(planets[4].angle);
        const jy = planets[4].orbit * Math.sin(planets[4].angle);
        const { sx: jsx, sy: jsy, depth: jd } = project3(jx, jy, 0);
        const jsc = clamp(getScale(jd), .4, 1.6);
        ctx.beginPath();
        ctx.arc(jsx, jsy, 40 * jsc, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,210,80,.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,230,110,.9)';
        ctx.font = (12 * jsc) + 'px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('Mar 16 · Jupiter flyby  0.36 AU', jsx, jsy - 44 * jsc);

        if (atlasFrac > 0.97) {
            const { sx: exs, sy: eys } = project3(ap.wx, ap.wy, ap.wz);
            ctx.fillStyle = 'rgba(200,220,255,.75)';
            ctx.font = '12px Georgia';
            ctx.textAlign = 'left';
            ctx.fillText('→ Exits solar system · never returns', exs + 12, eys - 8);
        }
    }

    // Evolving closeup inset panel (show from Scene 2 onward when 3I appears)
    if (currentScene >= 3) {
        drawAtlasCloseup(atlasFrac);
    }

    // Update calendar display (show from Scene 2 onward when 3I appears)
    const calEl = document.getElementById('calendar');
    if (currentScene >= 2) {
        calEl.textContent = fracToDate(atlasFrac);
    } else {
        calEl.textContent = '';
    }
}

// ── 3I/ATLAS CLOSEUP INSET PANEL ─────────────────────────────
let globalT2 = 0;

function drawAtlasCloseup(frac) {
    if (frac <= 0) return;
    if (!isPaused) globalT2 += 0.05;

    const W = canvas.width, H = canvas.height;
    const PW = 220, PH = 220;
    const PX = W - PW - 24, PY = H - PH - 80;
    const CX = PX + PW / 2, CY = PY + PH / 2;

    let phase, pBlend;
    if (frac < 0.20) { phase = 0; pBlend = frac / 0.20; }
    else if (frac < 0.38) { phase = 1; pBlend = (frac - 0.20) / 0.18; }
    else if (frac < 0.46) { phase = 2; pBlend = (frac - 0.38) / 0.08; }
    else if (frac < 0.60) { phase = 3; pBlend = (frac - 0.46) / 0.14; }
    else if (frac < 0.85) { phase = 4; pBlend = (frac - 0.60) / 0.25; }
    else { phase = 5; pBlend = (frac - 0.85) / 0.15; }

    const brightness = clamp(pBlend, 0.2, 1);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PX, PY, PW, PH, 10);
    ctx.fillStyle = 'rgba(0,1,8,0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(130,180,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 40; i++) {
        const sx = PX + ((i * 137.5) % PW);
        const sy = PY + ((i * 97.3) % PH);
        ctx.beginPath();
        ctx.arc(sx, sy, .7, 0, Math.PI * 2);
        ctx.fill();
    }

    const tailAngle = lerp(-0.6, 2.0, clamp(frac / 0.8, 0, 1));
    const antiTailAngle = tailAngle + Math.PI;

    let nucBright;
    if (frac < 0.42) nucBright = lerp(0.3, 1.0, frac / 0.42);
    else nucBright = lerp(1.0, 0.35, clamp((frac - 0.42) / 0.5, 0, 1));
    nucBright = clamp(nucBright, 0.15, 1.0);

    const nucR = clamp(lerp(4, 14, nucBright) * 1, 5, 14);
    const dustTailLen = lerp(20, 90, clamp(frac / 0.5, 0, 1)) + lerp(0, 20, clamp((frac - 0.5) / 0.4, 0, 1));
    const ionTailLen = lerp(10, 110, clamp(frac / 0.45, 0, 1)) * lerp(1, 0.4, clamp((frac - 0.7) / 0.3, 0, 1));

    // Phase 0: Green coma
    if (phase === 0) {
        const comaR = lerp(18, 38, pBlend);
        const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, comaR * 2);
        cg.addColorStop(0, `rgba(140,255,80,${nucBright * .9})`);
        cg.addColorStop(0.15, `rgba(80,230,40,${nucBright * .7})`);
        cg.addColorStop(0.45, `rgba(30,180,20,${nucBright * .4})`);
        cg.addColorStop(1, `rgba(0,80,0,0)`);
        ctx.beginPath();
        ctx.arc(CX, CY, comaR * 2, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();

        const tx2 = CX + Math.cos(tailAngle) * dustTailLen * .4;
        const ty2 = CY - Math.sin(tailAngle) * dustTailLen * .4;
        const tg = ctx.createLinearGradient(CX, CY, tx2, ty2);
        tg.addColorStop(0, `rgba(80,200,40,${nucBright * .5})`);
        tg.addColorStop(1, 'rgba(0,80,0,0)');
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = tg;
        ctx.lineWidth = 8;
        ctx.stroke();

        const ng = ctx.createRadialGradient(CX, CY, 0, CX, CY, nucR);
        ng.addColorStop(0, 'rgba(220,255,180,1)');
        ng.addColorStop(0.3, `rgba(100,255,80,${nucBright})`);
        ng.addColorStop(1, 'rgba(0,120,0,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, nucR, 0, Math.PI * 2);
        ctx.fillStyle = ng;
        ctx.fill();
    }

    // Phase 1: Warming
    else if (phase === 1) {
        const r = lerp(80, 255, pBlend), g2 = lerp(230, 130, pBlend), b = lerp(40, 30, pBlend);
        const comaR = lerp(35, 55, pBlend);

        const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, comaR);
        cg.addColorStop(0, `rgba(${r},${g2},${b},${nucBright * .85})`);
        cg.addColorStop(0.35, `rgba(${Math.round(r * .6)},${Math.round(g2 * .5)},${b},${nucBright * .4})`);
        cg.addColorStop(1, `rgba(10,5,0,0)`);
        ctx.beginPath();
        ctx.arc(CX, CY, comaR, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();

        const tx2 = CX + Math.cos(tailAngle) * dustTailLen * .6;
        const ty2 = CY - Math.sin(tailAngle) * dustTailLen * .6;
        const tg = ctx.createLinearGradient(CX, CY, tx2, ty2);
        tg.addColorStop(0, `rgba(${r},${Math.round(g2 * .7)},50,${nucBright * .6})`);
        tg.addColorStop(1, 'rgba(20,10,0,0)');
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = tg;
        ctx.lineWidth = 12;
        ctx.stroke();

        const ng = ctx.createRadialGradient(CX, CY, 0, CX, CY, nucR);
        ng.addColorStop(0, 'rgba(255,255,200,1)');
        ng.addColorStop(0.4, `rgba(${r},${Math.round(g2 * .8)},60,${nucBright})`);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, nucR, 0, Math.PI * 2);
        ctx.fillStyle = ng;
        ctx.fill();
    }

    // Phase 2: Perihelion
    else if (phase === 2) {
        const comaR = 65;
        const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, comaR);
        cg.addColorStop(0, 'rgba(255,240,180,0.95)');
        cg.addColorStop(0.12, 'rgba(255,200,100,0.7)');
        cg.addColorStop(0.35, 'rgba(180,120,50,0.35)');
        cg.addColorStop(0.7, 'rgba(60,30,10,0.12)');
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, comaR, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();

        const ionAng = tailAngle - 0.15;
        const iTailX = CX + Math.cos(ionAng) * ionTailLen;
        const iTailY = CY - Math.sin(ionAng) * ionTailLen;
        const ionG = ctx.createLinearGradient(CX, CY, iTailX, iTailY);
        ionG.addColorStop(0, 'rgba(100,180,255,0.9)');
        ionG.addColorStop(0.2, 'rgba(80,140,255,0.7)');
        ionG.addColorStop(0.55, 'rgba(40,80,200,0.4)');
        ionG.addColorStop(1, 'rgba(10,20,80,0)');
        ctx.lineWidth = 14;
        ctx.strokeStyle = ionG;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(iTailX, iTailY);
        ctx.stroke();
        const ionG2 = ctx.createLinearGradient(CX, CY, iTailX, iTailY);
        ionG2.addColorStop(0, 'rgba(200,230,255,0.95)');
        ionG2.addColorStop(0.3, 'rgba(150,200,255,0.7)');
        ionG2.addColorStop(1, 'rgba(80,120,255,0)');
        ctx.lineWidth = 3;
        ctx.strokeStyle = ionG2;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(iTailX, iTailY);
        ctx.stroke();

        const dAng = tailAngle + 0.25;
        const dTailX = CX + Math.cos(dAng) * dustTailLen * .6;
        const dTailY = CY - Math.sin(dAng) * dustTailLen * .6;
        const dustG = ctx.createLinearGradient(CX, CY, dTailX, dTailY);
        dustG.addColorStop(0, 'rgba(255,220,140,0.8)');
        dustG.addColorStop(0.4, 'rgba(200,160,80,0.4)');
        dustG.addColorStop(1, 'rgba(100,60,20,0)');
        ctx.lineWidth = 22;
        ctx.strokeStyle = dustG;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(dTailX, dTailY);
        ctx.stroke();

        const ng = ctx.createRadialGradient(CX, CY, 0, CX, CY, nucR * 1.5);
        ng.addColorStop(0, 'rgba(255,255,255,1)');
        ng.addColorStop(0.15, 'rgba(255,250,220,1)');
        ng.addColorStop(0.4, 'rgba(255,210,120,0.9)');
        ng.addColorStop(0.7, 'rgba(200,140,60,0.5)');
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, nucR * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = ng;
        ctx.fill();
    }

    // Phase 3: Post-perihelion
    else if (phase === 3) {
        const antiLen = lerp(0, 40, pBlend);

        const comaR = 58;
        const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, comaR);
        cg.addColorStop(0, 'rgba(255,210,130,0.85)');
        cg.addColorStop(0.3, 'rgba(180,100,40,0.35)');
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, comaR, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();

        const ionAng = tailAngle;
        const iTailX = CX + Math.cos(ionAng) * ionTailLen * .85;
        const iTailY = CY - Math.sin(ionAng) * ionTailLen * .85;
        const ionG = ctx.createLinearGradient(CX, CY, iTailX, iTailY);
        ionG.addColorStop(0, 'rgba(80,160,255,0.85)');
        ionG.addColorStop(0.4, 'rgba(50,100,220,0.45)');
        ionG.addColorStop(1, 'rgba(10,30,100,0)');
        ctx.lineWidth = 12;
        ctx.strokeStyle = ionG;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(iTailX, iTailY);
        ctx.stroke();

        const dAng = tailAngle + 0.3;
        const dTX = CX + Math.cos(dAng) * dustTailLen * .7;
        const dTY = CY - Math.sin(dAng) * dustTailLen * .7;
        const dg = ctx.createLinearGradient(CX, CY, dTX, dTY);
        dg.addColorStop(0, 'rgba(240,190,100,0.75)');
        dg.addColorStop(1, 'rgba(80,40,0,0)');
        ctx.lineWidth = 18;
        ctx.strokeStyle = dg;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(dTX, dTY);
        ctx.stroke();

        if (antiLen > 3) {
            const aTX = CX + Math.cos(antiTailAngle) * antiLen;
            const aTY = CY - Math.sin(antiTailAngle) * antiLen;
            const ag = ctx.createLinearGradient(CX, CY, aTX, aTY);
            ag.addColorStop(0, 'rgba(255,240,200,0.85)');
            ag.addColorStop(0.5, 'rgba(200,180,130,0.5)');
            ag.addColorStop(1, 'rgba(100,80,40,0)');
            ctx.lineWidth = 4;
            ctx.strokeStyle = ag;
            ctx.beginPath();
            ctx.moveTo(CX, CY);
            ctx.lineTo(aTX, aTY);
            ctx.stroke();
        }

        const ng = ctx.createRadialGradient(CX, CY, 0, CX, CY, nucR);
        ng.addColorStop(0, 'rgba(255,255,200,1)');
        ng.addColorStop(0.35, 'rgba(255,190,90,0.9)');
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, nucR, 0, Math.PI * 2);
        ctx.fillStyle = ng;
        ctx.fill();
    }

    // Phase 4 & 5: Jets and fading
    else if (phase === 4 || phase === 5) {
        const fadeOut = phase === 5 ? lerp(1, 0.3, pBlend) : 1;

        const bg2 = ctx.createRadialGradient(CX, CY, 0, CX, CY, PW * .6);
        bg2.addColorStop(0, `rgba(40,10,0,${fadeOut * .25})`);
        bg2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, PW * .6, 0, Math.PI * 2);
        ctx.fillStyle = bg2;
        ctx.fill();

        const dAng = tailAngle + 0.35;
        const dLen = dustTailLen * (phase === 4 ? lerp(0.9, 1.2, pBlend) : 1.3 * fadeOut);
        const dTX = CX + Math.cos(dAng) * dLen;
        const dTY = CY - Math.sin(dAng) * dLen;
        const dg = ctx.createLinearGradient(CX, CY, dTX, dTY);
        dg.addColorStop(0, `rgba(220,150,60,${fadeOut * .7})`);
        dg.addColorStop(0.5, `rgba(160,80,20,${fadeOut * .3})`);
        dg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.lineWidth = 14;
        ctx.strokeStyle = dg;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(dTX, dTY);
        ctx.stroke();

        const iLen = ionTailLen * fadeOut * .7;
        const iTX = CX + Math.cos(tailAngle) * iLen;
        const iTY = CY - Math.sin(tailAngle) * iLen;
        const ig = ctx.createLinearGradient(CX, CY, iTX, iTY);
        ig.addColorStop(0, `rgba(60,130,255,${fadeOut * .55})`);
        ig.addColorStop(0.5, `rgba(30,70,180,${fadeOut * .25})`);
        ig.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.lineWidth = 8;
        ctx.strokeStyle = ig;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(iTX, iTY);
        ctx.stroke();

        const aLen = lerp(38, 65, pBlend) * fadeOut;
        const aTX = CX + Math.cos(antiTailAngle) * aLen;
        const aTY = CY - Math.sin(antiTailAngle) * aLen;
        const ag = ctx.createLinearGradient(CX, CY, aTX, aTY);
        ag.addColorStop(0, `rgba(255,230,160,${fadeOut * .9})`);
        ag.addColorStop(0.4, `rgba(200,160,80,${fadeOut * .5})`);
        ag.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.lineWidth = 5;
        ctx.strokeStyle = ag;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(aTX, aTY);
        ctx.stroke();

        const jetBase = globalT2 * .08;
        for (let j = 0; j < 3; j++) {
            const jAng = jetBase + j * (Math.PI * 2 / 3);
            const jLen = lerp(22, 34, pBlend) * fadeOut;
            const jW = lerp(6, 10, pBlend);
            const jTX = CX + Math.cos(jAng) * jLen;
            const jTY = CY - Math.sin(jAng) * jLen;

            const jCols = [
                ['80,255,120', '30,180,60'],
                ['255,200,60', '200,100,20'],
                ['60,220,255', '20,120,200'],
            ];
            const [cInner, cOuter] = jCols[j];

            const jg = ctx.createLinearGradient(CX, CY, jTX, jTY);
            jg.addColorStop(0, `rgba(${cOuter},${fadeOut * .7})`);
            jg.addColorStop(0.5, `rgba(${cOuter},${fadeOut * .3})`);
            jg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.lineWidth = jW;
            ctx.strokeStyle = jg;
            ctx.beginPath();
            ctx.moveTo(CX, CY);
            ctx.lineTo(jTX, jTY);
            ctx.stroke();

            const jg2 = ctx.createLinearGradient(CX, CY, jTX, jTY);
            jg2.addColorStop(0, `rgba(${cInner},${fadeOut * .95})`);
            jg2.addColorStop(0.35, `rgba(${cInner},${fadeOut * .55})`);
            jg2.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = jg2;
            ctx.beginPath();
            ctx.moveTo(CX, CY);
            ctx.lineTo(jTX * .6 + CX * .4, jTY * .6 + CY * .4);
            ctx.stroke();
        }

        const ng = ctx.createRadialGradient(CX, CY, 0, CX, CY, nucR * 1.1);
        ng.addColorStop(0, `rgba(255,255,255,${fadeOut})`);
        ng.addColorStop(0.2, `rgba(80,255,200,${fadeOut * .9})`);
        ng.addColorStop(0.5, `rgba(255,100,20,${fadeOut * .6})`);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(CX, CY, nucR * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = ng;
        ctx.fill();

        if (phase === 4) {
            ctx.fillStyle = `rgba(255,160,60,${fadeOut * .7})`;
            ctx.font = '9px Georgia';
            ctx.textAlign = 'right';
            ctx.fillText('false color', PX + PW - 6, PY + PH - 6);
        }
    }

    const phaseTitles = [
        'Jul 2025 · Discovery · C₂ green glow',
        'Sep 2025 · Brightening · 4 AU',
        'Oct 29 · Perihelion · peak brightness',
        'Nov 2025 · Post-perihelion · anti-tail',
        'Dec 2025 · 3 jets · 120° spacing',
        'Mar 2026 · Fading · exits system',
    ];
    ctx.fillStyle = 'rgba(200,220,255,0.75)';
    ctx.font = '10px Georgia';
    ctx.textAlign = 'left';
    ctx.fillText(phaseTitles[phase], PX + 7, PY + 14);

    ctx.fillStyle = 'rgba(140,180,255,0.55)';
    ctx.font = '9px Georgia';
    ctx.textAlign = 'right';
    ctx.fillText('3I/ATLAS · closeup', PX + PW - 6, PY + 14);

    ctx.restore();
}

frame();
