// ═══════════════════════════════════════════════════════════════
// SOLAR SYSTEM OVERVIEW
// Scenes: Ecliptic Plane → Interstellar Visitors
// ═══════════════════════════════════════════════════════════════

// ── SCENE 2: Example comets showing ecliptic piercing ─────────
const S2_DUR = 520, S2_PHASE_TOTAL = 820;
let s2Phase = 0, s2T = 0;

const S2_DEF = [
  {
    label: 'Comet A · 90° to plane', col: '160,220,255',
    wx0: -60, wy0: 20, wz0: 680, vx: .10, vy: .06, vz: -1.42,
    azDeg: 18, elStart: 50, elEnd: -34, dist: 920
  },
  {
    label: 'Comet B · from below, -45°', col: '120,180,255',
    wx0: 310, wy0: -776, wz0: -600, vx: -.80, vy: .578, vz: 1.16,
    azDeg: 238, elStart: -42, elEnd: 34, dist: 1050
  },
];

function s2CometPos(def, t) {
  return { wx: def.wx0 + def.vx * t, wy: def.wy0 + def.vy * t, wz: def.wz0 + def.vz * t };
}

function s2CometAlpha(t) {
  return Math.min(clamp(t / 60, 0, 1), clamp((S2_PHASE_TOTAL - t) / 120, 0, 1));
}

// ── SCENE DEFINITIONS ─────────────────────────────────────────
let currentScene = 0, sceneTime = 0;
let isPaused = false;
let globalTimelineProgress = 0;
const TIMELINE_SPEED = 0.00008;

const SCENES = [
  { label: 'THE ECLIPTIC PLANE', sub: 'All planets share the same orbital plane' },
  { label: 'INTERSTELLAR VISITORS', sub: 'Comets arrive from all directions, piercing the plane' },
];

function setLabels(n) {
  document.getElementById('sceneLabel').textContent = SCENES[n].label;
  document.getElementById('subLabel').textContent = SCENES[n].sub;
}

function goToScene(n) {
  if (n >= SCENES.length) {
    // Go to ATLAS journey
    window.location.href = 'atlas_journey.html';
    return;
  }
  if (n < 0 || n >= SCENES.length) return;
  currentScene = n;
  sceneTime = 0;
  planeFlash.strength = 0;
  s2Phase = 0;
  s2T = 0;
  setLabels(n);
  updateTimeline();
}

function updateTimeline() {
  const progress = globalTimelineProgress * 100;
  document.getElementById('timelineProgress').style.width = progress + '%';
  document.getElementById('timelineThumb').style.left = progress + '%';

  const timeEl = document.getElementById('timeIndicator');
  timeEl.textContent = '';
}

document.getElementById('nextBtn').addEventListener('click', () => {
  if (currentScene < SCENES.length - 1) {
    const nextScene = currentScene + 1;
    globalTimelineProgress = nextScene / SCENES.length;
    goToScene(nextScene);
  } else {
    // Go to ATLAS journey
    window.location.href = 'atlas_journey.html';
  }
});

