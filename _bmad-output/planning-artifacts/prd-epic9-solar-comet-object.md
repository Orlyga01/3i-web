# PRD — Epic 9: Solar Comet Object Refactor

**Author:** orly
**Date:** 2026-03-15
**Status:** Draft
**Epic:** 9 — Solar Comet Object Refactor

---

## Goal

Refactor the current `solar_comet` concept into a standard bundled object that behaves like `3I`: it appears on the homepage index, opens in the Object Motion Tracker for editing, plays in the cinematic trajectory player, and supports per-point authoring of both camera framing and flying-object position.

## Problem

The repository currently treats `solar_comet` as a standalone scripted scene rather than as reusable trajectory content. That makes it hard to author point-by-point motion, impossible to reuse the standard editor/player workflow, and inconsistent with the rest of the object catalog.

## Users

- Authors building or tuning a cinematic solar-comet flyby
- Presenters launching a bundled comet sequence from the homepage
- Maintainers who want all bundled objects to follow one shared workflow

## User Outcomes

- Open `solar_comet` from the same index table as other bundled objects
- Edit `solar_comet` using the existing point-by-point tracker workflow
- Save a unique camera framing for each point
- Adjust the flying object position for each point directly in the editor
- Play the result in the same trajectory-player experience used by `3I`

## Functional Requirements

1. A bundled `solar_comet` object exists under `data/solar_comet/trajectory.json`.
2. The root homepage includes `solar_comet` in the bundled object list.
3. The homepage opens `solar_comet` through the existing `Play` and `Edit` actions.
4. The bundled `solar_comet` trajectory includes saved camera data for every shipped point.
5. The Object Motion Tracker exposes per-point controls for the flying object position in addition to the existing camera controls.
6. Authors can edit the object position numerically for the active point.
7. Edited point position values update the active marker immediately in the editor view.
8. Edited point position values persist through local draft save/load.
9. Edited point position values persist through `trajectory.json` export and reload.
10. The trajectory player renders the object at the saved per-point positions without requiring a custom `solar_comet` rendering path.
11. Existing bundled-object loading continues to work for `3I`.

## Non-Goals

- Rebuilding the slideshow system
- Replacing the general `trajectory_player` UI with a custom `solar_comet` player shell
- Adding drag-to-move object editing on the canvas
- Changing the Horizons fetch workflow for normal astronomy objects

## Constraints

- The app remains plain static HTML, CSS, and JavaScript
- The bundled object must use the current `trajectory.json` format
- The editor should reuse the existing point workflow and sidebar instead of introducing a second authoring page
- The new object-position control should fit into the current tracker UI without requiring a major layout rewrite

## Success Criteria

- `solar_comet` appears in the homepage table from bundled data
- `Edit` opens `object_motion?designation=solar_comet`
- `Play` opens `trajectory_player?designation=solar_comet&source=web`
- Every bundled `solar_comet` point ships with a saved camera state
- Editing a point's position in the tracker changes the visible object marker and persists after reload
- The player follows the authored `solar_comet` path without depending on `main.js`
