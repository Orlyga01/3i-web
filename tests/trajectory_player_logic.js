/**
 * Pure loader logic extracted from trajectory_player.js for unit testing.
 * Avoids DOM, canvas, and browser runtime dependencies.
 */

'use strict';

class TrajectoryLoadError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'TrajectoryLoadError';
        this.code = code;
        this.details = details;
    }
}

const SUPPORTED_SPEED_MULTIPLIERS = Object.freeze([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);

function decodeDesignation(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
        return decodeURIComponent(trimmed);
    } catch (_) {
        return trimmed;
    }
}

function readDesignationFromUrl(search = '') {
    const params = new URLSearchParams(search);
    const rawValue = params.get('designation') ?? params.get('d');
    return decodeDesignation(rawValue);
}

function normalizeRequestedSource(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'local' || normalized === 'web' ? normalized : '';
}

function readSourceFromUrl(search = '') {
    const params = new URLSearchParams(search);
    return normalizeRequestedSource(params.get('source') ?? params.get('s'));
}

function resolveRequestedSource(value, useLocalStorage = true) {
    const requestedSource = normalizeRequestedSource(value);
    if (requestedSource !== 'local') return requestedSource;
    return useLocalStorage ? 'local' : 'web';
}

function sanitize(name) {
    return String(name || '').replace(/[\s/]/g, '_');
}

function buildPath(designation) {
    const sanitizedName = sanitize(designation);
    return {
        sanitizedName,
        path: `data/${sanitizedName}/trajectory.json`,
    };
}

function normalizePoint(point, index, designation) {
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

function buildObjectMotionHref(designation, source = '', locale = 'en') {
    const params = new URLSearchParams({ designation: designation || '3I' });
    const normalizedSource = normalizeRequestedSource(source);
    if (normalizedSource) params.set('source', normalizedSource);
    params.set('lang', locale || 'en');
    return `object_motion?${params.toString()}`;
}

function buildTrajectoryPlayerHref(designation, source = '', locale = 'en') {
    const params = new URLSearchParams({ designation: designation || '3I' });
    const normalizedSource = normalizeRequestedSource(source);
    if (normalizedSource) params.set('source', normalizedSource);
    params.set('lang', locale || 'en');
    return `trajectory_player?${params.toString()}`;
}

const AU_IN_KM = 149597870.7;
const WORLD_PX_PER_AU = 175;
const REFERENCE_CONNECTOR_VISIBLE_FROM = '2025-10-31';
const FIXED_OBJECT_ANCHOR_DATE = '2025-10-29';
const DEFAULT_VISUAL_COLOR = 'green';
const VISUAL_COLOR_MAP = Object.freeze({
    green: Object.freeze({ r: 88, g: 228, b: 128 }),
    blue: Object.freeze({ r: 96, g: 176, b: 255 }),
    red: Object.freeze({ r: 255, g: 104, b: 104 }),
    yellow: Object.freeze({ r: 255, g: 214, b: 92 }),
    white: Object.freeze({ r: 242, g: 246, b: 252 }),
});
const FIXED_REFERENCE_POINT_KM = Object.freeze({
    x: -3.318697414262085e8,
    y: 7.099317219152682e8,
    z: 4.476039412376106e6,
});
const DEFAULT_OBJECT_VISUAL = Object.freeze({
    spriteSrc: 'assets/3igreen_1.png',
    imageBaseTailAngleRad: 150 * (Math.PI / 180),
    anchorY: 0.5,
    alignToSun: true,
    axialSpinMultiplier: 0,
    preserveSpriteColor: false,
    showColorRing: true,
    tailRevealMode: 'full',
});
const BORISOV_OBJECT_VISUAL = Object.freeze({
    spriteSrc: 'assets/comet.png',
    imageBaseTailAngleRad: -Math.PI / 2,
    anchorY: 0.9,
    alignToSun: true,
    axialSpinMultiplier: 0,
    preserveSpriteColor: false,
    showColorRing: true,
    tailRevealMode: 'sunDistance',
    tailRevealNearAu: 180 / 175,
    tailRevealFarAu: 820 / 175,
});
const OUMUAMUA_OBJECT_VISUAL = Object.freeze({
    spriteSrc: 'assets/Oumuamua.png',
    imageBaseTailAngleRad: 0,
    anchorY: 0.5,
    alignToSun: false,
    axialSpinMultiplier: 0.2,
    preserveSpriteColor: true,
    showColorRing: false,
    tailRevealMode: 'full',
});

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function catmullRom(p0, p1, p2, p3, t) {
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
    );
}

