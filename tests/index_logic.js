'use strict';

const DEFAULT_WEB_OBJECTS = Object.freeze(['3I', 'solar_comet']);
const PRESENTATION_OBJECTS = Object.freeze(['3I']);

function sanitizeDesignation(name) {
    return String(name || '').trim().replace(/[\s/]/g, '_');
}

function normalizeRequestedSource(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'local' || normalized === 'web' ? normalized : '';
}

function normalizeManifestObjects(payload, fallbackObjects = DEFAULT_WEB_OBJECTS) {
    const rawObjects = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.objects)
            ? payload.objects
            : null;

    if (!rawObjects) return [...fallbackObjects];

    const seen = new Set();
    const normalized = [];

    for (const entry of rawObjects) {
        const designation = typeof entry === 'string'
            ? entry.trim()
            : typeof entry?.designation === 'string'
                ? entry.designation.trim()
                : '';

        const sanitizedName = sanitizeDesignation(designation);
        if (!designation || !sanitizedName || seen.has(sanitizedName)) continue;
        seen.add(sanitizedName);
        normalized.push(designation);
    }

    return normalized.length ? normalized : [...fallbackObjects];
}

function buildPageHref(pageName, designation, source = '', locale = 'en') {
    const params = new URLSearchParams({ designation: designation || '3I' });
    const normalizedSource = normalizeRequestedSource(source);
    if (normalizedSource) params.set('source', normalizedSource);
    params.set('lang', locale || 'en');
    return `${pageName}?${params.toString()}`;
}

function mergeProjectSources(webDesignations = [], localProjects = [], useLocalStorage = true) {
    const projectMap = new Map();

    for (const designation of webDesignations) {
        const sanitizedName = sanitizeDesignation(designation);
        projectMap.set(sanitizedName, {
            designation,
            sanitizedName,
            hasWeb: true,
            hasLocal: false,
            localMeta: null,
        });
    }

    if (useLocalStorage) {
        for (const localProject of localProjects) {
            const sanitizedName = sanitizeDesignation(localProject.designation);
            const existing = projectMap.get(sanitizedName);

            if (existing) {
                existing.hasLocal = true;
                existing.localMeta = localProject;
                existing.designation = localProject.designation || existing.designation;
                continue;
            }

            projectMap.set(sanitizedName, {
                designation: localProject.designation,
                sanitizedName,
                hasWeb: false,
                hasLocal: true,
                localMeta: localProject,
            });
        }
    }

    return Array.from(projectMap.values())
        .sort((a, b) => a.designation.localeCompare(b.designation, undefined, { sensitivity: 'base' }));
}

function getProjectSelectionState(project, selectedSource = '') {
    const normalized = normalizeRequestedSource(selectedSource);
    const resolvedSource = normalized || (project.hasLocal && !project.hasWeb ? 'local' : (project.hasWeb && !project.hasLocal ? 'web' : ''));

    return {
        source: resolvedSource,
        showActions: Boolean(resolvedSource),
        highlightLocal: resolvedSource === 'local',
        showWebWarning: project.hasLocal && project.hasWeb && resolvedSource === 'web',
    };
}

function hasPresentationForProject(project, supportedObjects = PRESENTATION_OBJECTS) {
    if (!project?.hasWeb) return false;
    return supportedObjects.includes(String(project.designation || '').trim());
}

module.exports = {
    sanitizeDesignation,
    normalizeRequestedSource,
    normalizeManifestObjects,
    buildPageHref,
    mergeProjectSources,
    getProjectSelectionState,
    hasPresentationForProject,
};
