class TrajectoryLoadError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TrajectoryLoadError';
    this.code = code;
    this.details = details;
  }
}

const MoreInfoHelpers = window.MoreInfoShared || {};
const AnomaliesPanelApi = window.AnomaliesPanel || {};
const APP_CONFIG = window.AppConfigShared?.readAppConfig?.(window.AppConfig) || { useLocalStorage: false };
// AppTranslations is already declared by shared_render.js (loaded before this script)
const trajectoryPlayerLocale = AppTranslations.getLocaleFromSearch?.(window.location.search) || 'en';

AppTranslations.setDocumentLocale?.(trajectoryPlayerLocale);

function tt(name, fallback = '', params = null) {
  const sourceText = fallback || (typeof name === 'string' ? name : '');
  return AppTranslations.translate?.(sourceText, {
    locale: trajectoryPlayerLocale,
    params,
    fallback: sourceText,
  }) || sourceText;
}

class TrajectoryLoader {
  static readDesignationFromUrl(search = location.search) {
    const params = new URLSearchParams(search);
    const rawValue = params.get('designation') ?? params.get('d');
    return this.decodeDesignation(rawValue);
  }

  static readSourceFromUrl(search = location.search) {
    const params = new URLSearchParams(search);
    return this.normalizeRequestedSource(params.get('source') ?? params.get('s'));
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

  static normalizeRequestedSource(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'local' || normalized === 'web' ? normalized : '';
  }

  static resolveRequestedSource(value) {
    const requestedSource = this.normalizeRequestedSource(value);
    if (requestedSource !== 'local') return requestedSource;
    return APP_CONFIG.useLocalStorage ? 'local' : 'web';
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
      color: normalizeVisualColor(point.color),
      description: point.description ?? null,
      image: point.image ?? null,
    };
  }

  static parseLoadedData(parsed, designation, details = {}) {
    if (!parsed || !Array.isArray(parsed.points) || parsed.points.length === 0) {
      throw new TrajectoryLoadError(
        'invalid-json',
        `The trajectory file for '${designation}' could not be read. It may be corrupt.`,
        details
      );
    }

    const points = parsed.points.map((point, index) => this.normalizePoint(point, index, designation));
    return {
      designation,
      sanitizedName: details.sanitizedName ?? this.sanitize(designation),
      path: details.path ?? '',
      data: parsed,
      points,
      source: details.source || 'web',
    };
  }

  static loadFromLocal(designation, sanitizedName) {
    const key = `objectMotion:${sanitizedName}`;
    const raw = localStorage.getItem(key);

    if (!raw) {
      throw new TrajectoryLoadError(
        'not-found',
        `No local trajectory found for '${designation}'. Open it in the Object Motion Tracker first.`,
        { designation, sanitizedName, source: 'local', key }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      throw new TrajectoryLoadError(
        'invalid-json',
        `The local trajectory for '${designation}' could not be read. It may be corrupt.`,
        { designation, sanitizedName, source: 'local', key }
      );
    }

    return this.parseLoadedData(parsed, designation, {
      sanitizedName,
      path: key,
      source: 'local',
    });
  }

  static async load(designation, options = {}) {
    if (!designation) {
      throw new TrajectoryLoadError(
        'missing-designation',
        'Open this page with a ?designation= URL parameter, or use the ▶ Play Video button from the Object Motion Tracker.'
      );
    }

    const { sanitizedName, path } = this.buildPath(designation);
    const requestedSource = this.resolveRequestedSource(options.source);

    if (requestedSource === 'local') {
      return this.loadFromLocal(designation, sanitizedName);
    }

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

    return this.parseLoadedData(parsed, designation, {
      designation,
      sanitizedName,
      path,
      source: 'web',
    });
  }
}

const TP_AU_IN_KM = 149597870.7;
const TP_WORLD_PX_PER_AU = 175;
const TP_REFERENCE_CONNECTOR_VISIBLE_FROM = '2025-10-31';
const TP_FIXED_OBJECT_ANCHOR_DATE = '2025-10-29';
const TP_DEFAULT_VISUAL_COLOR = 'green';
const TP_VISUAL_COLOR_MAP = Object.freeze({
  green: Object.freeze({ r: 88, g: 228, b: 128 }),
  blue: Object.freeze({ r: 96, g: 176, b: 255 }),
  red: Object.freeze({ r: 255, g: 104, b: 104 }),
  yellow: Object.freeze({ r: 255, g: 214, b: 92 }),
});
const TP_FIXED_REFERENCE_POINT_KM = Object.freeze({
  x: -3.318697414262085e8,
  y: 7.099317219152682e8,
  z: 4.476039412376106e6,
});
const TP_DEFAULT_OBJECT_VISUAL = Object.freeze({
  spriteSrc: 'assets/3igreen_1.png',
  imageBaseTailAngleRad: 150 * (Math.PI / 180),
  anchorY: 0.5,
  alignToSun: true,
  axialSpinMultiplier: 0,
});
const TP_OUMUAMUA_OBJECT_VISUAL = Object.freeze({
  spriteSrc: 'assets/Oumuamua.png',
  imageBaseTailAngleRad: 0,
  anchorY: 0.5,
  alignToSun: false,
  axialSpinMultiplier: 1,
});

function getObjectVisualConfig(designation) {
  const key = String(designation || '').trim().toLowerCase();
  if (key === 'oumuamua') return TP_OUMUAMUA_OBJECT_VISUAL;
  return TP_DEFAULT_OBJECT_VISUAL;
}

function getObjectSpinRotation(designation, phase = 0) {
  const config = getObjectVisualConfig(designation);
  return (config.axialSpinMultiplier || 0) * Number(phase || 0);
}

function resolveObjectSprite(designation) {
  const spriteSrc = getObjectVisualConfig(designation).spriteSrc;
  return typeof window.getSharedSpriteImage === 'function'
    ? window.getSharedSpriteImage(spriteSrc)
    : null;
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
    this.playFlyover = options.playFlyover || null;
    this.referenceConnectorRenderer = options.referenceConnectorRenderer;
    this.anomaliesPanelController = options.anomaliesPanelController || null;
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
    this.currentAppearance = this.currentPoint ? getAppearanceAtPoint(this.points, 0) : getDefaultAppearance();
    this.objectVisual = getObjectVisualConfig(this.designation);
    this.objectSprite = resolveObjectSprite(this.designation);
    this.pauseAtStoppablePoints = true;
    this.pauseAtEveryPoint = false;
    this.solarSystemPaused = null;
    this.engine = new PlaybackEngine(this);
    this.boundKeydown = event => this.handleKeydown(event);
    this.boundCanvasClick = event => this.handleCanvasClick(event);
    this.boundCanvasInteractionGate = event => this.handleCanvasInteractionGate(event);
    this.interactionsBound = false;
  }

