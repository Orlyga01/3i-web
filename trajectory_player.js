class TrajectoryLoadError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TrajectoryLoadError';
    this.code = code;
    this.details = details;
  }
}

class TrajectoryLoader {
  static readDesignationFromUrl(search = location.search) {
    const params = new URLSearchParams(search);
    const rawValue = params.get('designation') ?? params.get('d');
    const designation = this.decodeDesignation(rawValue);

    return designation || '3I';
  }

  static decodeDesignation(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
      return decodeURIComponent(trimmed);
    } catch (_) {
      return trimmed;
    }
  }

  static sanitize(name) {
    return String(name || '').replace(/[\s/]/g, '_');
  }

  static buildPath(designation) {
    const sanitizedName = this.sanitize(designation);
    return {
      sanitizedName,
      path: `data/${sanitizedName}/trajectory.json`,
    };
  }

  static normalizePoint(point, index, designation) {
    if (!point || typeof point !== 'object' || !point.px || typeof point.px !== 'object') {
      throw new TrajectoryLoadError(
        'invalid-json',
        `The trajectory file for '${designation}' could not be read. It may be corrupt.`
      );
    }

    const wx = Number(point.px.wx);
    const wy = Number(point.px.wy);
    const wz = Number(point.px.wz);

    if (![wx, wy, wz].every(Number.isFinite)) {
      throw new TrajectoryLoadError(
        'invalid-json',
        `The trajectory file for '${designation}' could not be read. It may be corrupt.`
      );
    }

    const durationPct = Number(point.durationPct);
    const camera = point.camera && typeof point.camera === 'object'
      ? {
        el: Number(point.camera.el ?? 5),
        az: Number(point.camera.az ?? 0),
        zoom: Number(
          point.camera.zoom ??
          ((point.camera.zoomIn ?? 0) - (point.camera.zoomOut ?? 0))
        ) || 0,
        tx: Number(point.camera.tx ?? 0) || 0,
        ty: Number(point.camera.ty ?? 0) || 0,
        tz: Number(point.camera.tz ?? 0) || 0,
      }
      : null;

    const au = point.au && typeof point.au === 'object'
      ? {
        x: Number(point.au.x ?? 0) || 0,
        y: Number(point.au.y ?? 0) || 0,
        z: Number(point.au.z ?? 0) || 0,
      }
      : { x: 0, y: 0, z: 0 };

    return {
      ...point,
      index,
      px: { wx, wy, wz },
      au,
      camera,
      durationPct: Number.isFinite(durationPct) ? Math.max(1, durationPct) : 100,
      stoppable: Boolean(point.stoppable),
      description: point.description ?? null,
      image: point.image ?? null,
    };
  }

  static async load(designation) {
    if (!designation) {
      throw new TrajectoryLoadError(
        'missing-designation',
        'Open this page with a ?designation= URL parameter, or use the ▶ Play Video button from the Object Motion Tracker.'
      );
    }

    const { sanitizedName, path } = this.buildPath(designation);

    let response;
    try {
      response = await fetch(path, { cache: 'no-store' });
    } catch (_) {
      throw new TrajectoryLoadError(
        'network',
        'Could not load the trajectory file. Check your connection and try again.',
        { designation, sanitizedName, path }
      );
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new TrajectoryLoadError(
          'not-found',
          `No saved trajectory found for '${designation}'. Annotate it first in the Object Motion Tracker.`,
          { designation, sanitizedName, path }
        );
      }

      throw new TrajectoryLoadError(
        'network',
        'Could not load the trajectory file. Check your connection and try again.',
        { designation, sanitizedName, path, status: response.status }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(await response.text());
    } catch (_) {
      throw new TrajectoryLoadError(
        'invalid-json',
        `The trajectory file for '${designation}' could not be read. It may be corrupt.`,
        { designation, sanitizedName, path }
      );
    }

    if (!parsed || !Array.isArray(parsed.points) || parsed.points.length === 0) {
      throw new TrajectoryLoadError(
        'invalid-json',
        `The trajectory file for '${designation}' could not be read. It may be corrupt.`,
        { designation, sanitizedName, path }
      );
    }

    const points = parsed.points.map((point, index) => this.normalizePoint(point, index, designation));

    return {
      designation,
      sanitizedName,
      path,
      data: parsed,
      points,
    };
  }
}