function normalizeVisualColor(value) {
    const key = String(value || '').trim().toLowerCase();
    return VISUAL_COLOR_MAP[key] ? key : null;
}

function resolveDefaultSpeedMultiplier(value) {
    const numeric = Number(value);
    return SUPPORTED_SPEED_MULTIPLIERS.includes(numeric) ? numeric : 1;
}

function getObjectVisualConfig(designation) {
    const key = String(designation || '').trim().toLowerCase();
    if (key === '2i/borisov') return BORISOV_OBJECT_VISUAL;
    if (key === 'oumuamua') return OUMUAMUA_OBJECT_VISUAL;
    return DEFAULT_OBJECT_VISUAL;
}

function getObjectSpinRotation(designation, phase = 0) {
    const config = getObjectVisualConfig(designation);
    return (config.axialSpinMultiplier || 0) * Number(phase || 0);
}

function getObjectTailReveal(designation, sunDistanceAu = 0) {
    const config = getObjectVisualConfig(designation);
    if (config.tailRevealMode !== 'sunDistance') return 1;
    const near = Number(config.tailRevealNearAu);
    const far = Number(config.tailRevealFarAu);
    const distance = Number(sunDistanceAu);
    if (![near, far, distance].every(Number.isFinite) || far <= near) return 1;
    const reveal = (far - distance) / (far - near);
    return Math.max(0, Math.min(1, reveal));
}

function getNamedVisualColorRgb(name) {
    return VISUAL_COLOR_MAP[normalizeVisualColor(name) || DEFAULT_VISUAL_COLOR];
}

function getColorNameForPoint(points, index) {
    for (let cursor = index; cursor >= 0; cursor -= 1) {
        const color = normalizeVisualColor(points[cursor]?.color);
        if (color) return color;
    }
    return DEFAULT_VISUAL_COLOR;
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
            r: Math.round(lerp(startRgb.r, endRgb.r, t)),
            g: Math.round(lerp(startRgb.g, endRgb.g, t)),
            b: Math.round(lerp(startRgb.b, endRgb.b, t)),
        },
    };
}

function clampSegmentIndex(points, index) {
    return Math.max(0, Math.min(points.length - 1, index));
}

function getSegmentDurationMs(points, segmentIndex, speedMultiplier = 1) {
    const destinationPoint = points[segmentIndex + 1];
    if (!destinationPoint) return Number.POSITIVE_INFINITY;
    return (destinationPoint.durationPct / 100) * 4000 * (1 / speedMultiplier);
}

function buildTrailThroughIndex(points, throughIndex, samplesPerSegment = 8) {
    if (!Array.isArray(points) || points.length === 0) return [];
    const clampedIndex = Math.max(0, Math.min(points.length - 1, throughIndex));
    const trail = [{ ...points[0].px }];

    for (let segmentIndex = 0; segmentIndex < clampedIndex; segmentIndex += 1) {
        for (let step = 1; step <= samplesPerSegment; step += 1) {
            trail.push(interpolateWorldPosition(points, segmentIndex, step / samplesPerSegment));
        }
    }

    return trail;
}

function interpolateWorldPosition(points, segmentIndex, t) {
    const i0 = clampSegmentIndex(points, segmentIndex - 1);
    const i1 = clampSegmentIndex(points, segmentIndex);
    const i2 = clampSegmentIndex(points, segmentIndex + 1);
    const i3 = clampSegmentIndex(points, segmentIndex + 2);

    return {
        wx: catmullRom(points[i0].px.wx, points[i1].px.wx, points[i2].px.wx, points[i3].px.wx, t),
        wy: catmullRom(points[i0].px.wy, points[i1].px.wy, points[i2].px.wy, points[i3].px.wy, t),
        wz: catmullRom(points[i0].px.wz, points[i1].px.wz, points[i2].px.wz, points[i3].px.wz, t),
    };
}

function parseDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(`${value}T00:00:00Z`);
    }
    return new Date(value);
}