  bootstrap() {
    if (!this.currentPoint) {
      throw new TrajectoryLoadError(
        'invalid-json',
        `The trajectory file for '${this.designation}' could not be read. It may be corrupt.`
      );
    }

    this.registerLayers();
    this.bindInteractions();
    this.state = 'paused';
    this.jumpToSegmentStart(0, { resetTrail: true, snapCamera: true });
    this.timelineScrubber.setProgress(0);
    this.statsDisplay.show();
    this.statsDisplay.update(this.currentDate, this.currentSunDistance);
    this.controlBar.show();
    this.timelineScrubber.show();
    this.controlBar.syncInitialValues(this);
    this.syncUi();
    this.engine.start();
  }

  registerLayers() {
    if (!window.SolarSystem || !window.SolarSystem.layers) return;

    window.SolarSystem.layers.register('trajectory-player-trail', () => {
      this.trailRenderer.draw();
    });

    window.SolarSystem.layers.register('trajectory-player-reference-connector', () => {
      this.referenceConnectorRenderer?.draw(this.currentDate);
    });

    window.SolarSystem.layers.register('trajectory-player-object', () => {
      if (!this.currentWorldPosition || typeof drawComet !== 'function') return;
      const objectAlpha = 0.98;
      const ringAlpha = 0.22;
      const tint = this.currentAppearance?.rgb || getNamedVisualColorRgb(TP_DEFAULT_VISUAL_COLOR);
      drawComet(
        this.currentWorldPosition.wx,
        this.currentWorldPosition.wy,
        this.currentWorldPosition.wz,
        objectAlpha,
        `${tint.r},${tint.g},${tint.b}`,
        {
          sizeMultiplier: 0.95,
          image: this.objectSprite || undefined,
          imageBaseTailAngle: this.objectVisual.imageBaseTailAngleRad,
          anchorY: this.objectVisual.anchorY,
          alignToSun: this.objectVisual.alignToSun,
          rotationOffset: getObjectSpinRotation(this.designation, this.engine.pulsePhase),
        }
      );
      drawTrajectoryObjectColorRing(this.currentWorldPosition, tint, ringAlpha);
    });
  }

  bindInteractions() {
    if (this.interactionsBound) return;
    this.interactionsBound = true;
    document.addEventListener('keydown', this.boundKeydown);
    const canvasEl = document.getElementById('c');
    if (canvasEl) {
      canvasEl.addEventListener('click', this.boundCanvasClick);
      canvasEl.addEventListener('mousedown', this.boundCanvasInteractionGate, true);
      canvasEl.addEventListener('wheel', this.boundCanvasInteractionGate, { capture: true, passive: false });
      canvasEl.addEventListener('contextmenu', this.boundCanvasInteractionGate, true);
    }
  }

  onFrame(deltaMs) {
    if (!this.currentPoint || !this.currentWorldPosition) return;
    if (this.state !== 'playing') {
      this.syncUi();
      return;
    }

    if (this.segmentIndex >= this.points.length - 1) {
      this.state = 'stopped';
      this.syncUi();
      return;
    }

    if (this.segmentIndex >= this.points.length - 1) {
      this.syncUi();
      return;
    }

    this.segmentElapsedMs += deltaMs;
    let segmentMs = this.getCurrentSegmentDurationMs();

    while (this.segmentElapsedMs >= segmentMs && this.segmentIndex < this.points.length - 1) {
      this.segmentElapsedMs -= segmentMs;
      this.segmentIndex += 1;
      this.currentPointIndex = Math.min(this.segmentIndex, this.points.length - 1);
      this.currentPoint = this.points[this.currentPointIndex];

      this.applyPointFrame(this.currentPointIndex, { snapCamera: true });
      this.timelineScrubber.setProgress(this.currentPointIndex / Math.max(1, this.points.length - 1));

      if (this.segmentIndex >= this.points.length - 1) {
        this.segmentElapsedMs = 0;
        this.timelineScrubber.setProgress(1);
        this.state = 'stopped';
        this.syncUi();
        return;
      }

      if (shouldPauseAtPoint(this.currentPoint, this.pauseAtStoppablePoints, this.pauseAtEveryPoint)) {
        this.segmentElapsedMs = 0;
        this.state = 'stopped-at-point';
        this.annotationOverlay.hide();
        this.controlBar.setContinueVisible(true);
        this.applyAnomaliesDate(this.currentPoint);
        this.syncUi();
        return;
      }

      segmentMs = this.getCurrentSegmentDurationMs();
    }

    this.updateInterpolatedFrame();
    this.syncUi();
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
    this.currentAppearance = interpolateAppearanceForSegment(this.points, segmentIndex, t);
    this.trailRenderer.setAnchor(this.currentWorldPosition);

    if (window.SolarSystem?.engine) {
      window.SolarSystem.engine.setDate(this.currentDate);
    }

    const targetCamera = this.getCurrentCameraTarget();
    if (targetCamera) {
      this.currentCameraState = lerpCameraState(this.currentCameraState, targetCamera);
      this.applyCameraState(this.currentCameraState);
    }

    this.statsDisplay.update(this.currentDate, this.currentSunDistance, this.currentWorldPosition);
    this.timelineScrubber.setProgress((segmentIndex + t) / Math.max(1, this.points.length - 1));
  }

  jumpToSegmentStart(index, options = {}) {
    const { resetTrail = false, snapCamera = false, rebuildTrail = false } = options;
    const clampedIndex = Math.max(0, Math.min(this.points.length - 1, index));
    const point = this.points[clampedIndex];
    if (!point) return;

    this.segmentIndex = clampedIndex;
    this.currentPointIndex = clampedIndex;
    this.currentPoint = point;
    this.segmentElapsedMs = 0;
    this.state = (this.state === 'stopped' || this.state === 'stopped-manual') ? 'paused' : this.state;
    this.annotationOverlay.hide();
    this.controlBar.setContinueVisible(false);
    this.applyPointFrame(clampedIndex, { snapCamera });
    this.applyAnomaliesDate(point);

    if (resetTrail) {
      this.trailRenderer.reset(point.px);
    } else if (rebuildTrail) {
      this.trailRenderer.rebuild(this.points, clampedIndex);
    } else {
      this.trailRenderer.setAnchor(point.px);
    }

    this.statsDisplay.update(this.currentDate, this.currentSunDistance, this.currentWorldPosition);
    this.timelineScrubber.setProgress(clampedIndex / Math.max(1, this.points.length - 1));
    this.syncUi();
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

    this.applyAnomaliesDate(point);
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
    const action = getPlayAction(this.state, 'toggle');
    if (action === 'restart') {
      this.restart();
      return;
    }
    if (action === 'noop') return;
    this.controlBar.setContinueVisible(false);
    this.annotationOverlay.hide();
    this.state = action === 'pause' ? 'paused' : 'playing';
    this.syncUi();
  }

  onPlayButton() {
    const action = getPlayAction(this.state, 'button');
    if (action === 'restart') {
      this.restart();
      return;
    }
    if (action === 'noop') return;
    this.controlBar.setContinueVisible(false);
    this.annotationOverlay.hide();
    if (action === 'play') this.playFlyover?.play();
    this.state = action === 'pause' ? 'paused' : 'playing';
    this.syncUi();
  }

