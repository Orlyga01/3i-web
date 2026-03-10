# 3i-web — Story Status Tracker

**Project:** 3i-web
**Last updated:** 2026-03-10
**Maintained by:** All agents — update this file whenever a story's implementation status changes.

> **Rule:** Any agent (dev, PM, QA, architect) that completes, partially completes, or discovers a status change for any story **must** update the relevant row in this file before ending their session. The status values are defined below.

---

## Status Key

| Symbol | Label | Meaning |
|---|---|---|
| ✅ | Done | All acceptance criteria verified in code |
| 🚧 | In Progress | Development has started, not all AC met yet |
| 🔲 | Pending | Not yet started |
| ❌ | Blocked | Cannot proceed — dependency or blocker noted |
| 🚫 | Cancelled | Removed from scope |

---

## Epic 2 — Object Motion Tracker

**Source stories:** `_bmad-output/planning-artifacts/stories-epic2-object-motion-tracker.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic2-object-motion-tracker.md`
**Files:** `object_motion.html`, `object_motion.js`

| Story | Title | Status | Notes |
|---|---|---|---|
| 2.1 | Page Shell & Input Form | ✅ Done | `object_motion.html` + JS stub structure implemented |
| 2.2 | Horizons API Client | ✅ Done | `HorizonsClient` module fully implemented |
| 2.3 | API Error Handling | ✅ Done | All 4 error types: NotFound, Ambiguous, Network, EmptyData |
| 2.4 | Bundled Data Auto-Load & Update Mode | ✅ Done | Auto-load from bundled file + _saveDraft(); removed savedCard; fallback shows upload + API |
| 2.5 | Solar System Viewer Integration | ✅ Done | SolarSystem.engine.pause/setDate, form overlay hide/show |
| 2.6 | Object Marker Layer | ✅ Done | Pulsing dot, label, off-screen arrow via project3() |
| 2.7 | Progress Sidebar | ✅ Done | ProgressPanel supports row navigation, thumbnails, save badges, and inline point deletion |
| 2.8 | Point-by-Point Camera Annotation | ✅ Done | saveCurrentPoint, advanceToNextUnsaved, Space/Enter shortcut; pan tx/ty/tz now normalized on save/load |
| 2.9 | Per-Point Image Upload | ✅ Done | MediaAnnotator: upload, drag-drop, preview, remove |
| 2.10 | Per-Point Text Description | ✅ Done | Textarea captured on Save Point, loaded on navigate |
| 2.11 | LocalStorage Draft & Auto-save | ✅ Done | _saveDraft / _clearDraft, resume/startFresh flow, and immediate draft rewrite after point delete |
| 2.12 | JSON Serialisation & File Save | ✅ Done | FileIO.serialize / download / saveToDirectory (FSAPI) |
| 2.13 | Deep-Link via URL Parameter | ✅ Done | Updated: auto-load from bundled file + _saveDraft() on URL param load |
| 2.16 | Offline File Upload Fallback | ✅ Done | Browse file… button + FileReader parse + _saveDraft() in fallback section |
| 2.14 | Per-Point Duration & Stoppable Flag | ✅ Done | `durationPct` + `stoppable` controls, ⚙ modal, captured on Save Point, serialised to JSON |
| 2.15 | "Play Video" Button & Player Handoff | ✅ Done | `▶ Play Video` button with unsaved-changes / never-saved confirm dialog |

**Progress: 16 / 16 stories complete**

---

## Epic 3 — Trajectory Player (Cinematic Flyby)

**Source stories:** `_bmad-output/planning-artifacts/stories-epic3-trajectory-player.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic3-trajectory-player.md`
**Files:** `trajectory_player.html`, `trajectory_player.js`

> **Prerequisite:** Stories 2.14 and 2.15 must be complete before Epic 3 development begins.

