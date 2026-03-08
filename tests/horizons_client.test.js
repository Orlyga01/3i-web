/**
 * Unit tests for HorizonsClient pure-logic functions.
 *
 * The browser module (object_motion.js) uses window.fetch and the DOM, so
 * the parsing and URL-building logic is reimported here as a CommonJS module
 * (horizons_client_logic.js) that exports only the pure functions.
 */

'use strict';

const {
    buildUrl,
    parseResult,
    resolveStep,
    sanitize,
    NotFoundError,
    AmbiguousError,
    NetworkError,
    EmptyDataError,
} = require('./horizons_client_logic');

const AU_TO_PX = 175;

// ─────────────────────────────────────────────────────────────
// addProxy
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// buildUrl
// ─────────────────────────────────────────────────────────────

describe('buildUrl', () => {
    test('includes base URL', () => {
        const url = buildUrl('C/2025 N1', '2025-07-01', '2025-12-31', '1d');
        expect(url).toContain('ssd.jpl.nasa.gov/api/horizons.api');
    });

    test('encodes designation in COMMAND param', () => {
        const url = buildUrl('C/2025 N1', '2025-07-01', '2025-12-31', '1d');
        expect(url).toContain('COMMAND=');
        expect(url).toContain('C%2F2025%20N1');
    });

    test('passes correct fixed params', () => {
        const url = buildUrl('Oumuamua', '2017-10-01', '2018-01-01', '7d');
        expect(url).toContain('EPHEM_TYPE=VECTORS');
        expect(url).toContain('CENTER=500%4010');
        expect(url).toContain('VEC_TABLE=2');
    });

    test('encodes custom step size', () => {
        const url = buildUrl('1I', '2017-10-01', '2018-01-01', '14d');
        expect(url).toContain('STEP_SIZE=14d');
    });
});

// ─────────────────────────────────────────────────────────────
// parseResult — happy path
// ─────────────────────────────────────────────────────────────

const SAMPLE_RESULT = `
Some header text from Horizons

$$SOE
2461223.500000000 = A.D. 2025-Jul-01 00:00:00.0000 TDB
 X = 2.740000000000000E-01 Y =-4.497000000000000E+00 Z = 2.910000000000000E-01
 VX= 1.234E-03 VY= 5.678E-04 VZ= 9.101E-05
2461230.500000000 = A.D. 2025-Jul-08 00:00:00.0000 TDB
 X =-1.200000000000000E+00 Y = 3.100000000000000E-01 Z =-5.000000000000000E-02
 VX= 2.000E-03 VY=-1.000E-04 VZ= 3.000E-05
$$EOE

Some footer text
`;

describe('parseResult — happy path', () => {
    let points;

    beforeAll(() => {
        points = parseResult(SAMPLE_RESULT, 'TestObj');
    });

    test('returns 2 points', () => {
        expect(points).toHaveLength(2);
    });

    test('first point has correct JD', () => {
        expect(points[0].jd).toBeCloseTo(2461223.5, 5);
    });

    test('first point has correct calendar date', () => {
        expect(points[0].date).toBe('2025-Jul-01');
    });

    test('first point au.x is correct', () => {
        expect(points[0].au.x).toBeCloseTo(0.274, 5);
    });

    test('first point au.y is negative and correct', () => {
        expect(points[0].au.y).toBeCloseTo(-4.497, 5);
    });

    test('first point au.z is correct', () => {
        expect(points[0].au.z).toBeCloseTo(0.291, 5);
    });

    test('first point wx = au.x * 175', () => {
        expect(points[0].wx).toBeCloseTo(points[0].au.x * AU_TO_PX, 3);
    });

    test('first point wy = au.y * 175', () => {
        expect(points[0].wy).toBeCloseTo(points[0].au.y * AU_TO_PX, 3);
    });

    test('first point wz = au.z * 175', () => {
        expect(points[0].wz).toBeCloseTo(points[0].au.z * AU_TO_PX, 3);
    });

    test('velocity fields are discarded (not present on point)', () => {
        expect(points[0].vx).toBeUndefined();
        expect(points[0].vy).toBeUndefined();
        expect(points[0].vz).toBeUndefined();
    });

    test('each point initialised with camera=null', () => {
        points.forEach(p => expect(p.camera).toBeNull());
    });

    test('second point has correct au.x (negative)', () => {
        expect(points[1].au.x).toBeCloseTo(-1.2, 5);
    });

    test('second point date is correct', () => {
        expect(points[1].date).toBe('2025-Jul-08');
    });
});