  restart() {
    if (areSecondaryControlsDisabled(this.state)) return;
    this.state = 'playing';
    this.controlBar.setContinueVisible(false);
    this.annotationOverlay.hide();
    this.jumpToSegmentStart(0, { resetTrail: true, snapCamera: true });
  }

  continueFromStop() {
    if (this.state !== 'stopped-at-point' && this.state !== 'stopped-manual') return;
    this.controlBar.setContinueVisible(false);
    this.annotationOverlay.hide();
    this.state = 'playing';
    this.syncUi();
  }

  prevPoint() {
    if (areSecondaryControlsDisabled(this.state)) return;
    const targetIndex = Math.max(0, this.currentPointIndex - 1);
    if (this.state === 'stopped') this.state = 'paused';
    this.jumpToSegmentStart(targetIndex, { snapCamera: true, rebuildTrail: true });
  }

  nextPoint() {
    if (areSecondaryControlsDisabled(this.state)) return;
    const targetIndex = Math.min(this.points.length - 1, this.currentPointIndex + 1);
    if (this.state === 'stopped') this.state = 'paused';
    this.jumpToSegmentStart(targetIndex, { snapCamera: true, rebuildTrail: true });
  }

  handleKeydown(event) {
    if (shouldIgnorePlaybackShortcut(event.target)) return;

    if (event.code === 'Space') {
      if (shouldHandleAnomalyPlayShortcut(this.state, this.anomaliesPanelController?.hasPendingPlayStep?.())) {
        event.preventDefault();
        this.anomaliesPanelController.playQueueStep();
        return;
      }
      event.preventDefault();
      if (this.state === 'stopped-at-point' || this.state === 'stopped-manual') return;
      this.togglePlayPause();
      return;
    }

    if (event.code === 'ArrowLeft') {
      if (areSecondaryControlsDisabled(this.state)) return;
      event.preventDefault();
      this.prevPoint();
      return;
    }

    if (event.code === 'ArrowRight') {
      if (areSecondaryControlsDisabled(this.state)) return;
      event.preventDefault();
      this.nextPoint();
      return;
    }

    if (event.code === 'KeyF') {
      event.preventDefault();
      this.controlBar.toggleFullscreen();
      return;
    }

    if (event.code === 'Enter' && (this.state === 'stopped-at-point' || this.state === 'stopped-manual')) {
      event.preventDefault();
    }
  }

  handleCanvasClick(event) {
    if (event.defaultPrevented) return;
    if (getCanvasClickAction(this.state) !== 'stop') return;
    this.controlBar.setContinueVisible(true);
    this.annotationOverlay.hide();
    this.state = 'stopped-manual';
    this.syncUi();
  }

