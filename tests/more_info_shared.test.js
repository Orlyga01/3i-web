'use strict';

const {
    normalizeMoreInfo,
    hasMoreInfoContent,
    resolveTrajectoryAssetUrl,
    buildMoreInfoVideoModel,
} = require('../more_info_shared');

describe('more_info_shared', () => {
    test('normalizes structured more_info content', () => {
        const result = normalizeMoreInfo({
            images: [
                { url: 'gallery/pic.jpg', caption: 'Caption' },
                { url: 'https://example.com/remote.webp' },
            ],
            video: {
                url: 'https://youtu.be/abc123xyz',
                title: 'Video title',
            },
            text: ' Extra context ',
        }, '3I');

        expect(result.images).toEqual([
            { url: 'data/3I/gallery/pic.jpg', caption: 'Caption' },
            { url: 'https://example.com/remote.webp', caption: '' },
        ]);
        expect(result.video).toEqual({
            url: 'https://youtu.be/abc123xyz',
            title: 'Video title',
        });
        expect(result.text).toBe('Extra context');
        expect(result.hasStructuredContent).toBe(true);
        expect(result.hasContent).toBe(true);
    });

    test('treats page_name-only entries as valid content', () => {
        const point = {
            more_info: {
                page_name: 'custom_page.html',
            },
        };

        expect(hasMoreInfoContent(point, '3I')).toBe(true);
        expect(normalizeMoreInfo(point.more_info, '3I').pageName).toBe('custom_page.html');
    });

    test('resolves relative asset urls against the trajectory folder', () => {
        expect(resolveTrajectoryAssetUrl('clips/video.mp4', 'C/2025 N1'))
            .toBe('data/C_2025_N1/clips/video.mp4');
    });

    test('builds youtube embed models for known youtube links', () => {
        expect(buildMoreInfoVideoModel('https://www.youtube.com/watch?v=9t-OV6Wmbkw', '3I')).toEqual({
            type: 'youtube-embed',
            src: 'https://www.youtube.com/embed/9t-OV6Wmbkw',
            title: '',
        });
    });

    test('builds html5 video models for direct media files', () => {
        expect(buildMoreInfoVideoModel({ url: 'clips/flyby.mp4', title: 'Flyby' }, '3I')).toEqual({
            type: 'html5',
            src: 'data/3I/clips/flyby.mp4',
            title: 'Flyby',
        });
    });
});
