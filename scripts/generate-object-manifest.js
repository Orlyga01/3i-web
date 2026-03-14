'use strict';

const fs = require('fs');
const path = require('path');

function sanitizeDesignation(name) {
    return String(name || '').trim().replace(/[\s/]/g, '_');
}

function extractDesignation(folderName, parsedJson) {
    const designation = typeof parsedJson?.designation === 'string'
        ? parsedJson.designation.trim()
        : typeof parsedJson?.object === 'string'
            ? parsedJson.object.trim()
            : '';

    return designation || folderName;
}

function collectObjectsFromDataDirectory(dataDirectory) {
    if (!fs.existsSync(dataDirectory)) return [];

    const seen = new Set();
    const objects = [];
    const entries = fs.readdirSync(dataDirectory, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const folderName = entry.name;
        const trajectoryPath = path.join(dataDirectory, folderName, 'trajectory.json');
        if (!fs.existsSync(trajectoryPath)) continue;

        let designation = folderName;
        try {
            const parsed = JSON.parse(fs.readFileSync(trajectoryPath, 'utf8'));
            designation = extractDesignation(folderName, parsed);
        } catch (_) {
            designation = folderName;
        }

        const sanitizedName = sanitizeDesignation(designation);
        if (!sanitizedName || seen.has(sanitizedName)) continue;
        seen.add(sanitizedName);
        objects.push(designation);
    }

    return objects.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function buildManifestDocument(objects) {
    return { objects: [...objects] };
}

function writeObjectManifest(projectRoot) {
    const dataDirectory = path.join(projectRoot, 'data');
    const manifestPath = path.join(dataDirectory, 'objects.json');
    const objects = collectObjectsFromDataDirectory(dataDirectory);
    const manifest = buildManifestDocument(objects);

    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return { manifestPath, objects };
}

if (require.main === module) {
    const projectRoot = path.resolve(__dirname, '..');
    const result = writeObjectManifest(projectRoot);
    console.log(`[generate-object-manifest] Wrote ${result.objects.length} objects to ${result.manifestPath}`);
}

module.exports = {
    sanitizeDesignation,
    extractDesignation,
    collectObjectsFromDataDirectory,
    buildManifestDocument,
    writeObjectManifest,
};