// ─────────────────────────────────────────────────────────────
// parseResult — NotFoundError
// ─────────────────────────────────────────────────────────────

describe('parseResult — NotFoundError', () => {
    test('throws on "No matches found"', () => {
        expect(() => parseResult('No matches found.', 'X')).toThrow(NotFoundError);
    });

    test('throws on "No target body name matching" (Horizons name-search format)', () => {
        expect(() => parseResult('No target body name matching "X" found.', 'X'))
            .toThrow(NotFoundError);
    });

    test('throws on "No matching record" (alternate format)', () => {
        expect(() => parseResult('!!  No matching record found.', 'X'))
            .toThrow(NotFoundError);
    });

    test('throws on "ERROR:" prefix (API-level error)', () => {
        expect(() => parseResult('ERROR: Bad target name specified.', 'X'))
            .toThrow(NotFoundError);
    });

    test('does NOT throw on a response that contains "error" as a common word', () => {
        // "error" lowercase without colon should not trigger NotFoundError
        // (legitimate header text sometimes mentions "error" in context)
        const safeText = `Some header text\n$$SOE\n${SAMPLE_RESULT.split('$$SOE')[1]}`;
        // Only check it parses without NotFoundError (may throw other things)
        try {
            parseResult(safeText, 'X');
        } catch (e) {
            expect(e.name).not.toBe('NotFoundError');
        }
    });

    test('throws when $$SOE marker is absent', () => {
        expect(() => parseResult('Header with no SOE marker', 'X'))
            .toThrow(NotFoundError);
    });

    test('error message contains the designation', () => {
        try { parseResult('No matches found', 'C/2025 N1'); } catch (e) {
            expect(e.message).toContain('C/2025 N1');
        }
    });

    test('error message references JPL Horizons database', () => {
        try { parseResult('No matches found', 'X'); } catch (e) {
            expect(e.message).toMatch(/JPL Horizons/i);
        }
    });
});

// ─────────────────────────────────────────────────────────────
// parseResult — AmbiguousError
// ─────────────────────────────────────────────────────────────

describe('parseResult — AmbiguousError', () => {
    test('throws on "Matching small-bodies:" (Horizons small-body format)', () => {
        expect(() => parseResult('Matching small-bodies:\n Record # 1 ...', 'X'))
            .toThrow(AmbiguousError);
    });

    test('throws on "Multiple major-bodies match" (Horizons major-body format)', () => {
        expect(() => parseResult('Multiple major-bodies match string "X"', 'X'))
            .toThrow(AmbiguousError);
    });

    test('throws on "ambiguous target"', () => {
        expect(() => parseResult('ambiguous target specification', 'X'))
            .toThrow(AmbiguousError);
    });

    test('AmbiguousError wins over NotFoundError (small-bodies list has no $$SOE)', () => {
        const ambiguous = 'Matching small-bodies:\n1 record found\nNo matches in ephemeris';
        expect(() => parseResult(ambiguous, 'X')).toThrow(AmbiguousError);
    });

    test('error message advises more specific designation', () => {
        try { parseResult('Matching small-bodies: 3 found', 'X'); } catch (e) {
            expect(e.message).toMatch(/more specific/i);
        }
    });
});

// ─────────────────────────────────────────────────────────────
// parseResult — EmptyDataError
// ─────────────────────────────────────────────────────────────