class PlaybackEngine {
  constructor(controller) {
    this.controller = controller;
    this.running = false;
    this.rafId = 0;
    this.lastTs = 0;
    this.pulsePhase = 0;
    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  tick(ts) {
    if (!this.running) return;
    if (!this.lastTs) this.lastTs = ts;
    const deltaMs = ts - this.lastTs;
    this.lastTs = ts;
    this.pulsePhase += deltaMs * 0.006;
    this.controller.onFrame(deltaMs);
    this.rafId = requestAnimationFrame(this.tick);
  }
}

class PlaybackController {
  constructor(options) {
    this.designation = options.designation;
    this.sanitizedName = options.sanitizedName;
    this.points = options.points;
    this.controlBar = options.controlBar;
    this.statsDisplay = options.statsDisplay;
    this.trailRenderer = options.trailRenderer;
    this.timelineScrubber = options.timelineScrubber;
    this.annotationOverlay = options.annotationOverlay;
    this.state = 'idle';
    this.speedMultiplier = 1;
    this.currentPointIndex = 0;
    this.segmentIndex = 0;
    this.currentPoint = this.points[0] ?? null;
    this.segmentElapsedMs = 0;
    this.currentWorldPosition = this.currentPoint ? { ...this.currentPoint.px } : null;
    this.currentDate = this.currentPoint ? parseTrajectoryDate(this.currentPoint.date) : null;
    this.currentSunDistance = this.currentPoint ? computeSunDistance(this.currentPoint.au) : 0;
    this.currentCameraState = this.findNearestCamera(0);
    this.engine = new PlaybackEngine(this);
  }

  bootstrap() {
    if (!this.currentPoint) {
      throw new TrajectoryLoadError(
        'invalid-json',
        `The trajectory file for '${this.designation}' could not be read. It may be corrupt.`
      );
    }

    this.registerLayers();
    this.jumpToSegmentStart(0, { resetTrail: true, snapCamera: true });
    this.timelineScrubber.setProgress(0);
    this.statsDisplay.show();
    this.statsDisplay.update(this.currentDate, this.currentSunDistance);
    this.controlBar.show();
    this.timelineScrubber.show();
    this.state = 'playing';
    this.controlBar.setState(this.state);
    this.engine.start();
  }

  registerLayers() {
    if (!window.SolarSystem || !window.SolarSystem.layers) return;

    window.SolarSystem.layers.register('trajectory-player-trail', () => {
      this.trailRenderer.draw();
    });

    window.SolarSystem.layers.register('trajectory-player-object', () => {
      if (!this.currentWorldPosition || typeof drawComet !== 'function') return;
      const alpha = 0.82 + Math.sin(this.engine.pulsePhase) * 0.08;
      drawComet(
        this.currentWorldPosition.wx,
        this.currentWorldPosition.wy,
        this.currentWorldPosition.wz,
        alpha,
        '180,220,255',
        0.95
      );
    });
  }

