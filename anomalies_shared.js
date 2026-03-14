(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.AnomaliesShared = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function trimOptionalString(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function sanitizeDesignation(name) {
        return trimOptionalString(name).replace(/[\s/]/g, '_');
    }

    function normalizeBoolean(value) {
        if (value === true || value === false) return value;
        const normalized = trimOptionalString(String(value || '')).toLowerCase();
        return ['true', '1', 'yes', 'y'].includes(normalized);
    }

    function toIsoDate(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10);
        }
        const trimmed = trimOptionalString(value);
        if (!trimmed) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toISOString().slice(0, 10);
    }

    function normalizeStoredTriggerDate(value) {
        if (value instanceof Date) return toIsoDate(value);
        const trimmed = trimOptionalString(value);
        return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
    }

    function normalizeAnomalyEntry(entry, index) {
        const source = entry && typeof entry === 'object' ? entry : {};
        return {
            index,
            dateLabel: trimOptionalString(source.dateLabel),
            triggerDate: normalizeStoredTriggerDate(source.triggerDate),
            category: trimOptionalString(source.category),
            anomaly: trimOptionalString(source.anomaly),
            probability: trimOptionalString(source.probability),
            explanation: trimOptionalString(source.explanation),
            consensusNote: trimOptionalString(source.consensusNote),
            skip: normalizeBoolean(source.skip),
        };
    }

    function normalizeDataset(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const rawEntries = Array.isArray(source.entries)
            ? source.entries.map((entry, index) => normalizeAnomalyEntry(entry, index))
            : [];
        const visibleEntries = rawEntries.filter(entry => !entry.skip && entry.triggerDate);

        return {
            title: trimOptionalString(source.title),
            subtitle: trimOptionalString(source.subtitle),
            entries: rawEntries,
            visibleEntries,
        };
    }

    function createPlaceholderDataset(designation, message) {
        return normalizeDataset({
            title: `${trimOptionalString(designation) || 'Object'} anomalies`,
            subtitle: trimOptionalString(message) || 'No anomaly entries are available yet.',
            entries: [],
        });
    }

    function getVisibleEntriesForDate(dataset, dateInput) {
        const normalized = toIsoDate(dateInput);
        if (!normalized) return [];
        const model = dataset && Array.isArray(dataset.visibleEntries)
            ? dataset
            : normalizeDataset(dataset);
        return model.visibleEntries
            .filter(entry => entry.triggerDate === normalized)
            .map(entry => ({ ...entry }));
    }

    function cloneState(state) {
        return {
            activeDate: state.activeDate,
            pendingEntries: state.pendingEntries.map(entry => ({ ...entry })),
            revealedEntries: state.revealedEntries.map(entry => ({ ...entry })),
        };
    }

    function createDateQueueController(datasetInput) {
        let dataset = normalizeDataset(datasetInput);
        let state = {
            activeDate: '',
            pendingEntries: [],
            revealedEntries: [],
        };

        return {
            setDataset(nextDataset) {
                dataset = normalizeDataset(nextDataset);
                state = {
                    activeDate: '',
                    pendingEntries: [],
                    revealedEntries: [],
                };
                return cloneState(state);
            },
            getDataset() {
                return dataset;
            },
            applyDate(dateInput) {
                const activeDate = toIsoDate(dateInput);
                state = {
                    activeDate,
                    pendingEntries: getVisibleEntriesForDate(dataset, activeDate),
                    revealedEntries: [],
                };
                return cloneState(state);
            },
            replaceState(nextState) {
                const source = nextState && typeof nextState === 'object' ? nextState : {};
                state = {
                    activeDate: toIsoDate(source.activeDate),
                    pendingEntries: Array.isArray(source.pendingEntries)
                        ? source.pendingEntries.map(entry => ({ ...entry }))
                        : [],
                    revealedEntries: Array.isArray(source.revealedEntries)
                        ? source.revealedEntries.map(entry => ({ ...entry }))
                        : [],
                };
                return cloneState(state);
            },
            revealNext() {
                if (!state.pendingEntries.length) {
                    return {
                        entry: null,
                        state: cloneState(state),
                    };
                }

                const nextEntry = state.pendingEntries[0];
                state = {
                    activeDate: state.activeDate,
                    pendingEntries: state.pendingEntries.slice(1),
                    revealedEntries: [...state.revealedEntries, nextEntry],
                };
                return {
                    entry: { ...nextEntry },
                    state: cloneState(state),
                };
            },
            getState() {
                return cloneState(state);
            },
        };
    }

    return {
        trimOptionalString,
        sanitizeDesignation,
        normalizeBoolean,
        toIsoDate,
        normalizeStoredTriggerDate,
        normalizeAnomalyEntry,
        normalizeDataset,
        createPlaceholderDataset,
        getVisibleEntriesForDate,
        createDateQueueController,
    };
});