document.getElementById('prevBtn').addEventListener('click', () => {
  if (currentScene > 0) {
    const prevScene = currentScene - 1;
    globalTimelineProgress = prevScene / SCENES.length;
    goToScene(prevScene);
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
    currentScene = newScene;
    planeFlash.strength = 0;
    setLabels(currentScene);
  }

  // Set the scene time based on where in the scene we are
  if (currentScene === 0) {
    // Scene 0: Ecliptic plane animation (up to ~760 frames for full cycle)
    sceneTime = Math.floor(sceneProgress * 760);
  } else if (currentScene === 1) {
    // Scene 1: Comet phases (S2_PHASE_TOTAL * 2 phases)
    const totalDuration = S2_PHASE_TOTAL * 2; // Two comet phases
    const totalTime = Math.floor(sceneProgress * totalDuration);
    s2Phase = Math.floor(totalTime / S2_PHASE_TOTAL);
    s2Phase = Math.min(s2Phase, 1); // Clamp to valid phase
    s2T = totalTime % S2_PHASE_TOTAL;
    sceneTime = totalTime;
  }

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

// Add scene markers to timeline
// Markers show where each scene starts in the timeline
for (let i = 0; i < SCENES.length; i++) {
  const marker = document.createElement('div');
  marker.className = 'scene-marker';
  // Scene i starts at position (i / SCENES.length) of the timeline
  marker.style.left = ((i / SCENES.length) * 100) + '%';
  timeline.appendChild(marker);
}

// Initialize
setLabels(0);
updateTimeline();

// ── MAIN LOOP ─────────────────────────────────────────────────
function frame() {
  requestAnimationFrame(frame);

  if (!isPaused) {
    sceneTime++;
    for (const p of planets) p.angle += p.speed * .065;

    globalTimelineProgress = Math.min(1, globalTimelineProgress + TIMELINE_SPEED);

    const prevScene = currentScene;
    // Calculate scene properly to avoid going out of bounds
    const scene = Math.floor(globalTimelineProgress * SCENES.length);
    currentScene = Math.min(scene, SCENES.length - 1);

    if (currentScene !== prevScene) {
      sceneTime = 0;
      planeFlash.strength = 0;
      s2Phase = 0;
      s2T = 0;
      setLabels(currentScene);
    }

    // Only redirect when timeline reaches 100% (globalTimelineProgress >= 1)
    if (globalTimelineProgress >= 1.0) {
      // Allow some time on the last scene before redirecting
      if (sceneTime > 300) {  // ~5 seconds at 60fps
        window.location.href = 'atlas_journey.html';
        return;
      }
    }

    updateTimeline();
  }

  // ── CAMERA TARGETS ──
  let elTgt = 90, azTgt = 0, distTgt = 1200, txTgt = 0, tyTgt = 0, tzTgt = 0;

  // ── SCENE 0: ecliptic plane reveal (with 1-second delay) ──
  if (currentScene === 0) {
    const t0 = sceneTime;
    if (t0 < 60) {
      elTgt = 90;
      azTgt = 0;
      distTgt = 980;
    } else {
      const t1 = t0 - 60;
      if (t1 < 180) elTgt = lerp(90, 45, eio(t1 / 180));
      else if (t1 < 320) elTgt = lerp(45, 0, eio((t1 - 180) / 140));
      else if (t1 < 420) elTgt = lerp(0, -45, eio((t1 - 320) / 100));
      else if (t1 < 560) elTgt = lerp(-45, 0, eio((t1 - 420) / 140));
      else if (t1 < 700) elTgt = lerp(0, 45, eio((t1 - 560) / 140));
      else elTgt = 45;
      azTgt = t1 * .0025;
      distTgt = 980;
    }
  }

  // ── SCENE 1: example comets piercing the plane ──
  else if (currentScene === 1) {
    if (!isPaused) {
      s2T++;
      if (s2T > S2_PHASE_TOTAL && s2Phase < 1) {
        s2Phase++;
        s2T = 0;
        planeFlash.strength = 0;
        document.getElementById('subLabel').textContent = S2_DEF[s2Phase].label;
      }
    }
    const def = S2_DEF[s2Phase];
    const prog = clamp(s2T / S2_DUR, 0, 1);
    const { wx: cwx, wy: cwy, wz: cwz } = s2CometPos(def, s2T);

    elTgt = lerp(def.elStart, def.elEnd, eio(prog));
    azTgt = def.azDeg * Math.PI / 180;
    distTgt = def.dist;
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
  for (let i = 0; i < N_PLANETS; i++) drawPlanet(planets[i], true);
  drawSun();

  // ── SCENE 1: example comets ──
  if (currentScene === 1) {
    const def = S2_DEF[s2Phase];
    const { wx: cwx, wy: cwy, wz: cwz } = s2CometPos(def, s2T);
    const alpha = s2CometAlpha(s2T);
    drawComet(cwx, cwy, cwz, alpha, def.col);

    if (Math.abs(cwz) < 60 && alpha > .1) {
      planeFlash.x = cwx;
      planeFlash.y = cwy;
      planeFlash.strength = Math.min(1, planeFlash.strength + .16 * (1 - Math.abs(cwz) / 60));
    }
    drawPlaneFlash();

    // Phase indicator dots
    const lbls = ['A · 90°', 'B · −45°'];
    for (let i = 0; i < 2; i++) {
      const active = i === s2Phase, done = i < s2Phase;
      ctx.beginPath();
      ctx.arc(canvas.width / 2 - 60 + i * 60, canvas.height - 68, active ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(200,230,255,.95)' : done ? 'rgba(100,160,255,.55)' : 'rgba(55,75,140,.4)';
      ctx.fill();
      ctx.fillStyle = active ? 'rgba(210,235,255,.92)' : 'rgba(120,160,200,.5)';
      ctx.font = '11px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(lbls[i], canvas.width / 2 - 60 + i * 60, canvas.height - 50);
    }
  }

  // Hide calendar for these scenes
  const calEl = document.getElementById('calendar');
  calEl.textContent = '';
}

frame();