| Story | Title | Status | Notes |
|---|---|---|---|
| 3.1 | Player Page Shell & URL Loading | ✅ Done | Added player shell, URL loader, friendly error states, and manual-start playback wiring per latest user request |
| 3.2 | Animation Engine (Spline + Camera Lerp) | ✅ Done | Catmull-Rom playback, per-frame date/AU interpolation, and pan-aware camera lerp implemented |
| 3.3 | Motion Trail | ✅ Done | Glowing projected trail now accumulates during playback and resets cleanly on restart / point jumps |
| 3.4 | Playback Controls & Keyboard Shortcuts | ✅ Done | Wired ⏮⏪⏸▶⏩ controls, disabled edge states, canvas click toggle, and Space/←/→/F shortcuts |
| 3.5 | Speed Ruler | 🚧 In Progress | Playback pacing rebased so centered `1×` now matches the former `0.25×` default; total-duration readout still pending |
| 3.6 | Stop-at-Points Mode | 🚧 In Progress | Stoppable pauses plus temporary any-point option implemented; single overlay now stays live and swaps to point images on stop |
| 3.7 | Timeline Scrubber | 🔲 Pending | Drag-to-seek + notch markers; depends on 3.2, 3.4 |
| 3.8 | Annotation Overlay | ✅ Done | Auto-shows only on automatic annotated pauses, resolves local/remote images, and dismisses on Continue/manual navigation |
| 3.9 | Live Stats Display | 🔲 Pending | Date + Sun distance; depends on 3.2 |
| 3.10 | Fullscreen Mode | 🔲 Pending | requestFullscreen + F key; depends on 3.4 |
| 3.11 | Fixed Reference Point & Connector Line | ✅ Done | Static Jupiter-to-Atlas connector now stays rendered from 2025-10-31 onward, without dropping out when the camera swings behind an endpoint |
| 3.12 | Large Annotated Image Window | ✅ Done | Added larger paused-point media window with local/remote/root-asset image support, top-right placement, and graceful no-image fallback |

**Progress: 7 / 12 stories complete**

---

## Overall Project Progress

| Epic | Title | Done | Total | % |
|---|---|---|---|---|
| Epic 2 | Object Motion Tracker | 16 | 16 | 100% |
| Epic 3 | Trajectory Player | 7 | 12 | 58% |
| **Total** | | **23** | **28** | **82%** |

---

## Change Log

