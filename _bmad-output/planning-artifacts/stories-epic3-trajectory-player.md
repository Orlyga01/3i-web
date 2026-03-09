# Stories — Epic 3: Trajectory Player (Cinematic Flyby)

**Author:** orly
**Date:** 2026-03-08
**Status:** Draft
**Epic:** 3 — Trajectory Player
**Source PRD:** `prd-epic3-trajectory-player.md`

---

## Story Index

| Story | Title | Status |
|---|---|---|
| [3.1](#story-31--player-page-shell--url-loading) | Player Page Shell & URL Loading | 🔲 Pending |
| [3.2](#story-32--animation-engine) | Animation Engine (Spline + Camera Lerp) | 🔲 Pending |
| [3.3](#story-33--motion-trail) | Motion Trail | 🔲 Pending |
| [3.4](#story-34--playback-controls--keyboard-shortcuts) | Playback Controls & Keyboard Shortcuts | 🔲 Pending |
| [3.5](#story-35--speed-ruler) | Speed Ruler | 🔲 Pending |
| [3.6](#story-36--stop-at-points-mode) | Stop-at-Points Mode | 🔲 Pending |
| [3.7](#story-37--timeline-scrubber) | Timeline Scrubber | 🔲 Pending |
| [3.8](#story-38--annotation-overlay) | Annotation Overlay | 🔲 Pending |
| [3.9](#story-39--live-stats-display) | Live Stats Display | 🔲 Pending |
| [3.10](#story-310--fullscreen-mode) | Fullscreen Mode | 🔲 Pending |

---

## Story 3.1 — Player Page Shell & URL Loading

**As a** presenter or author,
**I want** to open a dedicated player page via a URL with a `?designation=` parameter,
**so that** the correct trajectory loads automatically and begins playing.

### Acceptance Criteria

- [ ] A new file `trajectory_player.html` exists and loads without errors
- [ ] A new file `trajectory_player.js` exists and is loaded by the HTML
- [ ] On page load, the system reads `?designation=` (or short alias `?d=`) from the URL query string via `URLSearchParams(location.search)`
- [ ] The designation value is URL-decoded and used to construct the fetch path: `data/{sanitized_name}/trajectory.json` where `sanitized_name` = designation with spaces and `/` replaced by `_`
- [ ] The `trajectory.json` is fetched and parsed; on success the solar system viewer is initialised and playback begins automatically
- [ ] **Error states display clean, non-technical messages and include a link to `object_motion.html`:**
  - No `?designation=` param: `"Open this page with a ?designation= URL parameter, or use the ▶ Play Video button from the Object Motion Tracker."`
  - File not found (404): `"No saved trajectory found for '[designation]'. Annotate it first in the Object Motion Tracker."`
  - Invalid JSON: `"The trajectory file for '[designation]' could not be read. It may be corrupt."`
  - Network error: `"Could not load the trajectory file. Check your connection and try again."`
- [ ] The page uses the existing dark space aesthetic (`styles.css`); no new conflicting global styles
- [ ] The page has no dependency on `object_motion.js`, `atlas_main.js`, or `atlas_data.js`
- [ ] `trajectory_player.js` defines the top-level module stubs: `TrajectoryLoader`, `PlaybackEngine`, `PlaybackController`, `TrailRenderer`, `ControlBar`, `TimelineScrubber`, `AnnotationOverlay`, `StatsDisplay`
- [ ] Supported URL formats:
  - `trajectory_player.html?designation=3I`
  - `trajectory_player.html?designation=C%2F2025%20N1`
  - `trajectory_player.html?d=3I`

### Technical Notes

- `TrajectoryLoader.load(designation)` — async; returns the parsed points array or throws a typed error
- `sanitize(name)` follows the same convention as Epic 2: `name.replace(/[\s\/]/g, '_')`
- The solar system viewer is initialised via `SolarSystem` public API from `solar_system.js` (same as Epic 2)
- `solar_system.js` and `shared_render.js` are `<script>` dependencies in `trajectory_player.html`

### Dependencies
- Epic 1 (`solar_system.js` must be complete)
- Epic 2 (a saved `trajectory.json` with camera states must exist for full testing)
- Story 2.14 (schema fields `durationPct`, `stoppable` must be understood by the loader)

---

## Story 3.2 — Animation Engine (Spline + Camera Lerp)

**As a** viewer,
**I want** the object to move smoothly along its trajectory and the camera to glide between saved views,
**so that** the animation feels cinematic rather than choppy.

### Acceptance Criteria

- [ ] The `PlaybackEngine` runs a `requestAnimationFrame` loop continuously while the page is active
- [ ] **Object position** is interpolated along the trajectory using a **Catmull-Rom spline** (identical to the `catmullRom()` function in `atlas_main.js`):
  - The four control points for segment `i → i+1` are `points[i-1]`, `points[i]`, `points[i+1]`, `points[i+2]`, clamped at array ends
  - `t` progresses from `0 → 1` over the segment's computed duration (see below)
  - Position is derived from `px.wx`, `px.wy`, `px.wz` fields of each point
- [ ] **Camera state** transitions between the saved `camera` values of consecutive points using **smooth-follow lerp** (same `lerp(current, target, sp)` pattern with `sp ≈ 0.022` from `atlas_main.js`):
  - Camera fields: `el` (elevation), `az` (azimuth), `zoom`
  - The camera lerps toward the **destination** point's camera state throughout the segment
- [ ] **Segment duration** is:
  ```
  segmentMs = (durationPct / 100) × 1000 × (1 / speedMultiplier)
  ```
  Where `durationPct` is from the **destination** point (defaults to `100` if absent), and `speedMultiplier` is from the speed ruler (§3.5, defaults to `1`)
- [ ] **Points with `camera: null`** are handled gracefully: the engine skips the null point and interpolates camera between the nearest non-null neighbors on either side; object position still passes through the null point's coordinates
- [ ] **Date display** updates every frame: the current date is linearly interpolated between the two adjacent point dates as `t` progresses. Displayed as `"Mon DD, YYYY"` in the stats area (Story 3.9)
- [ ] When `t` reaches `1.0` for the last segment, playback stops; the `PlaybackController` transitions to the `stopped` state
- [ ] The object is drawn on the canvas each frame at its interpolated position using the existing `drawComet()` or equivalent marker draw call from `solar_system.js` / `shared_render.js`

### Technical Notes

- `PlaybackEngine.tick(deltaMs)` — called each `requestAnimationFrame`; advances `t` by `deltaMs / segmentMs`; handles segment boundary crossing
- `catmullRom(p0, p1, p2, p3, t)` — can be duplicated from `atlas_main.js` or extracted to `shared_render.js`; do not modify `atlas_main.js`
- `lerp(a, b, t)` — same utility function; same source
- Camera state is passed to `SolarSystem.camera.setRawState({ el, az, zoom })` each frame

### Dependencies
- Story 3.1 (page shell and loaded trajectory data)

---

## Story 3.3 — Motion Trail

**As a** viewer,
**I want** to see the path the object has already traveled drawn as a glowing line,
**so that** I can understand the trajectory's shape and history at a glance.

### Acceptance Criteria

- [ ] Starting from the very first animation frame (object at point 0), the trail begins accumulating
- [ ] Each frame, the object's current interpolated world position `(wx, wy, wz)` is appended to a trail array
- [ ] The trail is drawn as a series of connected line segments between consecutive trail points:
  - Each segment's opacity = `(i / trail.length) × 0.7` — newer segments are more opaque, older ones fade out at the start
  - Colour: `rgba(120,255,200, opacity)`
  - Line width: `1.8px`
  - Uses `project3(wx, wy, wz)` from `shared_render.js` to convert world → screen coordinates
  - Segments behind the camera (depth < 10) are skipped
- [ ] The trail is drawn **before** the object marker each frame, so the marker renders on top
- [ ] When `⏮ Restart` is triggered (Story 3.4), the trail array is cleared and rebuilds from point 0
- [ ] When the user jumps to a different point via `⏩ / ⏪` (Story 3.4) or the scrubber (Story 3.7), the trail array is cleared and rebuilds from the new position forward

### Technical Notes

- `TrailRenderer` maintains a `trail: Array<{wx, wy, wz}>` array
- No maximum trail length cap — the full path from point 0 to the current position is always shown
- Trail draw is a direct adaptation of `drawAtlasTrail()` from `atlas_main.js`

### Dependencies
- Story 3.2 (animation engine must produce interpolated positions each frame)

---

## Story 3.4 — Playback Controls & Keyboard Shortcuts

**As a** viewer,
**I want** standard playback controls — play, pause, step forward and back, restart — with keyboard shortcuts,
**so that** I can navigate the animation fluidly without taking my hands off the keyboard.

### Acceptance Criteria

- [ ] A fixed control bar is visible at the bottom of the screen with the following buttons, in order:
  - `⏮` Restart
  - `⏪` Prev Point
  - `⏸ / ▶` Play / Pause (toggles; label updates to reflect state)
  - `⏩` Next Point
- [ ] **`⏮ Restart`:** jumps to the beginning of segment 0 (object at point 0), clears the trail, resets the camera to point 0's saved state, begins playing
- [ ] **`⏪ Prev Point`:** immediately moves to the start of the previous segment; camera snaps (not lerps) to the previous point's saved camera state; trail is trimmed to only include positions up to that point
- [ ] **`⏩ Next Point`:** immediately moves to the start of the next segment; camera snaps to that point's saved camera state; trail continues from that position
- [ ] **`⏸ / ▶`:** toggles between playing and paused; the `PlaybackEngine` loop continues running but `t` is not advanced while paused
- [ ] **Keyboard shortcuts** — active when no text input is focused:
  | Key | Action |
  |---|---|
  | `Space` | Play / Pause |
  | `←` | Prev Point |
  | `→` | Next Point |
  | `F` | Toggle fullscreen (Story 3.10) |
  | `Enter` | Continue → (at a stoppable pause, Story 3.6) |
- [ ] Prev/Next buttons are disabled (visually greyed) at the start and end of the trajectory respectively
- [ ] Clicking the canvas (outside the control bar) toggles play/pause — matching the existing `atlas_main.js` behaviour

### Technical Notes

- `PlaybackController` holds state: `playing | paused | stopped-at-point`
- Snap (not lerp) on Prev/Next: directly set `SolarSystem.camera.setState(point.camera)` rather than setting lerp target
- `stopped-at-point` is a distinct state from `paused` — it is entered by Story 3.6 (stop-at-stoppable-point), not by the play/pause toggle

### Dependencies
- Story 3.2 (PlaybackEngine loop)
- Story 3.3 (trail reset on Restart / Prev / Next)

---

## Story 3.5 — Speed Ruler

**As a** presenter,
**I want** a global speed multiplier that makes the whole video faster or slower,
**so that** I can adjust the pace without touching individual point durations.

### Acceptance Criteria

- [ ] A horizontal range slider is shown in the control bar, labelled `"Speed:"`
- [ ] Slider range: `0.25×` to `4×`; discrete steps: `0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4`
- [ ] Default value: `1×`
- [ ] A live text label beside the slider shows the current value, e.g., `"1×"`, updating as the user drags
- [ ] A **total video duration** readout updates in real-time as the slider changes, e.g., `"Total: 23s"`:
  - Total = sum of all segments: `Σ (durationPct[i] / 100) × 1000 × (1 / speedMultiplier)` in seconds, rounded to 1 decimal place
- [ ] Changing the speed ruler **mid-playback** takes effect immediately on the current segment — no need to restart
- [ ] The speed multiplier is stored in `PlaybackController` state and read by `PlaybackEngine` on every `tick()`

### Technical Notes

- `<input type="range">` with `step` attribute; map the discrete steps using a lookup array rather than a linear scale
- The total duration is recalculated on every `input` event

### Dependencies
- Story 3.2 (segment duration formula uses `speedMultiplier`)
- Story 3.4 (control bar DOM exists)

---

## Story 3.6 — Stop-at-Points Mode

**As a** storyteller,
**I want** the player to automatically pause when it reaches a stoppable point,
**so that** I can narrate or explain what's happening before the audience continues.

### Acceptance Criteria

- [ ] A checkbox is shown in the control bar: `☐ Pause at stoppable points` (default: unchecked)
- [ ] When **unchecked**: the `stoppable` field of every point is ignored; playback is continuous
- [ ] When **checked** and the animation reaches a point where `stoppable: true`:
  1. Playback transitions to the `stopped-at-point` state
  2. A prominent **"Continue →"** button appears above the control bar (centred, large)
  3. The annotation overlay is shown automatically if the point has a `description` or `image` (Story 3.8)
  4. `⏸ / ▶` button is visually disabled in this state — the play/pause toggle does not work while stopped-at-point
- [ ] Pressing "Continue →" or keyboard `Space` / `Enter` (when not in a text input):
  1. Hides the "Continue →" button
  2. Dismisses the annotation overlay
  3. Transitions back to the `playing` state
  4. Playback resumes from the start of the next segment
- [ ] If `stoppable: true` but the point has no `description` and no `image`, the player pauses silently (no overlay shown) — the "Continue →" button still appears
- [ ] Points with `stoppable: false` (or absent) are never paused at, regardless of checkbox state

### Technical Notes

- `PlaybackEngine` checks `stoppable` at the moment `t` reaches `1.0` for a segment (i.e., upon arriving at the destination point)
- The "Continue →" button is a DOM element, shown/hidden via CSS class
- `stopped-at-point` state is checked in `PlaybackController.tick()` to prevent `t` from advancing

### Dependencies
- Story 3.2 (animation engine segment boundary detection)
- Story 3.4 (control bar DOM)
- Story 3.8 (annotation overlay)

---

## Story 3.7 — Timeline Scrubber

**As a** viewer,
**I want** a timeline bar showing my position in the video that I can drag to seek,
**so that** I can jump to any moment instantly.

### Acceptance Criteria

- [ ] A full-width horizontal progress bar is displayed above the control bar
- [ ] The **progress fill** reflects the current playback position as a fraction of total video duration
- [ ] A **draggable thumb** moves with the fill and can be dragged by the user:
  - On `mousedown` on the thumb or bar: pause playback and track drag
  - On `mousemove` while dragging: update position; trail rebuilds from new position
  - On `mouseup`: if playback was playing before drag, resume; if was paused, stay paused
  - Click (without drag) on the bar also seeks to that position
- [ ] **Point notches** are placed on the scrubber at the exact position (proportional to cumulative duration) for each trajectory point:
  | Notch type | Condition | Shape | Colour |
  |---|---|---|---|
  | Stoppable | `stoppable: true` | Diamond `◆` | `rgba(120,255,200,0.9)` |
  | Annotated | has `description` or `image` | Dot `●` | `rgba(150,200,255,0.7)` |
  | Both | Both conditions true | Diamond takes precedence | Stoppable colour |
- [ ] **Hovering** a notch shows a tooltip: `"[Date] · [first 60 chars of description]"` or `"[Date] · stoppable"` if no description
- [ ] After a drag seek, the trail is cleared and rebuilt from the seeked point forward

### Technical Notes

- Notch positions are pre-calculated once on load: `cumulativeDuration[i] / totalDuration` gives the fractional position of point `i` on the scrubber
- Seeking snaps to the **nearest point** (not mid-segment) for simplicity — seeking always begins from the start of a segment
- Timeline uses `mousedown`, `mousemove`, `mouseup` on `document` (same pattern as `atlas_main.js` timeline)

### Dependencies
- Story 3.2 (total duration and per-segment durations must be computed)
- Story 3.4 (control bar DOM; play/pause state)
- Story 3.3 (trail reset on seek)

---

## Story 3.8 — Annotation Overlay

**As a** viewer at a stoppable point,
**I want** to see the description and image for this point displayed as a caption card,
**so that** I can read the context the author intended to show here.

### Acceptance Criteria

- [ ] The overlay is shown **only** when all of the following are true:
  1. Stop-at-points mode is active (checkbox checked)
  2. The player has paused at a `stoppable: true` point
  3. The point has at least a non-null `description` or a non-null `image`
- [ ] If `stoppable: true` but both `description` and `image` are null: no overlay is shown (player pauses silently)
- [ ] **Overlay layout** — positioned bottom-left, above the control bar:
  - Background: `rgba(0,1,14,0.88)`, border `1px solid rgba(130,180,255,0.3)`, `border-radius: 10px` — matching the `drawAtlasCloseup` panel aesthetic
  - Date line: the point's date in large `Georgia` font, `rgba(200,235,255,0.9)`
  - Image: displayed at maximum `200×150px` (`object-fit: contain`) if `image` is non-null; fetched from `data/{sanitized_name}/{image_filename}`
  - Description text: `12px Georgia`, `rgba(180,210,255,0.85)`, wrapping within the panel width
  - Minimum panel width: `260px`; maximum: `360px`
- [ ] The overlay is dismissed when the user presses "Continue →" or `Space` / `Enter` (Story 3.6)
- [ ] The overlay is **not** shown when the user manually steps to a stoppable point via `⏪ / ⏩` (Step buttons) — it is only triggered by the automatic stop during continuous play

### Technical Notes

- `AnnotationOverlay.show(point, sanitizedName)` / `AnnotationOverlay.hide()`
- Image loading: `<img src="data/{sanitizedName}/{point.image}">` — uses the same relative path convention as Epic 2 Update Mode
- The overlay is a DOM element, not a canvas draw — it sits over the canvas via CSS `position: absolute; z-index: 10`

### Dependencies
- Story 3.6 (stop-at-points mode triggers the overlay)

---

## Story 3.9 — Live Stats Display

**As a** viewer,
**I want** to see the current date and the object's distance from the Sun update in real-time during playback,
**so that** the animation feels grounded and scientifically meaningful.

### Acceptance Criteria

- [ ] A small panel is shown in the **top-right** corner of the canvas throughout playback
- [ ] Panel background: `rgba(0,1,14,0.75)`, border `1px solid rgba(130,180,255,0.2)`, `border-radius: 8px`, `padding: 8px 12px` — dark-panel aesthetic
- [ ] The panel shows two lines:
  1. **Date** — interpolated between adjacent point dates as `t` progresses; format: `"Oct 29, 2025"`
  2. **Sun distance** — `"Sun: 1.36 AU"` — computed each frame as `sqrt(au.x² + au.y² + au.z²)`, linearly interpolated between the two bounding points' `au` values; displayed to 2 decimal places
- [ ] Both values update every frame during playback; they also update when the user drags the timeline scrubber
- [ ] The panel is visible at all times during playback (not only at stoppable points)
- [ ] In fullscreen mode (Story 3.10), the panel remains visible

### Technical Notes

- Date interpolation: calculate fractional days between `point[i].date` and `point[i+1].date` using `t`, then format the resulting `Date` object
- AU distance: `Math.sqrt(auX*auX + auY*auY + auZ*auZ)` where `auX = lerp(points[i].au.x, points[i+1].au.x, t)` etc.
- Panel is a DOM element positioned over the canvas via CSS `position: absolute; top: 16px; right: 16px`

### Dependencies
- Story 3.2 (interpolated `t`, `au` values available each frame)

---

## Story 3.10 — Fullscreen Mode

**As a** presenter,
**I want** to enter fullscreen so the animation fills the entire screen,
**so that** I can show it cleanly at a conference or on a display without browser chrome.

### Acceptance Criteria

- [ ] A **`⛶`** button is shown in the control bar (rightmost position)
- [ ] Clicking it calls `document.documentElement.requestFullscreen()` (or vendor-prefixed equivalent)
- [ ] On entering fullscreen:
  - The canvas resizes to fill the full screen dimensions
  - The control bar remains visible at the bottom
  - The stats display (Story 3.9) remains visible top-right
  - The annotation overlay (Story 3.8) remains visible bottom-left
- [ ] Pressing `Esc` exits fullscreen (native browser behaviour); pressing `F` also toggles
- [ ] On exiting fullscreen, the canvas returns to its normal embedded dimensions
- [ ] If `requestFullscreen()` is unavailable or throws (e.g., Safari restrictions, iframe context), the failure is caught silently — no error message is shown to the user; the `⛶` button remains visible but clicking it has no effect

### Technical Notes

- Listen to the `fullscreenchange` event to update the `⛶` button icon (e.g., `⛶` → `⊡` to indicate exit mode)
- Canvas resize: use `ResizeObserver` or listen to `fullscreenchange` + `window.resize` to call `canvas.width = window.innerWidth; canvas.height = window.innerHeight`

### Dependencies
- Story 3.4 (control bar DOM; keyboard shortcut `F`)

---

## Implementation Order (Suggested)

```
3.1  Player Page Shell & URL Loading       ← foundation
3.2  Animation Engine                      ← core engine
3.3  Motion Trail                          ← visual layer on engine
3.4  Playback Controls & Keyboard          ← minimum interactive product complete here
3.5  Speed Ruler                           ← pacing control
3.6  Stop-at-Points Mode                   ← storytelling feature
3.7  Timeline Scrubber                     ← seek / navigation
3.8  Annotation Overlay                    ← depends on 3.6
3.9  Live Stats Display                    ← informational layer
3.10 Fullscreen Mode                       ← presentation polish
```

Stories 3.1–3.4 form the **minimum working player** — loads a trajectory, animates it, basic controls. Stories 3.5–3.8 add the pacing and storytelling features. Stories 3.9–3.10 add presentation polish.

**Epic 2 prerequisites (must be complete before Epic 3 development):**
- Story 2.14 (per-point `durationPct` and `stoppable` fields in annotation UI + schema)
- Story 2.15 (`▶ Play Video` button in `object_motion.html`)

---

*End of Stories — Epic 3: Trajectory Player*

**Document version:** 1.0
**Epic PRD:** `prd-epic3-trajectory-player.md`
**Depends on:** Stories 2.14, 2.15 (Epic 2 additions)
