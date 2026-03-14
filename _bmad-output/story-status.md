# 3i-web — Story Status Tracker

**Project:** 3i-web
**Last updated:** 2026-03-14
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
| 3.4 | Playback Controls & Keyboard Shortcuts | ✅ Done | Wired ⏮⏪⏸▶⏩ controls, disabled edge states, screen-click stop with Continue-only resume, and Space/←/→/F shortcuts |
| 3.5 | Speed Ruler | 🚧 In Progress | Playback pacing rebased so centered `1×` now matches the former `0.25×` default; total-duration readout still pending |
| 3.6 | Stop-at-Points Mode | 🚧 In Progress | Stoppable pauses plus temporary any-point option implemented; single overlay now stays live and swaps to point images on stop |
| 3.7 | Timeline Scrubber | 🔲 Pending | Drag-to-seek + notch markers; depends on 3.2, 3.4 |
| 3.8 | Annotation Overlay | ✅ Done | Auto-shows only on automatic annotated pauses, resolves local/remote images, and dismisses on Continue/manual navigation |
| 3.9 | Live Stats Display | 🚧 In Progress | Floating object-attached date + Sun distance panel exists; compacted box/date styling updated, but it still differs from the original top-right story spec |
| 3.10 | Fullscreen Mode | 🔲 Pending | requestFullscreen + F key; depends on 3.4 |
| 3.11 | Fixed Reference Point & Connector Line | ✅ Done | Static Jupiter-to-Atlas connector now stays rendered from 2025-10-31 onward, without dropping out when the camera swings behind an endpoint |
| 3.12 | Large Annotated Image Window | ✅ Done | Added larger paused-point media window with local/remote/root-asset image support, top-right placement, and graceful no-image fallback |

**Progress: 7 / 12 stories complete**

---

## Epic 4 — Project Index & Source Selection

**Source stories:** `_bmad-output/planning-artifacts/stories-epic4-project-index.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic4-project-index.md`
**Files:** `index.html`, `index.js`, `app_config.js`, `app_config_shared.js`, `object_motion.html`, `object_motion.js`, `trajectory_player.html`, `trajectory_player.js`, `data/objects.json`, `scripts/generate-object-manifest.js`, `scripts/prepare-hosting.js`, `firebase.json`, `.github/workflows/deploy-hosting.yml`

| Story | Title | Status | Notes |
|---|---|---|---|
| 4.1 | Root Project Index Shell & Firebase Init | ✅ Done | Added new root `index.html` + `index.js` homepage, Firebase web init, and local Firebase Hosting config files |
| 4.2 | Bundled + Local Project Catalog | ✅ Done | Homepage now merges bundled objects with `objectMotion:*` local drafts and deduplicates by sanitized designation |
| 4.3 | Source Selection & Action Routing | ✅ Done | Mixed local/web rows now require a source choice; editor/player honor `source=local|web`; tracker Play Video now opens local draft |
| 4.4 | Create New Object Entry Point | ✅ Done | Added `+` modal flow to enter a designation and open the Object Motion Tracker |
| 4.5 | Bundled Object Manifest | ✅ Done | Bundled homepage objects now load from `data/objects.json` with safe fallback behavior for static hosting |
| 4.6 | Generated Manifest from `data/` Folders | ✅ Done | Added a repo script that scans `data/*/trajectory.json` and rewrites `data/objects.json`; `npm test` now refreshes the manifest first |
| 4.7 | Firebase Hosting Bundle & GitHub Deploy | ✅ Done | Hosting now publishes from generated `site/`, uses clean extensionless HTML URLs, and includes prepare/deploy scripts plus GitHub auto-deploy on `main` |
| 4.8 | Global LocalStorage Kill Switch | ✅ Done | Added shared config flag; with local storage off, homepage is web-only and editor/player bypass local drafts even if `source=local` is requested |

**Progress: 8 / 8 stories complete**

---

## Epic 5 — Intro Slideshow

**Source stories:** `_bmad-output/planning-artifacts/stories-epic5-intro-slideshow.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic5-intro-slideshow.md`
**Files:** `index.html`, `index.js`, `assets/`

| Story | Title | Status | Notes |
|---|---|---|---|
| 5.1 | Intro Slideshow Shell & Navigation | 🚧 In Progress | Added `presentation.html` + `presentation.js` shell, JSON manifest loading, iframe slide hosting, Start/Back/Next/Skip controls, and Space-bar advance; no slide counter by current request |
| 5.2 | Wow! Signal Opening Slide | 🚧 In Progress | Added starter standalone slide HTML with initial presenter-friendly copy |
| 5.3 | Comets 101 Slide | 🚧 In Progress | Added starter standalone slide HTML with plain-language comet basics |
| 5.4 | Gravity & Orbit Basics Slide | 🚧 In Progress | Added starter standalone slide HTML with simple gravity/orbit explanation |
| 5.5 | Lagrange Points Slide | 🚧 In Progress | Added starter standalone slide HTML with first-pass Lagrange summary |
| 5.6 | Perseids on 12 August & Debris Formation | 🚧 In Progress | Added starter standalone slide HTML covering Perseids timing and debris formation |
| 5.7 | Solar Wind vs Solar Flare Slide | 🚧 In Progress | Added starter standalone slide HTML distinguishing solar wind from solar flare |
| 5.8 | Mars Transfer vs Lagrange Mission Slide | 🚧 In Progress | Added starter standalone slide HTML comparing Mars transfers with Lagrange missions |

