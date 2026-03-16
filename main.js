// ═══════════════════════════════════════════════════════════════
// SOLAR SYSTEM OVERVIEW
// Scenes: Ecliptic Plane → Interstellar Visitors
// ═══════════════════════════════════════════════════════════════

// ── SCENE 2: Example comets showing ecliptic piercing ─────────
const S2_INTRO_DUR = 240, S2_DUR = 540, S2_PHASE_TOTAL = 760;
let s2Phase = 0, s2T = 0;
let s2LockedCamera = null;
let s2IntroT = 0;
let s2IntroCamera = null;
const S2_INTRO_ZOOM_MULT = 2.45;
const SOLAR_COMET_SCENE_IMAGE = typeof window.getSharedSpriteImage === 'function'
  ? window.getSharedSpriteImage('assets/comet.png')
  : null;
const solarCometTranslations = window.AppTranslations || {};
const solarCometLocale = solarCometTranslations.getLocaleFromSearch?.(window.location.search) || 'en';

solarCometTranslations.setDocumentLocale?.(solarCometLocale);
document.documentElement.dataset.i18nReady = 'false';

function st(name, fallback = '') {
  const sourceText = fallback || (typeof name === 'string' ? name : '');
  return solarCometTranslations.translate?.(sourceText, {
    locale: solarCometLocale,
    fallback: sourceText,
  }) || sourceText;
}

document.title = st('objects.3I.slidePages.solarComet.title', document.title);
solarCometTranslations.loadTranslations?.().then(() => {
  document.title = st('objects.3I.slidePages.solarComet.title', document.title);
  setLabels?.(currentScene);
}).catch(() => {}).finally(() => {
  document.documentElement.dataset.i18nReady = 'true';
});

const S2_DEF = [
  {
    label: 'Comet A · rising up through the ecliptic',
    shortLabel: 'Below plane',
    col: '170,210,255',
    path: 'linear',
    wx0: 185, wy0: -310, wz0: -540, vx: -.24, vy: .42, vz: 1.95,
    azDeg: 228, elStart: -28, elEnd: 24, dist: 650,
    tailMode: 'plane',
    tailStart: 170,
    tailEnd: 380,
    trackFactor: 0.26,
    sizeMultiplier: 1.14,
  },
  {
    label: 'Comet B · bends around the Sun',
    shortLabel: 'Sun bend',
    col: '205,230,255',
    lockCamera: true,
    path: 'gravityArc',
    startAngle: -0.38,
    periAngle: 0.44,
    endAngle: 1.18,
    startRadius: 860,
    periRadius: 150,
    endRadius: 980,
    startZ: 420,
    periZ: 20,
    endZ: -240,
    azDeg: 20, elStart: 20, elEnd: 20, dist: 820,
    tailMode: 'sun',
    tailNear: 180,
    tailFar: 820,
    trackFactor: 0,
    sizeMultiplier: 1.08,
  },
];

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t * t2;
  return {
    wx: a * p0.wx + b * p1.wx + c * p2.wx + d * p3.wx,
    wy: a * p0.wy + b * p1.wy + c * p2.wy + d * p3.wy,
    wz: a * p0.wz + b * p1.wz + c * p2.wz + d * p3.wz,
  };
}

function s2GravityArcPos(def, t) {
  const prog = clamp(t / S2_DUR, 0, 1);
  const split = 0.48;

  let angle;
  let radius;
  let wz;

  if (prog <= split) {
    const local = eio(prog / split);
    angle = lerp(def.startAngle, def.periAngle, local);
    radius = lerp(def.startRadius, def.periRadius, local);
    wz = lerp(def.startZ, def.periZ, local);
  } else {
    const local = eio((prog - split) / (1 - split));
    angle = lerp(def.periAngle, def.endAngle, local);
    radius = lerp(def.periRadius, def.endRadius, local);
    wz = lerp(def.periZ, def.endZ, local);
  }

  return {
    wx: Math.cos(angle) * radius,
    wy: Math.sin(angle) * radius,
    wz,
  };
}

function s2CometPos(def, t) {
  if (def.path === 'gravityArc') {
    return s2GravityArcPos(def, t);
  }
  if (def.path === 'bezier' && Array.isArray(def.points) && def.points.length === 4) {
    return cubicBezierPoint(def.points[0], def.points[1], def.points[2], def.points[3], clamp(t / S2_DUR, 0, 1));
  }
  return { wx: def.wx0 + def.vx * t, wy: def.wy0 + def.vy * t, wz: def.wz0 + def.vz * t };
}

