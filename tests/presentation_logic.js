'use strict';

function buildPresentationManifestPath(designation) {
    const normalized = String(designation || '').trim() || '3I';
    return `data/${normalized}/presentation.json`;
}

function buildPresentationMainHref(designation, explicitHref = '', locale = 'en') {
    const trimmedExplicitHref = String(explicitHref || '').trim();
    if (trimmedExplicitHref) {
        const url = new URL(trimmedExplicitHref, 'https://example.com/');
        url.searchParams.set('lang', locale || 'en');
        return `${url.pathname.replace(/^\//, '')}${url.search}${url.hash}`;
    }

    const normalized = String(designation || '').trim() || '3I';
    const params = new URLSearchParams({
        designation: normalized,
        source: 'web',
        lang: locale || 'en',
    });
    return `trajectory_player?${params.toString()}`;
}

function normalizePresentationManifest(payload, designation = '3I') {
    const rawSlides = Array.isArray(payload?.slides) ? payload.slides : [];
    const slides = rawSlides
        .map((slide, index) => {
            const title = String(slide?.title || '').trim();
            const src = String(slide?.src || '').trim();
            if (!title || !src) return null;

            return {
                id: String(slide?.id || `slide-${index + 1}`).trim(),
                title,
                src,
            };
        })
        .filter(Boolean);

    return {
        designation: String(payload?.designation || designation || '3I').trim() || '3I',
        title: String(payload?.title || 'Presentation').trim() || 'Presentation',
        subtitle: String(payload?.subtitle || '').trim(),
        mainHref: buildPresentationMainHref(designation, payload?.mainHref),
        slides,
    };
}

function getPresentationControls(state) {
    const slideCount = Number.isFinite(state?.slideCount) ? state.slideCount : 0;
    const currentIndex = Number.isFinite(state?.currentIndex) ? state.currentIndex : -1;
    const started = Boolean(state?.started) && slideCount > 0 && currentIndex >= 0;

    return {
        canStart: slideCount > 0 && !started,
        canBack: started && currentIndex > 0,
        canNext: started && currentIndex < slideCount - 1,
    };
}

function getIntroFlyoverAdvanceResult(state, delta) {
    const slideCount = Number.isFinite(state?.slideCount) ? state.slideCount : 0;
    const currentIndex = Number.isFinite(state?.currentIndex) ? state.currentIndex : -1;
    const started = Boolean(state?.started) && slideCount > 0 && currentIndex >= 0;
    const introFlyoverPrimed = Boolean(state?.introFlyoverPrimed);

    if (!started) {
        return {
            currentIndex,
            introFlyoverPrimed,
            shouldPlayFlyover: false,
            shouldStopFlyover: false,
            didMove: false,
        };
    }

    if (delta > 0 && currentIndex === 0 && !introFlyoverPrimed) {
        return {
            currentIndex,
            introFlyoverPrimed: true,
            shouldPlayFlyover: true,
            shouldStopFlyover: false,
            didMove: false,
        };
    }

    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= slideCount) {
        return {
            currentIndex,
            introFlyoverPrimed: delta < 0 ? false : introFlyoverPrimed,
            shouldPlayFlyover: false,
            shouldStopFlyover: false,
            didMove: false,
        };
    }

    return {
        currentIndex: nextIndex,
        introFlyoverPrimed: false,
        shouldPlayFlyover: false,
        shouldStopFlyover: true,
        didMove: true,
    };
}

module.exports = {
    buildPresentationManifestPath,
    buildPresentationMainHref,
    normalizePresentationManifest,
    getPresentationControls,
    getIntroFlyoverAdvanceResult,
};