**Progress: 0 / 8 stories complete**

---

## Epic 6 — Point More Info Modal

**Source stories:** `_bmad-output/planning-artifacts/stories-epic6-more-info-modal.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic6-more-info-modal.md`
**Files:** `object_motion.html`, `object_motion.js`, `trajectory_player.html`, `trajectory_player.js`, `more_info_shared.js`, `more_info_modal.js`, `more_info_modal.css`, `scripts/prepare-hosting.js`

| Story | Title | Status | Notes |
|---|---|---|---|
| 6.1 | Shared `more_info` Model & Editor Modal Entry Point | ✅ Done | Refactored modal behavior into shared assets with taller layout, header description, expand/collapse, and image zoom |
| 6.2 | Player Overlay Entry Point & Custom Page iframe | ✅ Done | Player now uses the shared modal too, with fullscreen-style expansion, vertical images, iframe `page_name`, and hosting/test coverage |
| 6.3 | Curated Science Page for a Selected Point | ✅ Done | Added a custom embedded science page for `2025-12-13` with external media and play-triggered Miller comparison highlights |

**Progress: 3 / 3 stories complete**

---

## Epic 7 — Date-Driven Anomalies Panel

**Source stories:** `_bmad-output/planning-artifacts/stories-epic7-date-driven-anomalies-panel.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic7-date-driven-anomalies-panel.md`
**Files:** `anomalies_panel.html`, `anomalies_panel.css`, `anomalies_panel.js`, `anomalies_shared.js`, `data/3I/anomalies.json`, `trajectory_player.html`, `trajectory_player.js`

| Story | Title | Status | Notes |
|---|---|---|---|
| 7.1 | Anomalies JSON Schema & 3I Seed Data | ✅ Done | Imported all 18 rows from `data/3I/3i_atlas_anomalies.xlsx - 3I-ATLAS Anomalies.csv` with explicit `triggerDate` values and preserved `skip` flags |
| 7.2 | Shared Anomalies Model & Date Queue API | ✅ Done | Added `anomalies_shared.js` normalization helpers plus reusable date queue controller and tests |
| 7.3 | Standalone Panel Shell & Left Tab | ✅ Done | Added left-side slide-in anomalies panel with persistent tab, title, and subtitle rendering |
| 7.4 | Incremental Table Reveal Workflow | ✅ Done | Reworked reveal flow to use a cumulative `Play` sequence: anomaly text first, probability on the next play, then a combined `1 out of X` row for multi-anomaly dates, while keeping previously shown rows visible and auto-scrolling to the latest entry |
| 7.5 | Standalone Page Wiring & JSON Loading | ✅ Done | Added standalone `anomalies_panel.html` page with designation/date controls and friendly unavailable states |
| 7.6 | Trajectory Player Handoff Integration | ✅ Done | `trajectory_player` now hosts the shared anomalies panel, syncs date changes on stoppable pauses and manual point jumps, and lets Space trigger anomaly play steps when queued |

**Progress: 6 / 6 stories complete**

---

## Overall Project Progress

