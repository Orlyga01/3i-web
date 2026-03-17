'use strict';

const fs = require('fs');
const path = require('path');

const {
    buildPresentationManifestPath,
    buildPresentationMainHref,
    normalizePresentationManifest,
    getPresentationControls,
    getIntroFlyoverAdvanceResult,
} = require('./presentation_logic');

describe('presentation helpers', () => {
    test('builds the default manifest path from the designation', () => {
        expect(buildPresentationManifestPath('3I')).toBe('data/3I/presentation.json');
        expect(buildPresentationManifestPath('')).toBe('data/3I/presentation.json');
    });

    test('builds the default main experience link', () => {
        expect(buildPresentationMainHref('3I')).toBe('trajectory_player?designation=3I&source=web&lang=en');
        expect(buildPresentationMainHref('3I', 'object_motion?designation=3I')).toBe('object_motion?designation=3I&lang=en');
        expect(buildPresentationMainHref('3I', '', 'he')).toBe('trajectory_player?designation=3I&source=web&lang=he');
    });

    test('normalizes slide manifests and filters invalid entries', () => {
        expect(normalizePresentationManifest({
            designation: '3I',
            title: '3I Atlas Presentation',
            slides: [
                { id: 'wow', title: 'Wow! Signal', src: 'slides/3I/wow_signal.html' },
                { title: 'Missing src' },
                { src: 'slides/3I/comets_101.html' },
            ],
        })).toEqual({
            designation: '3I',
            title: '3I Atlas Presentation',
            subtitle: '',
            mainHref: 'trajectory_player?designation=3I&source=web&lang=en',
            slides: [
                { id: 'wow', title: 'Wow! Signal', src: 'slides/3I/wow_signal.html' },
            ],
        });
    });

    test('ships Borisov manual-start and Oumuamua autoplay player slides in the 3I manifest', () => {
        const manifestPath = path.join(__dirname, '..', 'data', '3I', 'presentation.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        expect(manifest.slides).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'borisov-trajectory-player',
                src: 'trajectory_player?designation=2I%2FBorisov&source=web',
            }),
            expect.objectContaining({
                id: 'oumuamua-trajectory-player',
                src: 'trajectory_player?designation=Oumuamua&source=web&autoplay=1',
            }),
        ]));
    });

    test('derives button state from the active slide state', () => {
        expect(getPresentationControls({ started: false, currentIndex: -1, slideCount: 3 })).toEqual({
            canStart: true,
            canBack: false,
            canNext: false,
        });

        expect(getPresentationControls({ started: true, currentIndex: 1, slideCount: 3 })).toEqual({
            canStart: false,
            canBack: true,
            canNext: true,
        });

        expect(getPresentationControls({ started: true, currentIndex: 2, slideCount: 3 })).toEqual({
            canStart: false,
            canBack: true,
            canNext: false,
        });
    });

    test('stops the intro flyover once the second next click advances', () => {
        expect(getIntroFlyoverAdvanceResult({
            started: true,
            currentIndex: 0,
            slideCount: 3,
            introFlyoverPrimed: false,
        }, 1)).toEqual({
            currentIndex: 0,
            introFlyoverPrimed: true,
            shouldPlayFlyover: true,
            shouldStopFlyover: false,
            didMove: false,
        });

        expect(getIntroFlyoverAdvanceResult({
            started: true,
            currentIndex: 0,
            slideCount: 3,
            introFlyoverPrimed: true,
        }, 1)).toEqual({
            currentIndex: 1,
            introFlyoverPrimed: false,
            shouldPlayFlyover: false,
            shouldStopFlyover: true,
            didMove: true,
        });
    });
});
