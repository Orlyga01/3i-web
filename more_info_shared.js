(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.MoreInfoShared = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function sanitizeDesignation(name) {
        return String(name || '').replace(/[\s/]/g, '_');
    }

    function trimOptionalString(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function isAbsoluteUrl(value) {
        const trimmed = trimOptionalString(value);
        return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('data:');
    }

    function resolveTrajectoryAssetUrl(value, designation) {
        const trimmed = trimOptionalString(value);
        if (!trimmed) return '';
        if (isAbsoluteUrl(trimmed)) return trimmed;
        const normalized = trimmed.replace(/^\.?[\\/]+/, '').replace(/\\/g, '/');
        return `data/${sanitizeDesignation(designation)}/${normalized}`;
    }

    function normalizeImageEntry(entry, designation) {
        if (typeof entry === 'string') {
            const url = resolveTrajectoryAssetUrl(entry, designation);
            return url ? { url, caption: '' } : null;
        }
        if (!entry || typeof entry !== 'object') return null;
        const url = resolveTrajectoryAssetUrl(entry.url, designation);
        if (!url) return null;
        return {
            url,
            caption: trimOptionalString(entry.caption),
        };
    }

    function normalizeVideoEntry(entry, designation) {
        if (typeof entry === 'string') {
            const url = resolveTrajectoryAssetUrl(entry, designation);
            return url ? { url, title: '' } : null;
        }
        if (!entry || typeof entry !== 'object') return null;
        const url = resolveTrajectoryAssetUrl(entry.url, designation);
        if (!url) return null;
        return {
            url,
            title: trimOptionalString(entry.title),
        };
    }

    function normalizeMoreInfo(moreInfo, designation) {
        if (!moreInfo || typeof moreInfo !== 'object') {
            return {
                images: [],
                video: null,
                text: '',
                pageName: '',
                hasStructuredContent: false,
                hasContent: false,
            };
        }

        const images = Array.isArray(moreInfo.images)
            ? moreInfo.images
                .map(entry => normalizeImageEntry(entry, designation))
                .filter(Boolean)
            : [];

        const video = normalizeVideoEntry(moreInfo.video, designation);
        const text = trimOptionalString(
            moreInfo.text ??
            moreInfo.additional_text ??
            moreInfo.additionalText
        );
        const pageName = trimOptionalString(moreInfo.page_name ?? moreInfo.pageName);
        const hasStructuredContent = Boolean(images.length || video || text);

        return {
            images,
            video,
            text,
            pageName,
            hasStructuredContent,
            hasContent: Boolean(pageName || hasStructuredContent),
        };
    }

    function hasMoreInfoContent(point, designation) {
        return normalizeMoreInfo(point?.more_info, designation).hasContent;
    }

    function buildMoreInfoVideoModel(videoEntry, designation) {
        const video = normalizeVideoEntry(videoEntry, designation);
        if (!video) {
            return { type: 'none', src: '', title: '' };
        }

        const url = video.url;
        const title = video.title;
        const lowerUrl = url.toLowerCase();
        const youTubeMatch = url.match(
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/i
        );

        if (youTubeMatch && youTubeMatch[1]) {
            return {
                type: 'youtube-embed',
                src: `https://www.youtube.com/embed/${youTubeMatch[1]}`,
                title,
            };
        }

        if (/\.(mp4|webm|ogg)(?:[#?].*)?$/i.test(lowerUrl)) {
            return {
                type: 'html5',
                src: url,
                title,
            };
        }

        return {
            type: 'link',
            src: url,
            title,
        };
    }

    return {
        sanitizeDesignation,
        trimOptionalString,
        isAbsoluteUrl,
        resolveTrajectoryAssetUrl,
        normalizeMoreInfo,
        hasMoreInfoContent,
        buildMoreInfoVideoModel,
    };
});