  onFrame(deltaMs) {
    if (!this.currentPoint || !this.currentWorldPosition) return;
    if (this.state !== 'playing') {
      this.controlBar.setState(this.state);
      return;
    }

    if (this.segmentIndex >= this.points.length - 1) {
      this.state = 'stopped';
      this.controlBar.setState(this.state);
      return;
    }

    if (this.segmentIndex >= this.points.length - 1) {
      this.controlBar.setState(this.state);
      return;
    }

    this.segmentElapsedMs += deltaMs;
    let segmentMs = this.getCurrentSegmentDurationMs();

    while (this.segmentElapsedMs >= segmentMs && this.segmentIndex < this.points.length - 1) {
      this.segmentElapsedMs -= segmentMs;
      this.segmentIndex += 1;
      this.currentPointIndex = Math.min(this.segmentIndex, this.points.length - 1);
      this.currentPoint = this.points[this.currentPointIndex];

      if (this.segmentIndex >= this.points.length - 1) {
        this.segmentElapsedMs = 0;
        this.currentWorldPosition = { ...this.points[this.points.length - 1].px };
        this.currentDate = parseTrajectoryDate(this.points[this.points.length - 1].date);
        this.currentSunDistance = computeSunDistance(this.points[this.points.length - 1].au);
        const finalCamera = this.getCurrentCameraTarget();
        if (finalCamera) {
          this.currentCameraState = { ...finalCamera };
          this.applyCameraState(this.currentCameraState);
        }
        this.statsDisplay.update(this.currentDate, this.currentSunDistance);
        this.timelineScrubber.setProgress(1);
        this.state = 'stopped';
        this.controlBar.setState(this.state);
        return;
      }

      segmentMs = this.getCurrentSegmentDurationMs();
    }

    this.updateInterpolatedFrame();
    this.controlBar.setState(this.state);
  }

  getCurrentSegmentDurationMs() {
    return getSegmentDurationMs(this.points, this.segmentIndex, this.speedMultiplier);
  }

  updateInterpolatedFrame() {
    const maxSegmentIndex = Math.max(0, this.points.length - 2);
    const segmentIndex = Math.max(0, Math.min(maxSegmentIndex, this.segmentIndex));
    const segmentMs = this.getCurrentSegmentDurationMs();
    const t = segmentMs === Number.POSITIVE_INFINITY ? 1 : tpClamp(this.segmentElapsedMs / segmentMs, 0, 1);
    const startPoint = this.points[segmentIndex];

    this.currentPointIndex = segmentIndex;
    this.currentPoint = startPoint;
    this.currentWorldPosition = interpolateWorldPosition(this.points, segmentIndex, t);
    this.currentDate = interpolateDateValue(this.points, segmentIndex, t);
    this.currentSunDistance = interpolateSunDistanceValue(this.points, segmentIndex, t);
    this.trailRenderer.setAnchor(this.currentWorldPosition);

    if (window.SolarSystem?.engine) {
      window.SolarSystem.engine.setDate(this.currentDate);
    }

    const targetCamera = this.getCurrentCameraTarget();
    if (targetCamera) {
      this.currentCameraState = lerpCameraState(this.currentCameraState, targetCamera);
      this.applyCameraState(this.currentCameraState);
    }

    this.statsDisplay.update(this.currentDate, this.currentSunDistance);
    this.timelineScrubber.setProgress((segmentIndex + t) / Math.max(1, this.points.length - 1));
  }

  jumpToSegmentStart(index, options = {}) {
    const { resetTrail = false, snapCamera = false } = options;
    const clampedIndex = Math.max(0, Math.min(this.points.length - 1, index));
    const point = this.points[clampedIndex];
    if (!point) return;

    this.segmentIndex = clampedIndex;
    this.currentPointIndex = clampedIndex;
    this.currentPoint = point;
    this.segmentElapsedMs = 0;
    this.currentWorldPosition = { ...point.px };
    this.currentDate = parseTrajectoryDate(point.date);
    this.currentSunDistance = computeSunDistance(point.au);

    if (resetTrail) {
      this.trailRenderer.reset(point.px);
    } else {
      this.trailRenderer.setAnchor(point.px);
    }

    if (window.SolarSystem?.engine && this.currentDate) {
      window.SolarSystem.engine.setDate(this.currentDate);
    }

    if (snapCamera) {
      this.currentCameraState = this.findNearestCamera(clampedIndex);
      this.applyCameraState(this.currentCameraState);
    }

    this.statsDisplay.update(this.currentDate, this.currentSunDistance);
    this.timelineScrubber.setProgress(clampedIndex / Math.max(1, this.points.length - 1));
  }

  applyCameraState(cameraState) {
    if (window.SolarSystem?.camera?.setRawState && cameraState) {
      window.SolarSystem.camera.setRawState(cameraState);
    }
  }