| Epic | Title | Done | Total | % |
|---|---|---|---|---|
| Epic 2 | Object Motion Tracker | 16 | 16 | 100% |
| Epic 3 | Trajectory Player | 7 | 12 | 58% |
| Epic 4 | Project Index & Source Selection | 8 | 8 | 100% |
| Epic 5 | Intro Slideshow | 0 | 8 | 0% |
| Epic 6 | Point More Info Modal | 3 | 3 | 100% |
| Epic 7 | Date-Driven Anomalies Panel | 6 | 6 | 100% |
| **Total** | | **40** | **53** | **75%** |

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
| 2026-03-10 | Updated `object_motion.js` save/load paths to preserve arbitrary per-point metadata such as `color`, `video`, and future fields when exporting or reopening `trajectory.json` | dev agent |
| 2026-03-10 | Refined comet recoloring to preserve more luminance and highlight detail so blue states stay crisp instead of looking vague or washed out | dev agent |
| 2026-03-10 | Added a new Jupiter-inspired SVG favicon and linked it from the main project pages so the tab icon matches the attached reference style | dev agent |
| 2026-03-10 | Added a generated root `favicon.ico` so browsers requesting the default icon path no longer receive a 404 even though SVG favicon links are present | dev agent |
| 2026-03-10 | Added Epic 4 planning docs and implemented a new root `index.html` project homepage with Firebase init, bundled/local source selection, and source-aware editor/player routing | dev agent |
| 2026-03-10 | Added `data/objects.json` manifest infrastructure so bundled homepage objects can scale beyond `3I` without changing `index.js` | dev agent |
| 2026-03-10 | Added `scripts/generate-object-manifest.js` plus package scripts/tests so `data/objects.json` can be regenerated automatically from the `data/` folders | dev agent |
| 2026-03-10 | Added root `firebase.json` and `.firebaserc` so Firebase Hosting can serve the repo directly and default to project `astro-489617` locally | dev agent |
| 2026-03-10 | Switched Firebase Hosting to generated `site/` output, added `prepare-hosting` automation, ignored generated Hosting files in git, and added GitHub Actions deploy-on-push for `main` | dev agent |
| 2026-03-10 | Enabled Firebase Hosting `cleanUrls` so extensionless routes like `/trajectory_player` and `/object_motion` resolve to their `.html` files in production | dev agent |
| 2026-03-10 | Added Epic 5 planning docs for an intro slideshow covering the `Wow! signal`, comets, the Perseids around `12 August`, comet debris formation, and solar wind vs solar flare | dev agent |
| 2026-03-10 | Expanded Epic 5 planning to include gravity, orbit, Lagrange points, and a Mars transfer vs Lagrange mission comparison with external explainer references | dev agent |
| 2026-03-10 | Added Epic 6 planning docs and implemented shared point-level `more_info` modals in both the tracker and player, including iframe `page_name` support and hosting/test updates | dev agent |
| 2026-03-10 | Refactored `more_info` UI into shared modal assets with header description, taller expandable layout, vertical full-width images, click-to-zoom support, and a new encapsulated-capabilities workspace rule | dev agent |
| 2026-03-11 | Added Epic 7 planning docs for a standalone date-driven anomalies panel with `data/3I/anomalies.json`, left slide-in UI, animated reveal-by-date workflow, typewriter anomaly text, and later `trajectory_player` handoff | dev agent |
| 2026-03-11 | Implemented Epic 7 Stories 7.2-7.6 with shared anomaly queue logic, standalone panel/page, player handoff integration, and Jest coverage; Story 7.1 remains blocked pending the source CSV import | dev agent |
| 2026-03-11 | Completed Story 7.1 by importing the provided anomaly CSV into `data/3I/anomalies.json` with preserved header copy, all 18 rows, explicit trigger dates, and `skip` flags | dev agent |
| 2026-03-11 | Refined Epic 7 reveal UX: removed the old status box, switched to Play-driven anomaly/probability steps, synced player anomaly dates on point jumps, and mapped Space to anomaly play when rows are queued | dev agent |
| 2026-03-11 | Slowed the Epic 7 typewriter animation so anomaly text reveals more deliberately while keeping the Play-first, probability-second interaction model | dev agent |
| 2026-03-11 | Added a final Play step for multi-anomaly dates that inserts a full-width combined probability line in `1 out of X` form using parsed numeric probabilities (treating `<` values as their numeric bound) | dev agent |
| 2026-03-11 | Updated the anomalies panel to keep previously revealed rows on screen across later stoppable points, while filtering future queues to only unseen rows for the newly active date | dev agent |
| 2026-03-11 | Added a red alert dot on the anomalies tab so the collapsed panel signals when a `Play` step is currently available | dev agent |
| 2026-03-11 | Added anomalies-table auto-scroll so long reveal sequences show a scrollbar and jump to the newest content at the bottom each time Play adds or completes a step | dev agent |
| 2026-03-11 | Fixed the anomalies-table scroll container so overflow now lives on the panel wrapper and Play-driven auto-scroll follows the real scrollable element | dev agent |
| 2026-03-12 | Updated trajectory-player screen-click behavior so canvas clicks can stop playback but cannot resume it; resume now uses the existing Continue control | dev agent |
| 2026-03-12 | Added Epic 6 Story 6.3 and started a custom `2025-12-13` More Info science page with play-triggered material highlights | dev agent |
| 2026-03-12 | Completed Epic 6 Story 6.3 with a custom `2025-12-13` science page, external media, hosting support, and verification | dev agent |
| 2026-03-13 | Tuned trajectory-player object rendering to remove pulse/blink behavior, reduce the live ring, and make the comet sprite read more solid on screen | dev agent |
| 2026-03-13 | Added Epic 4 Story 4.8 with a shared localStorage kill switch; homepage now hides local source choices and editor/player bypass local drafts when the flag is off | dev agent |
| 2026-03-14 | Compacted the trajectory-player floating stats box by removing its fixed minimum width and switching the attached date label to a numeric 2-digit-year format; marked Story 3.9 in progress because the live stats feature now exists in code but still differs from the original top-right spec | dev agent |
| 2026-03-14 | Started Epic 5 implementation with a new JSON-driven `presentation` shell, iframe slide loading, homepage Presentation button, keyboard Space advance, and starter standalone slide files for the planned topics | dev agent |
