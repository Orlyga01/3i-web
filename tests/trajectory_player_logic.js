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
    const designation = decodeDesignation(rawValue);
    return designation || '3I';
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
        description: point.description ?? null,
        image: point.image ?? null,
    };
}

function buildObjectMotionHref(designation) {
    return `object_motion?designation=${encodeURIComponent(designation || '3I')}`;
}

function buildTrajectoryPlayerHref(designation) {
    return `trajectory_player?designation=${encodeURIComponent(designation || '3I')}`;
}

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

function clampSegmentIndex(points, index) {
    return Math.max(0, Math.min(points.length - 1, index));
}

function getSegmentDurationMs(points, segmentIndex, speedMultiplier = 1) {
    const destinationPoint = points[segmentIndex + 1];
    if (!destinationPoint) return Number.POSITIVE_INFINITY;
    return (destinationPoint.durationPct / 100) * 1000 * (1 / speedMultiplier);
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
    const targetIndex = findNearestCameraIndex(points, destinationIndex, 1);
    if (targetIndex !== -1) return points[targetIndex].camera;

    const fallbackIndex = findNearestCameraIndex(points, segmentIndex, -1);
    return fallbackIndex !== -1 ? points[fallbackIndex].camera : null;
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

module.exports = {
    TrajectoryLoadError,
    decodeDesignation,
    readDesignationFromUrl,
    sanitize,
    buildPath,
    buildObjectMotionHref,
    buildTrajectoryPlayerHref,
    normalizePoint,
    lerp,
    catmullRom,
    getSegmentDurationMs,
    interpolateWorldPosition,
    interpolateDate,
    interpolateSunDistance,
    getCameraTargetForSegment,
    lerpCameraState,
};