function convertKmToAuPosition(positionKm) {
    return {
        x: Number(positionKm?.x || 0) / AU_IN_KM,
        y: Number(positionKm?.y || 0) / AU_IN_KM,
        z: Number(positionKm?.z || 0) / AU_IN_KM,
    };
}

function convertAuToWorldPosition(positionAu) {
    return {
        wx: Number(positionAu?.x || 0) * WORLD_PX_PER_AU,
        wy: Number(positionAu?.y || 0) * WORLD_PX_PER_AU,
        wz: Number(positionAu?.z || 0) * WORLD_PX_PER_AU,
    };
}

function getFixedReferencePoint() {
    const au = convertKmToAuPosition(FIXED_REFERENCE_POINT_KM);
    return {
        visibleFrom: REFERENCE_CONNECTOR_VISIBLE_FROM,
        km: { ...FIXED_REFERENCE_POINT_KM },
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

    const targetTime = parseDate(targetDate).getTime();
    if (Number.isNaN(targetTime)) return null;

    for (let index = 0; index < points.length - 1; index += 1) {
        const startTime = parseDate(points[index]?.date).getTime();
        const endTime = parseDate(points[index + 1]?.date).getTime();
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
        visibleFrom: REFERENCE_CONNECTOR_VISIBLE_FROM,
        objectAnchorDate: FIXED_OBJECT_ANCHOR_DATE,
        objectAnchorWorld: getWorldPositionAtDate(points, FIXED_OBJECT_ANCHOR_DATE),
        referencePoint: getFixedReferencePoint(),
    };
}

function interpolateDate(points, segmentIndex, t) {
    const start = parseDate(points[segmentIndex].date);
    const end = parseDate(points[segmentIndex + 1].date);
    return new Date(lerp(start.getTime(), end.getTime(), t));
}

function interpolateSunDistance(points, segmentIndex, t) {
    const startAu = points[segmentIndex].au;
    const endAu = points[segmentIndex + 1].au;
    const x = lerp(startAu.x, endAu.x, t);
    const y = lerp(startAu.y, endAu.y, t);
    const z = lerp(startAu.z, endAu.z, t);
    return Math.sqrt(x * x + y * y + z * z);
}

function findNearestCameraIndex(points, startIndex, direction) {
    let idx = startIndex;
    while (idx >= 0 && idx < points.length) {
        if (points[idx]?.camera) return idx;
        idx += direction;
    }
    return -1;
}

function getCameraTargetForSegment(points, segmentIndex) {
    const destinationIndex = Math.min(points.length - 1, segmentIndex + 1);
    const targetIndex = findNearestCameraIndex(points, destinationIndex, -1);
    return targetIndex !== -1 ? points[targetIndex].camera : null;
}

function lerpCameraState(current, target, sp = 0.022) {
    if (!target) return current;
    const base = current || target;

    return {
        el: lerp(base.el ?? target.el ?? 0, target.el ?? base.el ?? 0, sp),
        az: lerp(base.az ?? target.az ?? 0, target.az ?? base.az ?? 0, sp * 0.75),
        zoom: lerp(base.zoom ?? target.zoom ?? 0, target.zoom ?? base.zoom ?? 0, sp * 0.65),
        tx: lerp(base.tx ?? target.tx ?? 0, target.tx ?? base.tx ?? 0, sp),
        ty: lerp(base.ty ?? target.ty ?? 0, target.ty ?? base.ty ?? 0, sp),
        tz: lerp(base.tz ?? target.tz ?? 0, target.tz ?? base.tz ?? 0, sp),
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
            ? 'Playing'
            : state === 'paused'
                ? 'Paused'
                : state === 'stopped-manual'
                    ? 'Paused'
                : state === 'stopped'
                    ? 'Stopped'
                    : state === 'stopped-at-point'
                        ? 'Paused at point'
                        : 'Idle',
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

    left = Math.max(margin, Math.min(viewportWidth - panelWidth - margin, left));
    top = Math.max(margin, Math.min(viewportHeight - panelHeight - margin, top));

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

function shouldShowReferenceConnector(currentDate, visibleFrom = REFERENCE_CONNECTOR_VISIBLE_FROM) {
    const date = parseDate(currentDate);
    const start = parseDate(visibleFrom);
    if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime())) return false;
    return date.getTime() >= start.getTime();
}

function getAnomaliesDateForPoint(point) {
    const value = typeof point?.date === 'string' ? point.date.trim() : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function shouldHandleAnomalyPlayShortcut(state, hasPendingAnomalyStep) {
    return Boolean(hasPendingAnomalyStep && state !== 'playing');
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
    if (trimmed.startsWith('/')) return trimmed;
    const normalized = trimmed.replace(/^\.?[\\/]+/, '').replace(/\\/g, '/');
    return `data/${sanitize(sanitizedName)}/${normalized}`;
}

function hasAnnotationContent(point) {
    return Boolean(
        normalizeAnnotationDescription(point?.description) ||
        resolveAnnotationImageSrc(point?.image, point?.designation || '')
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
        dateText: point?.date ? parseDate(point.date).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            timeZone: 'UTC',
        }) : '--',
        description,
        imageSrc,
        hasContent: Boolean(description || imageSrc),
        hasImageWindow,
        showImage,
        showDescription: Boolean(description),
        showNoImageState: hasImageWindow && imageState === 'error',
    };
}