  handleCanvasInteractionGate(event) {
    if (!areSecondaryControlsDisabled(this.state)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  }

  applyPointFrame(index, options = {}) {
    const { snapCamera = false } = options;
    const point = this.points[index];
    if (!point) return;

    this.currentPointIndex = index;
    this.currentPoint = point;
    this.currentWorldPosition = { ...point.px };
    this.currentDate = parseTrajectoryDate(point.date);
    this.currentSunDistance = computeSunDistance(point.au);
    this.currentAppearance = getAppearanceAtPoint(this.points, index);

    if (window.SolarSystem?.engine && this.currentDate) {
      window.SolarSystem.engine.setDate(this.currentDate);
    }

    this.statsDisplay.update(this.currentDate, this.currentSunDistance, this.currentWorldPosition);

    if (snapCamera) {
      this.currentCameraState = this.findNearestCamera(index);
      this.applyCameraState(this.currentCameraState);
    }
  }

  syncSolarSystemMotion() {
    const shouldPause = this.state !== 'playing';
    if (this.solarSystemPaused === shouldPause) return;
    this.solarSystemPaused = shouldPause;

    if (!window.SolarSystem?.engine) return;
    if (shouldPause) {
      window.SolarSystem.engine.pause();
    } else {
      window.SolarSystem.engine.resume();
    }
  }

  syncAnnotationOverlay() {
    const translatedPoint = AppTranslations.translatePoint?.(
      this.designation,
      this.currentPoint,
      trajectoryPlayerLocale
    ) || this.currentPoint;
    this.annotationOverlay.show({
      state: this.state,
      point: translatedPoint,
      appearance: this.currentAppearance,
      sanitizedName: this.sanitizedName,
      designation: this.designation,
    });
  }

  applyAnomaliesDate(point) {
    const date = getAnomaliesDateForPoint(point);
    if (!date || !this.anomaliesPanelController?.applyDate) return;
    this.anomaliesPanelController.applyDate(date);
  }

  syncUi() {
    this.syncSolarSystemMotion();
    this.controlBar.setState(this.state, {
      currentPointIndex: this.currentPointIndex,
      totalPoints: this.points.length,
    });
    this.statsDisplay.updatePosition(this.currentWorldPosition);
    this.syncAnnotationOverlay();
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

  rebuild(points, throughIndex) {
    this.trail = buildTrailThroughIndex(points, throughIndex);
  }

  draw() {
    if (!Array.isArray(this.trail) || this.trail.length < 2 || typeof project3 !== 'function' || typeof ctx === 'undefined') {
      return;
    }

    for (let i = 1; i < this.trail.length; i += 1) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      const pa = project3(a.wx, a.wy, a.wz);
      const pb = project3(b.wx, b.wy, b.wz);
      if (pa.depth < 10 || pb.depth < 10) continue;
      const opacity = (i / this.trail.length) * 0.7;
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.strokeStyle = `rgba(120,255,200,${opacity})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }
}

class ReferenceConnectorRenderer {
  constructor(config = {}) {
    this.config = config;
  }

  draw(currentDate) {
    const objectAnchorWorld = this.config.objectAnchorWorld;
    const referenceWorld = this.config.referencePoint?.world;
    if (
      !objectAnchorWorld ||
      !referenceWorld ||
      !shouldShowReferenceConnector(currentDate, this.config.visibleFrom) ||
      typeof project3 !== 'function' ||
      typeof ctx === 'undefined'
    ) {
      return;
    }

    const objectProjected = project3(objectAnchorWorld.wx, objectAnchorWorld.wy, objectAnchorWorld.wz);
    const referenceProjected = project3(referenceWorld.wx, referenceWorld.wy, referenceWorld.wz);

    const markerScale = typeof getScale === 'function' ? getScale(referenceProjected.depth) : 1;
    const markerRadius = Math.max(4, Math.min(10, markerScale * 6));

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(objectProjected.sx, objectProjected.sy);
    ctx.lineTo(referenceProjected.sx, referenceProjected.sy);
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.25)';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(objectProjected.sx, objectProjected.sy);
    ctx.lineTo(referenceProjected.sx, referenceProjected.sy);
    ctx.strokeStyle = 'rgba(255, 230, 110, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const glow = ctx.createRadialGradient(
      referenceProjected.sx,
      referenceProjected.sy,
      0,
      referenceProjected.sx,
      referenceProjected.sy,
      markerRadius * 3
    );
    glow.addColorStop(0, 'rgba(255, 255, 210, 0.95)');
    glow.addColorStop(0.35, 'rgba(255, 235, 120, 0.85)');
    glow.addColorStop(1, 'rgba(255, 210, 60, 0)');
    ctx.beginPath();
    ctx.arc(referenceProjected.sx, referenceProjected.sy, markerRadius * 3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(referenceProjected.sx, referenceProjected.sy, markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 236, 135, 0.98)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 247, 210, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
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
    this.stopCheckbox = document.getElementById('tp-stop-checkbox');
    this.stopAllCheckbox = document.getElementById('tp-stop-all-checkbox');
    this.continueBtn = document.getElementById('tp-continue-btn');
    this.fullscreenBtn = document.getElementById('tp-fullscreen-btn');
    this.controller = null;
  }

  connect(controller) {
    this.controller = controller;

    this.playBtn.addEventListener('click', () => controller.onPlayButton());
    this.restartBtn.addEventListener('click', () => controller.restart());
    this.prevBtn.addEventListener('click', () => controller.prevPoint());
    this.nextBtn.addEventListener('click', () => controller.nextPoint());
    this.stopCheckbox?.addEventListener('change', () => {
      if (areSecondaryControlsDisabled(controller.state)) {
        this.stopCheckbox.checked = controller.pauseAtStoppablePoints;
        return;
      }
      controller.pauseAtStoppablePoints = Boolean(this.stopCheckbox.checked);
    });
    this.stopAllCheckbox?.addEventListener('change', () => {
      if (areSecondaryControlsDisabled(controller.state)) {
        this.stopAllCheckbox.checked = controller.pauseAtEveryPoint;
        return;
      }
      controller.pauseAtEveryPoint = Boolean(this.stopAllCheckbox.checked);
    });
    this.continueBtn?.addEventListener('click', () => controller.continueFromStop());

    this.speedSlider.addEventListener('input', () => {
      if (areSecondaryControlsDisabled(controller.state)) {
        this.speedSlider.value = String(ControlBar.SPEED_STEPS.indexOf(controller.speedMultiplier));
        return;
      }
      const speed = ControlBar.SPEED_STEPS[Number(this.speedSlider.value)] ?? 1;
      controller.speedMultiplier = speed;
      this.speedValue.textContent = `${speed}×`;
    });

    this.fullscreenBtn.addEventListener('click', () => {
      // Story 3.10 owns the actual fullscreen behavior.
    });
  }

  toggleFullscreen() {
    this.fullscreenBtn?.click();
  }

  setContinueVisible(visible) {
    this.continueBtn?.classList.toggle('visible', Boolean(visible));
  }

  syncInitialValues(controller) {
    if (this.stopCheckbox) this.stopCheckbox.checked = Boolean(controller.pauseAtStoppablePoints);
    if (this.stopAllCheckbox) this.stopAllCheckbox.checked = Boolean(controller.pauseAtEveryPoint);
    const speedIndex = Math.max(0, ControlBar.SPEED_STEPS.indexOf(controller.speedMultiplier));
    if (this.speedSlider) this.speedSlider.value = String(speedIndex);
    if (this.speedValue) this.speedValue.textContent = `${controller.speedMultiplier}×`;
  }

  show() {
    this.root.classList.add('visible');
  }

  setState(state, meta = {}) {
    const view = getControlBarState(state, meta.currentPointIndex ?? 0, meta.totalPoints ?? 1);
    this.statusEl.textContent = view.label;
    this.playBtn.textContent = view.playText;
    this.playBtn.disabled = view.playDisabled;
    this.restartBtn.disabled = view.secondaryDisabled;
    this.prevBtn.disabled = view.prevDisabled;
    this.nextBtn.disabled = view.nextDisabled;
    if (this.speedSlider) this.speedSlider.disabled = view.secondaryDisabled;
    if (this.stopCheckbox) this.stopCheckbox.disabled = view.secondaryDisabled;
    if (this.stopAllCheckbox) this.stopAllCheckbox.disabled = view.secondaryDisabled;
  }
}

ControlBar.SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

class PlayFlyoverOverlay {
  constructor(root) {
    this.root = root;
    this.resetTimer = 0;
  }

  play() {
    if (!this.root) return;
    if (this.resetTimer) window.clearTimeout(this.resetTimer);
    this.root.classList.remove('is-active');
    void this.root.offsetWidth;
    this.root.classList.add('is-active');
    this.resetTimer = window.setTimeout(() => {
      this.root.classList.remove('is-active');
      this.resetTimer = 0;
    }, 1850);
  }
}

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
  constructor(root, moreInfoModal = null) {
    this.root = root;
    this.moreInfoModal = moreInfoModal;
    this.modelKey = '';
    this.failedImageSrc = null;
    this.currentContext = null;
    if (!this.root) return;

    this.root.innerHTML = `
      <div class="tp-overlay-card">
        <div class="tp-overlay-kicker"></div>
        <div class="tp-overlay-date"></div>
        <div class="tp-overlay-media-shell">
          <canvas class="tp-overlay-preview" width="220" height="220" aria-hidden="true"></canvas>
          <img class="tp-overlay-image" alt="">
          <div class="tp-overlay-no-image">${tt('ui.trajectoryPlayer.noImage', 'Image unavailable.')}</div>
        </div>
        <div class="tp-overlay-description"></div>
        <div class="tp-overlay-actions">
          <button class="tp-more-info-btn" type="button">More Info</button>
        </div>
      </div>
    `;

    this.kickerEl = this.root.querySelector('.tp-overlay-kicker');
    this.dateEl = this.root.querySelector('.tp-overlay-date');
    this.mediaShellEl = this.root.querySelector('.tp-overlay-media-shell');
    this.previewEl = this.root.querySelector('.tp-overlay-preview');
    this.imageEl = this.root.querySelector('.tp-overlay-image');
    this.noImageEl = this.root.querySelector('.tp-overlay-no-image');
    this.descriptionEl = this.root.querySelector('.tp-overlay-description');
    this.actionsEl = this.root.querySelector('.tp-overlay-actions');
    this.moreInfoBtn = this.root.querySelector('.tp-more-info-btn');

    this.moreInfoBtn?.addEventListener('click', event => {
      if (!this.currentContext?.point) return;
      event.preventDefault();
      event.stopPropagation();
      this.moreInfoModal?.show({
        point: this.currentContext.point,
        designation: this.currentContext.designation,
        dateText: formatDisplayDate(this.currentContext.point?.date),
        description: this.currentContext.point?.description || '',
      });
    });

    this.imageEl?.addEventListener('click', event => {
      const src = this.imageEl?.getAttribute('src');
      if (src) {
        event.preventDefault();
        event.stopPropagation();
        showImageLightbox(src);
      }
    });
  }

  show(context) {
    if (!this.root) return;
    this.currentContext = {
      point: context?.point || null,
      designation: context?.designation || '',
    };
    const nextKey = getTrajectoryOverlayKey(context);
    if (this.modelKey !== nextKey) {
      this.modelKey = nextKey;
      this.failedImageSrc = null;
    }

    this.applyModel(context);
    this.root.classList.add('visible');
  }

  applyModel(context) {
    if (!this.root) return;
    const imageState = this.failedImageSrc ? 'error' : 'ready';
    const model = buildTrajectoryOverlayModel(context, imageState);

    this.root.classList.toggle('is-preview-mode', model.mode === 'preview');
    this.root.classList.toggle('is-image-mode', model.mode === 'image');
    if (this.kickerEl) this.kickerEl.textContent = model.kicker;
    if (this.dateEl) this.dateEl.textContent = model.dateText;
    if (this.descriptionEl) {
      this.descriptionEl.textContent = model.description;
      this.descriptionEl.style.display = model.showDescription ? 'block' : 'none';
    }
    if (this.actionsEl) {
      this.actionsEl.classList.toggle('visible', model.showMoreInfo);
    }
    if (this.mediaShellEl) {
      this.mediaShellEl.style.display = 'flex';
    }
    if (this.noImageEl) {
      this.noImageEl.style.display = model.showNoImageState ? 'flex' : 'none';
    }
    if (this.previewEl) {
      this.previewEl.style.display = model.showPreview ? 'block' : 'none';
      if (model.showPreview) {
        renderLivePreview(this.previewEl, model.previewAppearance, this.currentContext?.designation || '');
      }
    }
    if (!this.imageEl) return;

    this.imageEl.onload = null;
    this.imageEl.onerror = null;
    this.imageEl.style.display = model.showImage ? 'block' : 'none';

    if (model.showImage && model.imageSrc) {
      this.imageEl.onload = () => {
        if (this.imageEl.getAttribute('src') !== model.imageSrc) return;
        this.failedImageSrc = null;
      };
      this.imageEl.onerror = () => {
        if (this.imageEl.getAttribute('src') !== model.imageSrc) return;
        this.failedImageSrc = model.imageSrc;
        this.applyModel(context);
      };

      if (this.imageEl.getAttribute('src') !== model.imageSrc) {
        this.imageEl.src = model.imageSrc;
      }
    } else {
      this.imageEl.removeAttribute('src');
    }
  }

  hide() {
    if (!this.root) return;
    this.root.classList.remove('visible');
    this.root.classList.remove('is-preview-mode');
    this.root.classList.remove('is-image-mode');
    this.modelKey = '';
    this.failedImageSrc = null;
    this.currentContext = null;
    if (this.imageEl) {
      this.imageEl.onload = null;
      this.imageEl.onerror = null;
      this.imageEl.removeAttribute('src');
    }
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

  update(dateValue, sunDistance, worldPosition) {
    if (!dateValue) return;
    this.dateEl.textContent = formatCompactStatsDate(dateValue);
    this.distanceEl.textContent = tt('ui.trajectoryPlayer.distance', `Sun: ${Number(sunDistance || 0).toFixed(2)} AU`, {
      distance: Number(sunDistance || 0).toFixed(2),
    });
    this.updatePosition(worldPosition);
  }

  updatePosition(worldPosition) {
    if (!worldPosition || typeof project3 !== 'function') return;
    const projected = project3(worldPosition.wx, worldPosition.wy, worldPosition.wz);
    const layout = getFloatingStatsLayout(
      projected,
      {
        width: this.root.offsetWidth || 104,
        height: this.root.offsetHeight || 34,
      },
      {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    );

    this.root.style.left = `${layout.left}px`;
    this.root.style.top = `${layout.top}px`;
    this.root.style.opacity = layout.visible ? '1' : '0';
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

function normalizeVisualColor(value) {
  const key = String(value || '').trim().toLowerCase();
  return TP_VISUAL_COLOR_MAP[key] ? key : null;
}

function getNamedVisualColorRgb(name) {
  return TP_VISUAL_COLOR_MAP[normalizeVisualColor(name) || TP_DEFAULT_VISUAL_COLOR];
}

function getColorNameForPoint(points, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const color = normalizeVisualColor(points[cursor]?.color);
    if (color) return color;
  }
  return TP_DEFAULT_VISUAL_COLOR;
}

function getDefaultAppearance() {
  return {
    name: TP_DEFAULT_VISUAL_COLOR,
    rgb: { ...getNamedVisualColorRgb(TP_DEFAULT_VISUAL_COLOR) },
  };
}

function getAppearanceAtPoint(points, index) {
  const name = getColorNameForPoint(points, index);
  return {
    name,
    rgb: { ...getNamedVisualColorRgb(name) },
  };
}

function interpolateAppearanceForSegment(points, segmentIndex, t) {
  const startName = getColorNameForPoint(points, segmentIndex);
  const destinationIndex = Math.min(points.length - 1, segmentIndex + 1);
  const explicitDestinationName = normalizeVisualColor(points[destinationIndex]?.color);
  const endName = explicitDestinationName || startName;
  const startRgb = getNamedVisualColorRgb(startName);
  const endRgb = getNamedVisualColorRgb(endName);

  return {
    name: t >= 0.5 ? endName : startName,
    fromName: startName,
    toName: endName,
    rgb: {
      r: Math.round(tpLerp(startRgb.r, endRgb.r, t)),
      g: Math.round(tpLerp(startRgb.g, endRgb.g, t)),
      b: Math.round(tpLerp(startRgb.b, endRgb.b, t)),
    },
  };
}

function parseTrajectoryDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00Z`);
  }
  return new Date(value);
}

function convertKmToAuPosition(positionKm) {
  return {
    x: Number(positionKm?.x || 0) / TP_AU_IN_KM,
    y: Number(positionKm?.y || 0) / TP_AU_IN_KM,
    z: Number(positionKm?.z || 0) / TP_AU_IN_KM,
  };
}

function convertAuToWorldPosition(positionAu) {
  return {
    wx: Number(positionAu?.x || 0) * TP_WORLD_PX_PER_AU,
    wy: Number(positionAu?.y || 0) * TP_WORLD_PX_PER_AU,
    wz: Number(positionAu?.z || 0) * TP_WORLD_PX_PER_AU,
  };
}

function getFixedReferencePoint() {
  const au = convertKmToAuPosition(TP_FIXED_REFERENCE_POINT_KM);
  return {
    visibleFrom: TP_REFERENCE_CONNECTOR_VISIBLE_FROM,
    km: { ...TP_FIXED_REFERENCE_POINT_KM },
    au,
    world: convertAuToWorldPosition(au),
  };
}

function getWorldPositionAtDate(points, targetDate) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const exactPoint = points.find(point => point?.date === targetDate);
  if (exactPoint?.px) {
    return { ...exactPoint.px };
  }

