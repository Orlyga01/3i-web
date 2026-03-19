# 3i-web — Story Status Tracker

**Project:** 3i-web
**Last updated:** 2026-03-19
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
| 2.12 | JSON Serialisation & File Save | ✅ Done | File export now opens a JSON review/copy modal before downloading `trajectory.json` plus any uploaded point images; directory save remains available via FSAPI |
| 2.13 | Deep-Link via URL Parameter | ✅ Done | Updated: auto-load from bundled file + _saveDraft() on URL param load |
| 2.16 | Offline File Upload Fallback | ✅ Done | Browse file… button + FileReader parse + _saveDraft() in fallback section |
| 2.14 | Per-Point Duration & Stoppable Flag | ✅ Done | `durationPct` + `stoppable` controls, ⚙ modal, captured on Save Point, serialised to JSON |
| 2.15 | "Play Video" Button & Player Handoff | ✅ Done | `▶ Play Video` button with unsaved-changes / never-saved confirm dialog |

**Progress: 16 / 16 stories complete**

---

## Epic 3 — Trajectory Player (Cinematic Flyby)

**Source stories:** `_bmad-output/planning-artifacts/stories-epic3-trajectory-player.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic3-trajectory-player.md`
**Files:** `trajectory_player.html`, `trajectory_player.js`, `shared_render.js`, `solar_system.js`

> **Prerequisite:** Stories 2.14 and 2.15 must be complete before Epic 3 development begins.

| Story | Title | Status | Notes |
|---|---|---|---|
| 3.1 | Player Page Shell & URL Loading | ✅ Done | Added player shell, URL loader, friendly error states, manual-start playback wiring, explicit player-owned object sprite selection so solar-comet asset changes no longer leak into `trajectory_player`, and a corrected `3igreen_1` tail-angle calibration so the player sprite points sunward as intended |
| 3.2 | Animation Engine (Spline + Camera Lerp) | ✅ Done | Catmull-Rom playback, per-frame date/AU interpolation, pan-aware camera lerp, and object-specific player visuals including slower ringless `Oumuamua` rendering and 3I-only progressive tail reveal implemented |
| 3.3 | Motion Trail | ✅ Done | Glowing projected trail now accumulates during playback and resets cleanly on restart / point jumps |
| 3.4 | Playback Controls & Keyboard Shortcuts | ✅ Done | Wired ⏮⏪⏸▶⏩ controls, disabled edge states, screen-click stop with Continue-only resume, and Space/←/→/F shortcuts |
| 3.5 | Speed Ruler | 🚧 In Progress | Playback pacing rebased, supported trajectory-level default speed overrides now start `2I/Borisov` and `Oumuamua` at `3×`, and the total-duration readout is still pending |
| 3.6 | Stop-at-Points Mode | 🚧 In Progress | Stoppable pauses plus temporary any-point option implemented; single overlay now stays live and swaps to point images on stop |
| 3.7 | Timeline Scrubber | 🔲 Pending | Drag-to-seek + notch markers; depends on 3.2, 3.4 |
| 3.8 | Annotation Overlay | ✅ Done | Auto-shows only on automatic annotated pauses, resolves local/remote images, and dismisses on Continue/manual navigation |
| 3.9 | Live Stats Display | 🚧 In Progress | Floating object-attached date + Sun distance panel exists; compacted box/date styling updated, but it still differs from the original top-right story spec |
| 3.10 | Fullscreen Mode | 🔲 Pending | requestFullscreen + F key; depends on 3.4 |
| 3.11 | Fixed Reference Point & Connector Line | ✅ Done | Static Jupiter-to-Atlas connector now stays rendered from 2025-10-31 onward, without dropping out when the camera swings behind an endpoint, and the final 3I point now shows a Jupiter-centered 0.355 AU distance sphere |
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
**Files:** `presentation.html`, `presentation.js`, `data/3I/presentation.json`, `trajectory_player.js`, `assets/`

