/**
 * Unit tests for trajectory_player.js pure loader logic.
 */

'use strict';

const {
    TrajectoryLoadError,
    decodeDesignation,
    readDesignationFromUrl,
    sanitize,
    buildPath,
    buildObjectMotionHref,
    buildTrajectoryPlayerHref,
    normalizePoint,
    catmullRom,
    getSegmentDurationMs,
    interpolateWorldPosition,
    interpolateDate,
    interpolateSunDistance,
    getCameraTargetForSegment,
    lerpCameraState,
} = require('./trajectory_player_logic');

describe('decodeDesignation', () => {
    test('decodes URL-encoded designation', () => {
        expect(decodeDesignation('C%2F2025%20N1')).toBe('C/2025 N1');
    });

    test('returns trimmed plain designation unchanged', () => {
        expect(decodeDesignation('  3I  ')).toBe('3I');
    });
});

describe('readDesignationFromUrl', () => {
    test('reads full designation query parameter', () => {
        expect(readDesignationFromUrl('?designation=3I')).toBe('3I');
    });

    test('reads short alias query parameter', () => {
        expect(readDesignationFromUrl('?d=3I')).toBe('3I');
    });

    test('decodes encoded designation values', () => {
        expect(readDesignationFromUrl('?designation=C%2F2025%20N1')).toBe('C/2025 N1');
    });

    test('defaults to 3I when designation is missing', () => {
        expect(readDesignationFromUrl('?foo=bar')).toBe('3I');
    });
});

describe('sanitize and buildPath', () => {
    test('replaces spaces and slashes with underscores', () => {
        expect(sanitize('C/2025 N1')).toBe('C_2025_N1');
    });

    test('builds the expected trajectory path', () => {
        expect(buildPath('C/2025 N1')).toEqual({
            sanitizedName: 'C_2025_N1',
            path: 'data/C_2025_N1/trajectory.json',
        });
    });

    test('builds object motion back link with designation', () => {
        expect(buildObjectMotionHref('3I')).toBe('object_motion?designation=3I');
    });

    test('builds trajectory player link with designation', () => {
        expect(buildTrajectoryPlayerHref('3I')).toBe('trajectory_player?designation=3I');
    });
});

describe('normalizePoint', () => {
    test('normalizes saved trajectory point fields', () => {
        const point = normalizePoint({
            px: { wx: 48, wy: -787, wz: 51 },
            au: { x: 0.2743, y: -4.4971, z: 0.2914 },
            durationPct: 150,
            stoppable: true,
            camera: { el: 4.6, az: 0.08, zoom: 25, tx: 60, ty: 0, tz: 0 },
            description: 'Discovery',
            image: null,
        }, 3, '3I');

        expect(point.index).toBe(3);
        expect(point.durationPct).toBe(150);
        expect(point.stoppable).toBe(true);
        expect(point.camera).toEqual({
            el: 4.6,
            az: 0.08,
            zoom: 25,
            tx: 60,
            ty: 0,
            tz: 0,
        });
    });

    test('defaults duration and annotation fields when absent', () => {
        const point = normalizePoint({
            px: { wx: 1, wy: 2, wz: 3 },
            au: { x: 0, y: 0, z: 0 },
        }, 0, '3I');

        expect(point.durationPct).toBe(100);
        expect(point.stoppable).toBe(false);
        expect(point.description).toBeNull();
        expect(point.image).toBeNull();
        expect(point.camera).toBeNull();
    });

    test('throws invalid-json error when point has no px coordinates', () => {
        expect(() => normalizePoint({ au: { x: 1, y: 2, z: 3 } }, 0, '3I'))
            .toThrow(/could not be read/i);
    });
});

describe('animation helpers', () => {
    const points = [
        normalizePoint({
            date: '2025-01-01',
            px: { wx: 0, wy: 0, wz: 0 },
            au: { x: 1, y: 0, z: 0 },
            durationPct: 100,
            camera: { el: 10, az: 1, zoom: 20, tx: 5, ty: 6, tz: 7 },
        }, 0, '3I'),
        normalizePoint({
            date: '2025-01-11',
            px: { wx: 10, wy: 20, wz: 30 },
            au: { x: 0, y: 2, z: 0 },
            durationPct: 150,
            camera: null,
        }, 1, '3I'),
        normalizePoint({
            date: '2025-01-21',
            px: { wx: 20, wy: 40, wz: 60 },
            au: { x: 0, y: 0, z: 3 },
            durationPct: 200,
            camera: { el: 40, az: 2, zoom: 50, tx: 50, ty: 60, tz: 70 },
        }, 2, '3I'),
        normalizePoint({
            date: '2025-01-31',
            px: { wx: 30, wy: 60, wz: 90 },
            au: { x: 4, y: 0, z: 0 },
            durationPct: 100,
            camera: { el: 60, az: 3, zoom: 80, tx: 80, ty: 90, tz: 100 },
        }, 3, '3I'),
    ];

    test('catmullRom matches known midpoint for linear data', () => {
        expect(catmullRom(0, 10, 20, 30, 0.5)).toBeCloseTo(15, 5);
    });

    test('segment duration uses destination point durationPct', () => {
        expect(getSegmentDurationMs(points, 0, 1)).toBe(1500);
        expect(getSegmentDurationMs(points, 1, 2)).toBe(1000);
    });

    test('interpolates world position along spline', () => {
        const pos = interpolateWorldPosition(points, 1, 0.5);
        expect(pos.wx).toBeCloseTo(15, 5);
        expect(pos.wy).toBeCloseTo(30, 5);
        expect(pos.wz).toBeCloseTo(45, 5);
    });

    test('interpolates date midway between two points', () => {
        const date = interpolateDate(points, 0, 0.5);
        expect(date.toISOString()).toBe('2025-01-06T00:00:00.000Z');
    });

    test('interpolates sun distance from AU coordinates', () => {
        const distance = interpolateSunDistance(points, 0, 0.5);
        expect(distance).toBeCloseTo(Math.sqrt(1.25), 5);
    });

    test('camera target skips null destination and uses nearest non-null to the right', () => {
        expect(getCameraTargetForSegment(points, 0)).toEqual(points[2].camera);
    });

    test('camera lerp includes pan tx/ty/tz values', () => {
        const current = { el: 10, az: 1, zoom: 20, tx: 5, ty: 6, tz: 7 };
        const target = { el: 40, az: 2, zoom: 50, tx: 50, ty: 60, tz: 70 };
        const next = lerpCameraState(current, target, 0.022);

        expect(next.el).toBeCloseTo(10.66, 5);
        expect(next.az).toBeCloseTo(1.0165, 5);
        expect(next.zoom).toBeCloseTo(20.429, 5);
        expect(next.tx).toBeCloseTo(5.99, 5);
        expect(next.ty).toBeCloseTo(7.188, 5);
        expect(next.tz).toBeCloseTo(8.386, 5);
    });
});