  snapToPoint(index) {
    const point = this.points[index];
    if (!point) return;

    this.currentPointIndex = index;
    this.currentPoint = point;
    this.trailRenderer.setAnchor(point.px);

    if (window.SolarSystem?.engine && point.date) {
      window.SolarSystem.engine.setDate(point.date);
    }

    const camera = this.findNearestCamera(index);
    if (window.SolarSystem?.camera?.setRawState && camera) {
      window.SolarSystem.camera.setRawState(camera);
    }
  }

  findNearestCamera(index) {
    const leftIndex = findNearestCameraIndex(this.points, index, -1);
    if (leftIndex !== -1) return { ...this.points[leftIndex].camera };

    const rightIndex = findNearestCameraIndex(this.points, index, 1);
    if (rightIndex !== -1) return { ...this.points[rightIndex].camera };

    return null;
  }

  getCurrentCameraTarget() {
    return getCameraTargetForSegment(this.points, this.segmentIndex);
  }

  togglePlayPause() {
    this.state = this.state === 'playing' ? 'paused' : 'playing';
    this.controlBar.setState(this.state);
  }

  restart() {
    this.state = 'playing';
    this.jumpToSegmentStart(0, { resetTrail: true, snapCamera: true });
  }

  prevPoint() {
    this.jumpToSegmentStart(Math.max(0, this.currentPointIndex - 1), { snapCamera: true });
  }

  nextPoint() {
    this.jumpToSegmentStart(Math.min(this.points.length - 1, this.currentPointIndex + 1), { snapCamera: true });
  }
}

class TrailRenderer {
  constructor() {
    this.trail = [];
  }

  reset(point) {
    this.trail = point ? [point] : [];
  }

  setAnchor(point) {
    if (!point) return;
    const last = this.trail[this.trail.length - 1];
    if (last && last.wx === point.wx && last.wy === point.wy && last.wz === point.wz) return;
    this.trail.push({ wx: point.wx, wy: point.wy, wz: point.wz });
  }

  draw() {
    // Story 3.3 owns full trail rendering; the layer is registered now so
    // later stories can fill it in without changing the page shell contract.
  }
}

class ControlBar {
  constructor(root) {
    this.root = root;
    this.statusEl = document.getElementById('tp-status-pill');
    this.playBtn = document.getElementById('tp-play-btn');
    this.restartBtn = document.getElementById('tp-restart-btn');
    this.prevBtn = document.getElementById('tp-prev-btn');
    this.nextBtn = document.getElementById('tp-next-btn');
    this.speedSlider = document.getElementById('tp-speed-slider');
    this.speedValue = document.getElementById('tp-speed-value');
    this.fullscreenBtn = document.getElementById('tp-fullscreen-btn');
    this.controller = null;
  }

  connect(controller) {
    this.controller = controller;

    this.playBtn.addEventListener('click', () => controller.togglePlayPause());
    this.restartBtn.addEventListener('click', () => controller.restart());
    this.prevBtn.addEventListener('click', () => controller.prevPoint());
    this.nextBtn.addEventListener('click', () => controller.nextPoint());

    this.speedSlider.addEventListener('input', () => {
      const speed = ControlBar.SPEED_STEPS[Number(this.speedSlider.value)] ?? 1;
      controller.speedMultiplier = speed;
      this.speedValue.textContent = `${speed}×`;
    });

    this.fullscreenBtn.addEventListener('click', () => {
      // Story 3.10 owns the actual fullscreen behavior.
    });
  }

  show() {
    this.root.classList.add('visible');
  }

  setState(state) {
    const label = state === 'playing'
      ? 'Playing'
      : state === 'paused'
        ? 'Paused'
        : state === 'stopped'
          ? 'Stopped'
          : 'Idle';
    this.statusEl.textContent = label;
    this.playBtn.textContent = state === 'playing' ? '⏸' : '▶';
  }
}

ControlBar.SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

class TimelineScrubber {
  constructor(root) {
    this.root = root;
    this.progressEl = document.getElementById('tp-timeline-progress');
    this.thumbEl = document.getElementById('tp-timeline-thumb');
  }

