# Stories — Epic 7: Date-Driven Anomalies Panel

**Author:** orly
**Date:** 2026-03-11
**Status:** Draft
**Epic:** 7 — Date-Driven Anomalies Panel
**Source PRD:** `prd-epic7-date-driven-anomalies-panel.md`

---

## Story Index

| Story | Title | Status |
|---|---|---|
| [7.1](#story-71--anomalies-json-schema--3i-seed-data) | Anomalies JSON Schema & 3I Seed Data | ✅ Done |
| [7.2](#story-72--shared-anomalies-model--date-queue-api) | Shared Anomalies Model & Date Queue API | ✅ Done |
| [7.3](#story-73--standalone-panel-shell--left-tab) | Standalone Panel Shell & Left Tab | ✅ Done |
| [7.4](#story-74--incremental-table-reveal-workflow) | Incremental Table Reveal Workflow | ✅ Done |
| [7.5](#story-75--standalone-page-wiring--json-loading) | Standalone Page Wiring & JSON Loading | ✅ Done |
| [7.6](#story-76--trajectory-player-handoff-integration) | Trajectory Player Handoff Integration | ✅ Done |

---

## Story 7.1 — Anomalies JSON Schema & 3I Seed Data

**As an** author,
**I want** the 3I anomaly source CSV converted into a structured JSON file next to `trajectory.json`,
**so that** the anomaly narrative becomes reusable by app features instead of living only in an external spreadsheet export.

### Acceptance Criteria

- [ ] A new file exists at `data/3I/anomalies.json`
- [ ] The file includes top-level `title`, `subtitle`, and `entries`
- [ ] The `title` and `subtitle` are captured from the CSV header lines
- [ ] Each entry preserves the source row fields needed by the feature: `dateLabel`, `triggerDate`, `category`, `anomaly`, `probability`, `explanation`, `consensusNote`, and `skip`
- [ ] Each entry stores an explicit `triggerDate` instead of relying on runtime parsing of mixed date formats
- [ ] Rows marked `skip` in the source remain present in JSON with `skip: true`
- [ ] The initial 3I seed data covers all rows from the provided anomaly CSV

### File List

- `data/3I/anomalies.json`
- `tests/anomalies_data.test.js`

---

## Story 7.2 — Shared Anomalies Model & Date Queue API

**As a** developer,
**I want** a shared anomalies helper that loads, normalizes, and queues entries by date,
**so that** the standalone panel and the later player integration can reuse the same logic.

### Acceptance Criteria

- [ ] A shared runtime helper normalizes `anomalies.json`
- [ ] The helper exposes the anomaly dataset `title`, `subtitle`, and usable entries
- [ ] The helper filters out `skip: true` rows from the visible queue while preserving them in the raw model
- [ ] The helper accepts an input date and returns all visible entries whose `triggerDate` matches
- [ ] The helper supports dates with zero matching entries without throwing or producing an error state
- [ ] The helper exposes a small controller-friendly API suitable for future `trajectory_player` handoff

### File List

- `anomalies_shared.js`
- `tests/anomalies_shared.test.js`

---

## Story 7.3 — Standalone Panel Shell & Left Tab

**As a** viewer,
**I want** a collapsible anomalies panel that slides from the left side,
**so that** I can open it only when I want to inspect the anomaly narrative.

### Acceptance Criteria

- [ ] A standalone anomalies panel UI exists outside `trajectory_player`
- [ ] The panel renders on the left side of the screen
- [ ] The expanded panel width is approximately one third of the viewport
- [ ] The panel slides in and out instead of appearing abruptly
- [ ] A small tab remains visible while the panel is collapsed
- [ ] Clicking the tab toggles the panel between expanded and collapsed states
- [ ] The panel shows the anomaly dataset `title` and `subtitle`

### File List

- `anomalies_panel.html`
- `anomalies_panel.css`
- `anomalies_panel.js`

---

## Story 7.4 — Incremental Table Reveal Workflow

**As a** presenter,
**I want** anomaly rows to appear one by one for the current date,
**so that** I can pace the reveal instead of dumping all information at once.

### Acceptance Criteria

- [ ] The panel includes a table with `Anomaly` and `Probability` columns only in the initial version
- [ ] Applying a date can create an empty queue, a single-entry queue, or a multi-entry queue
- [ ] A `Reveal Next` button adds the next queued anomaly row into the table
- [ ] Each click reveals only one row
- [ ] Each newly revealed row enters with a polished text-and-row animation instead of appearing instantly
- [ ] The `anomaly` cell text reveals with a typewriter effect for the newly added row
- [ ] The typewriter pacing stays fast enough for presentation use and does not make the table feel stalled
- [ ] The `probability` cell appears immediately or with a short subtle fade
- [ ] Previously revealed rows do not replay their entrance animation when another row is added
- [ ] When no queued anomalies remain for the active date, the button becomes disabled
- [ ] Applying a new date resets the queue state for that date without duplicating previously revealed rows unintentionally

### File List

- `anomalies_panel.js`
- `tests/anomalies_panel.test.js`

---

## Story 7.5 — Standalone Page Wiring & JSON Loading

**As a** developer,
**I want** a standalone page to load anomaly data for a designation,
**so that** the panel can be tested and demoed before player integration.

### Acceptance Criteria

- [ ] A standalone page can load `data/<designation>/anomalies.json`
- [ ] The page can be driven by a designation input or URL parameter
- [ ] The page initializes the shared anomalies helper and panel controller
- [ ] The page can manually apply a test date to the panel
- [ ] The page shows a friendly empty state or error state when anomaly data is unavailable

### File List

- `anomalies_panel.html`
- `anomalies_panel.js`
- `anomalies_shared.js`
- `tests/anomalies_panel.test.js`

---

## Story 7.6 — Trajectory Player Handoff Integration

**As a** presenter,
**I want** the trajectory player to hand stoppable-point dates into the anomalies panel,
**so that** the anomaly reveal flow can follow the cinematic timeline.

### Acceptance Criteria

- [ ] `trajectory_player` can create or host the anomalies panel using the shared controller
- [ ] When playback reaches a stoppable point, the player passes that point's date into the anomalies controller
- [ ] If the handed-off date has no visible anomalies, the panel remains stable and the reveal button is disabled
- [ ] If the handed-off date has one or more visible anomalies, the queue is ready for one-by-one reveal
- [ ] The integration reuses shared logic rather than duplicating date matching or queue behavior inside `trajectory_player`

### File List

- `trajectory_player.html`
- `trajectory_player.js`
- `anomalies_shared.js`
- `anomalies_panel.js`
- `tests/trajectory_player.test.js`
- `tests/trajectory_player_logic.js`

---

## Dev Agent Record

- **Date:** 2026-03-11
- **Implemented:** Stories `7.1` through `7.6`
- **Blocked:** None
- **Tests:** `npm test -- --runInBand`
- **Key decisions:** Shared all queue/date matching in `anomalies_shared.js`; reused one panel controller for both standalone and `trajectory_player`; converted mixed CSV date labels into explicit `triggerDate` values while preserving each original `dateLabel`; replaced the old status box with a cumulative Play-driven reveal sequence where anomaly text appears first, probability appears on the next Play/Space step, multi-anomaly dates end with a full-width combined `1 out of X` probability row, previously shown rows remain visible across later stoppable points, and the table auto-scrolls to the latest revealed content when it overflows