| Story | Title | Status | Notes |
|---|---|---|---|
| 5.1 | Intro Slideshow Shell & Navigation | 🚧 In Progress | Added the slideshow shell, iframe hosting, keyboard/nav controls, intro flyover, and player embeds; the old `solar_comet` slide has now been removed and replaced with a manual-start `2I/Borisov` player slide plus an autoplaying `Oumuamua` player slide, and the manifest now includes a Starship image-to-video transition slide immediately after `SPHEREx` |
| 5.2 | Wow! Signal Opening Slide | 🚧 In Progress | Added a dedicated final `Wow! Signal` slide with the historical printout image and `12 Aug 1977` date; manifest now keeps it as the last slide |
| 5.3 | Comets 101 Slide | 🚫 Cancelled | Removed from Epic 5 slideshow scope and deleted standalone slide by user request |
| 5.4 | Gravity & Orbit Basics Slide | 🚫 Cancelled | Removed from Epic 5 slideshow scope and deleted standalone slide by user request |
| 5.5 | Lagrange Points Slide | 🚫 Cancelled | Removed from Epic 5 slideshow scope and deleted standalone slide by user request |
| 5.6 | Perseids on 12 August & Debris Formation | 🚫 Cancelled | Removed from Epic 5 slideshow scope and deleted standalone slide by user request |
| 5.7 | Solar Wind vs Solar Flare Slide | 🚫 Cancelled | Removed from Epic 5 slideshow scope and deleted standalone slide by user request |
| 5.8 | Mars Transfer vs Lagrange Mission Slide | 🚫 Cancelled | Removed from Epic 5 slideshow scope and deleted standalone slide by user request |

**Progress: 0 / 8 stories complete**

---

## Epic 6 — Point More Info Modal

**Source stories:** `_bmad-output/planning-artifacts/stories-epic6-more-info-modal.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic6-more-info-modal.md`
**Files:** `object_motion.html`, `object_motion.js`, `trajectory_player.html`, `trajectory_player.js`, `more_info_shared.js`, `more_info_modal.js`, `more_info_modal.css`, `scripts/prepare-hosting.js`

| Story | Title | Status | Notes |
|---|---|---|---|
| 6.1 | Shared `more_info` Model & Editor Modal Entry Point | ✅ Done | Refactored modal behavior into shared assets with taller layout, header description, expand/collapse, and image zoom |
| 6.2 | Player Overlay Entry Point & Custom Page iframe | ✅ Done | Player now uses the shared modal too, with fullscreen-style expansion, larger modal-scaled images, iframe `page_name`, and hosting/test coverage |
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

## Epic 8 — Translation & Localization

**Source stories:** `_bmad-output/planning-artifacts/stories-epic8-translations.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic8-translations.md`
**Files:** `data/translations.json`, `translations.js`, `index.html`, `index.js`, `presentation.html`, `presentation.js`, `trajectory_player.html`, `trajectory_player.js`, `shared_render.js`, `main.js`, `more_info_modal.js`, `more_info_2025_12_13.html`, `slides/3I/*.html`

| Story | Title | Status | Notes |
|---|---|---|---|
| 8.1 | Shared Translation JSON & Runtime Loader | ✅ Done | Replaced the nested translation store with flat `name` + `translations` entries and a startup-built locale map in `translations.js` |
| 8.2 | Index Language Selector & Link Propagation | ✅ Done | Added a language selector to `index.html`, localized index copy, and propagated `lang` through generated page links |
| 8.3 | Runtime Translation for Presentation, Player, and Solar System | ✅ Done | Switched to source-text lookups, fixed presentation slide routing so clean slide URLs keep `lang`, and applied the Hebrew-only Fredoka font through the shared translation runtime |
| 8.4 | Hebrew Seed Content for 3I Descriptions and More Info | ✅ Done | Preserved the Hebrew seed set for 3I slides, trajectory descriptions, and the `2025-12-13` more-info page in the new flat translation catalog |

