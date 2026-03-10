# Product Requirements Document
## Epic 3 — Trajectory Player (Cinematic Flyby)

**Author:** orly
**Date:** 2026-03-08
**Status:** Draft
**Epic:** 3 — Trajectory Player
**Project:** 3i-web

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [Functional Requirements](#5-functional-requirements)
   - 5.1 [Epic 2 Additions (Data Input for Epic 3)](#51-epic-2-additions-data-input-for-epic-3)
   - 5.2 [Player Page Shell & URL Loading](#52-player-page-shell--url-loading)
   - 5.3 [Animation Engine](#53-animation-engine)
   - 5.4 [Motion Trail](#54-motion-trail)
   - 5.5 [Playback Controls](#55-playback-controls)
   - 5.6 [Speed Ruler](#56-speed-ruler)
   - 5.7 [Stop-at-Points Mode](#57-stop-at-points-mode)
   - 5.8 [Timeline Scrubber](#58-timeline-scrubber)
   - 5.9 [Annotation Overlay](#59-annotation-overlay)
   - 5.10 [Live Stats Display](#510-live-stats-display)
   - 5.11 [Fullscreen Mode](#511-fullscreen-mode)
  - 5.12 [Large Annotated Image Window](#512-large-annotated-image-window)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Out of Scope for Epic 3](#7-out-of-scope-for-epic-3)
8. [User Journeys](#8-user-journeys)
9. [Architecture & File Structure](#9-architecture--file-structure)
10. [Data Schemas](#10-data-schemas)
11. [Constraints & Dependencies](#11-constraints--dependencies)

---

## 1. Executive Summary

Epic 3 delivers the **cinematic payoff** of the annotation workflow built in Epic 2. A new standalone page — `trajectory_player.html` — reads a saved `trajectory.json` file and plays it as a smooth animated video: the object glides through its heliocentric path, the camera flows between the author's chosen views, and a motion trail builds from the first point. The experience is bookmarkable and shareable via a `?designation=` URL parameter.

Two small additions to the Epic 2 annotation UI power the player: a **duration percentage field** (how long to spend on each segment) and a **stoppable checkbox** (whether the player should pause here). Both are stored in the same `trajectory.json` as new optional fields.

---

## 2. Problem Statement

### Current State

The Epic 2 annotation workflow produces a rich `trajectory.json` — saved camera views, descriptions, images, dated positions. However, there is currently no way to **play** that file back. The data is static.

### The Gap

The original `atlas_main.js` hard-coded the 3I/ATLAS journey as a fixed cinematic sequence. That approach cannot generalise to arbitrary trajectories loaded from JSON. Epic 3 replaces the hard-coded approach with a data-driven player that works for any object with a saved trajectory.

---

## 3. Goals & Success Metrics

### Goals

| # | Goal |
|---|---|
| G1 | Play any saved `trajectory.json` as a smooth animated video |
| G2 | Give the author control over pacing (per-segment duration, global speed) |
| G3 | Allow the player to pause at author-marked points for captioned storytelling |
| G4 | Show the full motion trail growing from the first point throughout playback |
| G5 | Enable direct URL-based access: `trajectory_player.html?designation=3I` |

### Success Metrics

| Metric | Target |
|---|---|
| JSON load to first frame | < 300ms |
| Animation smoothness | Consistent 60fps on a modern laptop |
| Camera interpolation | No visible snap or jump between any two consecutive saved camera states |
| URL parameter | Player loads and auto-plays when opened with `?designation=3I` |

---

## 4. User Personas

### Primary: The Presenter
- Has completed Epic 2 annotation for an object
- Wants to show the trajectory as a video — to a colleague, at a conference, or on a website
- Needs a clean, bookmarkable URL they can share

### Secondary: The Storyteller
- Wants to walk viewers through key events (perihelion, Mars flyby) with captions
- Uses stoppable points to pause and explain each moment
- Uses per-segment durations to control pacing — slow at dramatic moments, faster in quiet outer-solar-system segments

---

## 5. Functional Requirements

---

### 5.1 Epic 2 Additions (Data Input for Epic 3)

These are **additive changes to `object_motion.js`** required before the player can be fully used. They are delivered as part of Epic 3's scope but implemented in the existing Epic 2 file.

#### FR-1.1 — Per-Point Duration Field

Near the "Save Point →" button in the annotation UI, add:

| Control | Type | Default | Constraints |
|---|---|---|---|
| `Duration` | `<input type="number">` with `%` suffix label | `100` | Min: 1, Max: 1000, integer |

**Tooltip:** `"Duration as % of 1 second (base). 100 = 1s, 200 = 2s, 50 = 0.5s. Use the speed ruler in the player to scale the whole video."`

When "Save Point →" is clicked, the current `durationPct` value is captured and stored in `TrajectoryStore` for that point alongside the camera state. When navigating to a different point, the field updates to reflect that point's previously saved `durationPct` (or resets to 100 if not yet saved).

#### FR-1.2 — Per-Point Stoppable Checkbox

Adjacent to the duration field:

| Control | Type | Default |
|---|---|---|
| `☐ Stoppable point` | Checkbox | Unchecked |

**Tooltip:** `"When 'Pause at stoppable points' is enabled in the player, the video will pause here and show this point's annotation."`

Captured and stored the same way as `durationPct` on "Save Point →".

#### FR-1.3 — Settings Modal (reserved)

A small **`⚙`** icon button beside the duration/stoppable controls opens a modal. In Epic 3 this modal is empty except for a note: `"Additional per-point parameters will appear here in future updates."` It establishes the extensibility pattern for future epics.

#### FR-1.4 — "▶ Play Video" Button

Once all points have a saved camera state (same condition as "Save to File"), a **"▶ Play Video"** button appears in the annotation toolbar.

Clicking it opens `trajectory_player.html?designation={sanitized_name}` in a new browser tab.

If the trajectory has unsaved changes (points annotated after the last "Save to File"), a dialog is shown:
- `"Your latest annotations haven't been saved to file yet. The player will show the last saved version."`
- Buttons: **"Save to File First"** | **"Open Player Anyway"**

#### FR-1.5 — Schema Extension

Two new optional fields added to each point in `trajectory.json`:

```json
{
  "date": "2025-10-29",
  "durationPct": 150,
  "stoppable": true,
  ...
}
```

- Both fields default to `durationPct: 100` and `stoppable: false` when absent
- All existing files remain valid (fully backward-compatible)
- `durationPct` is serialised as an integer
- `stoppable` is serialised as a boolean

---

### 5.2 Player Page Shell & URL Loading

**Requirement:** The player page loads a `trajectory.json` based on the `?designation=` URL parameter and handles all error states gracefully.

#### FR-2.1 — URL Parameter

| Format | Example |
|---|---|
| Full | `trajectory_player.html?designation=3I` |
| URL-encoded | `trajectory_player.html?designation=C%2F2025%20N1` |
| Short alias | `trajectory_player.html?d=3I` |

The designation is read on page load via `URLSearchParams(location.search)`. It is URL-decoded and used to construct the file path: `data/{sanitized_name}/trajectory.json` where `sanitized_name` = designation with spaces and `/` replaced by `_`.

#### FR-2.2 — Auto-load Behaviour

On load:
1. Read `designation` from URL
2. Fetch `data/{sanitized_name}/trajectory.json`
3. Parse and validate the JSON
4. Initialise the solar system viewer
5. Begin playback automatically

#### FR-2.3 — Error States

| Condition | User-Facing Message |
|---|---|
| No `?designation=` parameter | `"Open this page with a ?designation= URL parameter, or use the ▶ Play Video button from the Object Motion Tracker."` with a link to `object_motion.html` |
| File not found (404) | `"No saved trajectory found for '[designation]'. Annotate it first in the Object Motion Tracker."` with a link |
| Invalid JSON | `"The trajectory file for '[designation]' could not be read. It may be corrupt."` |
| Network error | `"Could not load the trajectory file. Check your connection and try again."` |
| Trajectory has points with `camera: null` | Graceful degradation — interpolate from nearest non-null camera neighbors (see §5.3) |

---

### 5.3 Animation Engine

**Requirement:** The player animates the object's position and camera smoothly between saved trajectory points using the interpolation approach established in the existing `atlas_main.js`.

#### FR-3.1 — Object Position: Catmull-Rom Spline

Object position between consecutive points is interpolated using the **Catmull-Rom spline** — the same `catmullRom()` function already present in `atlas_main.js`. For a segment from point `i` to point `i+1`, `t` progresses from 0→1 over the segment's computed duration. The four control points for the spline are `points[i-1]`, `points[i]`, `points[i+1]`, `points[i+2]` (clamped at the ends of the array).

#### FR-3.2 — Camera: Linear Interpolation (Lerp)

Camera state (`el`, `az`, `zoom`, `tx`, `ty`, `tz`) between two consecutive saved points uses the same **smooth-follow lerp** mechanism from `atlas_main.js` (`lerp(current, target, sp)` with `sp ≈ 0.022`). This produces the characteristic organic camera movement — decelerating into each point's view without any rigid snap while preserving the saved pan offset from Epic 2.

If a point has `camera: null` (un-annotated), the system skips it and interpolates between the nearest non-null camera states on either side.

#### FR-3.3 — Segment Duration

Each segment's playback duration is:

```
segmentMs = (durationPct / 100) × 1000 × (1 / speedMultiplier)
```

- `durationPct` from the **destination** point (the point being arrived at); defaults to 100
- Base duration: 1000ms (1 second)
- `speedMultiplier`: from the global speed ruler (§5.6)

Total video duration = sum of all segment durations at the current speed setting.

#### FR-3.4 — Date Display

The displayed date is **interpolated** between the two adjacent point dates as `t` progresses through each segment. Displayed as `"Mon DD, YYYY"` format (e.g., `"Oct 29, 2025"`), updating every frame. Positioned prominently as a calendar-style readout, matching the `fracToDate` / calendar style from the existing system.

---

### 5.4 Motion Trail

**Requirement:** A trail showing the full path already traveled by the object grows from the very first point throughout the entire playback.

#### FR-4.1 — Trail Accumulation

Each animation frame, the object's current interpolated world position `(wx, wy, wz)` is appended to a trail array. The trail starts from frame 1 of playback (the object's position at point 0). The trail is **not cleared** when the user scrubs the timeline backward — instead it rebuilds from the beginning of the current playback pass.

#### FR-4.2 — Trail Rendering

The trail is drawn as a series of short line segments using the same technique as `drawAtlasTrail()` in `atlas_main.js`:

- Each segment's opacity increases with its position in the trail: `rgba(120,255,200, pct × 0.7)` where `pct = i / trail.length`
- Line width: `1.8px`
- Colour: `rgba(120,255,200, …)` — matching the existing object marker colour

#### FR-4.3 — Trail Reset on Restart

When the user clicks `⏮ Restart`, the trail array is cleared and begins rebuilding from point 0.

---

### 5.5 Playback Controls

**Requirement:** A persistent control bar at the bottom of the screen provides standard media-player controls.

#### FR-5.1 — Control Bar Layout

```
[ ⏮ ]  [ ⏪ ]  [ ⏸ / ▶ ]  [ ⏩ ]  |  Speed: [═══●══] 1×  |  ☐ Pause at stoppable  |  [ ⛶ ]
```

| Button | Action |
|---|---|
| `⏮ Restart` | Jump to point 0, clear trail, reset date display |
| `⏪ Prev` | Immediately jump to the previous point; camera snaps to that point's saved state |
| `⏸ / ▶` | Toggle play/pause |
| `⏩ Next` | Immediately jump to the next point; camera snaps to that point's saved state |
| `⛶` | Toggle fullscreen (§5.11) |

#### FR-5.2 — Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` | Prev point |
| `→` | Next point |
| `F` | Toggle fullscreen |
| `Enter` | Continue (at a stoppable pause) |

Keyboard shortcuts are active when the page has focus and no text input is focused.

#### FR-5.3 — "Continue →" Button

When the player pauses at a stoppable point (§5.7), a prominent **"Continue →"** button appears above the control bar. Pressing it (or `Space` / `Enter`) resumes playback and hides the button.

---

### 5.6 Speed Ruler

**Requirement:** A global speed multiplier slider scales the entire timeline without touching individual `durationPct` values.

#### FR-6.1 — Speed Slider

- Range: `0.25×` to `4×`
- Default: `1×`
- Discrete steps: `0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4`
- Label beside slider: `"1×"` (updates live)
- The **total video duration** readout (e.g., `"Total: 23s"`) updates in real-time as the slider moves

#### FR-6.2 — Effect

Changing the speed ruler mid-playback takes effect immediately on the **current** segment — no need to restart.

---

### 5.7 Stop-at-Points Mode

**Requirement:** When enabled, the player automatically pauses at every point where `stoppable: true`, waiting for the user to continue.

#### FR-7.1 — Checkbox

A checkbox in the control bar: `☐ Pause at stoppable points` (default: unchecked).

#### FR-7.2 — Pause Behaviour

When the animation reaches a point with `stoppable: true` and the checkbox is checked:
1. Playback pauses at that point
2. The annotation overlay is shown automatically (§5.9) if the point has a description or image
3. The "Continue →" button appears
4. The user presses "Continue →", `Space`, or `Enter` to resume

#### FR-7.3 — Unchecked Behaviour

When unchecked, `stoppable` flags are ignored and the animation plays continuously through all points.

---

### 5.8 Timeline Scrubber

**Requirement:** A horizontal progress bar spanning the full width of the page shows the current playback position and allows seeking.

#### FR-8.1 — Progress Bar

- Progress fill reflects current playback position (proportional to elapsed time vs. total duration)
- A draggable thumb follows the fill
- Dragging pauses playback; releasing the thumb resumes if it was playing before drag (same behaviour as `atlas_main.js` timeline)

#### FR-8.2 — Point Markers on the Scrubber

Notches are placed on the scrubber at the position corresponding to each point:

| Notch Type | Condition | Shape |
|---|---|---|
| Stoppable | `stoppable: true` | Diamond `◆` |
| Annotated | has `description` or `image` | Dot `●` |
| Both | Both conditions | Diamond takes precedence |

#### FR-8.3 — Hover Tooltips

Hovering a notch shows a tooltip: `"[Date] · [first 60 chars of description]"` or just `"[Date] · stoppable"` if no description.

---

### 5.9 Annotation Overlay

**Requirement:** At stoppable points (in stop-at-points mode), an overlay card shows the point's description and image.

#### FR-9.1 — Overlay Visibility

The overlay appears when:
- Stop-at-points mode is active (`☐ Pause at stoppable points` is checked), AND
- The player has paused at a point where `stoppable: true`, AND
- The point has at least a `description` or an `image`

If `stoppable: true` but neither description nor image exists, no overlay is shown — the player simply pauses silently.

#### FR-9.2 — Overlay Layout

- Positioned: bottom-left, above the control bar
- Background: `rgba(0,1,14,0.88)` with a `1px` border `rgba(130,180,255,0.3)`, rounded corners — matching the `drawAtlasCloseup` panel aesthetic
- Contents (top to bottom):
  - Date: `"Oct 29, 2025"` — large, `Georgia` font
  - Image: displayed at max 200×150px if present; relative/local values resolve from `data/{sanitized_name}/...`, absolute URLs are used directly
  - Description text: `12px Georgia`, light colour
- Stays visible until the user dismisses it (clicks "Continue →" or presses Space/Enter)

---

### 5.12 Large Annotated Image Window

**Requirement:** For major story beats with an image, the player may present a larger dedicated image window that is clearly bigger than the old `atlas_journey` inset while remaining encapsulated inside the trajectory-player codepath.

#### FR-12.1 — Supported Image Sources

The `points[].image` field may contain either:

- A local filename/path resolved from `data/{sanitized_name}/...`
- An absolute remote URL (`http://` or `https://`)

The player resolves local values relative to the trajectory folder and passes absolute URLs through unchanged.

#### FR-12.2 — Window Layout

- The image window is rendered as a DOM overlay, not a canvas draw
- It follows the dark-panel style inspired by `drawAtlasCloseup()` in `atlas_main.js`
- It is noticeably larger than the old `atlas_journey` inset (`220×220`)
- Target layout:
  - Panel width between `340px` and `560px`
  - Image display target up to `420×280px`
  - Date shown above the image
  - Optional description shown below the image

#### FR-12.3 — Behavior

- The large image window is shown only when the active point has an image and the relevant player pause/annotation conditions are met
- If the image fails to load, playback and controls continue uninterrupted
- Existing points with `image: null` behave exactly as before
- The feature is implemented with minimum changes to the current player and without changing shared solar-system rendering behavior

---

### 5.10 Live Stats Display

**Requirement:** A small top-right readout shows the current date and the object's real-time distance from the Sun during playback.

#### FR-10.1 — Stats Panel

Positioned top-right, matching the dark-panel aesthetic:

```
Oct 29, 2025
Sun distance: 1.36 AU
```

- **Date:** interpolated between adjacent point dates (same as §5.3 FR-3.4)
- **Sun distance:** computed each frame as `sqrt(au.x² + au.y² + au.z²)`, interpolated between the two bounding points. Displayed to 2 decimal places.

---

### 5.11 Fullscreen Mode

**Requirement:** A fullscreen button enters the browser's native fullscreen API, hiding the browser chrome for a clean presentation.

#### FR-11.1 — Entry & Exit

- `⛶` button (or keyboard `F`) calls `document.documentElement.requestFullscreen()`
- `Esc` exits fullscreen (native browser behaviour)
- The canvas and control bar resize to fill the screen; the control bar remains accessible

#### FR-11.2 — Graceful Degradation

If `requestFullscreen()` is unavailable or denied (e.g., Safari restrictions, iframe context), the button fails silently — no error message shown to the user.

---

## 6. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | JSON load to first frame < 300ms |
| NFR-2 | Performance | 60fps animation on modern laptop hardware |
| NFR-3 | Compatibility | Chrome 120+, Firefox 120+, Safari 17+ |
| NFR-4 | Read-only | Player never writes to `trajectory.json` or any file |
| NFR-5 | Robustness | Points with `camera: null` are handled gracefully via neighbor interpolation |
| NFR-6 | Consistency | Visual language matches the 3i-web dark space aesthetic throughout |
| NFR-7 | Independence | `trajectory_player.html` has no dependency on `object_motion.js` |
| NFR-8 | URL | The player URL is bookmarkable and shareable — full state recoverable from the designation param |

---

## 7. Out of Scope for Epic 3

| Feature | Deferred To |
|---|---|
| Video export (MediaRecorder / canvas capture) | Epic 5 |
| Multi-object comparison | Epic 4 |
| Velocity-adaptive auto-fill of `durationPct` | Epic 4 |
| Mobile / touch support | Epic 5 |
| Audio narration track | Future |
| Loop mode | Future |

---

## 8. User Journeys

### Journey 1: "Present the 3I/ATLAS journey to colleagues"

1. User opens `object_motion.html?designation=3I` — loads the saved trajectory.
2. Updates `durationPct` values on key points: perihelion at 300%, quiet outer-solar-system points at 60%.
3. Checks `☐ Stoppable point` on perihelion and Earth closest approach. Adds descriptions: `"Perihelion — peak brightness"`.
4. Clicks "Save to File" → saves updated `trajectory.json`.
5. Clicks **"▶ Play Video"** → player opens in new tab.
6. Player auto-loads and begins playing.
7. At perihelion, playback pauses; the annotation card appears with the description.
8. User shares the URL `trajectory_player.html?designation=3I` with colleagues.

### Journey 2: "Quick preview during annotation"

1. User is mid-annotation on a 50-point trajectory.
2. Clicks "▶ Play Video" — dialog: "Latest annotations not saved to file yet."
3. Clicks "Save to File First" → saves → player opens.
4. Reviews the flow, notices the Jupiter segment feels too fast.
5. Returns to `object_motion.html`, increases `durationPct` on those points, saves again.

### Journey 3: "Scrub to a specific moment"

1. User opens player via URL.
2. Drags the timeline scrubber to the diamond notch at perihelion.
3. Playback resumes from that point. Trail shows path up to that moment.

---

## 9. Architecture & File Structure

```
3i-web/
├── trajectory_player.html     ← NEW: player entry point
├── trajectory_player.js       ← NEW: all playback logic
├── solar_system.js            ← REUSED (SolarSystem public API)
├── shared_render.js           ← REUSED (project3, lerp, catmullRom, etc.)
├── object_motion.html         ← MODIFIED: adds ▶ Play Video button
├── object_motion.js           ← MODIFIED: adds durationPct, stoppable, Play Video
└── data/
    └── {designation}/
        └── trajectory.json    ← READ ONLY by player
```

### Module Breakdown — `trajectory_player.js`

| Module | Responsibility |
|---|---|
| `TrajectoryLoader` | Reads `?designation=` param, fetches and validates `trajectory.json`, handles all error states |
| `PlaybackEngine` | `requestAnimationFrame` loop; Catmull-Rom spline position; camera lerp; segment timing; trail accumulation |
| `PlaybackController` | State machine: playing / paused / stopped-at-point; play/pause/prev/next/restart actions |
| `TrailRenderer` | Draws the growing motion trail each frame |
| `ControlBar` | Renders playback buttons, speed ruler, stoppable checkbox; wires keyboard shortcuts |
| `TimelineScrubber` | Scrubber bar; drag-to-seek; notch markers; hover tooltips |
| `AnnotationOverlay` | Shows description + image card at stoppable points |
| `StatsDisplay` | Live date + Sun distance top-right readout |

### Reuse from Existing Codebase

| Item | Source | Usage |
|---|---|---|
| `catmullRom(p0,p1,p2,p3,t)` | `atlas_main.js` | Moved / re-imported into `trajectory_player.js` |
| `lerp(a,b,t)` | `atlas_main.js` | Camera smooth follow |
| `project3(wx,wy,wz)` | `shared_render.js` | Trail and marker projection |
| `SolarSystem` public API | `solar_system.js` | Viewer, camera get/set state, layers |
| Trail draw pattern | `drawAtlasTrail()` in `atlas_main.js` | Direct adaptation |
| Dark-panel aesthetic | `drawAtlasCloseup()` in `atlas_main.js` | Annotation overlay style |

---

## 10. Data Schemas

### 10.1 Extended Point Schema (backward-compatible addition)

New fields added to each point (both optional, backward-compatible):

```json
{
  "date": "2025-10-29",
  "jd": 2460977.5,
  "durationPct": 150,
  "stoppable": true,
  "au": { "x": -1.3082, "y": -0.3469, "z": 0.0920 },
  "px": { "wx": -229, "wy": -61, "wz": 16 },
  "camera": {
    "el": 45.0,
    "az": 0.0,
    "zoom": 0
  },
  "image": "images/perihelion.jpg",
  "description": "Perihelion — closest approach to Sun, 1.356 AU. Peak brightness."
}
```

**Defaults when absent:**
- `durationPct` → `100`
- `stoppable` → `false`

---

## 11. Constraints & Dependencies

| Constraint | Detail |
|---|---|
| **Epic 2 dependency** | `trajectory.json` files with saved camera states (all `camera` fields non-null) are required for full playback; files with some `camera: null` points are handled via neighbor interpolation |
| **Epic 1 dependency** | `solar_system.js` must expose `SolarSystem.camera.getState()` and `SolarSystem.camera.setRawState()` |
| **Catmull-Rom reuse** | The `catmullRom` and `lerp` functions currently in `atlas_main.js` must be accessible to `trajectory_player.js` — they can be duplicated or extracted to `shared_render.js` |
| **Scale convention** | 1 AU = 175 px — unchanged |
| **Read-only** | The player page must never write to any file — it is a pure consumer of `trajectory.json` |
| **URL parameter** | `sanitized_name` in the URL must match the folder name convention from Epic 2 (`spaces and / → _`) |
| **Image source support** | `points[].image` may be a local asset path relative to the trajectory folder or an absolute remote URL |

---

*End of PRD — Epic 3: Trajectory Player*

---

**Document version:** 1.0
**Depends on:** Epic 1 (solar_system.js), Epic 2 (trajectory.json with camera states)
**Next step:** Stories — Epic 3