  const targetTime = parseTrajectoryDate(targetDate).getTime();
  if (Number.isNaN(targetTime)) return null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const startTime = parseTrajectoryDate(points[index]?.date).getTime();
    const endTime = parseTrajectoryDate(points[index + 1]?.date).getTime();
    if (Number.isNaN(startTime) || Number.isNaN(endTime) || targetTime < startTime || targetTime > endTime) {
      continue;
    }

    const duration = endTime - startTime;
    const t = duration <= 0 ? 0 : (targetTime - startTime) / duration;
    return interpolateWorldPosition(points, index, t);
  }

  return null;
}

function getFixedConnectorConfiguration(points) {
  return {
    visibleFrom: TP_REFERENCE_CONNECTOR_VISIBLE_FROM,
    objectAnchorDate: TP_FIXED_OBJECT_ANCHOR_DATE,
    objectAnchorWorld: getWorldPositionAtDate(points, TP_FIXED_OBJECT_ANCHOR_DATE),
    referencePoint: getFixedReferencePoint(),
  };
}

function computeSunDistance(au) {
  const { x, y, z } = au ?? { x: 0, y: 0, z: 0 };
  return Math.sqrt(x * x + y * y + z * z);
}

function getSegmentDurationMs(points, segmentIndex, speedMultiplier = 1) {
  const destinationPoint = points[segmentIndex + 1];
  if (!destinationPoint) return Number.POSITIVE_INFINITY;
  return (destinationPoint.durationPct / 100) * 4000 * (1 / speedMultiplier);
}

