'use strict';

function buildPresentationManifestPath(designation) {
    const normalized = String(designation || '').trim() || '3I';
    return `data/${normalized}/presentation.json`;
}

function buildPresentationMainHref(designation, explicitHref = '') {
    const trimmedExplicitHref = String(explicitHref || '').trim();
    if (trimmedExplicitHref) return trimmedExplicitHref;

    const normalized = String(designation || '').trim() || '3I';
    const params = new URLSearchParams({
        designation: normalized,
        source: 'web',
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

module.exports = {
    buildPresentationManifestPath,
    buildPresentationMainHref,
    normalizePresentationManifest,
    getPresentationControls,
};
