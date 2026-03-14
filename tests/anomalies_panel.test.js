'use strict';

const {
    buildAnomaliesPath,
    hasRevealableProbability,
    parseProbabilityValue,
    formatCombinedProbabilityLine,
    buildPlayButtonModel,
    buildEmptyStateMessage,
    getTypewriterStepSize,
    getTypewriterDelayMs,
    createUnavailableDataset,
    buildStandaloneHref,
} = require('../anomalies_panel');

describe('anomalies_panel', () => {
    test('builds object-scoped anomalies data paths', () => {
        expect(buildAnomaliesPath('C/2025 N1')).toEqual({
            sanitizedName: 'C_2025_N1',
            path: 'data/C_2025_N1/anomalies.json',
        });
    });

    test('shows the play button only when there is an unrevealed anomaly step', () => {
        expect(buildPlayButtonModel({
            activeDate: '',
            pendingEntries: [],
            revealedEntries: [],
        }, false)).toEqual({
            visible: false,
            disabled: false,
            label: 'Play',
        });

        expect(buildPlayButtonModel({
            activeDate: '2025-10-31',
            pendingEntries: [],
            revealedEntries: [{ anomaly: 'One' }],
        }, true)).toEqual({
            visible: true,
            disabled: false,
            label: 'Play',
        });

        expect(buildPlayButtonModel({
            activeDate: '2025-10-31',
            pendingEntries: [{ anomaly: 'One' }, { anomaly: 'Two' }],
            revealedEntries: [],
        }, false)).toEqual({
            visible: true,
            disabled: false,
            label: 'Play',
        });
    });

    test('builds inline empty-state copy without the removed status box', () => {
        expect(buildEmptyStateMessage({
            title: '3I anomalies',
            subtitle: 'Placeholder',
            entries: [],
            visibleEntries: [],
        }, {
            activeDate: '',
            pendingEntries: [],
            revealedEntries: [],
        })).toBe('Placeholder');

        expect(buildEmptyStateMessage({
            title: '3I anomalies',
            subtitle: 'Loaded',
            entries: [{ triggerDate: '2025-07-01', anomaly: 'One' }, { triggerDate: '2025-10-31', anomaly: 'Two' }],
            visibleEntries: [{ triggerDate: '2025-07-01', anomaly: 'One' }, { triggerDate: '2025-10-31', anomaly: 'Two' }],
        }, {
            activeDate: '',
            pendingEntries: [],
            revealedEntries: [],
        })).toBe('Waiting for the active trajectory date.');

        expect(buildEmptyStateMessage({
            title: '3I anomalies',
            subtitle: 'Loaded',
            entries: [{ triggerDate: '2025-10-31', anomaly: 'One' }],
            visibleEntries: [{ triggerDate: '2025-10-31', anomaly: 'One' }],
        }, {
            activeDate: '2025-10-31',
            pendingEntries: [{ anomaly: 'One' }],
            revealedEntries: [],
        })).toBe('Press Play to reveal anomalies for this date.');

        expect(buildEmptyStateMessage({
            title: '3I anomalies',
            subtitle: 'Loaded',
            entries: [{ triggerDate: '2025-10-31', anomaly: 'One' }],
            visibleEntries: [{ triggerDate: '2025-10-31', anomaly: 'One' }],
        }, {
            activeDate: '2025-10-31',
            pendingEntries: [],
            revealedEntries: [],
        })).toBe('All visible anomalies for 2025-10-31 are already shown.');
    });

    test('detects whether a revealed row still has a probability step', () => {
        expect(hasRevealableProbability({ probability: 'P < 0.01' })).toBe(true);
        expect(hasRevealableProbability({ probability: '  ' })).toBe(false);
        expect(hasRevealableProbability({ probability: '—' })).toBe(false);
    });

    test('parses probability strings and builds a combined probability line', () => {
        expect(parseProbabilityValue('P = 0.002')).toBe(0.002);
        expect(parseProbabilityValue('P < 0.001')).toBe(0.001);
        expect(parseProbabilityValue('No P yet')).toBeNull();

        expect(formatCombinedProbabilityLine([
            { probability: 'P = 0.002' },
            { probability: 'P < 0.001' },
        ])).toBe('Combined probability: 1 out of 500,000');
    });

    test('keeps typewriter pacing presentation-friendly', () => {
        expect(getTypewriterStepSize(20)).toBe(1);
        expect(getTypewriterStepSize(100)).toBe(2);
        expect(getTypewriterDelayMs(20)).toBe(52);
        expect(getTypewriterDelayMs(170)).toBe(34);
    });

    test('builds placeholder datasets and standalone hrefs', () => {
        expect(createUnavailableDataset('3I', { code: 'not-found' })).toEqual({
            title: '3I anomalies',
            subtitle: "No anomaly dataset was found for '3I'.",
            entries: [],
            visibleEntries: [],
        });

        expect(buildStandaloneHref('3I')).toBe('anomalies_panel?designation=3I');
        expect(buildStandaloneHref('')).toBe('anomalies_panel');
    });
});
