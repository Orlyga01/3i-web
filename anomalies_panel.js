(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        const api = factory(require('./anomalies_shared'));
        module.exports = api;
        return;
    }
    const api = factory(root.AnomaliesShared || {});
    root.AnomaliesPanel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (AnomaliesShared) {
    'use strict';

    const normalizeDataset = typeof AnomaliesShared.normalizeDataset === 'function'
        ? AnomaliesShared.normalizeDataset
        : payload => payload || { title: '', subtitle: '', entries: [], visibleEntries: [] };
    const createPlaceholderDataset = typeof AnomaliesShared.createPlaceholderDataset === 'function'
        ? AnomaliesShared.createPlaceholderDataset
        : (designation, message) => ({
            title: `${designation || 'Object'} anomalies`,
            subtitle: message || 'No anomaly entries are available yet.',
            entries: [],
            visibleEntries: [],
        });
    const createDateQueueController = typeof AnomaliesShared.createDateQueueController === 'function'
        ? AnomaliesShared.createDateQueueController
        : () => ({
            setDataset() {
                return { activeDate: '', pendingEntries: [], revealedEntries: [] };
            },
            applyDate() {
                return { activeDate: '', pendingEntries: [], revealedEntries: [] };
            },
            revealNext() {
                return { entry: null, state: { activeDate: '', pendingEntries: [], revealedEntries: [] } };
            },
            getState() {
                return { activeDate: '', pendingEntries: [], revealedEntries: [] };
            },
        });
    const sanitizeDesignation = typeof AnomaliesShared.sanitizeDesignation === 'function'
        ? AnomaliesShared.sanitizeDesignation
        : value => String(value || '').trim().replace(/[\s/]/g, '_');
    const toIsoDate = typeof AnomaliesShared.toIsoDate === 'function'
        ? AnomaliesShared.toIsoDate
        : value => {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
        };

    class AnomaliesLoadError extends Error {
        constructor(code, message, details = {}) {
            super(message);
            this.name = 'AnomaliesLoadError';
            this.code = code;
            this.details = details;
        }
    }

    function readDesignationFromUrl(search = '') {
        const params = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
        return String(params.get('designation') ?? params.get('d') ?? '').trim();
    }

    function buildAnomaliesPath(designation) {
        const sanitizedName = sanitizeDesignation(designation);
        return {
            sanitizedName,
            path: `data/${sanitizedName}/anomalies.json`,
        };
    }

    function createUnavailableDataset(designation, error) {
        const messages = {
            'missing-designation': 'Choose a designation to load anomaly data.',
            'not-found': `No anomaly dataset was found for '${designation}'.`,
            'invalid-json': `The anomaly dataset for '${designation}' could not be read.`,
            'network': 'Could not load anomaly data right now. Try again in a moment.',
        };
        return createPlaceholderDataset(designation, messages[error?.code] || 'Anomaly data is currently unavailable.');
    }

    async function loadAnomaliesDataset(designation, options = {}) {
        if (!String(designation || '').trim()) {
            throw new AnomaliesLoadError(
                'missing-designation',
                'Enter a designation to load anomaly data.'
            );
        }

        const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        if (!fetchImpl) {
            throw new AnomaliesLoadError(
                'network',
                'Fetch is unavailable in this environment.'
            );
        }

        const target = buildAnomaliesPath(designation);
        let response;
        try {
            response = await fetchImpl(target.path, { cache: 'no-store' });
        } catch (_) {
            throw new AnomaliesLoadError(
                'network',
                'Could not load anomaly data right now. Try again in a moment.',
                target
            );
        }

        if (!response.ok) {
            if (response.status === 404) {
                throw new AnomaliesLoadError(
                    'not-found',
                    `No anomaly dataset was found for '${designation}'.`,
                    { ...target, status: response.status }
                );
            }
            throw new AnomaliesLoadError(
                'network',
                'Could not load anomaly data right now. Try again in a moment.',
                { ...target, status: response.status }
            );
        }

        let payload;
        try {
            payload = JSON.parse(await response.text());
        } catch (_) {
            throw new AnomaliesLoadError(
                'invalid-json',
                `The anomaly dataset for '${designation}' could not be read.`,
                target
            );
        }

        return normalizeDataset(payload);
    }

    function hasRevealableProbability(entry) {
        const value = typeof entry?.probability === 'string' ? entry.probability.trim() : '';
        return Boolean(value && value !== '—');
    }

    function parseProbabilityValue(value) {
        const raw = typeof value === 'string' ? value.trim() : '';
        const match = raw.match(/(\d+(?:\.\d+)?(?:e-\d+)?)/i);
        if (!match) return null;
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function formatCombinedProbabilityLine(entries) {
        const revealedEntries = Array.isArray(entries) ? entries : [];
        if (revealedEntries.length <= 1) return '';

        const parsedValues = revealedEntries
            .map(entry => parseProbabilityValue(entry?.probability))
            .filter(value => Number.isFinite(value) && value > 0);

        if (!parsedValues.length) return '';

        const combinedProbability = parsedValues.reduce((product, value) => product * value, 1);
        if (!Number.isFinite(combinedProbability) || combinedProbability <= 0) return '';

        const denominator = Math.max(1, Math.round(1 / combinedProbability));
        return `Combined probability: 1 out of ${denominator.toLocaleString('en-US')}`;
    }

    function getEntryKey(entry) {
        return JSON.stringify({
            index: entry?.index ?? -1,
            triggerDate: entry?.triggerDate || '',
            anomaly: entry?.anomaly || '',
        });
    }

    function buildPlayButtonModel(state, hasExtraPlayStep = false) {
        const pendingCount = state?.pendingEntries?.length || 0;
        return {
            visible: Boolean(hasExtraPlayStep || pendingCount > 0),
            disabled: false,
            label: 'Play',
        };
    }

    function buildEmptyStateMessage(dataset, state) {
        const model = normalizeDataset(dataset);
        const queueState = state || { activeDate: '', pendingEntries: [], revealedEntries: [] };
        const activeDate = queueState.activeDate || '';
        const hasVisibleRows = Boolean(model.visibleEntries?.length);
        const hasQueuedRows = Boolean((queueState.pendingEntries?.length || 0) + (queueState.revealedEntries?.length || 0));

        if (!model.entries.length) {
            return model.subtitle || 'No anomaly entries are available yet.';
        }
        if (!activeDate) {
            return hasVisibleRows ? 'Waiting for the active trajectory date.' : 'No visible anomaly rows are available.';
        }
        if (!hasQueuedRows) {
            const visibleMatchesForDate = model.visibleEntries.filter(entry => entry.triggerDate === activeDate).length;
            if (visibleMatchesForDate) {
                return `All visible anomalies for ${activeDate} are already shown.`;
            }
            return `No visible anomalies for ${activeDate}.`;
        }
        return 'Press Play to reveal anomalies for this date.';
    }

    function getTypewriterStepSize(length) {
        if (length > 160) return 3;
        if (length > 90) return 2;
        return 1;
    }

    function getTypewriterDelayMs(length) {
        if (length > 160) return 34;
        if (length > 90) return 40;
        if (length > 45) return 46;
        return 52;
    }

    class AnomaliesPanelController {
        constructor(root, options = {}) {
            this.root = root;
            this.options = options;
            this.dataset = normalizeDataset(options.dataset || createPlaceholderDataset(options.designation || '', 'No anomaly data loaded yet.'));
            this.queueController = createDateQueueController(this.dataset);
            this.typewriterTimers = [];
            this.activeTypewriterTarget = null;
            this.activeTypewriterText = '';
            this.pendingProbabilityReveal = null;
            this.revealedEntryKeys = new Set();
            this.displayedEntriesByDate = new Map();
            this.shownCombinedDates = new Set();

            if (!this.root) return;

            this.root.classList.add('anp-root');
            this.root.innerHTML = `
                <div class="anp-panel">
                    <button class="anp-tab" type="button" aria-expanded="false" aria-label="Toggle anomalies panel">
                        <span class="anp-tab-title">Anomalies</span>
                        <span class="anp-tab-alert" aria-hidden="true"></span>
                    </button>
                    <div class="anp-shell">
                        <div class="anp-header">
                            <div class="anp-kicker">Date-Driven Narrative</div>
                            <div class="anp-title"></div>
                            <div class="anp-subtitle"></div>
                        </div>
                        <div class="anp-table-wrap">
                            <table class="anp-table" aria-live="polite">
                                <thead>
                                    <tr>
                                        <th>Anomaly</th>
                                        <th>Probability</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                            <div class="anp-empty"></div>
                        </div>
                        <div class="anp-footer">
                            <button class="anp-play-btn" type="button">Play</button>
                        </div>
                    </div>
                </div>
            `;

            this.panelEl = this.root.querySelector('.anp-panel');
            this.tabBtn = this.root.querySelector('.anp-tab');
            this.tabAlertEl = this.root.querySelector('.anp-tab-alert');
            this.titleEl = this.root.querySelector('.anp-title');
            this.subtitleEl = this.root.querySelector('.anp-subtitle');
            this.tableWrapEl = this.root.querySelector('.anp-table-wrap');
            this.tbodyEl = this.root.querySelector('.anp-table tbody');
            this.emptyEl = this.root.querySelector('.anp-empty');
            this.playBtn = this.root.querySelector('.anp-play-btn');

            this.tabBtn?.addEventListener('click', () => this.toggleCollapsed());
            this.playBtn?.addEventListener('click', () => this.playQueueStep());

            this.setCollapsed(options.initialCollapsed !== false);
            this.queueController.setDataset(this.dataset);
            this.renderState();
        }

        setCollapsed(collapsed) {
            if (!this.panelEl || !this.tabBtn) return;
            this.panelEl.classList.toggle('is-collapsed', Boolean(collapsed));
            this.tabBtn.setAttribute('aria-expanded', String(!collapsed));
        }

        toggleCollapsed() {
            if (!this.panelEl) return;
            this.setCollapsed(!this.panelEl.classList.contains('is-collapsed'));
        }

        setDataset(dataset) {
            this.stopTypewriter();
            this.dataset = normalizeDataset(dataset);
            this.queueController.setDataset(this.dataset);
            this.clearRows();
            this.renderState();
            return this.dataset;
        }

        getDataset() {
            return this.dataset;
        }

        getState() {
            return this.queueController.getState();
        }

        clearRows() {
            if (this.tbodyEl) this.tbodyEl.innerHTML = '';
            this.pendingProbabilityReveal = null;
            this.revealedEntryKeys = new Set();
            this.displayedEntriesByDate = new Map();
            this.shownCombinedDates = new Set();
        }

        applyDate(dateInput) {
            this.stopTypewriter();
            this.pendingProbabilityReveal = null;
            const state = this.queueController.applyDate(dateInput);
            const filteredPendingEntries = state.pendingEntries.filter(entry => !this.revealedEntryKeys.has(getEntryKey(entry)));
            this.queueController.replaceState({
                activeDate: state.activeDate,
                pendingEntries: filteredPendingEntries,
                revealedEntries: [],
            });
            this.renderState();
            return this.queueController.getState();
        }

        revealNext() {
            const result = this.queueController.revealNext();
            if (result.entry) {
                this.appendEntryRow(result.entry);
            }
            this.renderState();
            return result;
        }

        hasPendingPlayStep() {
            const state = this.queueController.getState();
            return Boolean(
                this.pendingProbabilityReveal ||
                (state.pendingEntries?.length || 0) ||
                this.getCombinedProbabilityLine(state)
            );
        }

        playQueueStep() {
            if (this.pendingProbabilityReveal) {
                this.revealPendingProbability();
                this.renderState();
                return { kind: 'probability' };
            }

            const stateBeforeReveal = this.queueController.getState();
            const combinedProbabilityLine = this.getCombinedProbabilityLine(stateBeforeReveal);
            if (combinedProbabilityLine) {
                this.appendCombinedProbabilityRow(combinedProbabilityLine);
                this.combinedProbabilityShown = true;
                this.renderState();
                return { kind: 'combined-probability', text: combinedProbabilityLine };
            }

            const result = this.queueController.revealNext();
            if (result.entry) {
                this.appendEntryRow(result.entry);
            }
            this.renderState();
            return result;
        }

        revealPendingProbability() {
            if (!this.pendingProbabilityReveal?.cell) return;
            this.pendingProbabilityReveal.cell.textContent = this.pendingProbabilityReveal.value;
            this.pendingProbabilityReveal.cell.classList.add('is-visible');
            this.pendingProbabilityReveal = null;
            this.scrollTableToBottom();
        }

        getCombinedProbabilityLine(state = this.queueController.getState()) {
            if (this.pendingProbabilityReveal) return '';
            if (state?.pendingEntries?.length) return '';
            const activeDate = state?.activeDate || '';
            if (!activeDate || this.shownCombinedDates.has(activeDate)) return '';
            return formatCombinedProbabilityLine(this.displayedEntriesByDate.get(activeDate) || []);
        }

        appendCombinedProbabilityRow(text) {
            if (!this.tbodyEl || typeof document === 'undefined' || !text) return;

            const row = document.createElement('tr');
            row.className = 'anp-row anp-combined-row is-visible';

            const cell = document.createElement('td');
            cell.className = 'anp-probability-cell anp-combined-cell is-visible';
            cell.colSpan = 2;
            cell.textContent = text;

            row.appendChild(cell);
            this.tbodyEl.appendChild(row);
            const activeDate = this.queueController.getState().activeDate || '';
            if (activeDate) this.shownCombinedDates.add(activeDate);
            this.scrollTableToBottom();
        }

        appendEntryRow(entry) {
            if (!this.tbodyEl || typeof document === 'undefined') return;
            const entryKey = getEntryKey(entry);
            if (this.revealedEntryKeys.has(entryKey)) return;

            const row = document.createElement('tr');
            row.className = 'anp-row';

            const anomalyCell = document.createElement('td');
            anomalyCell.className = 'anp-anomaly-cell';
            const anomalyText = document.createElement('span');
            anomalyText.className = 'anp-typewriter';
            anomalyCell.appendChild(anomalyText);

            const probabilityCell = document.createElement('td');
            probabilityCell.className = 'anp-probability-cell';
            probabilityCell.textContent = '';

            row.appendChild(anomalyCell);
            row.appendChild(probabilityCell);
            this.tbodyEl.appendChild(row);

            requestAnimationFrame(() => row.classList.add('is-visible'));
            this.playTypewriter(anomalyText, entry.anomaly || '');
            this.revealedEntryKeys.add(entryKey);
            const dateKey = entry.triggerDate || '';
            const displayedEntries = this.displayedEntriesByDate.get(dateKey) || [];
            displayedEntries.push({ ...entry });
            this.displayedEntriesByDate.set(dateKey, displayedEntries);

            if (hasRevealableProbability(entry)) {
                this.pendingProbabilityReveal = {
                    cell: probabilityCell,
                    value: entry.probability.trim(),
                };
            }
            this.scrollTableToBottom();
        }

        playTypewriter(target, text) {
            this.stopTypewriter();
            if (!target) return;

            const value = String(text || '');
            this.activeTypewriterTarget = target;
            this.activeTypewriterText = value;
            target.textContent = '';
            if (!value) return;

            let index = 0;
            const stepSize = getTypewriterStepSize(value.length);
            const delayMs = getTypewriterDelayMs(value.length);
            const tick = () => {
                index = Math.min(value.length, index + stepSize);
                target.textContent = value.slice(0, index);
                if (index >= value.length) {
                    this.activeTypewriterTarget = null;
                    this.activeTypewriterText = '';
                    return;
                }
                const timerId = setTimeout(tick, delayMs);
                this.typewriterTimers.push(timerId);
            };

            tick();
        }

        stopTypewriter(completeActive = true) {
            if (completeActive && this.activeTypewriterTarget) {
                this.activeTypewriterTarget.textContent = this.activeTypewriterText;
            }
            while (this.typewriterTimers.length) {
                clearTimeout(this.typewriterTimers.pop());
            }
            this.activeTypewriterTarget = null;
            this.activeTypewriterText = '';
        }

        scrollTableToBottom() {
            const scrollEl = this.tableWrapEl || this.tbodyEl;
            if (!scrollEl) return;
            requestAnimationFrame(() => {
                const currentScrollEl = this.tableWrapEl || this.tbodyEl;
                if (!currentScrollEl) return;
                currentScrollEl.scrollTop = currentScrollEl.scrollHeight;
            });
        }

        renderState() {
            if (!this.root) return;

            const state = this.queueController.getState();
            const playButton = buildPlayButtonModel(
                state,
                Boolean(this.pendingProbabilityReveal || this.getCombinedProbabilityLine(state))
            );

            if (this.titleEl) {
                this.titleEl.textContent = this.dataset.title || 'Object anomalies';
            }
            if (this.subtitleEl) {
                this.subtitleEl.textContent = this.dataset.subtitle || 'Date-driven anomaly reveal panel';
            }
            if (this.playBtn) {
                this.playBtn.disabled = playButton.disabled;
                this.playBtn.textContent = playButton.label;
                this.playBtn.style.display = playButton.visible ? 'inline-flex' : 'none';
            }
            if (this.tabBtn) {
                this.tabBtn.classList.toggle('has-pending-play', playButton.visible);
            }
            if (this.tabAlertEl) {
                this.tabAlertEl.style.display = playButton.visible ? 'block' : 'none';
            }
            if (this.emptyEl) {
                const hasRows = Boolean(this.tbodyEl?.childElementCount);
                this.emptyEl.style.display = hasRows ? 'none' : 'block';
                this.emptyEl.textContent = hasRows ? '' : buildEmptyStateMessage(this.dataset, state);
            }
        }
    }

    function createPanelController(root, options = {}) {
        return new AnomaliesPanelController(root, options);
    }

    function buildStandaloneHref(designation) {
        const params = new URLSearchParams();
        if (String(designation || '').trim()) {
            params.set('designation', String(designation).trim());
        }
        const suffix = params.toString();
        return suffix ? `anomalies_panel?${suffix}` : 'anomalies_panel';
    }

    function setStandaloneStatus(text, isError = false) {
        const el = typeof document !== 'undefined' ? document.getElementById('anp-page-status') : null;
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('is-error', Boolean(isError));
    }

    function shouldIgnorePanelShortcutTarget(target) {
        if (!target || typeof target !== 'object') return false;
        if (target.isContentEditable) return true;
        const tagName = String(target.tagName || '').toUpperCase();
        if (tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
        if (tagName !== 'INPUT') return false;
        const type = String(target.type || '').toLowerCase();
        return ['text', 'search', 'url', 'tel', 'email', 'password', 'number', 'date'].includes(type);
    }

    async function bootstrapStandalonePage() {
        if (typeof document === 'undefined') return;
        const pageRoot = document.getElementById('anp-page');
        if (!pageRoot) return;

        const panelRoot = document.getElementById('anp-panel-root');
        const designationInput = document.getElementById('anp-designation-input');
        const dateInput = document.getElementById('anp-date-input');
        const loadBtn = document.getElementById('anp-load-btn');
        const applyBtn = document.getElementById('anp-apply-date-btn');
        const panel = createPanelController(panelRoot, {
            initialCollapsed: false,
            designation: designationInput?.value || readDesignationFromUrl(),
        });

        async function loadCurrentDesignation() {
            const designation = String(designationInput?.value || '').trim();
            if (!designation) {
                panel.setDataset(createUnavailableDataset('', new AnomaliesLoadError('missing-designation', '')));
                setStandaloneStatus('Enter a designation to load anomaly data.', true);
                return;
            }

            setStandaloneStatus(`Loading anomaly data for ${designation}…`, false);

            try {
                const dataset = await loadAnomaliesDataset(designation);
                panel.setDataset(dataset);
                if (typeof history !== 'undefined' && history.replaceState) {
                    history.replaceState(null, '', buildStandaloneHref(designation));
                }
                setStandaloneStatus(
                    dataset.entries.length
                        ? `Loaded ${dataset.entries.length} anomaly row${dataset.entries.length === 1 ? '' : 's'} for ${designation}.`
                        : `Loaded ${designation}, but the dataset currently has no rows.`
                );
            } catch (error) {
                panel.setDataset(createUnavailableDataset(designation, error));
                setStandaloneStatus(error.message, true);
            }

            if (dateInput?.value) {
                panel.applyDate(dateInput.value);
            }
        }

        function applyCurrentDate() {
            const value = String(dateInput?.value || '').trim();
            panel.applyDate(value);
            if (value) {
                setStandaloneStatus(`Applied test date ${toIsoDate(value) || value}.`, false);
            }
        }

        loadBtn?.addEventListener('click', () => {
            loadCurrentDesignation();
        });
        applyBtn?.addEventListener('click', () => {
            applyCurrentDate();
        });
        dateInput?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyCurrentDate();
            }
        });
        designationInput?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                loadCurrentDesignation();
            }
        });
        document.addEventListener('keydown', event => {
            if (event.code !== 'Space' || shouldIgnorePanelShortcutTarget(event.target) || !panel.hasPendingPlayStep()) {
                return;
            }
            event.preventDefault();
            panel.playQueueStep();
        });

        if (String(designationInput?.value || '').trim()) {
            loadCurrentDesignation();
        } else {
            panel.setDataset(createUnavailableDataset('', new AnomaliesLoadError('missing-designation', '')));
            setStandaloneStatus('Enter a designation to load anomaly data.', false);
        }
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootstrapStandalonePage, { once: true });
        } else {
            bootstrapStandalonePage();
        }
    }

    return {
        AnomaliesLoadError,
        readDesignationFromUrl,
        buildAnomaliesPath,
        createUnavailableDataset,
        loadAnomaliesDataset,
        hasRevealableProbability,
        parseProbabilityValue,
        formatCombinedProbabilityLine,
        buildPlayButtonModel,
        buildEmptyStateMessage,
        getTypewriterStepSize,
        getTypewriterDelayMs,
        shouldIgnorePanelShortcutTarget,
        createPanelController,
        buildStandaloneHref,
        bootstrapStandalonePage,
    };
});