function buildTrailThroughIndex(points, throughIndex, samplesPerSegment = 8) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const clampedIndex = tpClamp(throughIndex, 0, points.length - 1);
  const trail = [{ ...points[0].px }];

  for (let segmentIndex = 0; segmentIndex < clampedIndex; segmentIndex += 1) {
    for (let step = 1; step <= samplesPerSegment; step += 1) {
      trail.push(interpolateWorldPosition(points, segmentIndex, step / samplesPerSegment));
    }
  }

  return trail;
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

function shouldPauseAtPoint(point, pauseAtStoppablePoints, pauseAtEveryPoint = false) {
  return Boolean(pauseAtEveryPoint || (pauseAtStoppablePoints && point?.stoppable));
}

function getCanvasClickAction(state) {
  return state === 'playing' ? 'stop' : 'noop';
}

function getPlayAction(state, source = 'toggle') {
  if (state === 'stopped-at-point' || state === 'stopped-manual') return 'noop';
  if (state === 'stopped') return source === 'button' ? 'restart' : 'noop';
  return state === 'playing' ? 'pause' : 'play';
}

function areSecondaryControlsDisabled(state) {
  return state === 'playing';
}

function getControlBarState(state, currentPointIndex, totalPoints) {
  const atStart = currentPointIndex <= 0;
  const atEnd = currentPointIndex >= Math.max(0, totalPoints - 1);
  const secondaryDisabled = areSecondaryControlsDisabled(state);
  return {
    label: state === 'playing'
      ? tt('ui.trajectoryPlayer.statusPlaying', 'Playing')
      : state === 'paused'
        ? tt('ui.trajectoryPlayer.statusPaused', 'Paused')
        : state === 'stopped-manual'
          ? tt('ui.trajectoryPlayer.statusPaused', 'Paused')
          : state === 'stopped'
          ? tt('ui.trajectoryPlayer.statusStopped', 'Stopped')
          : state === 'stopped-at-point'
            ? tt('ui.trajectoryPlayer.statusPausedAtPoint', 'Paused at point')
            : tt('ui.trajectoryPlayer.statusIdle', 'Idle'),
    playText: state === 'playing' ? '⏸' : '▶',
    playDisabled: state === 'stopped-at-point' || state === 'stopped-manual',
    prevDisabled: secondaryDisabled || atStart,
    nextDisabled: secondaryDisabled || atEnd,
    secondaryDisabled,
  };
}

function getFloatingStatsLayout(projected, panelSize, viewportSize) {
  const margin = 16;
  const panelWidth = Math.max(0, Number(panelSize?.width) || 190);
  const panelHeight = Math.max(0, Number(panelSize?.height) || 56);
  const viewportWidth = Math.max(panelWidth + margin * 2, Number(viewportSize?.width) || 0);
  const viewportHeight = Math.max(panelHeight + margin * 2, Number(viewportSize?.height) || 0);

  if (!projected || !Number.isFinite(projected.sx) || !Number.isFinite(projected.sy) || projected.depth < 10) {
    return {
      left: margin,
      top: margin,
      visible: false,
    };
  }

  let left = projected.sx + 18;
  let top = projected.sy - panelHeight - 14;

  if (top < margin) {
    top = projected.sy + 18;
  }

  left = tpClamp(left, margin, viewportWidth - panelWidth - margin);
  top = tpClamp(top, margin, viewportHeight - panelHeight - margin);

  return {
    left,
    top,
    visible: true,
  };
}

function shouldIgnorePlaybackShortcut(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tagName = String(target.tagName || '').toUpperCase();
  if (tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  if (tagName !== 'INPUT') return false;
  const type = String(target.type || '').toLowerCase();
  return ['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(type);
}

function shouldShowReferenceConnector(currentDate, visibleFrom = TP_REFERENCE_CONNECTOR_VISIBLE_FROM) {
  const date = parseTrajectoryDate(currentDate);
  const start = parseTrajectoryDate(visibleFrom);
  if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime())) return false;
  return date.getTime() >= start.getTime();
}

function normalizeAnnotationDescription(description) {
  return typeof description === 'string' ? description.trim() : '';
}

function isAbsoluteImageUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function resolveAnnotationImageSrc(image, sanitizedName) {
  if (typeof image !== 'string') return null;
  const trimmed = image.trim();
  if (!trimmed) return null;
  if (isAbsoluteImageUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) {
    try {
      const base = typeof location !== 'undefined' ? location.href.replace(/\/[^/]*$/, '/') : '';
      return new URL(trimmed.slice(1), base || 'http://localhost/').href;
    } catch {
      return trimmed;
    }
  }
  const normalized = trimmed.replace(/^\.?[\\/]+/, '').replace(/\\/g, '/');
  return `data/${TrajectoryLoader.sanitize(sanitizedName)}/${normalized}`;
}

function hasAnnotationContent(point, sanitizedName = '') {
  return Boolean(
    normalizeAnnotationDescription(point?.description) ||
    resolveAnnotationImageSrc(point?.image, sanitizedName)
  );
}

function shouldShowAnnotationOverlay(state, point) {
  return state === 'stopped-at-point' && hasAnnotationContent(point);
}

function buildAnnotationOverlayModel(point, sanitizedName, imageState = 'ready') {
  const description = normalizeAnnotationDescription(point?.description);
  const imageSrc = resolveAnnotationImageSrc(point?.image, sanitizedName);
  const hasImageWindow = Boolean(imageSrc);
  const showImage = Boolean(imageSrc) && imageState !== 'error';

  return {
    dateText: formatDisplayDate(point?.date),
    description,
    imageSrc,
    hasContent: Boolean(description || imageSrc),
    hasImageWindow,
    showImage,
    showDescription: Boolean(description),
    showNoImageState: hasImageWindow && imageState === 'error',
  };
}

