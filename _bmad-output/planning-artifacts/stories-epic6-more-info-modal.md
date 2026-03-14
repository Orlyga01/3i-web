# Stories — Epic 6: Point More Info Modal

**Author:** orly
**Date:** 2026-03-10
**Status:** Draft
**Epic:** 6 — Point More Info Modal
**Source PRD:** `prd-epic6-more-info-modal.md`

---

## Story Index

| Story | Title | Status |
|---|---|---|
| [6.1](#story-61--shared-more_info-model--editor-modal-entry-point) | Shared `more_info` Model & Editor Modal Entry Point | ✅ Done |
| [6.2](#story-62--player-overlay-entry-point--custom-page-iframe) | Player Overlay Entry Point & Custom Page iframe | ✅ Done |
| [6.3](#story-63--curated-science-page-for-a-selected-point) | Curated Science Page for a Selected Point | ✅ Done |

---

## Story 6.1 — Shared `more_info` Model & Editor Modal Entry Point

**As an** author,
**I want** the tracker to recognize structured `more_info` data and expose it through a modal,
**so that** I can review richer point details without leaving the current editing page.

### Acceptance Criteria

- [x] A shared runtime helper normalizes `more_info` data
- [x] The helper supports `images`, `video`, `text`, and `page_name`
- [x] Relative media paths resolve against `data/<designation>/`
- [x] `object_motion.html` shows a `More Info` button only when the active point has usable `more_info`
- [x] Clicking the tracker button opens a modal with a close control
- [x] The tracker modal renders the point date plus generic `more_info` content when `page_name` is absent

### File List

- `more_info_shared.js`
- `object_motion.html`
- `object_motion.js`
- `tests/more_info_shared.test.js`

---

## Story 6.2 — Player Overlay Entry Point & Custom Page iframe

**As a** viewer,
**I want** to open richer point details directly from the player overlay,
**so that** I can explore additional media or a custom embedded page while staying in the playback experience.

### Acceptance Criteria

- [x] The player overlay shows a `More Info` button when the current point has usable `more_info`
- [x] Clicking the player button opens a modal with a close control
- [x] If `page_name` is present, the modal embeds it in an iframe
- [x] If `page_name` is absent, the modal renders the generic date + images + video + text template
- [x] The same `more_info` data works from bundled web trajectories and local draft trajectories
- [x] Hosting preparation includes any new shared runtime file needed by the feature

### File List

- `trajectory_player.html`
- `trajectory_player.js`
- `more_info_shared.js`
- `scripts/prepare-hosting.js`
- `tests/prepare_hosting.test.js`

---

## Story 6.3 — Curated Science Page for a Selected Point

**As a** viewer,
**I want** a selected trajectory point to open a richer science explainer page inside the More Info modal,
**so that** I can explore a specific date's evidence, media, and interpretation in a more cinematic way than the generic template allows.

### Acceptance Criteria

- [x] The `2025-12-13` point in `data/3I/trajectory.json` includes `more_info.page_name`
- [x] Opening `More Info` for that point embeds a custom page in the existing modal iframe flow
- [x] The custom page presents the requested 3I material list with short explanatory notes
- [x] The custom page loads the requested external 3I and Stanley Miller images by URL
- [x] A `Play` button starts the material-highlight animation only after user interaction
- [x] Circular highlight rings animate around the subset of materials being compared to the Miller-Urey experiment
- [x] Hosting preparation includes the custom page so the embedded route works in production

### File List

- `data/3I/trajectory.json`
- `more_info_2025_12_13.html`
- `scripts/prepare-hosting.js`
- `tests/prepare_hosting.test.js`

