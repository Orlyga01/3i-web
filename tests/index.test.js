'use strict';

const {
    sanitizeDesignation,
    normalizeRequestedSource,
    normalizeManifestObjects,
    buildPageHref,
    mergeProjectSources,
    getProjectSelectionState,
    hasPresentationForProject,
} = require('./index_logic');

describe('index helpers', () => {
    test('sanitizes object names for lookup keys', () => {
        expect(sanitizeDesignation('C/2025 N1')).toBe('C_2025_N1');
    });

    test('normalizes supported source choices', () => {
        expect(normalizeRequestedSource(' Local ')).toBe('local');
        expect(normalizeRequestedSource('WEB')).toBe('web');
        expect(normalizeRequestedSource('draft')).toBe('');
    });

    test('normalizes object manifests and falls back safely', () => {
        expect(normalizeManifestObjects({ objects: ['3I', ' C/2025 N1 ', '3I'] }))
            .toEqual(['3I', 'C/2025 N1']);
        expect(normalizeManifestObjects({ objects: [{ designation: '2I/Borisov' }] }))
            .toEqual(['2I/Borisov']);
        expect(normalizeManifestObjects({ objects: [] }))
            .toEqual(['3I']);
        expect(normalizeManifestObjects({ bad: true }))
            .toEqual(['3I']);
    });

    test('builds source-aware links for player and editor pages', () => {
        expect(buildPageHref('trajectory_player', '3I', 'local'))
            .toBe('trajectory_player?designation=3I&source=local&lang=en');
        expect(buildPageHref('object_motion', '3I', 'web'))
            .toBe('object_motion?designation=3I&source=web&lang=en');
        expect(buildPageHref('presentation', '3I', '', 'he'))
            .toBe('presentation?designation=3I&lang=he');
    });

    test('merges web and local entries by sanitized designation', () => {
        const projects = mergeProjectSources(
            ['3I'],
            [{ designation: '3I', updatedAt: '2026-03-10T10:00:00Z' }, { designation: 'C/2025 N1' }]
        );

        expect(projects).toEqual([
            {
                designation: '3I',
                sanitizedName: '3I',
                hasWeb: true,
                hasLocal: true,
                localMeta: { designation: '3I', updatedAt: '2026-03-10T10:00:00Z' },
            },
            {
                designation: 'C/2025 N1',
                sanitizedName: 'C_2025_N1',
                hasWeb: false,
                hasLocal: true,
                localMeta: { designation: 'C/2025 N1' },
            },
        ]);
    });

    test('ignores local entries when local storage is globally disabled', () => {
        const projects = mergeProjectSources(
            ['3I'],
            [{ designation: '3I', updatedAt: '2026-03-10T10:00:00Z' }, { designation: 'C/2025 N1' }],
            false
        );

        expect(projects).toEqual([
            {
                designation: '3I',
                sanitizedName: '3I',
                hasWeb: true,
                hasLocal: false,
                localMeta: null,
            },
        ]);
    });

    test('requires explicit source choice only when both local and web exist', () => {
        expect(getProjectSelectionState({ hasLocal: true, hasWeb: true }, '')).toEqual({
            source: '',
            showActions: false,
            highlightLocal: false,
            showWebWarning: false,
        });

        expect(getProjectSelectionState({ hasLocal: true, hasWeb: true }, 'web')).toEqual({
            source: 'web',
            showActions: true,
            highlightLocal: false,
            showWebWarning: true,
        });

        expect(getProjectSelectionState({ hasLocal: true, hasWeb: false }, '')).toEqual({
            source: 'local',
            showActions: true,
            highlightLocal: true,
            showWebWarning: false,
        });
    });

    test('shows the presentation entry only for supported bundled objects', () => {
        expect(hasPresentationForProject({ designation: '3I', hasWeb: true })).toBe(true);
        expect(hasPresentationForProject({ designation: '3I', hasWeb: false })).toBe(false);
        expect(hasPresentationForProject({ designation: '2I/Borisov', hasWeb: true })).toBe(false);
    });
});
