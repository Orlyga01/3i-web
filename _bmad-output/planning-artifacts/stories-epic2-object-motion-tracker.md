# Stories — Epic 2: Object Motion Tracker

**Author:** orly
**Date:** 2026-03-08
**Status:** Draft
**Epic:** 2 — Object Motion Tracker
**Source PRD:** `prd-epic2-object-motion-tracker.md`

---

## Story Index

| Story | Title | Status |
|---|---|---|
| [2.1](#story-21--page-shell--input-form) | Page Shell & Input Form | ✅ Done |
| [2.2](#story-22--horizons-api-client) | Horizons API Client | ✅ Done |
| [2.3](#story-23--api-error-handling) | API Error Handling | ✅ Done |
| [2.4](#story-24--bundled-data-auto-load--update-mode) | Bundled Data Auto-Load & Update Mode | ✅ Done |
| [2.5](#story-25--solar-system-viewer-integration) | Solar System Viewer Integration | ✅ Done |
| [2.6](#story-26--object-marker-layer) | Object Marker Layer | ✅ Done |
| [2.7](#story-27--progress-sidebar) | Progress Sidebar | ✅ Done |
| [2.8](#story-28--point-by-point-camera-annotation) | Point-by-Point Camera Annotation | ✅ Done |
| [2.9](#story-29--per-point-image-upload) | Per-Point Image Upload | ✅ Done |
| [2.10](#story-210--per-point-text-description) | Per-Point Text Description | ✅ Done |
| [2.11](#story-211--localstorage-draft--auto-save) | LocalStorage Draft & Auto-save | ✅ Done |
| [2.12](#story-212--json-serialisation--file-save) | JSON Serialisation & File Save | ✅ Done |
| [2.13](#story-213--deep-link-via-url-parameter) | Deep-Link via URL Parameter | ✅ Done |
| [2.14](#story-214--per-point-duration--stoppable-flag) | Per-Point Duration & Stoppable Flag | ✅ Done |
| [2.15](#story-215--play-video-button--player-handoff) | "Play Video" Button & Player Handoff | ✅ Done |
| [2.16](#story-216--offline-file-upload-fallback) | Offline File Upload Fallback | ✅ Done |

---

## Story 2.1 — Page Shell & Input Form

**As a** trajectory author,
**I want** to open a dedicated page where I can enter an object designation and date range,
**so that** I can start the process of fetching and annotating a trajectory.

### Acceptance Criteria

- [ ] A new file `object_motion.html` exists and loads without errors
- [ ] A new file `object_motion.js` exists and is loaded by the HTML
- [ ] The page displays an input form with four fields:
  - Object Designation (text, required)
  - Start Date (`<input type="date">`, required)
  - End Date (`<input type="date">`, required)
  - Step Size: a dropdown (`1d`, `7d`, `14d`, `1mo`) **and** a free-text field beside it (optional, overrides dropdown if filled); default selection is `1d`
- [ ] A **"Fetch Trajectory"** button is visible and enabled only when designation, start date, and end date are all filled
- [ ] Inline validation fires before any API call: if end date ≤ start date, show message "End date must be after Start date." and block submission
- [ ] Page uses the existing `styles.css` dark space aesthetic; no new conflicting global styles
- [ ] Page has no runtime dependency on `atlas_data.js`, `atlas_main.js`, or `main.js`
- [ ] Page is reachable via a link from `solar_system.html` (or the project index)

### Technical Notes

- The solar system viewer canvas area is rendered below/beside the form but remains empty until a trajectory is loaded (Story 2.5)
- The sidebar panel area is present in the DOM but hidden until data is loaded (Story 2.7)
- `object_motion.js` defines the top-level module structure: `HorizonsClient`, `TrajectoryStore`, `WorkflowController`, `ObjectMarker`, `ProgressPanel`, `MediaAnnotator`, `FileIO` — stubs are acceptable at this stage

### Dependencies
- None — this is the foundation story

---

## Story 2.2 — Horizons API Client

**As a** trajectory author,
**I want** the app to call the JPL Horizons API with my entered designation and date range,
**so that** I get back a list of dated heliocentric positions ready to plot.

### Acceptance Criteria

- [ ] On "Fetch Trajectory" click (after passing validation), an HTTP GET request is made to:
  ```
  https://ssd.jpl.nasa.gov/api/horizons.api
    ?format=json
    &COMMAND='DES={designation}'
    &EPHEM_TYPE=VECTORS
    &CENTER=500@10
    &START_TIME={start}
    &STOP_TIME={stop}
    &STEP_SIZE={step}
    &VEC_TABLE=2
  ```
- [ ] The designation is URL-encoded; wrapped in single quotes in the COMMAND parameter
- [ ] If the free-text step field is filled, its value is used; otherwise the dropdown value is used
- [ ] The `result` field of the JSON response is parsed to extract data rows between `$$SOE` and `$$EOE` markers
- [ ] Each row yields: Julian Date (`jd`), calendar date string (`date`), X, Y, Z in AU (`au.x`, `au.y`, `au.z`)
- [ ] Coordinates are converted to animation pixels: `wx = X × 175`, `wy = Y × 175`, `wz = Z × 175`
- [ ] VX, VY, VZ (velocity) fields are parsed but discarded — not stored
- [ ] The parsed result is an ordered `Point[]` array matching the schema in PRD Section 10.1
- [ ] A loading indicator ("Fetching trajectory…") is shown while the request is in flight
- [ ] After successful parse, the point count is displayed: e.g., "258 points loaded"

### Technical Notes

- Module: `HorizonsClient.fetch(designation, startDate, endDate, step)` returns `Promise<Point[]>`
- The Horizons API supports CORS — no proxy is needed
- Each `$$SOE`/`$$EOE` row format (compact VECTORS):
  ```
  2461223.500000000 = A.D. 2025-Jul-01 00:00:00.0000 TDB
   X = 2.740000000000000E-01 Y =-4.497000000000000E+00 Z = 2.910000000000000E-01
   VX= ... VY= ... VZ= ...
  ```
  Parse `X`, `Y`, `Z` values using regex on the scientific notation format
- Scale: 1 AU = 175 px (canonical project constant)

### Dependencies
- Story 2.1 (form must exist to trigger the call)

---

## Story 2.3 — API Error Handling

**As a** trajectory author,
**I want** clear error messages when the object lookup fails,
**so that** I know what went wrong and can try a corrected designation.

### Acceptance Criteria

- [ ] **Object not found:** API response contains no `$$SOE` marker or returns an error flag → show: "Object '[name]' was not found in the JPL Horizons database. Check the designation and try again."
- [ ] **Ambiguous designation:** API response indicates multiple matches → show: "Multiple matches found. Please enter a more specific designation (e.g., use the full provisional designation)."
- [ ] **Network error / timeout:** `fetch()` rejects or returns a non-200 status → show: "Could not reach the JPL Horizons API. Check your connection and try again."
- [ ] **Zero data points:** `$$SOE`/`$$EOE` block is present but empty → show: "No ephemeris data found for '[name]' in the specified date range."
- [ ] In all error cases:
  - The error message is displayed clearly near the form (not a browser alert)
  - The form remains fully visible and editable with the previously entered values intact
  - The loading indicator is dismissed
  - No partial data is shown or stored

### Technical Notes

- Horizons signals "not found" via text patterns in the `result` field (e.g., `"No matches found"`, `"ERROR"`) — inspect both the HTTP status and the result text
- Wrap `HorizonsClient.fetch()` in try/catch; propagate typed errors (`NotFoundError`, `AmbiguousError`, `NetworkError`, `EmptyDataError`) to the UI layer

### Dependencies
- Story 2.2

---

## Story 2.4 — Bundled Data Auto-Load & Update Mode

**As a** dataset curator,
**I want** the app to automatically detect and load a saved trajectory for an object,
**so that** I can immediately continue annotation without a manual confirmation step.

### Acceptance Criteria

- [ ] When "Search" is clicked, after the localStorage draft check, the system performs a GET `fetch()` to `data/{sanitized_name}/trajectory.json`
  - `sanitized_name` = designation with spaces and `/` replaced by `_` (e.g., `C/2025 N1` → `C_2025_N1`)
- [ ] If the file returns HTTP 200 (exists):
  - The JSON is parsed and loaded **automatically** — no confirmation card is shown
  - `TrajectoryStore` is populated via `loadTrajectoryFromData()`
  - The result is immediately written to `localStorage` under `objectMotion:{sanitized_name}` (so subsequent loads use the draft path)
  - The viewer activates directly (Update Mode)
- [ ] All points that have a `camera` object are marked `✓ saved` in the progress indicator
- [ ] Camera is pre-set to the saved state when a saved point becomes active
- [ ] If the file returns 404 (or the fetch fails), the fallback section is revealed (Story 2.16 upload + date-range form for API) — no silent failure
- [ ] The old "Load Saved Data / Re-fetch from Horizons" confirmation card is **removed**

### Technical Notes

- Sanitisation function: `sanitize(name) => name.replace(/[\s\/]/g, '_')`
- In Update Mode, when navigating to a point that has no saved camera state, the camera retains its current view (same as normal annotation mode)
- Existing `image` filenames in the JSON are used to fetch thumbnails from `data/{sanitized_name}/point_{index}.{ext}`
- `_saveDraft()` is called immediately after `loadTrajectoryFromData()` so the data is cached for offline/fast reload

### Dependencies
- Story 2.1, Story 2.2

---

## Story 2.5 — Solar System Viewer Integration

**As a** trajectory author,
**I want** the solar system viewer to appear on the annotation page once trajectory data is loaded,
**so that** I can see the solar system and navigate it using familiar controls.

### Acceptance Criteria

- [ ] After trajectory data is loaded (from API or saved file), the full Epic 1 solar system viewer is rendered on the page — planets, orbits, starfield, ecliptic plane, arcball widget, zoom rulers, preset buttons
- [ ] The viewer uses the `SolarSystem` public API from `solar_system.js`: `SolarSystem.layers`, `SolarSystem.camera`, `SolarSystem.engine`
- [ ] The simulation is **paused** immediately on load — `SolarSystem.engine.pause()` is called — the planets do not animate
- [ ] The simulation date is set to the first data point's date: `SolarSystem.camera.setDate(points[0].date)`
- [ ] All Epic 1 camera controls work as expected: arcball drag, canvas drag, zoom rulers, preset buttons, scroll wheel zoom
- [ ] The input form is hidden or collapsed once the viewer is active (to maximise canvas space); a small **"← New Search"** button allows the user to return to the form
- [ ] `solar_system.js` is loaded as a `<script>` dependency in `object_motion.html`; no modifications to `solar_system.js` are required

### Technical Notes

- If `SolarSystem.camera.getRawState()` does not yet return `{ el, az, zoom }` (depends on Epic 1 implementation), add this as a minimal additive change to `solar_system.js`
- The `SolarSystem.engine.pause()` call must be made before the first frame renders to prevent any simulation ticks

### Dependencies
- Epic 1 (`solar_system.js`) must be complete
- Story 2.1

---

## Story 2.6 — Object Marker Layer

**As a** trajectory author,
**I want** to see the current data point's position marked on the solar system canvas,
**so that** I know exactly where the object is and can frame the camera around it.

### Acceptance Criteria

- [ ] A layer named `'object-marker'` is registered with `SolarSystem.layers.register('object-marker', fn)`
- [ ] Each frame, the layer draws at the current point's `(wx, wy, wz)` world coordinates:
  - Inner filled circle: radius 5px, colour `rgba(120,255,200,1.0)`
  - Outer ring: radius 12px, colour `rgba(120,255,200,0.35)`, stroke only
  - The outer ring pulses (animates between radius 10px and 14px over ~60 frames) to draw the eye
- [ ] A text label is drawn 16px above the marker: `"{date} · {objectName}"`, font `11px Georgia`, colour `rgba(200,235,255,0.9)`, centred
- [ ] If the marker's projected screen position is outside the canvas bounds (off-screen), a directional arrow is drawn at the nearest canvas edge pointing toward the off-screen position, with the label beside the arrow
- [ ] When the active point changes (user advances to next point), the marker immediately moves to the new coordinates; no animation between points
- [ ] The layer is correctly depth-tested via the existing `project3()` function — the marker is not drawn if `depth < 10`

### Technical Notes

- Use `project3(wx, wy, wz)` from `shared_render.js` to get screen coordinates and depth
- Off-screen detection: if `sx < 0 || sx > canvas.width || sy < 0 || sy > canvas.height`
- Arrow size: equilateral triangle, 10px, same green colour as the marker

### Dependencies
- Story 2.5

---

## Story 2.7 — Progress Sidebar

**As a** trajectory author,
**I want** to see all data points listed in a sidebar with their save status,
**so that** I always know where I am in the annotation workflow and can jump to any point.

### Acceptance Criteria

- [ ] A sidebar panel is shown once trajectory data is loaded, listing all points in chronological order
- [ ] Each row shows:
  - Row number (`1`, `2`, … `N`)
  - Date (`Jul 01, 2025`)
  - Image thumbnail icon (a small 20×20px preview if an image has been attached; a faint placeholder icon if not)
  - Status badge: `· pending` (grey) or `✓ saved` (green)
- [ ] Each row includes a small delete icon button; clicking it removes that point from the current trajectory without triggering row navigation
- [ ] The currently active point row is highlighted (e.g., brighter background, left border accent)
- [ ] Clicking any row navigates directly to that point — the marker moves, the date updates, the camera is pre-set if that point has a saved state (Update Mode), otherwise camera is unchanged
- [ ] The sidebar is scrollable; the active row is always scrolled into view automatically
- [ ] A summary line at the top of the sidebar shows: `"[N saved] of [M total]"`
- [ ] After a point is deleted, the sidebar re-numbers the remaining rows and immediately updates the active point, summary line, and `"Point [current] of [total]"` counter
- [ ] On mobile widths (< 768px) the sidebar collapses to a compact top bar showing only the summary line and current point number

### Technical Notes

- Module: `ProgressPanel.render()` and `ProgressPanel.setActive(index)`
- Sidebar width: ~220px; fixed position alongside the canvas
- Thumbnail images are displayed using object-fit: cover at 20×20px

### Dependencies
- Story 2.5

---

## Story 2.8 — Point-by-Point Camera Annotation

**As a** trajectory author,
**I want** to adjust the camera for each data point and save my chosen view,
**so that** the trajectory file records a meaningful camera angle for every position.

### Acceptance Criteria

- [ ] When the viewer is active, a prominent **"Save Point →"** button is shown below (or beside) the canvas
- [ ] Pressing `Space` or `Enter` (when the canvas or save button is focused) triggers the same action as clicking "Save Point →"
- [ ] On "Save Point →":
  1. The current camera state is captured: `SolarSystem.camera.getRawState()` → `{ el, az, zoom }`
  2. The state is stored in `TrajectoryStore` for the current point index
  3. The current point row in the sidebar updates from `· pending` to `✓ saved`
  4. The viewer advances to the **next unsaved** point (skipping already-saved points); if none remain, stays on the current point
  5. The sidebar scrolls the next point into view
- [ ] The user can navigate to any row in the sidebar and re-save — re-saving a point overwrites its previous camera state
- [ ] A counter near the save button shows: `"Point [current] of [total]"`
- [ ] Once **at least one** point has a saved camera state, the **"Save to File"** button (Story 2.12) becomes enabled; a visual indicator `"All points saved — ready to export ✓"` appears only when every point is annotated
- [ ] While navigating forward/backward through points, the simulation date updates to each point's date: `SolarSystem.camera.setDate(point.date)` — planet positions reflect the correct date

### Technical Notes

- `WorkflowController` manages the current index and the advance-to-next-unsaved logic
- "Next unsaved" = first point after current index where `camera === null`; wraps to the first unsaved point from index 0 if none found ahead
- Camera state is stored as-is from `getState()` — no rounding at this stage (rounding happens on serialisation in Story 2.12)

### Dependencies
- Story 2.5, Story 2.6, Story 2.7

---

## Story 2.9 — Per-Point Image Upload

**As a** trajectory author,
**I want** to optionally associate an image with each data point,
**so that** the saved trajectory file is enriched with visual reference material without requiring an upload-only workflow.

### Acceptance Criteria

- [ ] Below the solar system viewer (or in an annotation panel beside the sidebar), each active point supports an optional image reference:
  - The existing **"Upload Image"** flow may still be used
  - A saved point may also carry an `image` string set directly in `trajectory.json`
  - The stored image string may be either a local asset filename/path or an absolute URL
- [ ] Once an image is selected:
  - A thumbnail preview (80×80px, object-fit: cover) is shown in the annotation panel
  - The same thumbnail (20×20px) appears in the sidebar row for this point
  - An **"× Remove"** button clears the image
- [ ] If the uploaded file exceeds 5 MB, a soft warning is shown: `"Large image (X MB) — this will increase your saved data size."` The upload is still accepted; no hard block
- [ ] Image upload is fully optional — "Save Point →" works with no image attached, and player playback does not require an uploaded file
- [ ] Images are held in memory as `File` objects until exported (Story 2.12)
- [ ] When loading a saved file (Update Mode), existing image values in the JSON are used to fetch and display saved thumbnails:
  - Relative/local values resolve from `data/{sanitized_name}/...`
  - Absolute URLs are used as-is

### Technical Notes

- Module: `MediaAnnotator.handleImageUpload(file, pointIndex)`, `MediaAnnotator.clearImage(pointIndex)`
- Use `URL.createObjectURL(file)` for in-memory preview thumbnails when the upload flow is used
- `points[i].image` remains a string reference in the saved JSON, whether it came from an uploaded file, a local asset path, or an absolute URL

### Dependencies
- Story 2.7, Story 2.8

---

## Story 2.10 — Per-Point Text Description

**As a** trajectory author,
**I want** to optionally add a text note to each data point,
**so that** the saved trajectory captures context, observations, or captions for each position.

### Acceptance Criteria

- [ ] In the annotation panel for each active point, a `<textarea>` is displayed below the image area
- [ ] Placeholder text: `"Add a note for this date… (optional)"`
- [ ] The textarea has no character limit and accepts plain text only (no formatting controls)
- [ ] Text is saved to `TrajectoryStore` for the current point when the user clicks "Save Point →" (captured together with the camera state — the user does not need a separate "save description" step)
- [ ] When navigating to a different point, the textarea content updates to show that point's previously entered description (or clears if none)
- [ ] Description is fully optional — empty string is stored as `null` in the JSON
- [ ] In Update Mode, previously saved descriptions are loaded and displayed in the textarea when their point becomes active

### Technical Notes

- Capture textarea value in `WorkflowController` at the moment "Save Point →" is triggered
- Store as `description: string | null` in `TrajectoryStore.points[i]`

### Dependencies
- Story 2.8, Story 2.9

---

## Story 2.11 — LocalStorage Draft & Auto-save

**As a** trajectory author,
**I want** my annotation progress to be automatically saved as I work,
**so that** I don't lose my work if I accidentally close the tab before exporting.

### Acceptance Criteria

- [ ] Every time a point is saved (Story 2.8), the full `TrajectoryStore` state is written to `localStorage` under the key `objectMotion:{sanitized_name}`
- [ ] Every time a point is deleted from the sidebar (Story 2.7), the full `TrajectoryStore` state is immediately rewritten to the same `localStorage` key; if the final point is deleted, the draft is cleared
- [ ] The stored draft includes: all point data (date, jd, au, px), all saved camera states, all saved descriptions; image references are stored but `File` objects are not (cannot be serialised to localStorage)
- [ ] On page load, after the user enters an object designation and clicks "Search", the system checks localStorage for a matching key **before** checking for a bundled file (Story 2.4) and **before** calling the API
- [ ] If a draft is found, the user is shown: `"Resume unsaved session for '[name]' — [N] of [M] points saved"` with two buttons:
  - **"Resume"** — loads the draft into `TrajectoryStore`, skips the API call, enters the annotation workflow
  - **"Start Fresh"** — clears the draft, proceeds with the normal file-check → API flow
- [ ] When "Save to File" completes successfully (Story 2.12), the localStorage draft for that object is cleared
- [ ] If "Start Fresh" is chosen, the localStorage draft is cleared immediately

### Technical Notes

- Serialise with `JSON.stringify(TrajectoryStore.toPlainObject())`; uploaded `File` objects are excluded, but existing image reference strings remain in the draft
- Draft key collision (same designation, different date range): overwrite the draft — only one draft per designation is kept

### Dependencies
- Story 2.8

---

## Story 2.12 — JSON Serialisation & File Save

**As a** trajectory author,
**I want** to export the annotated trajectory as a JSON file (and any optional uploaded local images),
**so that** the data is saved to the repository and available for future epics.

### Acceptance Criteria

- [ ] The **"Save to File"** button is enabled as soon as at least one point has a saved camera state; points with `camera: null` are written to JSON as-is (the player skips or interpolates them)
- [ ] Clicking "Save to File" serialises `TrajectoryStore` to a JSON object matching the schema in PRD Section 10.1:
  - `object`, `designation`, `createdAt`, `updatedAt`, `source`, `dateRange`, `scale`, `points[]`
  - Camera values rounded to 2 decimal places
  - `image` field: string reference (relative/local path, absolute URL, or uploaded filename such as `"point_0.jpg"`) or `null`
  - `description` field: string or `null`
- [ ] **Download fallback (all browsers):**
  - `trajectory.json` is downloaded via `URL.createObjectURL(new Blob([...]))` + programmatic `<a>` click
  - Any uploaded local images are downloaded as separate files: `point_{index}.{ext}`
  - A confirmation message is shown: `"Trajectory saved — [N] points · trajectory.json"` with optional image count detail when uploaded files were written
- [ ] **File System Access API (Chrome 86+, progressive enhancement):**
  - If `window.showDirectoryPicker` is available, an additional button **"Save to project folder"** is shown
  - Clicking it opens a directory picker; the user selects the `data/` folder
  - The system creates (or overwrites) the subfolder `{sanitized_name}/` and writes `trajectory.json` plus any uploaded local image files into it
  - Falls back gracefully with a message if the user cancels the picker or if the API is unavailable
- [ ] After a successful save, the localStorage draft for this object is cleared (Story 2.11)
- [ ] In Update Mode, "Save to File" overwrites `trajectory.json`; `updatedAt` is set to the current timestamp; `createdAt` is preserved from the original file

### Technical Notes

- Module: `FileIO.serialize(store)`, `FileIO.download(json, images)`, `FileIO.saveToDirectory(dirHandle, sanitizedName, json, images)`
- The JSON `points[].au` values are stored at full floating-point precision (do not round AU coordinates — rounding only applies to camera state)
- When the upload flow is used, the exported image filename extension is derived from `file.type`: `image/jpeg` → `.jpg`, `image/png` → `.png`, `image/webp` → `.webp`, `image/gif` → `.gif`

### Dependencies
- Story 2.8, Story 2.9, Story 2.10, Story 2.11

### Implementation Notes

- Refined the `Save to File` flow so it now opens an in-page export modal showing the generated `trajectory.json` content before any download starts.
- Added inline copy support for the JSON text, while keeping the existing browser-download fallback that writes `trajectory.json` plus any uploaded point images when the user confirms save.
- Routed the `Play Video` "Save to File First" path through the same export modal so both save entry points use one consistent confirmation flow.

### File List

- `object_motion.html`
- `object_motion.js`

---

---

## Story 2.13 — Deep-Link via URL Parameter

**As a** user linking to the Object Motion Tracker from another page or external source,
**I want** to open the tracker with an object designation pre-filled in the URL,
**so that** the correct trajectory loads automatically without manually typing the designation.

### Acceptance Criteria

- [ ] On page load, the system reads `?designation=` (or the short alias `?d=`) from the URL query string using `URLSearchParams(location.search)`
- [ ] If a value is found it is URL-decoded and set as the value of the designation input (`#om-designation`)
- [ ] The search button is enabled immediately (same as if the user had typed the value)
- [ ] The normal search flow is triggered automatically — in the same order as a manual click:
  1. Check `localStorage` for a draft matching the designation
  2. If draft found → load immediately (auto-restore, no prompt)
  3. If no draft → GET `data/{sanitized}/trajectory.json`
  4. If bundled file found → load automatically + write to `localStorage` (Story 2.4), enter viewer
  5. If neither → reveal the fallback section (upload or Horizons API)
- [ ] Supported URL formats:
  - `object_motion.html?designation=3I`
  - `object_motion.html?designation=C%2F2025%20N1` (URL-encoded special chars)
  - `object_motion.html?d=3I` (short alias)
- [ ] If no parameter is present the page behaves exactly as before — no change to normal flow

### Technical Notes

- Added at the **end of `initUI()`**, after all event listeners are wired, so it runs after the DOM is fully set up
- Reuses the existing `searchBtn.click()` path — no duplicate logic
- Uses `decodeURIComponent` on the raw param value before setting the input

### Dependencies
- Story 2.1 (form must exist), Story 2.4 (saved-file card), Story 2.11 (draft card)

---

## Story 2.14 — Per-Point Duration & Stoppable Flag

**As a** trajectory author,
**I want** to set how long the video spends on each segment and mark key points where the player should pause,
**so that** the cinematic playback has intentional pacing and can stop to tell the story at important moments.

### Acceptance Criteria

- [ ] Near the "Save Point →" button, two new inline controls are displayed:
  - `Duration: [___] %` — a `<input type="number">` field, default `100`, min `1`, max `1000`, integer only; a `%` label appears beside the field
  - `☐ Stoppable point` — a checkbox, unchecked by default
- [ ] A small **`⚙`** icon button beside these controls opens a modal; the modal currently shows only: `"Additional per-point parameters will appear here in future updates."` It establishes the extensibility slot for future epics
- [ ] When "Save Point →" is clicked, the current values of `durationPct` and `stoppable` are captured and stored in `TrajectoryStore` for that point alongside the camera state
- [ ] When navigating to a different point:
  - If that point has been saved: `durationPct` and `stoppable` controls update to reflect the saved values
  - If that point has not been saved: controls reset to defaults (`100`, unchecked)
- [ ] `durationPct` and `stoppable` are serialised to `trajectory.json` in Story 2.12:
  - `durationPct` as an integer
  - `stoppable` as a boolean
  - Both are omitted (not written as `null`) for points where the user never changed them from defaults, OR written as their actual values — either approach is acceptable; the player defaults absent fields to `100` / `false`
- [ ] A tooltip on the duration field reads: `"Duration as % of 1 second (base). 100 = 1s, 200 = 2s, 50 = 0.5s. Use the speed ruler in the player to scale the whole video."`
- [ ] A tooltip on the stoppable checkbox reads: `"When 'Pause at stoppable points' is enabled in the player, the video will pause here and show this point's annotation."`

### Technical Notes

- Capture both values inside `WorkflowController` at the moment "Save Point →" is triggered — same as camera state capture
- Store as `TrajectoryStore.points[i].durationPct` and `TrajectoryStore.points[i].stoppable`
- In `FileIO.serialize()` (Story 2.12): write both fields to the JSON; they appear alongside `camera`, `image`, `description`

### Schema Change

```json
{
  "date": "2025-10-29",
  "durationPct": 150,
  "stoppable": true,
  "camera": { ... },
  "image": "point_11.jpg",
  "description": "Perihelion — closest approach to Sun."
}
```

Existing files without these fields remain valid — the player defaults absent fields to `durationPct: 100`, `stoppable: false`.

### Dependencies
- Story 2.8 (Save Point workflow), Story 2.12 (serialisation)

---

## Story 2.15 — "Play Video" Button & Player Handoff

**As a** trajectory author,
**I want** a button that opens the trajectory player for the current trajectory in a new tab,
**so that** I can preview the cinematic playback without leaving the annotation page.

### Acceptance Criteria

- [ ] A **"▶ Play Video"** button is shown in the annotation toolbar, visually grouped near the "Save to File" button
- [ ] The button is **enabled** as soon as at least one point has a saved camera state (same condition as "Save to File")
- [ ] When the button is enabled and clicked:
  - It constructs the URL: `trajectory_player.html?designation={sanitized_name}`
  - It opens this URL in a **new browser tab** (`window.open(url, '_blank')`)
- [ ] If the trajectory has **unsaved changes** since the last "Save to File" (i.e., the user annotated or re-annotated points after the last export), a confirmation dialog is shown first:
  - Message: `"Your latest annotations haven't been saved to file yet. The player will show the last saved version."`
  - Two buttons: **"Save to File First"** | **"Open Player Anyway"**
  - "Save to File First" triggers the normal save flow and, on success, then opens the player
  - "Open Player Anyway" opens the player immediately using whatever is currently on disk
- [ ] If the trajectory has **never been saved** (no file exists on disk), the dialog message changes to: `"This trajectory hasn't been saved to file yet. Save it first so the player can load it."` — in this case only **"Save to File"** is offered (no "Open Player Anyway")
- [ ] The `sanitized_name` in the URL follows the same convention as Epic 2: spaces and `/` replaced by `_`

### Technical Notes

- "Unsaved changes" detection: track a `hasUnsavedChanges` flag in `WorkflowController`; set to `true` whenever a point is saved (Story 2.8); cleared to `false` after a successful "Save to File" (Story 2.12)
- "Never been saved" detection: tracked by a `hasSavedFile` flag set when Update Mode is entered (Story 2.4) or when "Save to File" completes (Story 2.12)

### Dependencies
- Story 2.8, Story 2.12, Story 2.13 (sanitized_name convention)

---

## Story 2.16 — Offline File Upload Fallback

**As a** trajectory author,
**I want** to upload a local `trajectory.json` file when no bundled or cached data exists for an object,
**so that** I can load previously exported trajectories without needing internet access or a server.

### Acceptance Criteria

- [ ] When no `localStorage` draft and no bundled `data/{name}/trajectory.json` are found for a designation, the fallback section is revealed containing two options:
  - **Option A — Upload:** A "Browse file…" button (+ visible filename display) that opens a file picker accepting `.json` files
  - **Option B — Fetch:** The existing date-range + step-size form + "Fetch Trajectory" button
  - A visual divider `"— or fetch from JPL Horizons —"` separates the two options
- [ ] When the user selects a `.json` file:
  - It is read as text and parsed via `JSON.parse`
  - If valid: `loadTrajectoryFromData()` is called and `_saveDraft()` caches the result to `localStorage`
  - If invalid (parse error): an inline error is shown: "Could not parse the uploaded file. Make sure it is a valid trajectory.json."
- [ ] After a successful upload load, the viewer activates exactly as if the file had been found on the server (Update Mode if points have camera data)
- [ ] The file picker is triggered by the button click; the `<input type="file">` element itself is hidden
- [ ] The filename of the uploaded file is displayed next to the button after selection

### Technical Notes

- Element IDs: `#om-json-upload-input` (hidden file input), `#om-json-upload-btn` (visible trigger button), `#om-json-upload-name` (filename display span)
- Use `FileReader.readAsText()` to read the JSON file contents
- The upload section lives inside `#om-date-section` so it is shown and hidden together with the API form
- `_saveDraft()` is called immediately after `loadTrajectoryFromData()` to cache the upload for offline reload

### Dependencies
- Story 2.4 (fallback trigger), Story 2.11 (localStorage), Story 2.13 (auto-load path)

---

## Implementation Order (Suggested)

```
2.1  Page Shell & Input Form
2.2  Horizons API Client
2.3  API Error Handling
2.4  Existing File Detection & Update Mode
2.5  Solar System Viewer Integration
2.6  Object Marker Layer
2.7  Progress Sidebar
2.8  Point-by-Point Camera Annotation   ← core workflow complete here
2.9  Per-Point Image Upload
2.10 Per-Point Text Description
2.11 LocalStorage Draft & Auto-save
2.12 JSON Serialisation & File Save      ← full feature complete here
2.13 Deep-Link via URL Parameter         ← additive enhancement
2.14 Per-Point Duration & Stoppable Flag ← Epic 3 data input
2.15 "Play Video" Button & Player Handoff ← Epic 3 handoff
2.16 Offline File Upload Fallback        ← data management improvement
```

Stories 2.1–2.8 form the **minimum working product** — object lookup, trajectory display, and camera annotation with export. Stories 2.9–2.12 add media, descriptions, draft protection, and robust file saving. Story 2.13 adds deep-linking support. Stories 2.14–2.15 are Epic 3 prerequisites — they extend the annotation UI with pacing controls and the handoff button to the player.

---

*End of Stories — Epic 2: Object Motion Tracker*

**Document version:** 1.3
**Epic PRD:** `prd-epic2-object-motion-tracker.md`
