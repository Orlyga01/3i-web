# Stories — Epic 9: Solar Comet Object Refactor

**Author:** orly
**Date:** 2026-03-15
**Status:** Draft
**Epic:** 9 — Solar Comet Object Refactor
**Source PRD:** `prd-epic9-solar-comet-object.md`

---

## Story Index

| Story | Title | Status |
|---|---|---|
| [9.1](#story-91--solar-comet-as-a-standard-bundled-object) | Solar Comet as a Standard Bundled Object | ✅ Done |

---

## Story 9.1 — Solar Comet as a Standard Bundled Object

**As a** content author,  
**I want** `solar_comet` to use the same bundled object workflow as `3I`,  
**so that** I can edit point framing and object motion in one consistent system.

### Acceptance Criteria

- [x] A bundled `solar_comet` object exists in `data/solar_comet/trajectory.json`
- [x] The homepage shows `solar_comet` as a bundled object row
- [x] The shipped `solar_comet` trajectory includes saved camera data for every bundled point
- [x] Opening `Edit` for `solar_comet` loads the standard Object Motion Tracker
- [x] Opening `Play` for `solar_comet` loads the standard Trajectory Player
- [x] The tracker exposes per-point flying-object position controls
- [x] Changing the active point's object position updates the current point in memory and is reflected in the viewer
- [x] Edited object-position values persist through draft save/load and JSON export/reload
- [x] Existing bundled object behavior for `3I` remains unchanged

### File List

- `data/solar_comet/trajectory.json`
- `data/objects.json`
- `index.js`
- `tests/index_logic.js`
- `tests/index.test.js`
- `object_motion.html`
- `object_motion.js`
- `_bmad-output/story-status.md`

---

## Dev Agent Record

- **Date:** 2026-03-15
- **Implemented:** Story `9.1`
- **Blocked:** None
- **Tests:** `npm test -- --runInBand`
- **Key decisions:** reused the existing `trajectory.json` point schema, stored per-point object motion by editing each point's `au`/`px` coordinates directly, and shipped `solar_comet` as a bundled data object instead of a custom player-only path