function buildTrajectoryOverlayModel(context = {}, imageState = 'ready') {
  const point = context.point || null;
  const appearance = context.appearance || getDefaultAppearance();
  const sanitizedName = context.sanitizedName || '';
  const stopImageSrc = resolveAnnotationImageSrc(point?.image, sanitizedName);
  const atStoppableWithImage = Boolean(stopImageSrc) && Boolean(point?.stoppable);
  const showStoppedImage = atStoppableWithImage && (
    context.state === 'stopped-at-point' || context.state === 'paused'
  );
  const description = normalizeAnnotationDescription(point?.description);
  const colorName = appearance.name || TP_DEFAULT_VISUAL_COLOR;
  const showMoreInfo = typeof MoreInfoHelpers.hasMoreInfoContent === 'function'
    ? MoreInfoHelpers.hasMoreInfoContent(point, context.designation || sanitizedName || '')
    : false;

  return {
    mode: showStoppedImage ? 'image' : 'preview',
    kicker: showStoppedImage
      ? tt('ui.trajectoryPlayer.pointImage', 'Point Image')
      : `${capitalizeVisualColor(colorName)} ${tt('ui.trajectoryPlayer.previewSuffix', 'Preview')}`,
    dateText: formatDisplayDate(point?.date),
    description,
    imageSrc: showStoppedImage ? stopImageSrc : null,
    showImage: showStoppedImage && imageState !== 'error',
    showNoImageState: showStoppedImage && imageState === 'error',
    showPreview: !showStoppedImage || imageState === 'error',
    showDescription: Boolean(description),
    showMoreInfo,
    previewAppearance: appearance,
  };
}

function capitalizeVisualColor(name) {
  const value = String(name || TP_DEFAULT_VISUAL_COLOR).trim().toLowerCase();
  const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
  return tt(capitalized, capitalized);
}

function getTrajectoryOverlayKey(context = {}) {
  return JSON.stringify({
    state: context.state || '',
    point: getAnnotationOverlayKey(context.point, context.sanitizedName),
    appearance: context.appearance || null,
  });
}

function renderLivePreview(canvasEl, appearance, designation = '') {
  if (!canvasEl?.getContext) return;
  const previewCtx = canvasEl.getContext('2d');
  if (!previewCtx) return;

  const width = canvasEl.width;
  const height = canvasEl.height;
  const tint = appearance?.rgb || getNamedVisualColorRgb(TP_DEFAULT_VISUAL_COLOR);

  previewCtx.clearRect(0, 0, width, height);
  const bg = previewCtx.createRadialGradient(width * 0.48, height * 0.45, 8, width * 0.5, height * 0.5, width * 0.5);
  bg.addColorStop(0, 'rgba(18,34,58,0.96)');
  bg.addColorStop(1, 'rgba(3,8,18,0.98)');
  previewCtx.fillStyle = bg;
  previewCtx.fillRect(0, 0, width, height);

  const halo = previewCtx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.42);
  halo.addColorStop(0, `rgba(${tint.r},${tint.g},${tint.b},0.34)`);
  halo.addColorStop(1, `rgba(${tint.r},${tint.g},${tint.b},0)`);
  previewCtx.fillStyle = halo;
  previewCtx.fillRect(0, 0, width, height);

  if (typeof window.drawCometBillboard === 'function') {
    const previewTailDirection = -3 * Math.PI / 4;
    const objectVisual = getObjectVisualConfig(designation);
    const objectSprite = resolveObjectSprite(designation);
    window.drawCometBillboard(previewCtx, {
      x: width / 2,
      y: height / 2,
      size: Math.min(width, height) * 0.68,
      rotationAngle: objectVisual.alignToSun ? (previewTailDirection - objectVisual.imageBaseTailAngleRad) : 0,
      alpha: 0.98,
      tint,
      image: objectSprite || undefined,
      anchorY: objectVisual.anchorY,
    });
  }

  previewCtx.save();
  previewCtx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},0.95)`;
  previewCtx.font = '600 14px Georgia, serif';
  previewCtx.textAlign = 'center';
  previewCtx.fillText(capitalizeVisualColor(appearance?.name), width / 2, height - 16);
  previewCtx.restore();
}

function drawTrajectoryObjectColorRing(worldPosition, tint, alpha = 1) {
  if (!worldPosition || typeof project3 !== 'function' || typeof ctx === 'undefined') return;
  const projected = project3(worldPosition.wx, worldPosition.wy, worldPosition.wz);
  if (projected.depth < 5) return;

  const scale = typeof getScale === 'function' ? getScale(projected.depth) : 1;
  const radius = Math.max(11, Math.min(22, scale * 14));
  const lineWidth = Math.max(1.4, Math.min(2.4, scale * 1.7));
  const strokeAlpha = tpClamp(alpha, 0.14, 0.38);

  ctx.save();
  ctx.beginPath();
  ctx.arc(projected.sx, projected.sy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${tint.r},${tint.g},${tint.b},${strokeAlpha})`;
  ctx.lineWidth = lineWidth;
  ctx.shadowBlur = 8;
  ctx.shadowColor = `rgba(${tint.r},${tint.g},${tint.b},${strokeAlpha * 0.7})`;
  ctx.stroke();
  ctx.restore();
}

function getAnnotationOverlayKey(point, sanitizedName) {
  return JSON.stringify({
    sanitizedName: sanitizedName || '',
    index: point?.index ?? -1,
    date: point?.date ?? '',
    description: normalizeAnnotationDescription(point?.description),
    image: point?.image ?? null,
    moreInfo: point?.more_info ?? null,
  });
}