function s2CometAlpha(t) {
  return Math.min(clamp(t / 60, 0, 1), clamp((S2_PHASE_TOTAL - t) / 120, 0, 1));
}

function s2TailReveal(def, t, pos) {
  if (def.tailMode === 'plane') {
    return clamp((t - def.tailStart) / Math.max(1, def.tailEnd - def.tailStart), 0, 1);
  }
  if (def.tailMode === 'sun') {
    const sunDistance = Math.hypot(pos.wx, pos.wy, pos.wz);
    return clamp((def.tailFar - sunDistance) / Math.max(1, def.tailFar - def.tailNear), 0, 1);
  }
  return 1;
}

function getDefaultS2IntroCamera() {
  return {
    el: 26,
    az: 1.12,
    dist: 2550,
    tx: 0,
    ty: 0,
    tz: 0,
  };
}

function getS2IntroCameraTarget() {
  const base = s2IntroCamera || getDefaultS2IntroCamera();
  const firstTarget = buildS2CameraTarget(S2_DEF[0], 0);
  const introProg = clamp(s2IntroT / Math.max(1, S2_INTRO_DUR), 0, 1);

  if (introProg < .32) {
    const local = eio(introProg / .32);
    return {
      el: lerp(aEl, base.el, local),
      az: lerp(aAz, base.az, local),
      dist: lerp(aDist, base.dist, local),
      tx: lerp(aTx, base.tx, local),
      ty: lerp(aTy, base.ty, local),
      tz: lerp(aTz, base.tz, local),
    };
  }

  if (introProg < .7) {
    const local = eio((introProg - .32) / .38);
    return {
      el: base.el,
      az: base.az,
      dist: lerp(base.dist, base.dist * S2_INTRO_ZOOM_MULT, local),
      tx: base.tx,
      ty: base.ty,
      tz: base.tz,
    };
  }

  const local = eio((introProg - .7) / .3);
  return {
    el: lerp(base.el, firstTarget.el, local),
    az: lerp(base.az, firstTarget.az, local),
    dist: lerp(base.dist * S2_INTRO_ZOOM_MULT, firstTarget.dist, local),
    tx: lerp(base.tx, firstTarget.tx, local),
    ty: lerp(base.ty, firstTarget.ty, local),
    tz: lerp(base.tz, firstTarget.tz, local),
  };
}

