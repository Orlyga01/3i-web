(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.AppTranslations = api;
    root.t = function globalTranslate(name, params, locale) {
        return api.translate(name, { params, locale });
    };
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const DEFAULT_LOCALE = 'en';
    const RTL_LOCALES = new Set(['he']);
    const SUPPORTED_LOCALES = new Set(['en', 'he']);
    const SCRIPT_BASE_URL = getScriptBaseUrl();
    const HEBREW_FONT_URL = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700&display=swap';
    const HEBREW_FONT_LINK_ID = 'app-hebrew-font-link';

    let cachedTranslations = null;
    let cachedMaps = {};
    let cachedPromise = null;

    function getScriptBaseUrl() {
        if (typeof document === 'undefined') return '';
        const currentScript = document.currentScript;
        if (!currentScript?.src) return '';
        try {
            return new URL('.', currentScript.src).href;
        } catch (_) {
            return '';
        }
    }

    function getTranslationsUrl() {
        if (SCRIPT_BASE_URL) {
            return new URL('data/translations.json', SCRIPT_BASE_URL).href;
        }
        return 'data/translations.json';
    }

    function normalizeLocale(value) {
        const normalized = String(value || '').trim().toLowerCase();
        return SUPPORTED_LOCALES.has(normalized) ? normalized : DEFAULT_LOCALE;
    }

    function getLocaleFromSearch(search) {
        const source = typeof search === 'string'
            ? search
            : (typeof location !== 'undefined' ? location.search : '');
        const params = new URLSearchParams(source);
        return normalizeLocale(params.get('lang'));
    }

    function getCurrentLocale() {
        if (typeof document !== 'undefined') {
            return normalizeLocale(document.documentElement?.lang || getLocaleFromSearch());
        }
        return getLocaleFromSearch('');
    }

    function isRtlLocale(locale) {
        return RTL_LOCALES.has(normalizeLocale(locale));
    }

    function ensureHebrewFont(locale) {
        if (typeof document === 'undefined') return;
        if (normalizeLocale(locale) !== 'he') return;

        if (!document.getElementById(HEBREW_FONT_LINK_ID)) {
            const link = document.createElement('link');
            link.id = HEBREW_FONT_LINK_ID;
            link.rel = 'stylesheet';
            link.href = HEBREW_FONT_URL;
            document.head.appendChild(link);
        }

        /* Font rules are in styles.css; link ensures Fredoka loads on pages without styles.css (e.g. presentation) */
    }

    function setDocumentLocale(locale) {
        if (typeof document === 'undefined') return normalizeLocale(locale);
        const normalized = normalizeLocale(locale);
        const dir = isRtlLocale(normalized) ? 'rtl' : 'ltr';
        ensureHebrewFont(normalized);
        document.documentElement.lang = normalized;
        document.documentElement.dir = dir;
        if (document.body) {
            document.body.dir = dir;
        } else {
            document.addEventListener('DOMContentLoaded', function applyBodyDirection() {
                if (document.body) document.body.dir = dir;
            }, { once: true });
        }
        return normalized;
    }

    async function loadTranslations(fetchImpl) {
        if (cachedTranslations) return cachedTranslations;
        if (cachedPromise) return cachedPromise;

        const fetcher = fetchImpl || root.fetch;
        if (typeof fetcher !== 'function') {
            cachedTranslations = {};
            return cachedTranslations;
        }

        cachedPromise = fetcher(getTranslationsUrl(), { cache: 'no-store' })
            .then(function onResponse(response) {
                if (!response.ok) throw new Error('Could not load translations.');
                return response.json();
            })
            .then(function onJson(payload) {
                cachedTranslations = payload && typeof payload === 'object' ? payload : {};
                cachedMaps = {};
                return cachedTranslations;
            })
            .catch(function onError(error) {
                console.warn('[translations] Falling back to empty translations.', error);
                cachedTranslations = {};
                cachedMaps = {};
                return cachedTranslations;
            });

        return cachedPromise;
    }

    function formatTemplate(value, params) {
        const template = String(value ?? '');
        return template.replace(/\{\{(\w+)\}\}/g, function replace(_, key) {
            return Object.prototype.hasOwnProperty.call(params || {}, key)
                ? String(params[key])
                : '';
        });
    }

    function buildTranslationMap(payload, locale = DEFAULT_LOCALE) {
        const normalizedLocale = normalizeLocale(locale);
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const map = new Map();

        items.forEach(function eachItem(item) {
            if (!item || typeof item.name !== 'string') return;
            const sourceName = item.name;
            const translations = item.translations && typeof item.translations === 'object'
                ? item.translations
                : {};
            const translatedValue = typeof translations[normalizedLocale] === 'string'
                ? translations[normalizedLocale]
                : typeof translations[DEFAULT_LOCALE] === 'string'
                    ? translations[DEFAULT_LOCALE]
                    : sourceName;
            map.set(sourceName, translatedValue || sourceName);
        });

        return map;
    }

    function getTranslationMap(locale = DEFAULT_LOCALE, payload = null) {
        const normalizedLocale = normalizeLocale(locale);
        if (payload) return buildTranslationMap(payload, normalizedLocale);
        if (!cachedTranslations) return new Map();
        if (!cachedMaps[normalizedLocale]) {
            cachedMaps[normalizedLocale] = buildTranslationMap(cachedTranslations, normalizedLocale);
        }
        return cachedMaps[normalizedLocale];
    }

    function translate(name, options = {}) {
        const sourceName = String(name ?? '');
        const fallback = typeof options.fallback === 'string' && options.fallback
            ? options.fallback
            : sourceName;
        const locale = normalizeLocale(options.locale || getCurrentLocale());
        const params = options.params || null;
        const map = getTranslationMap(locale, options.translations || null);
        const translatedValue = map.get(sourceName) || fallback || sourceName;
        return formatTemplate(translatedValue, params);
    }

    function getValue(name, options = {}) {
        if (Array.isArray(name)) {
            const fallback = typeof options.fallback === 'string' ? options.fallback : '';
            return translate(fallback || name[name.length - 1] || '', options);
        }
        return translate(String(name || ''), options);
    }

    function toRelativeHref(urlObject) {
        if (!urlObject) return '';
        if (typeof window !== 'undefined' && urlObject.origin !== window.location.origin) return urlObject.href;
        return `${urlObject.pathname.replace(/^\/+/, '')}${urlObject.search}${urlObject.hash}`;
    }

    function withLangParam(href, locale) {
        const rawHref = String(href || '').trim();
        if (!rawHref) return rawHref;
        const normalizedLocale = normalizeLocale(locale || getCurrentLocale());

        try {
            const baseHref = typeof window !== 'undefined' ? window.location.href : 'https://example.invalid/';
            const url = new URL(rawHref, baseHref);
            if (typeof window !== 'undefined' && url.origin !== window.location.origin) {
                return rawHref;
            }
            url.searchParams.set('lang', normalizedLocale);
            return toRelativeHref(url) || rawHref;
        } catch (_) {
            return rawHref;
        }
    }

    function mergeTranslatedImages(baseImages, translatedImages) {
        if (!Array.isArray(baseImages) || !baseImages.length) return baseImages;
        if (!Array.isArray(translatedImages) || !translatedImages.length) return baseImages;

        return baseImages.map(function mapImage(entry, index) {
            const translatedEntry = translatedImages[index];
            const translatedCaption = typeof translatedEntry?.caption === 'string'
                ? translatedEntry.caption.trim()
                : '';

            if (!translatedCaption) return entry;
            if (typeof entry === 'string') {
                return { url: entry, caption: translatedCaption };
            }
            if (entry && typeof entry === 'object') {
                return { ...entry, caption: translatedCaption };
            }
            return entry;
        });
    }

    function mergeTranslatedVideo(baseVideo, translatedVideo) {
        const translatedTitle = typeof translatedVideo?.title === 'string'
            ? translatedVideo.title.trim()
            : '';

        if (!translatedTitle) return baseVideo;
        if (typeof baseVideo === 'string') {
            return { url: baseVideo, title: translatedTitle };
        }
        if (baseVideo && typeof baseVideo === 'object') {
            return { ...baseVideo, title: translatedTitle };
        }
        return baseVideo;
    }

    function mergeMoreInfo(baseMoreInfo, translatedMoreInfo) {
        if (!translatedMoreInfo || typeof translatedMoreInfo !== 'object') return baseMoreInfo;
        const base = (baseMoreInfo && typeof baseMoreInfo === 'object') ? baseMoreInfo : {};
        const merged = { ...base };

        if (typeof translatedMoreInfo.text === 'string') {
            merged.text = translatedMoreInfo.text;
        }
        if (typeof translatedMoreInfo.additional_text === 'string') {
            merged.additional_text = translatedMoreInfo.additional_text;
        }
        if (typeof translatedMoreInfo.additionalText === 'string') {
            merged.additionalText = translatedMoreInfo.additionalText;
        }
        if (typeof translatedMoreInfo.page_name === 'string') {
            merged.page_name = translatedMoreInfo.page_name;
        }
        if (typeof translatedMoreInfo.pageName === 'string') {
            merged.pageName = translatedMoreInfo.pageName;
        }
        if (Array.isArray(base.images)) {
            merged.images = mergeTranslatedImages(base.images, translatedMoreInfo.images);
        }
        if (base.video) {
            merged.video = mergeTranslatedVideo(base.video, translatedMoreInfo.video);
        }

        return merged;
    }

    function translatePoint(designation, point, locale, translations) {
        if (!point || typeof point !== 'object') return point;
        const normalizedLocale = normalizeLocale(locale || getCurrentLocale());
        const baseMoreInfo = point.more_info && typeof point.more_info === 'object'
            ? point.more_info
            : null;
        const translatedMoreInfo = baseMoreInfo
            ? {
                ...baseMoreInfo,
                text: typeof baseMoreInfo.text === 'string'
                    ? translate(baseMoreInfo.text, { locale: normalizedLocale, translations })
                    : baseMoreInfo.text,
                additional_text: typeof baseMoreInfo.additional_text === 'string'
                    ? translate(baseMoreInfo.additional_text, { locale: normalizedLocale, translations })
                    : baseMoreInfo.additional_text,
                additionalText: typeof baseMoreInfo.additionalText === 'string'
                    ? translate(baseMoreInfo.additionalText, { locale: normalizedLocale, translations })
                    : baseMoreInfo.additionalText,
                images: Array.isArray(baseMoreInfo.images)
                    ? baseMoreInfo.images.map(function mapImage(image) {
                        if (!image || typeof image !== 'object') return image;
                        return {
                            ...image,
                            caption: typeof image.caption === 'string'
                                ? translate(image.caption, { locale: normalizedLocale, translations })
                                : image.caption,
                        };
                    })
                    : baseMoreInfo.images,
                video: baseMoreInfo.video && typeof baseMoreInfo.video === 'object'
                    ? {
                        ...baseMoreInfo.video,
                        title: typeof baseMoreInfo.video.title === 'string'
                            ? translate(baseMoreInfo.video.title, { locale: normalizedLocale, translations })
                            : baseMoreInfo.video.title,
                    }
                    : baseMoreInfo.video,
            }
            : point.more_info;

        return {
            ...point,
            description: typeof point.description === 'string'
                ? translate(point.description, { locale: normalizedLocale, translations })
                : point.description ?? null,
            more_info: translatedMoreInfo,
        };
    }

    function getPlanetName(name, locale, translations) {
        return translate(String(name || '').trim(), {
            locale,
            translations,
            fallback: String(name || '').trim(),
        }) || String(name || '').trim();
    }

    return {
        DEFAULT_LOCALE,
        buildTranslationMap,
        getTranslationMap,
        normalizeLocale,
        getLocaleFromSearch,
        getCurrentLocale,
        isRtlLocale,
        setDocumentLocale,
        loadTranslations,
        getTranslationsUrl,
        translate,
        getValue,
        formatTemplate,
        withLangParam,
        translatePoint,
        getPlanetName,
    };
});