function formatDisplayDate(value) {
  const date = parseTrajectoryDate(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(trajectoryPlayerLocale === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatCompactStatsDate(value) {
  const date = parseTrajectoryDate(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(trajectoryPlayerLocale === 'he' ? 'he-IL' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function getAnomaliesDateForPoint(point) {
  const value = typeof point?.date === 'string' ? point.date.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function shouldHandleAnomalyPlayShortcut(state, hasPendingAnomalyStep) {
  return Boolean(hasPendingAnomalyStep && state !== 'playing');
}

function setSubtitle(text) {
  const el = document.getElementById('tp-subtitle');
  if (el) el.textContent = text;
}

function buildObjectMotionHref(designation, source = '', locale = trajectoryPlayerLocale) {
  const params = new URLSearchParams({ designation: designation || '3I' });
  const normalizedSource = TrajectoryLoader.normalizeRequestedSource(source);
  if (normalizedSource) params.set('source', normalizedSource);
  params.set('lang', locale || trajectoryPlayerLocale || 'en');
  return `object_motion?${params.toString()}`;
}

function buildTrajectoryPlayerHref(designation, source = '', locale = trajectoryPlayerLocale) {
  const params = new URLSearchParams({ designation: designation || '3I' });
  const normalizedSource = TrajectoryLoader.normalizeRequestedSource(source);
  if (normalizedSource) params.set('source', normalizedSource);
  params.set('lang', locale || trajectoryPlayerLocale || 'en');
  return `trajectory_player?${params.toString()}`;
}

function syncPlayerUrl(designation, source = '', locale = trajectoryPlayerLocale) {
  if (!window.history?.replaceState) return;
  window.history.replaceState(null, '', buildTrajectoryPlayerHref(designation, source, locale));
}

function updateObjectMotionLinks(designation, source = '', locale = trajectoryPlayerLocale) {
  const href = buildObjectMotionHref(designation, source, locale);
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
  setSubtitle(tt('ui.trajectoryPlayer.unableToLoad', 'Unable to load trajectory'));
}

function showImageLightbox(src) {
  const lightbox = document.getElementById('tp-image-lightbox');
  const img = document.getElementById('tp-image-lightbox-img');
  const closeBtn = document.getElementById('tp-image-lightbox-close');
  if (!lightbox || !img) return;
  img.src = src;
  img.alt = tt('ui.trajectoryPlayer.pointImage', 'Point Image');
  lightbox.classList.add('visible');
  const close = () => {
    lightbox.classList.remove('visible');
    lightbox.removeEventListener('click', onBackdropClick);
    closeBtn?.removeEventListener('click', onCloseClick);
    document.removeEventListener('keydown', onEscape);
  };
  const onBackdropClick = (e) => {
    if (e.target === lightbox) close();
  };
  const onCloseClick = () => close();
  const onEscape = (e) => {
    if (e.key === 'Escape') close();
  };
  lightbox.addEventListener('click', onBackdropClick);
  closeBtn?.addEventListener('click', onCloseClick);
  document.addEventListener('keydown', onEscape);
}

async function bootstrapTrajectoryPlayer() {
  await AppTranslations.loadTranslations?.();
  document.title = `${tt('ui.trajectoryPlayer.pageTitle', 'Trajectory Player')} · 3I-web`;
  const backLink = document.getElementById('tp-back-link');
  const errorLink = document.getElementById('tp-error-link');
  const titleEl = document.getElementById('tp-title');
  const statsDistanceEl = document.getElementById('tp-stats-distance');
  if (backLink) backLink.textContent = tt('ui.trajectoryPlayer.backToTracker', '← Back to Object Motion Tracker');
  if (errorLink) errorLink.textContent = tt('ui.trajectoryPlayer.openTracker', 'Open Object Motion Tracker');
  if (titleEl) titleEl.textContent = tt('ui.trajectoryPlayer.pageTitle', 'Trajectory Player');
  if (statsDistanceEl) statsDistanceEl.textContent = tt('ui.trajectoryPlayer.distance', 'Sun: -- AU', { distance: '--' });

  showLoadingCard(tt('ui.trajectoryPlayer.loading', 'Loading trajectory…'));

  try {
    const designation = TrajectoryLoader.readDesignationFromUrl();
    const requestedSource = TrajectoryLoader.resolveRequestedSource(TrajectoryLoader.readSourceFromUrl());
    if (designation) {
      syncPlayerUrl(designation, requestedSource, trajectoryPlayerLocale);
      setSubtitle(tt('ui.trajectoryPlayer.loadingDesignation', `Loading ${designation}${requestedSource ? ` (${requestedSource})` : ''}`, {
        designation,
        sourceSuffix: requestedSource
          ? tt(
            requestedSource === 'local'
              ? 'ui.trajectoryPlayer.sourceSuffixLocal'
              : 'ui.trajectoryPlayer.sourceSuffixWeb',
            ` (${requestedSource})`
          )
          : '',
      }));
    } else {
      setSubtitle(tt('ui.trajectoryPlayer.waiting', 'Waiting for trajectory'));
    }
    updateObjectMotionLinks(designation || '3I', requestedSource, trajectoryPlayerLocale);

    const result = await TrajectoryLoader.load(designation, { source: requestedSource });

    hideLoadingCard();
    setSubtitle(tt('ui.trajectoryPlayer.playingDesignation', `Playing ${result.designation}${result.source === 'local' ? ' · Local draft' : ''}`, {
      designation: result.designation,
      localSuffix: result.source === 'local'
        ? tt('ui.trajectoryPlayer.localDraftSuffix', ' · Local draft')
        : '',
    }));

    const controlBar = new ControlBar(document.getElementById('tp-controls'));
    const statsDisplay = new StatsDisplay(document.getElementById('tp-stats'));
    const trailRenderer = new TrailRenderer();
    const timelineScrubber = new TimelineScrubber(document.getElementById('tp-timeline-shell'));
    const moreInfoModal = (window.MoreInfoModalShared?.createModalController)
      ? window.MoreInfoModalShared.createModalController(document.getElementById('tp-more-info-modal'), {
        title: tt('ui.trajectoryPlayer.pointMoreInfoTitle', 'Point More Info'),
      })
      : null;
    const annotationOverlay = new AnnotationOverlay(document.getElementById('tp-overlay'), moreInfoModal);
    const playFlyover = new PlayFlyoverOverlay(document.getElementById('tp-play-flyover'));
    const referenceConnectorRenderer = new ReferenceConnectorRenderer(getFixedConnectorConfiguration(result.points));
    const anomaliesPanelController = (typeof AnomaliesPanelApi.createPanelController === 'function')
      ? AnomaliesPanelApi.createPanelController(document.getElementById('tp-anomalies-panel'), {
        initialCollapsed: true,
        designation: result.designation,
      })
      : null;

    if (anomaliesPanelController) {
      try {
        const dataset = await AnomaliesPanelApi.loadAnomaliesDataset(result.designation);
        anomaliesPanelController.setDataset(dataset);
      } catch (error) {
        const fallbackDataset = typeof AnomaliesPanelApi.createUnavailableDataset === 'function'
          ? AnomaliesPanelApi.createUnavailableDataset(result.designation, error)
          : {
            title: `${result.designation} anomalies`,
            subtitle: error?.message || 'Anomaly data is unavailable.',
            entries: [],
            visibleEntries: [],
          };
        anomaliesPanelController.setDataset(fallbackDataset);
      }
    }

    const controller = new PlaybackController({
      designation: result.designation,
      sanitizedName: result.sanitizedName,
      points: result.points,
      controlBar,
      statsDisplay,
      trailRenderer,
      timelineScrubber,
      annotationOverlay,
      playFlyover,
      referenceConnectorRenderer,
      anomaliesPanelController,
    });

    controlBar.connect(controller);
    statsDisplay.update(parseTrajectoryDate(result.points[0].date), computeSunDistance(result.points[0].au), result.points[0].px);

    requestAnimationFrame(() => controller.bootstrap());
  } catch (error) {
    if (error instanceof TrajectoryLoadError) {
      updateObjectMotionLinks(error.details?.designation || '3I', error.details?.source || '', trajectoryPlayerLocale);
      showError(error);
      return;
    }

    console.error(error);
    updateObjectMotionLinks('3I', '', trajectoryPlayerLocale);
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