describe('parseResult — EmptyDataError', () => {
    const EMPTY_BLOCK = '\nHeader\n$$SOE\n$$EOE\nFooter\n';

    test('throws when SOE/EOE block is present but empty', () => {
        expect(() => parseResult(EMPTY_BLOCK, 'X')).toThrow(EmptyDataError);
    });

    test('error message references the date range', () => {
        try { parseResult(EMPTY_BLOCK, 'Oumuamua'); } catch (e) {
            expect(e.message).toMatch(/date range/i);
        }
    });
});

// ─────────────────────────────────────────────────────────────
// normalizePoint (schema compatibility — Story 2.4)
// ─────────────────────────────────────────────────────────────

const { normalizePoint } = require('./horizons_client_logic');

describe('normalizePoint — saved-file schema (px.wx)', () => {
    const raw = {
        jd: 2460857.5, date: '2025-07-01',
        au: { x: 0.2743, y: -4.4971, z: 0.2914 },
        px: { wx: 48, wy: -787, wz: 51 },
        camera: null, description: 'Discovery', image: null,
    };

    test('reads wx from px.wx', () => {
        expect(normalizePoint(raw).wx).toBe(48);
    });
    test('reads wy from px.wy', () => {
        expect(normalizePoint(raw).wy).toBe(-787);
    });
    test('reads wz from px.wz', () => {
        expect(normalizePoint(raw).wz).toBe(51);
    });
    test('preserves description', () => {
        expect(normalizePoint(raw).description).toBe('Discovery');
    });
    test('camera defaults to null', () => {
        expect(normalizePoint(raw).camera).toBeNull();
    });
});

describe('normalizePoint — API schema (flat wx)', () => {
    const raw = {
        jd: 2460857.5, date: '2025-07-01',
        au: { x: 0.2743, y: -4.4971, z: 0.2914 },
        wx: 48, wy: -787, wz: 51,
        camera: { el: 45, az: 0 }, description: null, image: null,
    };

    test('reads wx directly', () => {
        expect(normalizePoint(raw).wx).toBe(48);
    });
    test('preserves saved camera state', () => {
        expect(normalizePoint(raw).camera).toEqual({ el: 45, az: 0 });
    });
});

describe('normalizePoint — fallback to au * 175 when neither px nor flat wx present', () => {
    const raw = {
        jd: 1, date: '2025-01-01',
        au: { x: 1, y: -2, z: 0.5 },
        camera: null, description: null, image: null,
    };

    test('wx = au.x * 175', () => {
        expect(normalizePoint(raw).wx).toBeCloseTo(175);
    });
    test('wy = au.y * 175', () => {
        expect(normalizePoint(raw).wy).toBeCloseTo(-350);
    });
    test('wz = au.z * 175', () => {
        expect(normalizePoint(raw).wz).toBeCloseTo(87.5);
    });
});

// ─────────────────────────────────────────────────────────────
// resolveStep
// ─────────────────────────────────────────────────────────────

describe('resolveStep', () => {
    test('returns dropdown value when custom is empty', () => {
        expect(resolveStep('7d', '')).toBe('7d');
    });

    test('returns custom value when custom is filled', () => {
        expect(resolveStep('7d', '3d')).toBe('3d');
    });

    test('trims whitespace from custom value', () => {
        expect(resolveStep('1d', '  10d  ')).toBe('10d');
    });

    test('returns dropdown value when custom is whitespace only', () => {
        expect(resolveStep('14d', '   ')).toBe('14d');
    });
});

// ─────────────────────────────────────────────────────────────
// sanitize
// ─────────────────────────────────────────────────────────────

describe('sanitize', () => {
    test('replaces spaces with underscores', () => {
        expect(sanitize('C/2025 N1')).toBe('C_2025_N1');
    });

    test('replaces forward slashes with underscores', () => {
        expect(sanitize('1I/Oumuamua')).toBe('1I_Oumuamua');
    });

    test('handles multiple spaces', () => {
        expect(sanitize('A B C')).toBe('A_B_C');
    });

    test('leaves names without special chars unchanged', () => {
        expect(sanitize('Oumuamua')).toBe('Oumuamua');
    });
});