**Progress: 4 / 4 stories complete**

---

## Epic 9 — Solar Comet Object Refactor

**Source stories:** `_bmad-output/planning-artifacts/stories-epic9-solar-comet-object.md`
**Source PRD:** `_bmad-output/planning-artifacts/prd-epic9-solar-comet-object.md`
**Files:** `data/objects.json`, `index.js`, `data/3I/presentation.json`, `scripts/prepare-hosting.js`

| Story | Title | Status | Notes |
|---|---|---|---|
| 9.1 | Solar Comet as a Standard Bundled Object | 🚫 Cancelled | Removed from bundled runtime scope by user request; homepage, presentation, and hosting no longer surface `solar_comet` |

**Progress: 0 / 1 stories complete**

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
| Epic 8 | Translation & Localization | 4 | 4 | 100% |
| Epic 9 | Solar Comet Object Refactor | 0 | 1 | 0% |
| **Total** | | **44** | **58** | **76%** |

---

## Change Log

| Date | Change | By |
|---|---|---|
| 2026-03-16 | Fixed the shared comet renderer to forward the new horizontal sprite anchor too, so the measured `3I` tail-image nucleus point actually applies during live playback and not just in the preview path | dev agent |
| 2026-03-16 | Used the measured `3i_tail.png` bright-nucleus point at `240px,240px` inside the `533x800` image to set a precise `3I` tail-sprite anchor (`anchorX`/`anchorY`) instead of a vertical-only approximation | dev agent |
| 2026-03-16 | Re-anchored the bundled `3I` long-tail sprite to the actual bright nucleus area high in `assets/3i_tail.png`, so the object position tracks the image’s brightest spot instead of the vertical midpoint | dev agent |
| 2026-03-16 | Restored the bundled `3I` floating date badge and switched its normal sprite to the raw-image render path so the extra synthetic inner circle/glow is no longer painted over the object | dev agent |
| 2026-03-16 | Hid the entire floating date/distance badge for bundled `3I` so only the image stays attached to the flying object, while leaving other objects unchanged | dev agent |
| 2026-03-16 | Disabled the attached color-ring marker for bundled `3I` in both its normal and long-tail runtime visuals so the extra circle no longer appears next to the object/date | dev agent |
| 2026-03-16 | Forced the presentation bottom control bar to `ltr` so the controls stay left-to-right in every locale, including Hebrew, while the rest of the page can remain RTL | dev agent |
| 2026-03-16 | Mirrored the presentation bottom control bar to right-to-left when the locale is Hebrew so the nav/buttons follow RTL ordering | dev agent |
| 2026-03-16 | Moved the Hebrew `Fredoka` typography to a true global CSS rule through `translations.js` and strengthened `styles.css`, so presentation and other translated pages inherit the same font consistently | dev agent |
| 2026-03-16 | Updated bundled `3I` so the runtime switches to `assets/3i_tail.png` from 2025-11-13 through 2026-02-28 and progressively scales that longer-tail sprite up across the window | dev agent |
| 2026-03-16 | Removed the extra green preview halo from the bundled `3I` top-right box so only the sprite image remains there, without changing the other objects | dev agent |
| 2026-03-16 | Switched the bundled `3I` top-right preview box to render the plain sprite image instead of the glowing live-preview point treatment, leaving the other objects unchanged | dev agent |
| 2026-03-16 | Restored the trajectory-player top-right preview box only for bundled `3I`, switched the object-attached stats date to month-name formatting, and moved the `3I` floating label closer to the nucleus | dev agent |
| 2026-03-16 | Recalibrated the bundled `3I` player sprite from the wrong built-in `150°` tail assumption to the actual `3igreen_1.png` tail angle so the first trajectory point now points toward the Sun correctly | dev agent |
| 2026-03-16 | Densified the bundled `2I/Borisov` perihelion arc with additional JPL Horizons vectors from 2019-09-01 through 2020-02-28 so the visible turn reads closer to the Sun | dev agent |
| 2026-03-16 | Updated the 3I presentation so the Borisov trajectory-player slide no longer autoplays, while the Oumuamua slide still does | dev agent |
| 2026-03-16 | Removed the bundled `solar_comet` runtime surface, replaced its presentation slot with autoplaying `2I/Borisov` and `Oumuamua` trajectory-player slides, and refreshed the top-level docs | dev agent |
| 2026-03-16 | Clamped trajectory-player spline interpolation to each segment's endpoint range to reduce fake overshoot kinks at sparse-to-dense transitions such as the visible `Oumuamua` wobble near 2017-08-29 | dev agent |
| 2026-03-16 | Corrected player segment timing so `durationPct` now applies to the segment starting at that point and uses the intended 1-second base before `defaultSpeedMultiplier` / speed-ruler scaling | dev agent |
| 2026-03-16 | Inserted the requested 2017-09-01 through 2017-09-29 Horizons point set into the bundled `Oumuamua` trajectory, preserving its existing schema and default playback speed metadata | dev agent |
| 2026-03-16 | Refined Object Motion Tracker file export into a modal review/copy/save flow, preserved trajectory-level default speed metadata during draft/export round-trips, and updated `Oumuamua` in the trajectory player to hide its color ring, keep its native sprite color, spin 5x slower, and start at the same 3x default playback speed as `2I/Borisov` | dev agent |
| 2026-03-16 | Added optional trajectory-level default playback speed support, kept null speed at the current 1x behavior, and set `2I/Borisov` to start at 3x with a white carried-forward trajectory color | dev agent |
| 2026-03-16 | Trimmed the bundled `2I/Borisov` trajectory again by removing the 2020-04-20 through 2020-08-18 points and the 2021-04-15 through 2021-10-12 points, keeping other objects unchanged | dev agent |
| 2026-03-16 | Updated the trajectory player so null cameras fall back only to the last saved earlier camera, hid the top-right trajectory image card, and removed the startup flyby animation without changing other trajectory data | dev agent |
| 2026-03-16 | Updated the Borisov trajectory player to use the legacy comet sprite and a sun-distance tail reveal so the tail grows as it approaches the Sun, without changing the other object trajectories | dev agent |
| 2026-03-16 | Restored the recovered `2I/Borisov` runtime export from a stalled download temp file back into `data/2I_Borisov/trajectory.json`, preserving the saved camera-authored points | dev agent |
| 2026-03-16 | Reduced the bundled `2I/Borisov` trajectory density by removing every second point so playback now advances in roughly 60-day steps | dev agent |
| 2026-03-16 | Added a new bundled `Oumuamua` trajectory generated from the supplied Horizons vectors and refreshed `data/objects.json` so it appears in the homepage index | dev agent |
| 2026-03-16 | Added a new bundled `2I/Borisov` trajectory generated from the supplied Horizons vectors and refreshed `data/objects.json` so it appears in the homepage index | dev agent |
| 2026-03-16 | Swapped the trajectory-player 3I artwork to `3igreen_1.png`, compensated its built-in 150-degree tail angle so the rendered tail still points anti-sunward, and let player/modal image views scale up to the dialog size | dev agent |
| 2026-03-15 | Added Epic 9 docs and implemented `solar_comet` as a standard bundled object with homepage entry, shipped camera-authored points, top-level page redirect to the shared player, and per-point object-position controls in the tracker | dev agent |
| 2026-03-15 | Added a new comparison video slide right after Small Bodies Overview, embedding the YouTube Shorts video with autoplay, mute, and full-viewport layout | dev agent |
| 2026-03-15 | Added 30px more height to the three Small Bodies Overview cards while keeping their width unchanged | dev agent |
| 2026-03-15 | Corrected the Small Bodies Overview square-card layout so card width stays intact and only the height is reduced to match | dev agent |
| 2026-03-15 | Enlarged the comet-tail `waterSplash` and `greenDust` burst images by 1.5x and added a 3-second hold after those reveals before the tail build continues | dev agent |
| 2026-03-15 | Added a new presentation image slide before `SPHEREx` using the requested Dark Side of the Moon laser-show image | dev agent |
| 2026-03-15 | Fixed the `solar_comet` slide bootstrap conflict so the slide can render again, and increased non-title presentation text sizes across the shell and active slideshow pages | dev agent |
| 2026-03-15 | Fixed the presentation intro flyover overlay so the second `Next` click clears the flying `3igreen_1.png` before opening the next slide | dev agent |
| 2026-03-15 | Added Google Fonts `Fredoka` as a Hebrew-only shared font through `translations.js`, so translated pages switch typography automatically when `lang=he` | dev agent |
| 2026-03-15 | Fixed presentation slideshow translation handoff by normalizing iframe slide URLs to clean routes before appending `lang`, so the server redirect no longer drops the locale query string | dev agent |
| 2026-03-15 | Replaced the translation system with a flat `name` + `translations` catalog, global `translate(name)` runtime map, and source-text lookups across the index, presentation, player, slides, and more-info pages | dev agent |
| 2026-03-15 | Added Epic 8 translation planning plus a shared `en`/`he` translation layer, homepage language selector, `lang` URL propagation, and Hebrew runtime content for presentation, player, solar-system labels, descriptions, and more-info pages | dev agent |
| 2026-03-14 | Doubled the first-slide presentation flyover duration again so the `3igreen_1.png` pass now plays at half the prior speed | dev agent |
| 2026-03-15 | Attached the presentation `1`-key shortcut to both the shell and loaded slide iframe so keyboard advance still works after clicking inside a slide | dev agent |
| 2026-03-15 | Switched the presentation next-slide keyboard shortcut to `1` and slowed the first-click `3igreen_1.png` flyover to about 8x longer so the handoff reads much more clearly | dev agent |
| 2026-03-15 | Changed the presentation keyboard next-slide shortcut from Space/F1 fallback attempts to the backtick key so keyboard advance works reliably with the `Next` button flow | dev agent |
| 2026-03-14 | Swapped the presentation first-slide flyover image from `assets/3igreen.jpg` to `assets/3igreen_1.png` | dev agent |
| 2026-03-14 | Restored the Space-bar slideshow shortcut so keyboard advance works again in the presentation, matching the `Next` button flow | dev agent |
| 2026-03-14 | Removed the on-screen autoplay/fullscreen hint line from the intro video slide so the opening video displays cleanly | dev agent |
| 2026-03-14 | Kept the presentation `Next` button enabled throughout the slideshow and removed the Space-bar slide-advance shortcut | dev agent |
| 2026-03-14 | Updated the presentation `3igreen.jpg` flyover so it no longer fades near the right edge and stays fully visible while scaling up across the screen | dev agent |
| 2026-03-14 | Retuned the presentation `3igreen.jpg` flyover to travel from the left edge to the right edge of the screen and slowed the handoff again for a longer visible pass | dev agent |
| 2026-03-14 | Retuned the presentation `3igreen.jpg` flyover to end on the right side again and slowed the motion further for a longer first-slide handoff | dev agent |
| 2026-03-14 | Removed the `Gravity and Orbit` and `Lagrange Points` slides from the `3I` presentation manifest and deleted their standalone slide files by user request | dev agent |
| 2026-03-14 | Slowed the presentation `3igreen.jpg` flyover substantially and changed its endpoint to finish 30% from the bottom on the left side of the screen | dev agent |
| 2026-03-14 | Changed the first-slide presentation handoff so the first `Next` click only plays the `3igreen.jpg` flyover and the second `Next` click advances to slide 2 | dev agent |
| 2026-03-14 | Moved the `3igreen.jpg` flyover into the presentation shell so the image now appears above the slideshow when advancing from the first slide | dev agent |
| 2026-03-14 | Added a trajectory-player play-click flyover overlay that animates `assets/3igreen.jpg` diagonally across the screen while scaling it up from 100% to 300% | dev agent |
| 2026-03-14 | Added a new first `3I` presentation slide that embeds the requested YouTube intro video, and enabled autoplay/fullscreen permissions on the presentation iframe shell | dev agent |
| 2026-03-14 | Added new `3I` presentation slides for `hill_radius.jpg` and `spherex.webp`, placing both after `solar_comet.html` and before the final `Wow! Signal` slide | dev agent |
| 2026-03-14 | Added `solar_comet.html` to the `3I` presentation manifest as the slide immediately before the final `Wow! Signal` page | dev agent |
| 2026-03-14 | Widened the opening `solar_comet` scene-2 establishing phase further so the whole first segment stays much more zoomed out before the comet handoff | dev agent |
| 2026-03-14 | Reframed the `solar_comet` pre-comet intro to start on a full-solar-system view and extended that establishing section so the wide shot reads before the comet handoff | dev agent |
| 2026-03-14 | Extended the `solar_comet` pre-comet establishing move to about 3 seconds and increased the zoom-out distance so the transition reads less abruptly | dev agent |
| 2026-03-14 | Added a 1.5 second pre-comet zoom-out/zoom-in intro to `solar_comet` scene 2 so the comet sequence starts after a brief wider establishing move | dev agent |
| 2026-03-14 | Reworked the second `solar_comet` flyby onto a Sun-centered arc so the visible deflection is centered on the Sun rather than an off-axis curve | dev agent |
| 2026-03-14 | Clarified the second `solar_comet` flyby by adding a visible trajectory path and exaggerating the near-Sun deflection so the gravity bend reads clearly | dev agent |
| 2026-03-14 | Refined `solar_comet` pacing and scene-2 comet choreography: shorter intro, reordered comet reveal, anti-sun tail alignment, staged tail growth, and a near-Sun bent trajectory | dev agent |
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
| 2026-03-14 | Reordered the opening slideshow so the 3-box comparison is first as `Small Bodies Overview`, then added a new single-run comet-tail animation slide with a 2-second delayed auto-start | dev agent |
| 2026-03-14 | Removed the slideshow header so slides start at the top, floated the nav controls over the stage, and compressed the first slide to fit the viewport without a scrollbar | dev agent |
| 2026-03-14 | Removed the `Start` step so the presentation opens directly on the first slide and Space now always advances to the next slide | dev agent |
| 2026-03-14 | Rotated the comet nucleus 180 degrees in the tail-formation canvas and rotated the water and dust burst sprites to match | dev agent |
| 2026-03-14 | Removed the zoom-in beat, moved the impact point to the rock’s right side, and changed the water/dust burst reveal to a center-out vertical spread with dust starting after water completes | dev agent |
| 2026-03-14 | Refined the comet-tail canvas again: reduced Sun size and spacing overlap, shrank the burst sprites, moved their center to the rock’s right edge, and switched to a 1-second angular reveal that opens from the right side for water first and dust second | dev agent |
| 2026-03-14 | Updated the tail phase so burst sprites disappear once plasma starts forming the tail, and the ending now fades out the Sun/effects to leave only the final comet image | dev agent |
| 2026-03-14 | Reworked the tail phase with 1.2-second water/dust reveals plus a 2-second hold, replaced the old dotted tail with a measured blue-green orb dissolving into a smooth tail behind the comet, and removed the small particle circles | dev agent |
| 2026-03-14 | Rotated the final comet image to -90 degrees from its source orientation and increased the final zoom-out so the end transition pulls back more before the reveal | dev agent |
| 2026-03-14 | Corrected the first orb transition so it now sweeps from the comet’s left edge only to the center, covering half the nucleus before dissolving smoothly into the existing tail flow | dev agent |
| 2026-03-14 | Moved the water/dust burst sprites slightly left and behind the comet, rotated them by 20 degrees, and slowed each image reveal to 2 seconds | dev agent |
| 2026-03-14 | Separated the comet-cover sweep from the tail renderer so the blue/green sphere is now visibly drawn over the comet’s right half while the tail remains behind it | dev agent |
| 2026-03-14 | Slowed and strengthened the comet-cover sweep so it reads more clearly on screen, extended the tail phase timing, and added a pause/play button directly on the comet animation slide | dev agent |
| 2026-03-14 | Separated the sphere and tail timing properly so the sphere completes before the tail begins, and increased the sphere opacity to about 70% for a clearer half-cover transition | dev agent |
| 2026-03-14 | Moved the comet pause control into the main slideshow navigation beside `Next`, reversed the half-sphere to sweep right-to-left, and delayed the sphere fade so its right edge turns transparent before the full orb fades out | dev agent |
| 2026-03-14 | Moved the tail layer in front of the comet nucleus and regraded its head so the rock overlap starts transparent on the right and grows more solid toward the left | dev agent |
| 2026-03-14 | Enlarged the final comet reveal to about 2x and softened the ending camera pullback so the last shot is less zoomed out | dev agent |
| 2026-03-14 | Fixed the half-sphere continuity bug by keeping the sphere visible through the tail-build phase and only tying its fade-out to the final settle instead of the initial sweep progress | dev agent |
| 2026-03-14 | Matched the tail head more closely to the sphere’s height and opacity, shortened the initial autoplay delay to 1 second, and inserted a 3-second hold before the final reveal continues | dev agent |
| 2026-03-14 | Slowed the sphere sweep slightly, reduced the tail head so it stays below the sphere height, and added animated yellow solar-wind streaks entering from the right during the tail phase | dev agent |
| 2026-03-14 | Made the tail head match the sphere radius, started the tail at the same moment as the sphere with a shared 2-second build, and delayed the yellow right-side glow until after the sphere-start moment | dev agent |
| 2026-03-14 | Separated player and solar-comet sprite ownership by fixing the trajectory-player shared-render call path to use its own explicit object image, while the solar-comet scene now also passes its sprite explicitly instead of relying on the shared default | dev agent |
| 2026-03-14 | Removed Epic 5 slides `Comets 101`, `Perseids and Debris`, `Solar Wind and Solar Flare`, and `Mars vs Lagrange Missions` from the presentation manifest, cancelled Stories 5.3/5.6/5.7/5.8, and deleted their standalone slide files | dev agent |
| 2026-03-14 | Added a new dedicated `Wow! Signal` slideshow ending slide using the historical printout image and `12 Aug 1977`, and pinned it as the final manifest entry | dev agent |
| 2026-03-17 | Made the 3I player tail reveal progressively from the sprite tail-start point and added a final 3I-only Jupiter-centered 0.355 AU sphere plus matching trajectory text updates | dev agent |
| 2026-03-17 | Corrected all three `2026-03-16` 3I trajectory entries to the Horizons-derived AU/world position while preserving their different camera angles | dev agent |
| 2026-03-17 | Fixed the 3I tail reveal direction so the visible tail now grows outward from the sun-facing tail base instead of expanding around the comet head | dev agent |
| 2026-03-17 | Restored trajectory-driven tinting for the flying 3I object by letting the player recolor both the normal and tail sprites instead of forcing their original green pixels | dev agent |
| 2026-03-17 | Widened the 3I tail reveal clip band so the far end of the growing tail stays fully visible instead of being cut off | dev agent |
| 2026-03-17 | Removed the extra circular core and nucleus glow from the flying 3I object so only the object sprite remains visible without a second halo ring behind it | dev agent |
| 2026-03-17 | Reverted the temporary `3i_tail2.png` experiment and restored the requested `3i_tail.png` sprite with the original `240,240` anchor for the 3I tail window | dev agent |
| 2026-03-19 | Added a new `Starship Transition` slideshow slide after `SPHEREx` that shows the requested Starship image for 4 seconds, then crossfades into a muted embedded YouTube clip from `3s` through `11s` | dev agent |