  setProgress(value) {
    const pct = Math.max(0, Math.min(100, value * 100));
    this.progressEl.style.width = `${pct}%`;
    this.thumbEl.style.left = `${pct}%`;
  }

  show() {
    this.root.classList.add('visible');
  }
}

class AnnotationOverlay {
  constructor(root) {
    this.root = root;
  }

  show() {
    this.root.classList.add('visible');
  }

  hide() {
    this.root.classList.remove('visible');
  }
}

class StatsDisplay {
  constructor(root) {
    this.root = root;
    this.dateEl = document.getElementById('tp-stats-date');
    this.distanceEl = document.getElementById('tp-stats-distance');
  }

  show() {
    this.root.classList.add('visible');
  }

  update(dateValue, sunDistance) {
    if (!dateValue) return;
    this.dateEl.textContent = formatDisplayDate(dateValue);
    this.distanceEl.textContent = `Sun: ${Number(sunDistance || 0).toFixed(2)} AU`;
  }
}

function tpLerp(a, b, t) {
  return a + (b - a) * t;
}

function tpClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function tpCatmullRom(p0, p1, p2, p3, t) {
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
}

function parseTrajectoryDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00Z`);
  }
  return new Date(value);
}

function computeSunDistance(au) {
  const { x, y, z } = au ?? { x: 0, y: 0, z: 0 };
  return Math.sqrt(x * x + y * y + z * z);
}

function getSegmentDurationMs(points, segmentIndex, speedMultiplier = 1) {
  const destinationPoint = points[segmentIndex + 1];
  if (!destinationPoint) return Number.POSITIVE_INFINITY;
  return (destinationPoint.durationPct / 100) * 1000 * (1 / speedMultiplier);
}

function interpolateWorldPosition(points, segmentIndex, t) {
  const i0 = tpClamp(segmentIndex - 1, 0, points.length - 1);
  const i1 = tpClamp(segmentIndex, 0, points.length - 1);
  const i2 = tpClamp(segmentIndex + 1, 0, points.length - 1);
  const i3 = tpClamp(segmentIndex + 2, 0, points.length - 1);

  return {
    wx: tpCatmullRom(points[i0].px.wx, points[i1].px.wx, points[i2].px.wx, points[i3].px.wx, t),
    wy: tpCatmullRom(points[i0].px.wy, points[i1].px.wy, points[i2].px.wy, points[i3].px.wy, t),
    wz: tpCatmullRom(points[i0].px.wz, points[i1].px.wz, points[i2].px.wz, points[i3].px.wz, t),
  };
}

function interpolateDateValue(points, segmentIndex, t) {
  const start = parseTrajectoryDate(points[segmentIndex].date);
  const end = parseTrajectoryDate(points[segmentIndex + 1].date);
  return new Date(tpLerp(start.getTime(), end.getTime(), t));
}

function interpolateSunDistanceValue(points, segmentIndex, t) {
  const startAu = points[segmentIndex].au;
  const endAu = points[segmentIndex + 1].au;
  const x = tpLerp(startAu.x, endAu.x, t);
  const y = tpLerp(startAu.y, endAu.y, t);
  const z = tpLerp(startAu.z, endAu.z, t);
  return Math.sqrt(x * x + y * y + z * z);
}

function findNearestCameraIndex(points, startIndex, direction) {
  let index = startIndex;
  while (index >= 0 && index < points.length) {
    if (points[index]?.camera) return index;
    index += direction;
  }
  return -1;
}

function getCameraTargetForSegment(points, segmentIndex) {
  const destinationIndex = Math.min(points.length - 1, segmentIndex + 1);
  const rightIndex = findNearestCameraIndex(points, destinationIndex, 1);
  if (rightIndex !== -1) return { ...points[rightIndex].camera };

  const leftIndex = findNearestCameraIndex(points, segmentIndex, -1);
  return leftIndex !== -1 ? { ...points[leftIndex].camera } : null;
}

function lerpCameraState(current, target, sp = 0.022) {
  if (!target) return current;
  const base = current || target;
  return {
    el: tpLerp(base.el ?? target.el ?? 0, target.el ?? base.el ?? 0, sp),
    az: tpLerp(base.az ?? target.az ?? 0, target.az ?? base.az ?? 0, sp * 0.75),
    zoom: tpLerp(base.zoom ?? target.zoom ?? 0, target.zoom ?? base.zoom ?? 0, sp * 0.65),
    tx: tpLerp(base.tx ?? target.tx ?? 0, target.tx ?? base.tx ?? 0, sp),
    ty: tpLerp(base.ty ?? target.ty ?? 0, target.ty ?? base.ty ?? 0, sp),
    tz: tpLerp(base.tz ?? target.tz ?? 0, target.tz ?? base.tz ?? 0, sp),
  };
}

function formatDisplayDate(value) {
  const date = parseTrajectoryDate(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function setSubtitle(text) {
  const el = document.getElementById('tp-subtitle');
  if (el) el.textContent = text;
}

function buildObjectMotionHref(designation) {
  return `object_motion?designation=${encodeURIComponent(designation || '3I')}`;
}

function buildTrajectoryPlayerHref(designation) {
  return `trajectory_player?designation=${encodeURIComponent(designation || '3I')}`;
}

function syncPlayerUrl(designation) {
  if (!window.history?.replaceState) return;
  window.history.replaceState(null, '', buildTrajectoryPlayerHref(designation));
}

function updateObjectMotionLinks(designation) {
  const href = buildObjectMotionHref(designation);
  const backLink = document.getElementById('tp-back-link');
  const errorLink = document.getElementById('tp-error-link');
  if (backLink) backLink.href = href;
  if (errorLink) errorLink.href = href;
}

function hideLoadingCard() {
  const el = document.getElementById('tp-loading-card');
  if (el) el.style.display = 'none';
}

function showLoadingCard(text) {
  const el = document.getElementById('tp-loading-card');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = text;
}

function showError(error) {
  hideLoadingCard();
  const card = document.getElementById('tp-error-card');
  const message = document.getElementById('tp-error-message');
  if (!card || !message) return;
  message.textContent = error.message;
  card.classList.add('visible');
  setSubtitle('Unable to load trajectory');
}

async function bootstrapTrajectoryPlayer() {
  showLoadingCard('Loading trajectory…');

  try {
    const designation = TrajectoryLoader.readDesignationFromUrl();
    syncPlayerUrl(designation);
    updateObjectMotionLinks(designation);
    setSubtitle(`Loading ${designation}`);

    const result = await TrajectoryLoader.load(designation);

    hideLoadingCard();
    setSubtitle(`Playing ${result.designation}`);

    const controlBar = new ControlBar(document.getElementById('tp-controls'));
    const statsDisplay = new StatsDisplay(document.getElementById('tp-stats'));
    const trailRenderer = new TrailRenderer();
    const timelineScrubber = new TimelineScrubber(document.getElementById('tp-timeline-shell'));
    const annotationOverlay = new AnnotationOverlay(document.getElementById('tp-overlay'));

    const controller = new PlaybackController({
      designation: result.designation,
      sanitizedName: result.sanitizedName,
      points: result.points,
      controlBar,
      statsDisplay,
      trailRenderer,
      timelineScrubber,
      annotationOverlay,
    });

    controlBar.connect(controller);
    statsDisplay.update(parseTrajectoryDate(result.points[0].date), computeSunDistance(result.points[0].au));

    requestAnimationFrame(() => controller.bootstrap());
  } catch (error) {
    if (error instanceof TrajectoryLoadError) {
      updateObjectMotionLinks(error.details?.designation || '3I');
      showError(error);
      return;
    }

    console.error(error);
    updateObjectMotionLinks('3I');
    showError(
      new TrajectoryLoadError(
        'network',
        'Could not load the trajectory file. Check your connection and try again.'
      )
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapTrajectoryPlayer);
} else {
  bootstrapTrajectoryPlayer();
}