| Date | Change | By |
|---|---|---|
| 2026-03-08 | Created tracker; assessed Epic 2 as 13/15 done from code review | PM agent |
| 2026-03-08 | Stories 2.14, 2.15 added to Epic 2; all Epic 3 stories defined | PM agent |
| 2026-03-09 | Stories 2.14 and 2.15 implemented; Epic 2 now 15/15 complete | dev agent |
| 2026-03-09 | Bug fix: navigateToPoint() now calls setRawState() to restore saved camera on sidebar click (Stories 2.4, 2.7, 2.8) | dev agent |
| 2026-03-09 | Relaxed Save to File / Play Video enable condition from allSaved() to savedCount() > 0; updated Stories 2.8, 2.12, 2.15 and PRD Epic 2 | dev agent |
| 2026-03-09 | Revised data management: Story 2.4 now auto-loads bundled file + writes to localStorage; added Story 2.16 (upload fallback); updated 2.13 deep-link to also save to localStorage | dev agent |
| 2026-03-09 | Camera pan (right-click drag) now saved to trajectory.json (tx/ty/tz added to getRawState); setRawState snaps aEl/aAz/aTx/Ty/Tz immediately on restore; HUD moved to bottom-left to avoid sidebar overlap | dev agent |
| 2026-03-09 | HUD converted from read-only canvas overlay to interactive HTML panel: ZOOM (±5), ELEV (±1°), AZ (±1°) each have − and + buttons with click-and-hold repeat; DATE remains read-only | dev agent |
| 2026-03-09 | Hardened camera pan persistence: Save Point, draft storage, file export, and JSON reload now all normalize explicit tx/ty/tz values in `object_motion.js` | dev agent |
| 2026-03-09 | Added inline delete action for sidebar points; deleting a point now reflows the active index and rewrites the local draft immediately | dev agent |
| 2026-03-09 | Started Epic 3 Story 3.1: player shell, URL loading, and bootstrap implementation in progress | dev agent |
| 2026-03-09 | Completed Story 3.1 with new player shell, URL-based trajectory loader, friendly error states, basic autoplay bootstrap, and Jest coverage | dev agent |
| 2026-03-09 | Started Story 3.2: spline playback engine, interpolated stats, and camera pan support | dev agent |
| 2026-03-09 | Completed Story 3.2 with Catmull-Rom motion, per-frame date/Sun-distance updates, and camera lerp including tx/ty/tz pan data | dev agent |
| 2026-03-09 | Fixed Story 3.1 missing-designation handling to show the required friendly error instead of silently defaulting to `3I` | dev agent |
| 2026-03-09 | Completed Stories 3.3 and 3.4 with projected motion trail rendering, playback controls, edge-state disabling, canvas click toggle, and keyboard shortcuts | dev agent |
| 2026-03-09 | Started Story 3.6 bug-fix pass: stoppable checkbox now pauses playback with Continue →, non-playing states pause solar-system motion, and only an explicit Play-button click restarts from the end | dev agent |
| 2026-03-09 | Updated player UX by request: no autoplay on load, `Pause at stoppable points` defaults on, and non-play controls plus canvas drag/zoom stay disabled while playback is running | dev agent |
| 2026-03-09 | Hid the shared Solar System HUD on `trajectory_player`, made date/Sun-distance float with the object, and added a temporary `Pause at every point` checkbox | dev agent |
| 2026-03-09 | Added a new bundled `3I` trajectory point for `2025-10-31` to `data/3I/trajectory.json`, including converted AU/PX coordinates and a smooth interpolated camera state | dev agent |
| 2026-03-09 | Corrected the trajectory-player default playback speed to `0.25×` (4× slower than the original default) and synced the slider UI to match | dev agent |
| 2026-03-09 | Added Epic 3 Story 3.11 for a fixed 2026-03-16 reference point and yellow connector line that appears from 2025-10-31 onward | dev agent |
| 2026-03-09 | Implemented Story 3.11 with an isolated trajectory-player reference-point renderer, date gate, and Jest coverage for the fixed coordinates and visibility logic | dev agent |
| 2026-03-09 | Revised Story 3.11 to anchor the yellow connector between fixed Jupiter coordinates and the saved 2025-10-29 Atlas position instead of the live playback position | dev agent |
| 2026-03-09 | Adjusted Story 3.11 rendering so the static yellow connector remains visible after 2025-10-31 even when the camera passes behind one of its fixed endpoints | dev agent |
| 2026-03-09 | Updated Epic 2 docs so image references can be local asset paths or absolute URLs without requiring upload, and added Epic 3 Story 3.12 for a larger annotated image window | dev agent |
| 2026-03-09 | Implemented Stories 3.8 and 3.12 with a DOM-based paused-point annotation overlay, larger local/remote image window, and graceful image-load fallback | dev agent |
| 2026-03-09 | Rebased trajectory-player pacing so centered `1×` now matches the prior slow default by changing the base segment duration to 4000 ms and restoring controller default speed to `1` | dev agent |
| 2026-03-09 | Updated shared solar-system planet textures so Venus now uses `assets/venus.webp` and Uranus uses `assets/uranus.png` | dev agent |
| 2026-03-09 | Fixed trajectory-player local asset image resolution for root-relative paths, moved the annotation window to the top-right, and updated the small-fixes rule to skip approval prompts | dev agent |
| 2026-03-09 | Fixed the floating date/Sun-distance panel to keep tracking the object during paused camera moves by reprojecting its screen position on every UI sync | dev agent |
| 2026-03-10 | Added trajectory-driven named-color comet tinting, kept a single bottom-right live preview box, and switched stoppable image mode to reuse that same box | dev agent |
| 2026-03-10 | Replaced overlay tinting with generated recolored comet-image variants so blue/red states change the sprite itself instead of painting a diamond-shaped cover over it | dev agent |
| 2026-03-10 | Fixed color inheritance so points without `color` keep the last defined trajectory color, and transitions happen only when the destination point explicitly defines a new color | dev agent |
| 2026-03-10 | Added `yellow` as a supported trajectory-driven comet color so the player now respects green, blue, red, and yellow values from `data/3I/trajectory.json` | dev agent |
| 2026-03-10 | Moved the single trajectory overlay back to the top of the screen and added a hollow color ring over the media area to show the current trajectory color on both preview and stopped-image states | dev agent |
| 2026-03-10 | Moved the hollow color ring off the overlay box and onto the flying object itself so the ring tracks the live object instead of covering preview or stop images | dev agent |
