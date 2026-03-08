/**
 * Pure logic extracted from object_motion.js for unit testing.
 * No browser globals (window, fetch, document) are used here.
 */

'use strict';

const AU_TO_PX = 175;
const HORIZONS_BASE_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

class NotFoundError  extends Error { constructor(msg) { super(msg); this.name = 'NotFoundError';  } }
class AmbiguousError extends Error { constructor(msg) { super(msg); this.name = 'AmbiguousError'; } }
class NetworkError   extends Error { constructor(msg) { super(msg); this.name = 'NetworkError';   } }
class EmptyDataError extends Error { constructor(msg) { super(msg); this.name = 'EmptyDataError'; } }

function buildUrl(designation, startDate, endDate, step) {
    // Encode only the designation; keep single-quote wrapping literal so
    // the Horizons API receives COMMAND='DES=<encoded>' without double-encoding.
    const encodedDes = encodeURIComponent(designation);
    return (
        `${HORIZONS_BASE_URL}` +
        `?format=json` +
        `&COMMAND='DES=${encodedDes}'` +
        `&EPHEM_TYPE=VECTORS` +
        `&CENTER=500%4010` +
        `&START_TIME=${encodeURIComponent(startDate)}` +
        `&STOP_TIME=${encodeURIComponent(endDate)}` +
        `&STEP_SIZE=${encodeURIComponent(step)}` +
        `&VEC_TABLE=2`
    );
}

function parseResult(resultText, designation) {
    // Ambiguous checked first — "Matching small-bodies" also contains no $$SOE
    if (/Matching\s+small-bodies:/i.test(resultText) ||
        /Multiple\s+major-bodies\s+match/i.test(resultText) ||
        /ambiguous\s+target/i.test(resultText)) {
        throw new AmbiguousError(
            'Multiple matches found. Please enter a more specific designation (e.g., use the full provisional designation).'
        );
    }

    if (/No\s+matches\s+found/i.test(resultText) ||
        /No\s+target\s+body\s+name\s+matching/i.test(resultText) ||
        /No\s+matching\s+record/i.test(resultText) ||
        /ERROR:/i.test(resultText)) {
        throw new NotFoundError(
            `Object '${designation}' was not found in the JPL Horizons database. Check the designation and try again.`
        );
    }

    const soeIdx = resultText.indexOf('$$SOE');
    const eoeIdx = resultText.indexOf('$$EOE');

    if (soeIdx === -1 || eoeIdx === -1) {
        throw new NotFoundError(
            `Object '${designation}' was not found in the JPL Horizons database. Check the designation and try again.`
        );
    }

    const block = resultText.slice(soeIdx + 5, eoeIdx).trim();

    if (!block) {
        throw new EmptyDataError(
            `No ephemeris data found for '${designation}' in the specified date range.`
        );
    }

    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const points = [];

    for (let i = 0; i < lines.length; i += 3) {
        const jdLine  = lines[i];
        const xyzLine = lines[i + 1];
        if (!jdLine || !xyzLine) break;

        const jdMatch = jdLine.match(/^([\d.]+)\s*=\s*A\.D\.\s*(\d{4}-\w{3}-\d{2})/);
        if (!jdMatch) continue;

        const jd   = parseFloat(jdMatch[1]);
        const date = jdMatch[2];

        const xMatch = xyzLine.match(/X\s*=\s*([-+]?\d+\.?\d*[Ee][-+]?\d+)/);
        const yMatch = xyzLine.match(/Y\s*=\s*([-+]?\d+\.?\d*[Ee][-+]?\d+)/);
        const zMatch = xyzLine.match(/Z\s*=\s*([-+]?\d+\.?\d*[Ee][-+]?\d+)/);

        if (!xMatch || !yMatch || !zMatch) continue;

        const auX = parseFloat(xMatch[1]);
        const auY = parseFloat(yMatch[1]);
        const auZ = parseFloat(zMatch[1]);

        points.push({
            jd,
            date,
            au: { x: auX, y: auY, z: auZ },
            wx: auX * AU_TO_PX,
            wy: auY * AU_TO_PX,
            wz: auZ * AU_TO_PX,
            camera:      null,
            description: null,
            image:       null,
        });
    }

    if (points.length === 0) {
        throw new EmptyDataError(
            `No ephemeris data found for '${designation}' in the specified date range.`
        );
    }

    return points;
}

function normalizePoint(p) {
    return {
        jd:          p.jd,
        date:        p.date,
        au:          p.au,
        wx:          p.wx  ?? p.px?.wx ?? (p.au?.x * AU_TO_PX) ?? 0,
        wy:          p.wy  ?? p.px?.wy ?? (p.au?.y * AU_TO_PX) ?? 0,
        wz:          p.wz  ?? p.px?.wz ?? (p.au?.z * AU_TO_PX) ?? 0,
        camera:      p.camera      ?? null,
        description: p.description ?? null,
        image:       p.image       ?? null,
    };
}

function resolveStep(dropdownValue, customValue) {
    const custom = (customValue || '').trim();
    return custom || dropdownValue;
}

function sanitize(name) {
    return name.replace(/[\s/]/g, '_');
}

module.exports = {
    buildUrl,
    parseResult,
    normalizePoint,
    resolveStep,
    sanitize,
    NotFoundError,
    AmbiguousError,
    NetworkError,
    EmptyDataError,
};
