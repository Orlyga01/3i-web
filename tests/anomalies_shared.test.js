'use strict';

const {
    normalizeAnomalyEntry,
    normalizeDataset,
    getVisibleEntriesForDate,
    createDateQueueController,
} = require('../anomalies_shared');

describe('anomalies_shared', () => {
    test('normalizes entries and preserves skip rows in the raw dataset', () => {
        const entry = normalizeAnomalyEntry({
            dateLabel: 'Late Oct 2025',
            triggerDate: '2025-10-31',
            category: 'Orbital',
            anomaly: 'Rapid brightening window',
            probability: 'High',
            explanation: 'Dust production spikes',
            consensusNote: 'Multiple observers agree',
            skip: 'true',
        }, 4);

        expect(entry).toEqual({
            index: 4,
            dateLabel: 'Late Oct 2025',
            triggerDate: '2025-10-31',
            category: 'Orbital',
            anomaly: 'Rapid brightening window',
            probability: 'High',
            explanation: 'Dust production spikes',
            consensusNote: 'Multiple observers agree',
            skip: true,
        });
    });

    test('builds visible entries without skip rows', () => {
        const dataset = normalizeDataset({
            title: '3I anomalies',
            subtitle: 'Working draft',
            entries: [
                { triggerDate: '2025-10-31', anomaly: 'Visible row', probability: 'Medium' },
                { triggerDate: '2025-10-31', anomaly: 'Skipped row', probability: 'Low', skip: true },
                { triggerDate: '2025-11-13', anomaly: 'Later row', probability: 'High' },
            ],
        });

        expect(dataset.entries).toHaveLength(3);
        expect(dataset.visibleEntries.map(entry => entry.anomaly)).toEqual(['Visible row', 'Later row']);
    });

    test('returns all visible entries matching a trigger date', () => {
        const dataset = normalizeDataset({
            entries: [
                { triggerDate: '2025-10-31', anomaly: 'One', probability: 'Medium' },
                { triggerDate: '2025-10-31', anomaly: 'Two', probability: 'High' },
                { triggerDate: '2025-11-01', anomaly: 'Three', probability: 'Low' },
            ],
        });

        expect(getVisibleEntriesForDate(dataset, '2025-10-31').map(entry => entry.anomaly)).toEqual(['One', 'Two']);
        expect(getVisibleEntriesForDate(dataset, '2025-12-01')).toEqual([]);
    });

    test('date queue controller resets and reveals one row at a time', () => {
        const controller = createDateQueueController({
            entries: [
                { triggerDate: '2025-10-31', anomaly: 'One', probability: 'Medium' },
                { triggerDate: '2025-10-31', anomaly: 'Two', probability: 'High' },
                { triggerDate: '2025-11-01', anomaly: 'Three', probability: 'Low' },
            ],
        });

        expect(controller.applyDate('2025-10-31')).toEqual({
            activeDate: '2025-10-31',
            pendingEntries: [
                {
                    index: 0,
                    dateLabel: '',
                    triggerDate: '2025-10-31',
                    category: '',
                    anomaly: 'One',
                    probability: 'Medium',
                    explanation: '',
                    consensusNote: '',
                    skip: false,
                },
                {
                    index: 1,
                    dateLabel: '',
                    triggerDate: '2025-10-31',
                    category: '',
                    anomaly: 'Two',
                    probability: 'High',
                    explanation: '',
                    consensusNote: '',
                    skip: false,
                },
            ],
            revealedEntries: [],
        });

        const firstReveal = controller.revealNext();
        expect(firstReveal.entry.anomaly).toBe('One');
        expect(firstReveal.state.revealedEntries).toHaveLength(1);
        expect(firstReveal.state.pendingEntries).toHaveLength(1);

        const secondReveal = controller.revealNext();
        expect(secondReveal.entry.anomaly).toBe('Two');
        expect(secondReveal.state.revealedEntries).toHaveLength(2);
        expect(secondReveal.state.pendingEntries).toHaveLength(0);

        expect(controller.revealNext()).toEqual({
            entry: null,
            state: {
                activeDate: '2025-10-31',
                pendingEntries: [],
                revealedEntries: [
                    {
                        index: 0,
                        dateLabel: '',
                        triggerDate: '2025-10-31',
                        category: '',
                        anomaly: 'One',
                        probability: 'Medium',
                        explanation: '',
                        consensusNote: '',
                        skip: false,
                    },
                    {
                        index: 1,
                        dateLabel: '',
                        triggerDate: '2025-10-31',
                        category: '',
                        anomaly: 'Two',
                        probability: 'High',
                        explanation: '',
                        consensusNote: '',
                        skip: false,
                    },
                ],
            },
        });
    });

    test('date queue controller can replace queue state after date filtering', () => {
        const controller = createDateQueueController({
            entries: [
                { triggerDate: '2025-10-31', anomaly: 'One', probability: 'Medium' },
                { triggerDate: '2025-10-31', anomaly: 'Two', probability: 'High' },
            ],
        });

        controller.applyDate('2025-10-31');
        expect(controller.replaceState({
            activeDate: '2025-10-31',
            pendingEntries: [{ triggerDate: '2025-10-31', anomaly: 'Two', probability: 'High' }],
            revealedEntries: [],
        })).toEqual({
            activeDate: '2025-10-31',
            pendingEntries: [{ triggerDate: '2025-10-31', anomaly: 'Two', probability: 'High' }],
            revealedEntries: [],
        });
    });
});
