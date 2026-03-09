# 3i-web — Story Status Tracker

**Project:** 3i-web
**Last updated:** 2026-03-09
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
| 3.1 | Player Page Shell & URL Loading | ✅ Done | Added player shell, URL loader, friendly error states, bootstrap playback, and Jest coverage |
| 3.2 | Animation Engine (Spline + Camera Lerp) | ✅ Done | Catmull-Rom playback, per-frame date/AU interpolation, and pan-aware camera lerp implemented |
| 3.3 | Motion Trail | 🔲 Pending | Depends on 3.2 |
| 3.4 | Playback Controls & Keyboard Shortcuts | 🔲 Pending | ⏮⏪⏸▶⏩ + Space/←/→; depends on 3.2 |
| 3.5 | Speed Ruler | 🔲 Pending | 0.25×–4× slider; depends on 3.2, 3.4 |
| 3.6 | Stop-at-Points Mode | 🔲 Pending | stoppable pause + Continue →; depends on 3.2, 3.4 |
| 3.7 | Timeline Scrubber | 🔲 Pending | Drag-to-seek + notch markers; depends on 3.2, 3.4 |
| 3.8 | Annotation Overlay | 🔲 Pending | Description/image card; depends on 3.6 |
| 3.9 | Live Stats Display | 🔲 Pending | Date + Sun distance; depends on 3.2 |
| 3.10 | Fullscreen Mode | 🔲 Pending | requestFullscreen + F key; depends on 3.4 |

**Progress: 2 / 10 stories complete**

---

## Overall Project Progress

| Epic | Title | Done | Total | % |
|---|---|---|---|---|
| Epic 2 | Object Motion Tracker | 16 | 16 | 100% |
| Epic 3 | Trajectory Player | 2 | 10 | 20% |
| **Total** | | **18** | **26** | **69%** |

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
