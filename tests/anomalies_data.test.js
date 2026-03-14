'use strict';

const anomalies = require('../data/3I/anomalies.json');

describe('anomalies data seed', () => {
    test('provides the expected top-level schema', () => {
        expect(anomalies).toEqual({
            title: expect.any(String),
            subtitle: expect.any(String),
            entries: expect.any(Array),
        });
    });

    test('imports all anomaly rows from the CSV with preserved header copy', () => {
        expect(anomalies.title).toBe('3I/ATLAS — Anomalies Organized by Likelihood');
        expect(anomalies.subtitle).toContain('Source: Avi Loeb, Medium');
        expect(anomalies.entries).toHaveLength(18);
        expect(anomalies.entries.filter(entry => entry.skip)).toHaveLength(7);
    });

    test('keeps every entry in the expected anomaly schema', () => {
        for (const entry of anomalies.entries) {
            expect(entry).toEqual({
                dateLabel: expect.any(String),
                triggerDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                category: expect.any(String),
                anomaly: expect.any(String),
                probability: expect.any(String),
                explanation: expect.any(String),
                consensusNote: expect.any(String),
                skip: expect.any(Boolean),
            });
        }
    });

    test('stores explicit trigger dates for mixed-format source labels', () => {
        expect(anomalies.entries[0]).toMatchObject({
            dateLabel: 'Jul 01 2025',
            triggerDate: '2025-07-01',
            anomaly: 'Retrograde orbit aligned within 5° of ecliptic plane',
            skip: false,
        });

        expect(anomalies.entries[7]).toMatchObject({
            dateLabel: 'Aug–Sep 2025',
            triggerDate: '2025-08-01',
            anomaly: 'Only 4% water in gas plume',
            skip: true,
        });

        expect(anomalies.entries[13]).toMatchObject({
            dateLabel: 'Nov 16, 2025 obs → reported Jan 26, 2026 (Keck)',
            triggerDate: '2025-11-16',
            probability: 'P — no P yet',
        });
    });
});
