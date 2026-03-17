'use strict';

const {
    buildTranslationMap,
    getHebrewFontCss,
    normalizeLocale,
    translate,
    formatTemplate,
    withLangParam,
    translatePoint,
    getPlanetName,
} = require('../translations.js');

describe('translation helpers', () => {
    test('normalizes unsupported locales to english', () => {
        expect(normalizeLocale('he')).toBe('he');
        expect(normalizeLocale('EN')).toBe('en');
        expect(normalizeLocale('fr')).toBe('en');
    });

    test('formats templates with named params', () => {
        expect(formatTemplate('{{count}} projects', { count: 3 })).toBe('3 projects');
    });

    test('defines a global Hebrew font rule for the whole document tree', () => {
        const css = getHebrewFontCss();
        expect(css).toContain('html[lang="he"] body *');
        expect(css).toContain('"Fredoka"');
        expect(css).toContain('!important');
    });

    test('builds a locale map from name-based entries', () => {
        const translations = {
            items: [
                { name: 'Cyanide', translations: { en: 'Cyanide', he: 'ציאניד' } },
            ],
        };

        const map = buildTranslationMap(translations, 'he');
        expect(map.get('Cyanide')).toBe('ציאניד');
        expect(translate('Cyanide', { locale: 'he', translations })).toBe('ציאניד');
    });

    test('appends lang to internal hrefs', () => {
        expect(withLangParam('trajectory_player?designation=3I', 'he'))
            .toBe('trajectory_player?designation=3I&lang=he');
    });

    test('translates point descriptions and preserves base more_info data', () => {
        const point = {
            date: '2025-07-01',
            description: 'Discovery — 4.5 AU from Sun',
            more_info: {
                images: [
                    { url: 'https://example.com/atlas.png', caption: 'Discovery image' },
                ],
            },
        };

        const translations = {
            items: [
                { name: 'Discovery — 4.5 AU from Sun', translations: { en: 'Discovery — 4.5 AU from Sun', he: 'גילוי — 4.5 AU מהשמש' } },
                { name: 'Discovery image', translations: { en: 'Discovery image', he: 'תמונת גילוי' } },
            ],
        };

        expect(translatePoint('3I', point, 'he', translations)).toEqual({
            date: '2025-07-01',
            description: 'גילוי — 4.5 AU מהשמש',
            more_info: {
                images: [
                    { url: 'https://example.com/atlas.png', caption: 'תמונת גילוי' },
                ],
            },
        });
    });

    test('falls back to english planet names when no translation exists', () => {
        const translations = {
            items: [
                { name: 'Jupiter', translations: { en: 'Jupiter', he: 'צדק' } },
            ],
        };

        expect(getPlanetName('Jupiter', 'he', translations)).toBe('צדק');
        expect(getPlanetName('Mars', 'he', translations)).toBe('Mars');
    });
});