function capitalizeVisualColor(name) {
    const value = String(name || DEFAULT_VISUAL_COLOR);
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildTrajectoryOverlayModel(context = {}, imageState = 'ready') {
    const point = context.point || null;
    const appearance = context.appearance || {
        name: DEFAULT_VISUAL_COLOR,
        rgb: { ...getNamedVisualColorRgb(DEFAULT_VISUAL_COLOR) },
    };
    const sanitizedName = context.sanitizedName || '';
    const stopImageSrc = resolveAnnotationImageSrc(point?.image, sanitizedName);
    const showStoppedImage = context.state === 'stopped-at-point' && Boolean(stopImageSrc);
    const description = normalizeAnnotationDescription(point?.description);
    const colorName = appearance.name || DEFAULT_VISUAL_COLOR;

    return {
        mode: showStoppedImage ? 'image' : 'preview',
        kicker: showStoppedImage ? 'Point Image' : `${capitalizeVisualColor(colorName)} Preview`,
        dateText: point?.date ? parseDate(point.date).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            timeZone: 'UTC',
        }) : '--',
        description,
        imageSrc: showStoppedImage ? stopImageSrc : null,
        showImage: showStoppedImage && imageState !== 'error',
        showNoImageState: showStoppedImage && imageState === 'error',
        showPreview: !showStoppedImage || imageState === 'error',
        showDescription: Boolean(description),
        previewAppearance: appearance,
    };
}

module.exports = {
    TrajectoryLoadError,
    decodeDesignation,
    readDesignationFromUrl,
    normalizeRequestedSource,
    readSourceFromUrl,
    resolveRequestedSource,
    sanitize,
    buildPath,
    buildObjectMotionHref,
    buildTrajectoryPlayerHref,
    normalizePoint,
    normalizeVisualColor,
    resolveDefaultSpeedMultiplier,
    getObjectVisualConfig,
    getObjectSpinRotation,
    getObjectTailReveal,
    getNamedVisualColorRgb,
    getColorNameForPoint,
    getAppearanceAtPoint,
    interpolateAppearanceForSegment,
    lerp,
    catmullRom,
    getSegmentDurationMs,
    buildTrailThroughIndex,
    interpolateWorldPosition,
    interpolateDate,
    interpolateSunDistance,
    getCameraTargetForSegment,
    lerpCameraState,
    shouldPauseAtPoint,
    getCanvasClickAction,
    getPlayAction,
    areSecondaryControlsDisabled,
    getControlBarState,
    getFloatingStatsLayout,
    shouldIgnorePlaybackShortcut,
    convertKmToAuPosition,
    convertAuToWorldPosition,
    getFixedReferencePoint,
    getWorldPositionAtDate,
    getFixedConnectorConfiguration,
    shouldShowReferenceConnector,
    getAnomaliesDateForPoint,
    shouldHandleAnomalyPlayShortcut,
    normalizeAnnotationDescription,
    isAbsoluteImageUrl,
    resolveAnnotationImageSrc,
    hasAnnotationContent,
    shouldShowAnnotationOverlay,
    buildAnnotationOverlayModel,
    buildTrajectoryOverlayModel,
};