function drawS2Trajectory(def, alpha = 1) {
  if (def.path !== 'bezier') return;

  const samples = 90;
  const tintParts = String(def.col || '205,230,255').split(',').map(v => clamp(Number(v.trim()) || 0, 0, 255));
  const [r, g, b] = tintParts;

  ctx.save();
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= samples; i++) {
    const pos = s2CometPos(def, (i / samples) * S2_DUR);
    const projected = project3(pos.wx, pos.wy, pos.wz);
    if (projected.depth < 5) continue;
    if (!started) {
      ctx.moveTo(projected.sx, projected.sy);
      started = true;
    } else {
      ctx.lineTo(projected.sx, projected.sy);
    }
  }
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.58 * alpha})`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  started = false;
  for (let i = 0; i <= samples; i++) {
    const pos = s2CometPos(def, (i / samples) * S2_DUR);
    const sunDistance = Math.hypot(pos.wx, pos.wy, pos.wz);
    if (sunDistance > 260) continue;
    const projected = project3(pos.wx, pos.wy, pos.wz);
    if (projected.depth < 5) continue;
    if (!started) {
      ctx.moveTo(projected.sx, projected.sy);
      started = true;
    } else {
      ctx.lineTo(projected.sx, projected.sy);
    }
  }
  ctx.strokeStyle = `rgba(255,235,170,${0.92 * alpha})`;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function buildS2CameraTarget(def, t) {
  const prog = clamp(t / S2_DUR, 0, 1);
  const pos = s2CometPos(def, t);
  return {
    el: lerp(def.elStart, def.elEnd, eio(prog)),
    az: def.azDeg * Math.PI / 180,
    dist: def.dist,
    tx: pos.wx * (def.trackFactor || 0),
    ty: pos.wy * (def.trackFactor || 0),
    tz: pos.wz * (def.trackFactor || 0),
  };
}

function getS2CameraTarget(phase, t) {
  const def = S2_DEF[phase];
  if (def.lockCamera && phase > 0) {
    if (s2LockedCamera) return s2LockedCamera;
    return buildS2CameraTarget(S2_DEF[phase - 1], S2_PHASE_TOTAL);
  }
  return buildS2CameraTarget(def, t);
}

// ── SCENE DEFINITIONS ─────────────────────────────────────────
let currentScene = 0, sceneTime = 0;
let isPaused = false;
let globalTimelineProgress = 0;
const TIMELINE_SPEED = 0.0005;

const SCENES = [
  { label: 'THE ECLIPTIC PLANE', sub: 'All planets share the same orbital plane' },
  { label: 'INTERSTELLAR VISITORS', sub: 'Comets arrive from all directions, piercing the plane' },
];

const SCENE_WEIGHTS = [0.14, 0.86];
const SCENE_STARTS = [];
let sceneWeightCursor = 0;
for (const weight of SCENE_WEIGHTS) {
  SCENE_STARTS.push(sceneWeightCursor);
  sceneWeightCursor += weight;
}

function getSceneStart(sceneIndex) {
  return SCENE_STARTS[sceneIndex];
}

function getSceneEnd(sceneIndex) {
  return SCENE_STARTS[sceneIndex] + SCENE_WEIGHTS[sceneIndex];
}

function getSceneIndexAtProgress(progress) {
  for (let i = SCENE_STARTS.length - 1; i >= 0; i--) {
    if (progress >= SCENE_STARTS[i]) return i;
  }
  return 0;
}

function getSceneLocalProgress(sceneIndex, progress) {
  const start = getSceneStart(sceneIndex);
  const end = getSceneEnd(sceneIndex);
  return clamp((progress - start) / Math.max(0.000001, end - start), 0, 1);
}

function syncSubLabel() {
  document.getElementById('subLabel').textContent =
    currentScene === 1 && s2IntroT >= S2_INTRO_DUR
      ? st(
        s2Phase === 0 ? 'solarSystem.scenes.cometA.label' : 'solarSystem.scenes.cometB.label',
        S2_DEF[s2Phase].label
      )
      : st(`solarSystem.scenes.scene${currentScene}.sub`, SCENES[currentScene].sub);
}

function setLabels(n) {
  document.getElementById('sceneLabel').textContent = st(`solarSystem.scenes.scene${n}.label`, SCENES[n].label);
  syncSubLabel();
}

function goToScene(n) {
  if (n < 0 || n >= SCENES.length) return;
  currentScene = n;
  sceneTime = 0;
  planeFlash.strength = 0;
  s2Phase = 0;
  s2T = 0;
  s2LockedCamera = null;
  s2IntroT = 0;
  s2IntroCamera = n === 1 ? { el: aEl, az: aAz, dist: aDist, tx: aTx, ty: aTy, tz: aTz } : null;
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
    globalTimelineProgress = getSceneStart(nextScene);
    goToScene(nextScene);
  }
});

document.getElementById('prevBtn').addEventListener('click', () => {
  if (currentScene > 0) {
    const prevScene = currentScene - 1;
    globalTimelineProgress = getSceneStart(prevScene);
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

  const newScene = getSceneIndexAtProgress(globalTimelineProgress);
  const sceneProgress = getSceneLocalProgress(newScene, globalTimelineProgress);

  if (newScene !== currentScene) {
    currentScene = newScene;
    planeFlash.strength = 0;
  }

  // Set the scene time based on where in the scene we are
  if (currentScene === 0) {
    sceneTime = Math.floor(sceneProgress * 280);
    s2Phase = 0;
    s2T = 0;
    s2LockedCamera = null;
    s2IntroT = 0;
    s2IntroCamera = null;
  } else if (currentScene === 1) {
    const totalDuration = S2_INTRO_DUR + S2_PHASE_TOTAL * S2_DEF.length;
    const totalTime = Math.min(Math.floor(sceneProgress * totalDuration), totalDuration - 1);
    sceneTime = totalTime;
    s2IntroT = Math.min(totalTime, S2_INTRO_DUR);

    if (totalTime < S2_INTRO_DUR) {
      s2Phase = 0;
      s2T = 0;
      s2LockedCamera = null;
    } else {
      const cometTime = totalTime - S2_INTRO_DUR;
      s2Phase = Math.floor(cometTime / S2_PHASE_TOTAL);
      s2Phase = Math.min(s2Phase, S2_DEF.length - 1);
      s2T = cometTime % S2_PHASE_TOTAL;
      s2LockedCamera = s2Phase > 0 ? buildS2CameraTarget(S2_DEF[s2Phase - 1], S2_PHASE_TOTAL) : null;
    }
  }

  setLabels(currentScene);
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
  marker.style.left = (getSceneStart(i) * 100) + '%';
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
    currentScene = getSceneIndexAtProgress(globalTimelineProgress);

    if (currentScene !== prevScene) {
      sceneTime = 0;
      planeFlash.strength = 0;
      s2Phase = 0;
      s2T = 0;
      s2LockedCamera = null;
      s2IntroT = 0;
      s2IntroCamera = currentScene === 1 ? { el: aEl, az: aAz, dist: aDist, tx: aTx, ty: aTy, tz: aTz } : null;
      setLabels(currentScene);
    }

    // Hold on the last scene when playback reaches the end.
    if (globalTimelineProgress >= 1.0) {
      globalTimelineProgress = 1;
      isPaused = true;
      document.getElementById('pauseBtn').textContent = '▶ Play';
    }

    updateTimeline();
  }

  // ── CAMERA TARGETS ──
  let elTgt = 90, azTgt = 0, distTgt = 1200, txTgt = 0, tyTgt = 0, tzTgt = 0;

  // ── SCENE 0: ecliptic plane reveal (with 1-second delay) ──
  if (currentScene === 0) {
    const t0 = sceneTime;
    if (t0 < 28) {
      elTgt = 90;
      azTgt = 0;
      distTgt = 980;
    } else {
      const t1 = t0 - 28;
      if (t1 < 78) elTgt = lerp(90, 48, eio(t1 / 78));
      else if (t1 < 148) elTgt = lerp(48, 2, eio((t1 - 78) / 70));
      else if (t1 < 210) elTgt = lerp(2, -28, eio((t1 - 148) / 62));
      else if (t1 < 272) elTgt = lerp(-28, 18, eio((t1 - 210) / 62));
      else elTgt = 18;
      azTgt = t1 * .0042;
      distTgt = 980;
    }
  }

  // ── SCENE 1: example comets piercing the plane ──
  else if (currentScene === 1) {
    if (!isPaused) {
      if (s2IntroT < S2_INTRO_DUR) {
        s2IntroT++;
        if (s2IntroT === S2_INTRO_DUR) syncSubLabel();
      } else {
        s2T++;
        if (s2T > S2_PHASE_TOTAL && s2Phase < S2_DEF.length - 1) {
          s2LockedCamera = {
            el: aEl,
            az: aAz,
            dist: aDist,
            tx: aTx,
            ty: aTy,
            tz: aTz,
          };
          s2Phase++;
          s2T = 0;
          planeFlash.strength = 0;
          syncSubLabel();
        }
      }
    }
    const def = S2_DEF[s2Phase];
    const cameraTarget = s2IntroT < S2_INTRO_DUR ? getS2IntroCameraTarget() : getS2CameraTarget(s2Phase, s2T);
    elTgt = cameraTarget.el;
    azTgt = cameraTarget.az;
    distTgt = cameraTarget.dist;
    txTgt = cameraTarget.tx;
    tyTgt = cameraTarget.ty;
    tzTgt = cameraTarget.tz;
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
    const cometPos = s2CometPos(def, s2T);
    const { wx: cwx, wy: cwy, wz: cwz } = cometPos;
    const alpha = s2CometAlpha(s2T);
    const tailReveal = s2TailReveal(def, s2T, cometPos);
    if (s2IntroT >= S2_INTRO_DUR) {
      drawS2Trajectory(def, alpha);
      drawComet(cwx, cwy, cwz, alpha, def.col, {
        sizeMultiplier: def.sizeMultiplier,
        tailReveal,
        image: SOLAR_COMET_SCENE_IMAGE || undefined,
      });
    }

    // Phase indicator dots
    const lbls = [
      st('solarSystem.scenes.cometA.short', S2_DEF[0].shortLabel),
      st('solarSystem.scenes.cometB.short', S2_DEF[1].shortLabel),
    ];
    for (let i = 0; i < S2_DEF.length; i++) {
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
