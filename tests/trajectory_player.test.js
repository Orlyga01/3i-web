/**
 * Unit tests for trajectory_player.js pure loader logic.
 */

'use strict';

const {
    TrajectoryLoadError,
    decodeDesignation,
    readDesignationFromUrl,
    normalizeRequestedSource,
    readSourceFromUrl,
    readAutoplayFromUrl,
    resolveRequestedSource,
    sanitize,
    buildPath,
    buildObjectMotionHref,
    buildTrajectoryPlayerHref,
    normalizePoint,
    normalizeVisualColor,
    resolveDefaultSpeedMultiplier,
    getObjectVisualConfig,
    getObjectRenderScale,
    getObjectSpinRotation,
    getObjectTailReveal,
    getNamedVisualColorRgb,
    getColorNameForPoint,
    getAppearanceAtPoint,
    interpolateAppearanceForSegment,
    catmullRom,
    getSegmentDurationMs,
    getTimelineProgress,
    buildTrailThroughIndex,
    interpolateWorldPosition,
    interpolateDate,
    interpolateSunDistance,
    getCameraTargetForSegment,
    lerpCameraState,
    formatCompactStatsDate,
    is3iTailWindow,
    shouldPauseAtPoint,
    getCanvasClickAction,
    getPlayAction,
    areSecondaryControlsDisabled,
    getControlBarState,
    shouldEnableTrajectoryOverlay,
    shouldShow3iJupiterDistanceSphere,
    get3iJupiterDistanceSphereRadiusWorld,
    getFloatingStatsLayout,
    shouldIgnorePlaybackShortcut,
    getFixedReferencePoint,
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

    test('returns empty string when designation is missing', () => {
        expect(readDesignationFromUrl('?foo=bar')).toBe('');
    });
});

describe('source query helpers', () => {
    test('normalizes supported source names', () => {
        expect(normalizeRequestedSource(' Local ')).toBe('local');
        expect(normalizeRequestedSource('WEB')).toBe('web');
        expect(normalizeRequestedSource('draft')).toBe('');
    });

    test('reads source query parameter and alias', () => {
        expect(readSourceFromUrl('?source=local')).toBe('local');
        expect(readSourceFromUrl('?s=web')).toBe('web');
        expect(readSourceFromUrl('?designation=3I')).toBe('');
    });

    test('reads autoplay query parameter and alias', () => {
        expect(readAutoplayFromUrl('?autoplay=1')).toBe(true);
        expect(readAutoplayFromUrl('?auto=true')).toBe(true);
        expect(readAutoplayFromUrl('?autoplay=false')).toBe(false);
        expect(readAutoplayFromUrl('?autoplay=0')).toBe(false);
        expect(readAutoplayFromUrl('?designation=3I')).toBe(false);
    });

    test('falls back to web when local storage is globally disabled', () => {
        expect(resolveRequestedSource('local', true)).toBe('local');
        expect(resolveRequestedSource('local', false)).toBe('web');
        expect(resolveRequestedSource('web', false)).toBe('web');
    });

    test('keeps legacy playback speed when default speed is null and accepts supported values', () => {
        expect(resolveDefaultSpeedMultiplier(null)).toBe(1);
        expect(resolveDefaultSpeedMultiplier(undefined)).toBe(1);
        expect(resolveDefaultSpeedMultiplier(3)).toBe(3);
        expect(resolveDefaultSpeedMultiplier('3')).toBe(3);
        expect(resolveDefaultSpeedMultiplier(2.25)).toBe(1);
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
        expect(buildObjectMotionHref('3I')).toBe('object_motion?designation=3I&lang=en');
    });

    test('builds object motion back link with source', () => {
        expect(buildObjectMotionHref('3I', 'local')).toBe('object_motion?designation=3I&source=local&lang=en');
    });

    test('builds trajectory player link with designation', () => {
        expect(buildTrajectoryPlayerHref('3I')).toBe('trajectory_player?designation=3I&lang=en');
    });

    test('builds trajectory player link with source', () => {
        expect(buildTrajectoryPlayerHref('3I', 'web')).toBe('trajectory_player?designation=3I&source=web&lang=en');
    });

    test('builds localized links when a non-default language is requested', () => {
        expect(buildObjectMotionHref('3I', 'web', 'he')).toBe('object_motion?designation=3I&source=web&lang=he');
        expect(buildTrajectoryPlayerHref('3I', 'local', 'he')).toBe('trajectory_player?designation=3I&source=local&lang=he');
    });
});

