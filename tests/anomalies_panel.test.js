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

    test('localizes the combined probability line for Hebrew', () => {
        global.document = {
            location: { search: '?lang=he' },
            readyState: 'loading',
            addEventListener() {},
        };
        global.AppTranslations = {
            getLocaleFromSearch() {
                return 'he';
            },
            translate(sourceText, options) {
                if (sourceText === 'Combined probability: 1 out of {{n}}') {
                    return `הסתברות משולבת: 1 מתוך ${options.params.n}`;
                }
                return options.fallback;
            },
        };

        jest.resetModules();
        const { formatCombinedProbabilityLine: formatHebrewCombinedProbabilityLine } = require('../anomalies_panel');

        expect(formatHebrewCombinedProbabilityLine([
            { probability: 'P = 0.002' },
            { probability: 'P < 0.001' },
        ])).toBe('הסתברות משולבת: 1 מתוך 500,000');

        delete global.document;
        delete global.AppTranslations;
        jest.resetModules();
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
        expect(buildStandaloneHref('3I', 'he')).toBe('anomalies_panel?designation=3I&lang=he');
        expect(buildStandaloneHref('')).toBe('anomalies_panel');
    });

    test('localizes dataset copy through AppTranslations when available', () => {
        global.AppTranslations = {
            translate(sourceText, fallback) {
                if (sourceText === 'Original title') return 'כותרת';
                if (sourceText === 'Original subtitle') return 'כותרת משנה';
                if (sourceText === 'No P yet') return 'עדיין אין הסתברות';
                if (sourceText === 'Original anomaly') return 'אנומליה מתורגמת';
                return fallback;
            },
        };

        jest.resetModules();
        const { localizeDatasetCopy } = require('../anomalies_panel');

        expect(localizeDatasetCopy({
            title: 'Original title',
            subtitle: 'Original subtitle',
            entries: [
                { triggerDate: '2025-10-31', anomaly: 'Original anomaly', probability: 'No P yet' },
            ],
        })).toEqual({
            title: 'כותרת',
            subtitle: 'כותרת משנה',
            entries: [
                {
                    index: 0,
                    dateLabel: '',
                    triggerDate: '2025-10-31',
                    category: '',
                    anomaly: 'אנומליה מתורגמת',
                    probability: 'עדיין אין הסתברות',
                    explanation: '',
                    consensusNote: '',
                    skip: false,
                },
            ],
            visibleEntries: [
                {
                    index: 0,
                    dateLabel: '',
                    triggerDate: '2025-10-31',
                    category: '',
                    anomaly: 'אנומליה מתורגמת',
                    probability: 'עדיין אין הסתברות',
                    explanation: '',
                    consensusNote: '',
                    skip: false,
                },
            ],
        });

        delete global.AppTranslations;
        jest.resetModules();
    });
});
