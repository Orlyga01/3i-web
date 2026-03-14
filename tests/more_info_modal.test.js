'use strict';

const { buildMoreInfoModalModel } = require('../more_info_modal');

describe('more_info_modal', () => {
    test('builds header model with description beside the date', () => {
        const model = buildMoreInfoModalModel({
            date: '2025-11-13',
            description: 'Blue color shift observed',
            more_info: {
                text: 'Extended note',
            },
        }, '3I', {
            dateText: 'Nov 13, 2025',
            title: 'Point More Info',
        });

        expect(model.title).toBe('Point More Info');
        expect(model.dateText).toBe('Nov 13, 2025');
        expect(model.description).toBe('Blue color shift observed');
        expect(model.info.text).toBe('Extended note');
        expect(model.hasContent).toBe(true);
    });

    test('preserves image order for vertical rendering', () => {
        const model = buildMoreInfoModalModel({
            more_info: {
                images: [
                    { url: 'one.jpg', caption: 'First' },
                    { url: 'two.jpg', caption: 'Second' },
                ],
            },
        }, '3I');

        expect(model.info.images.map(image => image.caption)).toEqual(['First', 'Second']);
    });

    test('returns no content for empty more_info payloads', () => {
        const model = buildMoreInfoModalModel({
            description: 'Header only',
            more_info: {},
        }, '3I');

        expect(model.hasContent).toBe(false);
    });
});