describe('normalizePoint', () => {
    test('normalizes saved trajectory point fields', () => {
        const point = normalizePoint({
            px: { wx: 48, wy: -787, wz: 51 },
            au: { x: 0.2743, y: -4.4971, z: 0.2914 },
            durationPct: 150,
            stoppable: true,
            color: 'Blue',
            camera: { el: 4.6, az: 0.08, zoom: 25, tx: 60, ty: 0, tz: 0 },
            description: 'Discovery',
            image: null,
        }, 3, '3I');

        expect(point.index).toBe(3);
        expect(point.durationPct).toBe(150);
        expect(point.stoppable).toBe(true);
        expect(point.color).toBe('blue');
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
        expect(point.color).toBeNull();
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
            color: 'green',
            camera: { el: 10, az: 1, zoom: 20, tx: 5, ty: 6, tz: 7 },
        }, 0, '3I'),
        normalizePoint({
            date: '2025-01-11',
            px: { wx: 10, wy: 20, wz: 30 },
            au: { x: 0, y: 2, z: 0 },
            durationPct: 150,
            color: 'blue',
            camera: null,
        }, 1, '3I'),
        normalizePoint({
            date: '2025-01-21',
            px: { wx: 20, wy: 40, wz: 60 },
            au: { x: 0, y: 0, z: 3 },
            durationPct: 200,
            color: 'red',
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

    test('normalizes named visual colors and resolves RGB values', () => {
        expect(normalizeVisualColor(' Blue ')).toBe('blue');
        expect(normalizeVisualColor('yellow')).toBe('yellow');
        expect(normalizeVisualColor('white')).toBe('white');
        expect(normalizeVisualColor('purple')).toBeNull();
        expect(getNamedVisualColorRgb('red')).toEqual({ r: 255, g: 104, b: 104 });
        expect(getNamedVisualColorRgb('yellow')).toEqual({ r: 255, g: 214, b: 92 });
        expect(getNamedVisualColorRgb('white')).toEqual({ r: 242, g: 246, b: 252 });
    });

    test('uses Borisov comet visuals without changing other objects', () => {
        expect(getObjectVisualConfig('3I')).toEqual({
            spriteSrc: 'assets/3igreen_1.png',
            imageBaseTailAngleRad: 55 * (Math.PI / 180),
            anchorY: 0.5,
            alignToSun: true,
            tailDirectionSign: -1,
            axialSpinMultiplier: 0,
            preserveSpriteColor: false,
            showCoreGlow: false,
            showNucleusGlow: false,
            showColorRing: false,
            tailRevealMode: 'full',
        });
        expect(getObjectVisualConfig('2I/Borisov')).toEqual({
            spriteSrc: 'assets/comet.png',
            imageBaseTailAngleRad: -Math.PI / 2,
            anchorY: 0.9,
            alignToSun: true,
            tailDirectionSign: 1,
            axialSpinMultiplier: 0,
            preserveSpriteColor: false,
            showColorRing: true,
            tailRevealMode: 'sunDistance',
            tailRevealNearAu: 180 / 175,
            tailRevealFarAu: 820 / 175,
        });
        expect(getObjectVisualConfig('Oumuamua')).toEqual({
            spriteSrc: 'assets/Oumuamua.png',
            imageBaseTailAngleRad: 0,
            anchorY: 0.5,
            alignToSun: false,
            axialSpinMultiplier: 0.2,
            preserveSpriteColor: true,
            showColorRing: false,
            tailRevealMode: 'full',
        });
        expect(is3iTailWindow('3I', '2025-11-12')).toBe(false);
        expect(is3iTailWindow('3I', '2025-11-13')).toBe(true);
        expect(is3iTailWindow('3I', '2026-02-28')).toBe(true);
        expect(is3iTailWindow('3I', '2026-03-01')).toBe(false);
        expect(getObjectVisualConfig('3I', '2025-11-13')).toEqual({
            spriteSrc: 'assets/3i_tail.png',
            imageBaseTailAngleRad: 55 * (Math.PI / 180),
            anchorX: 240 / 533,
            anchorY: 240 / 800,
            alignToSun: true,
            tailDirectionSign: -1,
            axialSpinMultiplier: 0,
            preserveSpriteColor: false,
            showCoreGlow: false,
            showNucleusGlow: false,
            showColorRing: false,
            tailRevealMode: 'tail-start',
        });
        expect(getObjectRenderScale('3I', '2025-11-13')).toBeCloseTo(1, 6);
        expect(getObjectRenderScale('3I', '2026-02-28')).toBeCloseTo(1.85, 6);
        expect(getObjectRenderScale('3I', '2026-01-15')).toBeGreaterThan(1);
        expect(getObjectRenderScale('2I/Borisov', '2026-01-15')).toBe(1);
        expect(getObjectSpinRotation('3I', 2.5)).toBe(0);
        expect(getObjectSpinRotation('2I/Borisov', 2.5)).toBe(0);
        expect(getObjectSpinRotation('Oumuamua', 2.5)).toBe(0.5);
        expect(getObjectTailReveal('3I', 2.5)).toBe(1);
        expect(getObjectTailReveal('3I', 0, '2025-11-13')).toBe(0);
        expect(getObjectTailReveal('3I', 0, '2026-02-28')).toBe(1);
        expect(getObjectTailReveal('3I', 0, '2026-01-15')).toBeGreaterThan(0);
        expect(getObjectTailReveal('3I', 0, '2026-01-15')).toBeLessThan(1);
        expect(getObjectTailReveal('2I/Borisov', 6)).toBe(0);
        expect(getObjectTailReveal('2I/Borisov', 0.5)).toBe(1);
        expect(getObjectTailReveal('2I/Borisov', 2.85)).toBeGreaterThan(0);
        expect(getObjectTailReveal('2I/Borisov', 2.85)).toBeLessThan(1);
    });

    test('segment duration uses current point durationPct with 1 second base', () => {
        expect(getSegmentDurationMs(points, 0, 1)).toBe(1000);
        expect(getSegmentDurationMs(points, 1, 2)).toBe(750);
        expect(getSegmentDurationMs(points, 0, 0.25)).toBe(4000);
    });

    test('timeline progress is weighted by segment duration', () => {
        expect(getTimelineProgress(points, 0, 0.5, 1)).toBeCloseTo(500 / 4500, 6);
        expect(getTimelineProgress(points, 1, 0, 1)).toBeCloseTo(1000 / 4500, 6);
        expect(getTimelineProgress(points, 1, 0.5, 1)).toBeCloseTo(1750 / 4500, 6);
        expect(getTimelineProgress(points, 2, 1, 1)).toBe(1);
        expect(getTimelineProgress(points, 3, 0, 1)).toBe(1);
    });

    test('rebuilds trail points through a selected point index', () => {
        const trail = buildTrailThroughIndex(points, 2, 4);
        expect(trail[0]).toEqual(points[0].px);
        expect(trail).toHaveLength(9);
        expect(trail[trail.length - 1].wx).toBeCloseTo(points[2].px.wx, 5);
        expect(trail[trail.length - 1].wy).toBeCloseTo(points[2].px.wy, 5);
        expect(trail[trail.length - 1].wz).toBeCloseTo(points[2].px.wz, 5);
    });

    test('interpolates world position along spline', () => {
        const pos = interpolateWorldPosition(points, 1, 0.5);
        expect(pos.wx).toBeCloseTo(15, 5);
        expect(pos.wy).toBeCloseTo(30, 5);
        expect(pos.wz).toBeCloseTo(45, 5);
    });

    test('clamps spline overshoot within the current segment endpoints', () => {
        const overshootPoints = [
            normalizePoint({ date: '2025-01-01', px: { wx: 0, wy: 0, wz: 0 }, au: { x: 0, y: 0, z: 0 } }, 0, '3I'),
            normalizePoint({ date: '2025-01-02', px: { wx: 1, wy: 10, wz: 0 }, au: { x: 0, y: 0, z: 0 } }, 1, '3I'),
            normalizePoint({ date: '2025-01-03', px: { wx: 2, wy: 0, wz: 0 }, au: { x: 0, y: 0, z: 0 } }, 2, '3I'),
            normalizePoint({ date: '2025-01-04', px: { wx: 3, wy: 0, wz: 0 }, au: { x: 0, y: 0, z: 0 } }, 3, '3I'),
        ];
        const pos = interpolateWorldPosition(overshootPoints, 1, 0.5);
        expect(pos.wx).toBeGreaterThanOrEqual(1);
        expect(pos.wx).toBeLessThanOrEqual(2);
        expect(pos.wy).toBeGreaterThanOrEqual(0);
        expect(pos.wy).toBeLessThanOrEqual(10);
        expect(pos.wz).toBe(0);
    });

    test('resolves point colors and interpolates appearance across segments', () => {
        expect(getColorNameForPoint(points, 0)).toBe('green');
        expect(getAppearanceAtPoint(points, 2)).toEqual({
            name: 'red',
            rgb: { r: 255, g: 104, b: 104 },
        });

        expect(interpolateAppearanceForSegment(points, 0, 0.5)).toEqual({
            name: 'blue',
            fromName: 'green',
            toName: 'blue',
            rgb: { r: 92, g: 202, b: 192 },
        });
    });

    test('keeps the current color when the next point has no explicit color', () => {
        const pointsWithGap = [
            normalizePoint({
                date: '2025-01-01',
                px: { wx: 0, wy: 0, wz: 0 },
                au: { x: 1, y: 0, z: 0 },
                color: 'green',
            }, 0, '3I'),
            normalizePoint({
                date: '2025-01-11',
                px: { wx: 10, wy: 20, wz: 30 },
                au: { x: 0, y: 2, z: 0 },
            }, 1, '3I'),
            normalizePoint({
                date: '2025-01-21',
                px: { wx: 20, wy: 40, wz: 60 },
                au: { x: 0, y: 0, z: 3 },
                color: 'blue',
            }, 2, '3I'),
        ];

        expect(getColorNameForPoint(pointsWithGap, 1)).toBe('green');
        expect(interpolateAppearanceForSegment(pointsWithGap, 0, 0.5)).toEqual({
            name: 'green',
            fromName: 'green',
            toName: 'green',
            rgb: { r: 88, g: 228, b: 128 },
        });
        expect(interpolateAppearanceForSegment(pointsWithGap, 1, 0.5)).toEqual({
            name: 'blue',
            fromName: 'green',
            toName: 'blue',
            rgb: { r: 92, g: 202, b: 192 },
        });
    });

    test('interpolates date midway between two points', () => {
        const date = interpolateDate(points, 0, 0.5);
        expect(date.toISOString()).toBe('2025-01-06T00:00:00.000Z');
    });

    test('interpolates sun distance from AU coordinates', () => {
        const distance = interpolateSunDistance(points, 0, 0.5);
        expect(distance).toBeCloseTo(Math.sqrt(1.25), 5);
    });

    test('camera target falls back to the last saved camera at or before the destination point', () => {
        expect(getCameraTargetForSegment(points, 0)).toEqual(points[0].camera);
        expect(getCameraTargetForSegment(points, 1)).toEqual(points[2].camera);
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

    test('pause logic supports stoppable-only and any-point modes', () => {
        expect(shouldPauseAtPoint(points[2], true, false)).toBe(false);
        expect(shouldPauseAtPoint({ stoppable: true }, false, false)).toBe(false);
        expect(shouldPauseAtPoint({ stoppable: true }, true, false)).toBe(true);
        expect(shouldPauseAtPoint({ stoppable: false }, false, true)).toBe(true);
    });

    test('canvas clicks can stop playback but never resume it', () => {
        expect(getCanvasClickAction('playing')).toBe('stop');
        expect(getCanvasClickAction('paused')).toBe('noop');
        expect(getCanvasClickAction('stopped-at-point')).toBe('noop');
        expect(getCanvasClickAction('stopped-manual')).toBe('noop');
    });

    test('stopped playback only restarts from the play button', () => {
        expect(getPlayAction('stopped', 'toggle')).toBe('noop');
        expect(getPlayAction('stopped', 'button')).toBe('restart');
        expect(getPlayAction('playing', 'button')).toBe('pause');
        expect(getPlayAction('paused', 'toggle')).toBe('play');
        expect(getPlayAction('stopped-at-point', 'button')).toBe('noop');
        expect(getPlayAction('stopped-manual', 'button')).toBe('noop');
    });

    test('secondary controls are disabled only while playing', () => {
        expect(areSecondaryControlsDisabled('playing')).toBe(true);
        expect(areSecondaryControlsDisabled('paused')).toBe(false);
        expect(areSecondaryControlsDisabled('stopped')).toBe(false);
        expect(areSecondaryControlsDisabled('stopped-at-point')).toBe(false);
        expect(areSecondaryControlsDisabled('stopped-manual')).toBe(false);
    });

    test('control bar disables prev at start and next at end', () => {
        expect(getControlBarState('playing', 0, 4)).toEqual({
            label: 'Playing',
            playText: '⏸',
            playDisabled: false,
            secondaryDisabled: true,
            prevDisabled: true,
            nextDisabled: true,
        });

        expect(getControlBarState('paused', 3, 4)).toEqual({
            label: 'Paused',
            playText: '▶',
            playDisabled: false,
            secondaryDisabled: false,
            prevDisabled: false,
            nextDisabled: true,
        });
    });

    test('control bar disables play toggle at stoppable pause', () => {
        expect(getControlBarState('stopped-at-point', 2, 4).playDisabled).toBe(true);
    });

    test('control bar disables play toggle after a manual screen stop', () => {
        expect(getControlBarState('stopped-manual', 2, 4)).toEqual({
            label: 'Paused',
            playText: '▶',
            playDisabled: true,
            secondaryDisabled: false,
            prevDisabled: false,
            nextDisabled: false,
        });
    });

    test('floating stats layout follows projected object and clamps inside viewport', () => {
        expect(getFloatingStatsLayout(
            { sx: 100, sy: 100, depth: 20 },
            { width: 190, height: 56 },
            { width: 800, height: 600 }
        )).toEqual({
            left: 118,
            top: 30,
            visible: true,
        });

        expect(getFloatingStatsLayout(
            { sx: 790, sy: 8, depth: 20 },
            { width: 190, height: 56 },
            { width: 800, height: 600 }
        )).toEqual({
            left: 594,
            top: 26,
            visible: true,
        });

        expect(getFloatingStatsLayout(
            { sx: 0, sy: 0, depth: 5 },
            { width: 190, height: 56 },
            { width: 800, height: 600 }
        )).toEqual({
            left: 16,
            top: 16,
            visible: false,
        });

        expect(getFloatingStatsLayout(
            { sx: 100, sy: 100, depth: 20 },
            { width: 190, height: 56 },
            { width: 800, height: 600 },
            '3I'
        )).toEqual({
            left: 108,
            top: 38,
            visible: true,
        });
    });

    test('enables the top-right overlay only for 3I', () => {
        expect(shouldEnableTrajectoryOverlay('3I')).toBe(true);
        expect(shouldEnableTrajectoryOverlay('2I/Borisov')).toBe(false);
        expect(shouldEnableTrajectoryOverlay('Oumuamua')).toBe(false);
    });

    test('shows the Jupiter distance sphere only at the last 3I point', () => {
        expect(shouldShow3iJupiterDistanceSphere('3I', points, points.length - 1)).toBe(true);
        expect(shouldShow3iJupiterDistanceSphere('3I', points, points.length - 2)).toBe(false);
        expect(shouldShow3iJupiterDistanceSphere('2I/Borisov', points, points.length - 1)).toBe(false);
        expect(get3iJupiterDistanceSphereRadiusWorld()).toBeCloseTo(0.355 * 175, 6);
    });

    test('formats floating stats dates with month names', () => {
        expect(formatCompactStatsDate('2025-03-10')).toBe('Mar 10, 2025');
    });

    test('ignores playback shortcuts for text-entry targets only', () => {
        expect(shouldIgnorePlaybackShortcut({ tagName: 'INPUT', type: 'text' })).toBe(true);
        expect(shouldIgnorePlaybackShortcut({ tagName: 'TEXTAREA' })).toBe(true);
        expect(shouldIgnorePlaybackShortcut({ tagName: 'INPUT', type: 'range' })).toBe(false);
        expect(shouldIgnorePlaybackShortcut({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
        expect(shouldIgnorePlaybackShortcut({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    });

    test('fixed reference point converts supplied Horizons coordinates into player space', () => {
        const referencePoint = getFixedReferencePoint();

        expect(referencePoint.visibleFrom).toBe('2025-10-31');
        expect(referencePoint.au.x).toBeCloseTo(-2.2184121998, 6);
        expect(referencePoint.au.y).toBeCloseTo(4.7456004460, 6);
        expect(referencePoint.au.z).toBeCloseTo(0.0299204754, 6);
        expect(referencePoint.world.wx).toBeCloseTo(-388.2221350, 5);
        expect(referencePoint.world.wy).toBeCloseTo(830.4800781, 5);
        expect(referencePoint.world.wz).toBeCloseTo(5.2360832, 5);
    });

    test('fixed connector uses the saved 2025-10-29 atlas position as its anchor', () => {
        const config = getFixedConnectorConfiguration([
            normalizePoint({
                date: '2025-10-14',
                px: { wx: -201, wy: -160, wz: 21 },
                au: { x: -1.1486, y: -0.9143, z: 0.12 },
            }, 0, '3I'),
            normalizePoint({
                date: '2025-10-29',
                px: { wx: -214, wy: -114, wz: 19 },
                au: { x: -1.2231, y: -0.6495, z: 0.1069 },
            }, 1, '3I'),
            normalizePoint({
                date: '2025-10-31',
                px: { wx: -232, wy: -47, wz: 15 },
                au: { x: -1.3275, y: -0.2705, z: 0.0879 },
            }, 2, '3I'),
        ]);

        expect(config.visibleFrom).toBe('2025-10-31');
        expect(config.objectAnchorDate).toBe('2025-10-29');
        expect(config.objectAnchorWorld).toEqual({ wx: -214, wy: -114, wz: 19 });
    });

    test('reference connector becomes visible on and after 2025-10-31', () => {
        expect(shouldShowReferenceConnector('2025-10-30')).toBe(false);
        expect(shouldShowReferenceConnector('2025-10-31')).toBe(true);
        expect(shouldShowReferenceConnector('2026-03-16')).toBe(true);
        expect(shouldShowReferenceConnector('not-a-date')).toBe(false);
    });

    test('hands off only explicit ISO dates to the anomalies panel', () => {
        expect(getAnomaliesDateForPoint({ date: '2025-10-31' })).toBe('2025-10-31');
        expect(getAnomaliesDateForPoint({ date: ' Oct 31, 2025 ' })).toBe('');
        expect(getAnomaliesDateForPoint({ date: null })).toBe('');
    });

    test('routes spacebar to anomaly playback only when queue steps remain', () => {
        expect(shouldHandleAnomalyPlayShortcut('paused', true)).toBe(true);
        expect(shouldHandleAnomalyPlayShortcut('stopped-at-point', true)).toBe(true);
        expect(shouldHandleAnomalyPlayShortcut('playing', true)).toBe(false);
        expect(shouldHandleAnomalyPlayShortcut('paused', false)).toBe(false);
    });

    test('normalizes annotation description whitespace', () => {
        expect(normalizeAnnotationDescription('  Discovery image  ')).toBe('Discovery image');
        expect(normalizeAnnotationDescription(null)).toBe('');
    });

    test('detects absolute image URLs only for http and https', () => {
        expect(isAbsoluteImageUrl('https://example.com/atlas.png')).toBe(true);
        expect(isAbsoluteImageUrl('http://example.com/atlas.png')).toBe(true);
        expect(isAbsoluteImageUrl('images/atlas.png')).toBe(false);
    });

    test('resolves local and remote annotation image sources', () => {
        expect(resolveAnnotationImageSrc('https://example.com/atlas.png', '3I')).toBe('https://example.com/atlas.png');
        expect(resolveAnnotationImageSrc('/assets/3igreen.jpg', '3I')).toBe('http://localhost/assets/3igreen.jpg');
        expect(resolveAnnotationImageSrc('story/atlas.png', 'C/2025 N1')).toBe('data/C_2025_N1/story/atlas.png');
        expect(resolveAnnotationImageSrc('.\\story\\atlas.png', '3I')).toBe('data/3I/story/atlas.png');
        expect(resolveAnnotationImageSrc(null, '3I')).toBeNull();
    });

    test('detects whether a point has any annotation content', () => {
        expect(hasAnnotationContent({ description: '  Discovery  ', image: null })).toBe(true);
        expect(hasAnnotationContent({ description: '', image: 'atlas.png' })).toBe(true);
        expect(hasAnnotationContent({ description: '   ', image: null })).toBe(false);
    });

    test('shows annotation overlay only while stopped at an annotated point', () => {
        expect(shouldShowAnnotationOverlay('stopped-at-point', { description: 'Discovery', image: null })).toBe(true);
        expect(shouldShowAnnotationOverlay('paused', { description: 'Discovery', image: null })).toBe(false);
        expect(shouldShowAnnotationOverlay('stopped-at-point', { description: null, image: null })).toBe(false);
    });

    test('builds large image-window model for local image annotations', () => {
        expect(buildAnnotationOverlayModel({
            date: '2025-10-31',
            description: '  Atlas close approach  ',
            image: 'images/atlas.png',
        }, '3I')).toEqual({
            dateText: 'Oct 31, 2025',
            description: 'Atlas close approach',
            imageSrc: 'data/3I/images/atlas.png',
            hasContent: true,
            hasImageWindow: true,
            showImage: true,
            showDescription: true,
            showNoImageState: false,
        });
    });

    test('builds graceful no-image fallback model after image load failure', () => {
        expect(buildAnnotationOverlayModel({
            date: '2025-10-31',
            description: 'Remote panel',
            image: 'https://example.com/atlas.png',
        }, '3I', 'error')).toEqual({
            dateText: 'Oct 31, 2025',
            description: 'Remote panel',
            imageSrc: 'https://example.com/atlas.png',
            hasContent: true,
            hasImageWindow: true,
            showImage: false,
            showDescription: true,
            showNoImageState: true,
        });
    });

    test('keeps compact overlay behavior for description-only points', () => {
        expect(buildAnnotationOverlayModel({
            date: '2025-10-31',
            description: 'No image yet',
            image: null,
        }, '3I')).toEqual({
            dateText: 'Oct 31, 2025',
            description: 'No image yet',
            imageSrc: null,
            hasContent: true,
            hasImageWindow: false,
            showImage: false,
            showDescription: true,
            showNoImageState: false,
        });
    });

    test('keeps the single overlay in preview mode while playing', () => {
        expect(buildTrajectoryOverlayModel({
            state: 'playing',
            point: { date: '2025-11-13', description: null, image: 'assets/jets.jpg' },
            sanitizedName: '3I',
            appearance: { name: 'blue', rgb: { r: 96, g: 176, b: 255 } },
        })).toEqual({
            mode: 'preview',
            kicker: 'Blue Preview',
            dateText: 'Nov 13, 2025',
            description: '',
            imageSrc: null,
            showImage: false,
            showNoImageState: false,
            showPreview: true,
            showDescription: false,
            showMoreInfo: false,
            previewAppearance: { name: 'blue', rgb: { r: 96, g: 176, b: 255 } },
        });
    });

    test('switches the same overlay to point-image mode at stoppable stops', () => {
        expect(buildTrajectoryOverlayModel({
            state: 'stopped-at-point',
            point: { date: '2026-01-21', description: 'Jets visible', image: '/assets/jets.jpg', stoppable: true },
            sanitizedName: '3I',
            appearance: { name: 'red', rgb: { r: 255, g: 104, b: 104 } },
        })).toEqual({
            mode: 'image',
            kicker: 'Point Image',
            dateText: 'Jan 21, 2026',
            description: 'Jets visible',
            imageSrc: 'http://localhost/assets/jets.jpg',
            showImage: true,
            showNoImageState: false,
            showPreview: false,
            showDescription: true,
            showMoreInfo: false,
            previewAppearance: { name: 'red', rgb: { r: 255, g: 104, b: 104 } },
        });
    });
});
