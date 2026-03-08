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
| [2.1](#story-21--page-shell--input-form) | Page Shell & Input Form | Pending |
| [2.2](#story-22--horizons-api-client) | Horizons API Client | Pending |
| [2.3](#story-23--api-error-handling) | API Error Handling | Pending |
| [2.4](#story-24--existing-file-detection--update-mode) | Existing File Detection & Update Mode | Pending |
| [2.5](#story-25--solar-system-viewer-integration) | Solar System Viewer Integration | Pending |
| [2.6](#story-26--object-marker-layer) | Object Marker Layer | Pending |
| [2.7](#story-27--progress-sidebar) | Progress Sidebar | Pending |
| [2.8](#story-28--point-by-point-camera-annotation) | Point-by-Point Camera Annotation | Pending |
| [2.9](#story-29--per-point-image-upload) | Per-Point Image Upload | Pending |
| [2.10](#story-210--per-point-text-description) | Per-Point Text Description | Pending |
| [2.11](#story-211--localstorage-draft--auto-save) | LocalStorage Draft & Auto-save | Pending |
| [2.12](#story-212--json-serialisation--file-save) | JSON Serialisation & File Save | Pending |

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

## Story 2.4 — Existing File Detection & Update Mode

**As a** dataset curator,
**I want** the app to detect if I already have a saved trajectory for an object,
**so that** I can load and update it without re-fetching from the API.

### Acceptance Criteria

- [ ] When "Fetch Trajectory" is clicked, before calling the API the system performs a `fetch()` to `data/{sanitized_name}/trajectory.json`
  - `sanitized_name` = designation with spaces and `/` replaced by `_` (e.g., `C/2025 N1` → `C_2025_N1`)
- [ ] If the file returns HTTP 200 (exists):
  - A notice is shown: "A saved trajectory for '[name]' already exists."
  - Two buttons are offered: **"Load Saved Data"** and **"Re-fetch from Horizons"**
  - The API is **not** called until the user chooses
- [ ] **"Load Saved Data"** path:
  - Parses `trajectory.json` into the `TrajectoryStore`
  - All points that have a `camera` object are marked `✓ saved` in the progress indicator
  - Camera is pre-set to the saved state when a saved point becomes active
  - The page enters the annotation workflow (Story 2.8) in Update Mode
- [ ] **"Re-fetch from Horizons"** path:
  - Proceeds with the API call normally (Story 2.2)
  - The existing file is only overwritten after the user completes annotation and explicitly clicks "Save to File" (Story 2.12)
- [ ] If the file returns 404 (does not exist), proceed directly to the API call — no prompt shown

### Technical Notes

- Sanitisation function: `sanitize(name) => name.replace(/[\s\/]/g, '_')`
- In Update Mode, when navigating to a point that has no saved camera state, the camera retains its current view (same as normal annotation mode)
- Existing `image` filenames in the JSON are used to fetch thumbnails from `data/{sanitized_name}/point_{index}.{ext}`

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

- If `SolarSystem.camera.getState()` does not yet return `{ el, az, zoomIn, zoomOut }` (depends on Epic 1 implementation), add this as a minimal additive change to `solar_system.js`
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
- [ ] The currently active point row is highlighted (e.g., brighter background, left border accent)
- [ ] Clicking any row navigates directly to that point — the marker moves, the date updates, the camera is pre-set if that point has a saved state (Update Mode), otherwise camera is unchanged
- [ ] The sidebar is scrollable; the active row is always scrolled into view automatically
- [ ] A summary line at the top of the sidebar shows: `"[N saved] of [M total]"`
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
  1. The current camera state is captured: `SolarSystem.camera.getState()` → `{ el, az, zoomIn, zoomOut }`
  2. The state is stored in `TrajectoryStore` for the current point index
  3. The current point row in the sidebar updates from `· pending` to `✓ saved`
  4. The viewer advances to the **next unsaved** point (skipping already-saved points); if none remain, stays on the current point
  5. The sidebar scrolls the next point into view
- [ ] The user can navigate to any row in the sidebar and re-save — re-saving a point overwrites its previous camera state
- [ ] A counter near the save button shows: `"Point [current] of [total]"`
- [ ] Once **all** points have a saved camera state, the **"Save to File"** button (Story 2.12) becomes enabled; a visual indicator confirms: `"All points saved — ready to export"`
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
**I want** to optionally attach an image to each data point,
**so that** the saved trajectory file is enriched with visual reference material.

### Acceptance Criteria

- [ ] Below the solar system viewer (or in an annotation panel beside the sidebar), each active point shows:
  - An **"Upload Image"** button that opens the browser file picker
  - A drag-and-drop target area accepting file drops
  - Accepted formats: JPEG, PNG, WebP, GIF
- [ ] Once an image is selected:
  - A thumbnail preview (80×80px, object-fit: cover) is shown in the annotation panel
  - The same thumbnail (20×20px) appears in the sidebar row for this point
  - An **"× Remove"** button clears the image
- [ ] If the uploaded file exceeds 5 MB, a soft warning is shown: `"Large image (X MB) — this will increase your saved data size."` The upload is still accepted; no hard block
- [ ] Image upload is fully optional — "Save Point →" works with no image attached
- [ ] Images are held in memory as `File` objects until exported (Story 2.12)
- [ ] When loading a saved file (Update Mode), existing image filenames in the JSON are used to fetch and display the saved thumbnails from `data/{sanitized_name}/point_{index}.{ext}`

### Technical Notes

- Module: `MediaAnnotator.handleImageUpload(file, pointIndex)`, `MediaAnnotator.clearImage(pointIndex)`
- Use `URL.createObjectURL(file)` for in-memory preview thumbnails
- Store the `File` object in `TrajectoryStore` alongside the point data; the filename is set at export time (Story 2.12)

### Dependencies
- Story 2.7, Story 2.8

---

## Story 2.10 — Per-Point Text Description

**As a** trajectory author,
**I want** to optionally add a text note to each data point,
**so that** the saved trajectory captures context, observations, or captions for each position.

### Acceptance Criteria

- [ ] In the annotation panel for each active point, a `<textarea>` is displayed below the image upload area
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
- [ ] The stored draft includes: all point data (date, jd, au, px), all saved camera states, all saved descriptions; image filenames are stored but `File` objects are not (cannot be serialised to localStorage)
- [ ] On page load, after the user enters an object designation and clicks "Fetch Trajectory", the system checks localStorage for a matching key **before** checking for a saved file (Story 2.4) and **before** calling the API
- [ ] If a draft is found, the user is shown: `"Resume unsaved session for '[name]' — [N] of [M] points saved"` with two buttons:
  - **"Resume"** — loads the draft into `TrajectoryStore`, skips the API call, enters the annotation workflow
  - **"Start Fresh"** — clears the draft, proceeds with the normal file-check → API flow
- [ ] When "Save to File" completes successfully (Story 2.12), the localStorage draft for that object is cleared
- [ ] If "Start Fresh" is chosen, the localStorage draft is cleared immediately

### Technical Notes

- Serialise with `JSON.stringify(TrajectoryStore.toPlainObject())`; `File` objects are excluded — the draft note warns: "Images are not included in the draft and will need to be re-uploaded."
- Draft key collision (same designation, different date range): overwrite the draft — only one draft per designation is kept

### Dependencies
- Story 2.8

---

## Story 2.12 — JSON Serialisation & File Save

**As a** trajectory author,
**I want** to export the annotated trajectory as a JSON file (and any attached images),
**so that** the data is saved to the repository and available for future epics.

### Acceptance Criteria

- [ ] The **"Save to File"** button is enabled only after all points have a saved camera state (Story 2.8)
- [ ] Clicking "Save to File" serialises `TrajectoryStore` to a JSON object matching the schema in PRD Section 10.1:
  - `object`, `designation`, `createdAt`, `updatedAt`, `source`, `dateRange`, `scale`, `points[]`
  - Camera values rounded to 2 decimal places
  - `image` field: filename string (e.g., `"point_0.jpg"`) or `null`
  - `description` field: string or `null`
- [ ] **Download fallback (all browsers):**
  - `trajectory.json` is downloaded via `URL.createObjectURL(new Blob([...]))` + programmatic `<a>` click
  - Each attached image is downloaded as a separate file: `point_{index}.{ext}`
  - A confirmation message is shown: `"Trajectory saved — [N] points · [N images] · trajectory.json"`
- [ ] **File System Access API (Chrome 86+, progressive enhancement):**
  - If `window.showDirectoryPicker` is available, an additional button **"Save to project folder"** is shown
  - Clicking it opens a directory picker; the user selects the `data/` folder
  - The system creates (or overwrites) the subfolder `{sanitized_name}/` and writes all files into it
  - Falls back gracefully with a message if the user cancels the picker or if the API is unavailable
- [ ] After a successful save, the localStorage draft for this object is cleared (Story 2.11)
- [ ] In Update Mode, "Save to File" overwrites `trajectory.json`; `updatedAt` is set to the current timestamp; `createdAt` is preserved from the original file

### Technical Notes

- Module: `FileIO.serialize(store)`, `FileIO.download(json, images)`, `FileIO.saveToDirectory(dirHandle, sanitizedName, json, images)`
- The JSON `points[].au` values are stored at full floating-point precision (do not round AU coordinates — rounding only applies to camera state)
- Image filename extension is derived from `file.type`: `image/jpeg` → `.jpg`, `image/png` → `.png`, `image/webp` → `.webp`, `image/gif` → `.gif`

### Dependencies
- Story 2.8, Story 2.9, Story 2.10, Story 2.11

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
```

Stories 2.1–2.8 form the **minimum working product** — object lookup, trajectory display, and camera annotation with export. Stories 2.9–2.12 add media, descriptions, draft protection, and robust file saving.

---

*End of Stories — Epic 2: Object Motion Tracker*

**Document version:** 1.0
**Epic PRD:** `prd-epic2-object-motion-tracker.md`
