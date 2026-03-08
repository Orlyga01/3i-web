# Product Requirements Document
## Epic 2 — Object Motion Tracker

**Author:** orly
**Date:** 2026-03-08
**Status:** Draft
**Epic:** 2 — Object Motion Tracker
**Project:** 3i-web

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [Functional Requirements](#5-functional-requirements)
   - 5.1 [Object Search & Data Fetch](#51-object-search--data-fetch)
   - 5.2 [Existing File Detection & Update Mode](#52-existing-file-detection--update-mode)
   - 5.3 [Point-by-Point Camera Annotation Workflow](#53-point-by-point-camera-annotation-workflow)
   - 5.4 [Per-Point Image & Description](#54-per-point-image--description)
   - 5.5 [JSON Export & Persistence](#55-json-export--persistence)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Out of Scope for Epic 2](#7-out-of-scope-for-epic-2)
8. [User Journeys](#8-user-journeys)
9. [Architecture & File Structure](#9-architecture--file-structure)
10. [Data Schemas](#10-data-schemas)
11. [Constraints & Dependencies](#11-constraints--dependencies)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

Epic 2 adds a new standalone page — **`object_motion.html`** — that lets the user look up any solar system object by name via the JPL Horizons API, retrieve its heliocentric trajectory as a list of dated positions, and annotate each position with a saved camera view using the Epic 1 solar system viewer as the visual canvas.

For each data point the user may optionally attach an **image** and a **text description** — turning the trajectory file into a richly annotated record suitable for presentation, storytelling, or scientific notes.

The result is a **per-object folder** under `data/` containing a `trajectory.json` file and any uploaded images. These files are committed to the repository. They serve as the data source for future animated flyby epics (e.g., Epic 3: replay a saved trajectory as a cinematic scene).

If a folder already exists for the named object, the page enters **Update Mode** — loading the previously saved data and allowing the user to revise any camera annotation, description, or image.

---

## 2. Problem Statement

### Current State

The `ATLAS_PATH` array in `atlas_data.js` was hand-authored — coordinates were manually retrieved from JPL Horizons, unit-converted, and typed into a static file. There is no workflow to:

- Look up an arbitrary solar system object by name
- Fetch its real ephemeris positions automatically
- Annotate those positions with camera states, images, and descriptions
- Persist the result as a reusable, committed data folder

### The Gap

Adding a new object to the project currently requires a developer to manually call the JPL API, parse the response, convert units, and edit a JS source file. This blocks non-developer users from building object trajectories and makes the system closed to new interstellar or comet discoveries.

---

## 3. Goals & Success Metrics

### Goals

| # | Goal |
|---|---|
| G1 | Allow any user to look up a solar system object by designation and get its trajectory with no coding required |
| G2 | Guide the user through each trajectory point to record a preferred camera view for that date |
| G3 | Support optional per-point image and text annotation |
| G4 | Save the fully annotated trajectory as a committed folder of files ready to be consumed by future animation epics |
| G5 | Support updating an existing saved trajectory without starting from scratch |

### Success Metrics

| Metric | Target |
|---|---|
| API lookup to first rendered point | < 3 seconds for objects with ≤ 365 data points |
| Coordinate accuracy | Matches JPL Horizons VECTORS output within floating-point rounding |
| Save reliability | 100% of annotated points persisted on save; no data loss if user closes mid-session (localStorage draft) |
| Error handling coverage | Clear message for: object not found, API timeout, malformed designation, network error, invalid date range |

---

## 4. User Personas

### Primary: The Trajectory Author
- Wants to add a newly discovered comet or asteroid to the project
- Non-developer; has the object's official designation (e.g., `2024 YR4`, `C/2025 N1`)
- Wants to record how each position looks best in the solar system viewer
- May want to attach telescope images or notes to key dates

### Secondary: The Dataset Curator
- Maintains existing trajectory files
- Wants to extend date ranges or re-annotate camera views after project UI changes
- Uses Update Mode to avoid re-fetching and re-annotating everything

---

## 5. Functional Requirements

---

### 5.1 Object Search & Data Fetch

**Requirement:** The user shall enter an object designation and a mandatory date range, and the system shall call the JPL Horizons API to retrieve the object's heliocentric state vectors.

#### FR-1.1 — Input Form

The page shall display an input form with the following fields before the solar system view is shown:

| Field | Type | Required | Notes |
|---|---|---|---|
| Object Designation | Text input | ✅ | E.g., `3I`, `C/2025 N1`, `2024 YR4` |
| Start Date | `<input type="date">` | ✅ | No default |
| End Date | `<input type="date">` | ✅ | Must be after Start Date |
| Step Size | Dropdown + free-text | Optional | Dropdown: `1d` (Every day), `7d` (Every week), `14d` (Every 2 weeks), `1mo` (Every month). A free-text field beside the dropdown allows any custom Horizons step syntax. Default: `1d`. |

A **"Fetch Trajectory"** button submits the form.

#### FR-1.2 — API Call

On form submission, the system shall call:

```
GET https://ssd.jpl.nasa.gov/api/horizons.api
  ?format=json
  &COMMAND='DES={designation}'
  &EPHEM_TYPE=VECTORS
  &CENTER=500@10
  &START_TIME={start}
  &STOP_TIME={stop}
  &STEP_SIZE={step}
  &VEC_TABLE=2
```

- `CENTER=500@10` — Sun as the coordinate origin (heliocentric)
- `EPHEM_TYPE=VECTORS` — returns Cartesian state vectors (X, Y, Z in AU)
- `VEC_TABLE=2` — compact table format, position + velocity
- The designation is URL-encoded; the system wraps it in single quotes: `'DES=3I'`

#### FR-1.3 — Response Parsing

The API returns a JSON envelope with a `result` field containing a plain-text ephemeris block. The system shall:

1. Locate the `$$SOE` / `$$EOE` markers that delimit the data rows
2. Parse each row, extracting: Julian Date, calendar date string, X (AU), Y (AU), Z (AU)
3. Convert each coordinate to animation pixels: `wx = X × 175`, `wy = Y × 175`, `wz = Z × 175`
4. Discard VX/VY/VZ (velocity vectors — not needed for Epic 2)
5. Build an ordered array of data points: `{ date, jd, wx, wy, wz }`

#### FR-1.4 — Error Handling

| Error Condition | User-Facing Message |
|---|---|
| Object designation not found | "Object '[name]' was not found in the JPL Horizons database. Check the designation and try again." |
| Ambiguous designation (multiple matches) | "Multiple matches found. Please enter a more specific designation (e.g., use the full provisional designation)." |
| Network timeout or HTTP error | "Could not reach the JPL Horizons API. Check your connection and try again." |
| End date ≤ Start date | "End date must be after Start date." (inline validation, before API call) |
| Zero data points returned | "No ephemeris data found for '[name]' in the specified date range." |

In all error cases the form remains visible and editable. No partial data is shown.

---

### 5.2 Existing File Detection & Update Mode

**Requirement:** Before calling the API, the system shall check if a saved trajectory already exists for the entered object name.

#### FR-2.1 — Existing Data Check

When the user clicks "Fetch Trajectory", the system first checks for a saved file at:

```
data/{sanitized_name}/trajectory.json
```

Where `sanitized_name` is the designation with spaces and `/` replaced by `_`
(e.g., `C/2025 N1` → `C_2025_N1`).

The check uses a `fetch()` call against the relative path; a `200` response means data exists.

#### FR-2.2 — Existing Data Detected

If a file is found, the system shall:

1. Show a notice: **"A saved trajectory for '[name]' already exists."**
2. Offer two buttons:
   - **"Load Saved Data"** — skip the API call, load from JSON, enter Update Mode
   - **"Re-fetch from Horizons"** — proceed with the API call, overwrite after user completes annotation
3. Never silently overwrite the existing file

#### FR-2.3 — Update Mode

When loaded from a saved file:

- All previously annotated points are shown with their saved camera state as `✓ saved` in the progress indicator
- Points with saved images show a thumbnail icon in the progress list
- The user can navigate to any point and re-save its camera state, description, or image
- Points can be extended by re-fetching from the API with a wider date range; new points are merged in chronologically, no duplicates by Julian Date
- "Save to File" writes the full updated dataset to the same folder

---

### 5.3 Point-by-Point Camera Annotation Workflow

**Requirement:** After fetching or loading the trajectory, the system displays each data point in sequence on the solar system viewer, allows the user to position the camera, and records the camera state.

#### FR-3.1 — Solar System Viewer Initialisation

The page renders the full Epic 1 `solar_system.html` viewer (solar system, planets, starfield, arcball, zoom rulers) via the `SolarSystem` public API. The simulation date is set to the current data point's date. The orbital simulation is **paused** — the user is doing manual annotation, not watching a live simulation.

#### FR-3.2 — Object Marker

The current data point's position `(wx, wy, wz)` shall be drawn on the canvas as:

- A pulsing circle: inner radius 5px `rgba(120,255,200,1)`, outer ring 12px `rgba(120,255,200,0.35)`
- A text label showing the date and object name, offset 16px above the marker
- If the marker is off-screen, an edge arrow indicator pointing toward it

#### FR-3.3 — Progress Indicator

A compact sidebar shall show all data points as a scrollable list:

| Column | Content |
|---|---|
| Index | Point number |
| Date | `Jul 01, 2025` |
| Image | Thumbnail icon if image is attached |
| Status | `· pending` or `✓ saved` |

The currently active point is highlighted. The user can click any row to jump to that point directly (pending points remain pending).

#### FR-3.4 — Camera Controls

All Epic 1 camera controls are active:
- Arcball widget drag and direct canvas drag (azimuth + elevation)
- Zoom In / Zoom Out rulers
- Preset view buttons (Top-Down, Ecliptic, Side View, Isometric, From Below)
- Scroll wheel zoom

The camera retains its current view when advancing to a new point — no auto-reset.  
**Exception:** In Update Mode, when navigating to a point that has a saved camera state, the camera is pre-set to that saved state.

#### FR-3.5 — Save Point

A prominent **"Save Point →"** button (keyboard shortcut: `Space` or `Enter`) shall:

1. Capture the current camera state: `{ el, az, zoomIn, zoomOut }`
2. Mark the current point as `✓ saved` in the progress indicator
3. Auto-advance to the next unsaved point
4. When all points are saved, enable the **"Save to File"** button

The user may re-save a point at any time by returning to it and clicking "Save Point →" again.

#### FR-3.6 — Save to File

Once all points have been saved at least once, a **"Save to File"** button becomes active. Clicking it:

1. Serialises the full annotated trajectory to `trajectory.json` (see Section 10)
2. Triggers a browser **file download** of `trajectory.json`
3. If the File System Access API is available (`window.showDirectoryPicker`), also offers to write all files (JSON + images) directly into the `data/{name}/` folder in the project
4. Falls back gracefully to download-only on Firefox/Safari
5. Shows confirmation: "Trajectory saved — [N] points · [filename]"

---

### 5.4 Per-Point Image & Description

**Requirement:** For each data point, the user may optionally attach a single image file and a free-text description. Both are optional and may be added, changed, or removed at any time during annotation.

#### FR-4.1 — Image Upload

Each point in the progress sidebar and in the main annotation area shall include:

- An **"Upload Image"** button (or drag-and-drop target area)
- Accepted formats: JPEG, PNG, WebP, GIF
- No size limit enforced client-side, but a soft warning is shown for files > 5 MB: "Large images will increase the size of your saved data."
- Once uploaded, the image is previewed as a small thumbnail (80×80px) beside the point
- An **"×"** remove button clears the image

The image is held in memory as a `File` object until saved. It is not embedded in the JSON — it is saved as a separate file (see FR-4.3).

#### FR-4.2 — Text Description

Below the image upload area, a multiline text field (`<textarea>`) allows the user to type a description for the current point. Placeholder text: `"Add a note for this date... (optional)"`. No character limit. No formatting — plain text only.

#### FR-4.3 — Image File Naming & Storage

When saving to file, each attached image is written as a separate file in the same object folder:

```
data/{sanitized_name}/
  trajectory.json
  point_{index}.jpg     ← or .png / .webp depending on uploaded file type
```

The `trajectory.json` stores only the filename (not the image data):

```json
"image": "point_0.jpg"
```

On load (Update Mode), the system fetches each image file by its relative path from the same folder to display thumbnails.

#### FR-4.4 — Images Not Required to Save Point

The user can click "Save Point →" with no image and no description attached. The camera state is saved regardless. Images and descriptions are purely optional enrichments.

---

### 5.5 JSON Export & Persistence

#### FR-5.1 — LocalStorage Draft

Every time the user saves a point, the current in-memory state is written to `localStorage` under:

```
objectMotion:{sanitized_name}
```

This protects against accidental tab close before the final save.  
Note: Image `File` objects cannot be stored in localStorage. The draft stores only image filenames; actual image files must be re-uploaded if the session is lost before final save.

#### FR-5.2 — Draft Recovery

On page load, if `localStorage` contains a draft for the entered object name, the system offers:  
**"Resume unsaved session for '[name]' ([N] of [M] points saved)"**  
with options **"Resume"** or **"Start Fresh"**.

---

## 6. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Parsing and rendering the first data point must complete < 500ms after API response is received |
| NFR-2 | Performance | Switching between data points must complete within 1 animation frame |
| NFR-3 | Compatibility | Must work in Chrome 120+, Firefox 120+, Safari 17+; File System Access API is a progressive enhancement |
| NFR-4 | Network | The Horizons API call is the only external network request; all other logic is client-side |
| NFR-5 | CORS | The Horizons API supports CORS — no proxy required |
| NFR-6 | Responsiveness | Controls remain accessible at viewport widths ≥ 768px |
| NFR-7 | Consistency | Visual language matches the 3i-web dark space aesthetic |
| NFR-8 | Independence | `object_motion.html` has no dependency on `atlas_data.js`, `atlas_main.js`, or `main.js` |
| NFR-9 | Persistence | Saved trajectory files and images are committed to the repository under `data/` |

---

## 7. Out of Scope for Epic 2

| Feature | Deferred To |
|---|---|
| Animating / replaying a saved trajectory as a cinematic scene | Epic 3 |
| Multi-object comparison (two objects on screen simultaneously) | Epic 4 |
| Server-side file storage | Epic 5 |
| Mobile touch support | Epic 5 |
| Velocity vector display (VX, VY, VZ) | Epic 3 |
| Orbital elements display (e, q, i) | Epic 3 |
| Sharing a trajectory via URL | Epic 5 |
| Multiple images per point | Future |
| Rich text / Markdown in descriptions | Future |

---

## 8. User Journeys

### Journey 1: "I want to map 2024 YR4's trajectory"

1. User opens `object_motion.html` — sees the input form.
2. Enters designation `2024 YR4`, start `2024-12-01`, end `2025-04-01`, step `1d`.
3. No existing folder found — system calls Horizons API.
4. 122 data points returned. Solar system viewer appears with point 1 marked.
5. User rotates the arcball to a 3/4 view, zooms in slightly. Clicks **"Save Point →"**.
6. Point 2 appears. User notices the object is near Mars. Uploads a telescope image of YR4 from that date, types `"Close approach to Mars — 0.07 AU"`. Saves.
7. Repeats for all 122 points. When done, clicks **"Save to File"**.
8. `trajectory.json` and any image files download; optionally written to `data/2024_YR4/`.

### Journey 2: "Update 3I's annotations after redesigning the UI"

1. User opens `object_motion.html`, enters `3I`.
2. System detects `data/3I/trajectory.json` — shows prompt.
3. User clicks **"Load Saved Data"** — 258 points load, all `✓ saved`.
4. User clicks point 42 (Oct 29 — Perihelion) in the sidebar.
5. Camera snaps to the previously saved view. User adjusts to a better angle, adds a description: `"Perihelion — closest approach to Sun, peak brightness"`. Saves.
6. Clicks **"Save to File"** — folder updated.

### Journey 3: "Object not found"

1. User enters `comet-xyz`, clicks "Fetch Trajectory".
2. No existing file. API returns not-found error.
3. Message shown: "Object 'comet-xyz' was not found in the JPL Horizons database."
4. User corrects to `C/2023 A3` — found. Proceeds normally.

---

## 9. Architecture & File Structure

```
3i-web/
├── object_motion.html         ← NEW: entry point for Epic 2
├── object_motion.js           ← NEW: all Epic 2 logic
├── solar_system.js            ← REUSED from Epic 1 (via SolarSystem public API)
├── shared_render.js           ← UNCHANGED
├── styles.css                 ← UNCHANGED (minor additions for Epic 2 panels)
└── data/                      ← NEW: committed to repository
    ├── 3I/
    │   ├── trajectory.json
    │   ├── point_0.jpg
    │   └── point_42.png
    └── 2024_YR4/
        ├── trajectory.json
        └── point_6.jpg
```

### Module Breakdown — `object_motion.js`

| Module | Responsibility |
|---|---|
| `HorizonsClient` | Builds the API URL, calls `fetch()`, parses `$$SOE`/`$$EOE` text block, returns `Point[]` |
| `TrajectoryStore` | Holds the in-memory annotated point array; handles localStorage draft read/write |
| `WorkflowController` | Manages the point-by-point annotation state machine (current index, saved flags, advance logic) |
| `ObjectMarker` | Registers a layer with `SolarSystem.layers` to draw the pulsing marker + label + off-screen arrow |
| `ProgressPanel` | Renders the scrollable sidebar; handles click-to-jump; shows thumbnails and save status |
| `MediaAnnotator` | Handles image file picker, drag-and-drop, thumbnail rendering, description textarea |
| `FileIO` | Serialises trajectory to JSON; handles File System Access API save + download fallback |

### Extension of Epic 1 SolarSystem API

`object_motion.js` uses the published extension contract from Epic 1:

```javascript
// Register the object marker as a named layer
SolarSystem.layers.register('object-marker', ObjectMarker.draw);

// Set simulation date to the current point's date
SolarSystem.camera.setDate(point.date);

// Read current camera state for saving
const camState = SolarSystem.camera.getState();
// returns { el, az, zoomIn, zoomOut }
```

No modifications to `solar_system.js` are required unless `getState()` was not fully implemented in Epic 1, in which case it is a minor additive change only.

---

## 10. Data Schemas

### 10.1 Saved Trajectory JSON (`trajectory.json`)

```json
{
  "object": "3I",
  "designation": "3I",
  "createdAt": "2026-03-08T14:00:00Z",
  "updatedAt": "2026-03-08T15:30:00Z",
  "source": {
    "api": "https://ssd.jpl.nasa.gov/api/horizons.api",
    "ephem_type": "VECTORS",
    "center": "500@10",
    "step": "1d"
  },
  "dateRange": {
    "start": "2025-07-01",
    "end": "2026-03-16"
  },
  "scale": "1 AU = 175 px",
  "points": [
    {
      "index": 0,
      "date": "2025-07-01",
      "jd": 2461223.5,
      "au": { "x": 0.274, "y": -4.497, "z": 0.291 },
      "px": { "wx": 47.95, "wy": -786.975, "wz": 50.925 },
      "camera": {
        "el": 45.0,
        "az": 0.0,
        "zoomIn": 0,
        "zoomOut": 0
      },
      "image": "point_0.jpg",
      "description": "Discovery observation — 4.5 AU from Sun"
    },
    {
      "index": 1,
      "date": "2025-07-02",
      "jd": 2461224.5,
      "au": { "x": 0.268, "y": -4.451, "z": 0.288 },
      "px": { "wx": 46.9, "wy": -778.925, "wz": 50.4 },
      "camera": {
        "el": 45.0,
        "az": 0.0,
        "zoomIn": 0,
        "zoomOut": 0
      },
      "image": null,
      "description": null
    }
  ]
}
```

### 10.2 ATLAS_PATH-Compatible Extract

The `points[].px` sub-object maps directly to the `ATLAS_PATH` format used by `atlas_data.js`. Epic 3 can consume saved data as:

```javascript
const OBJECT_PATH = savedData.points.map((p, i) =>
  [i / (savedData.points.length - 1), p.px.wx, p.px.wy, p.px.wz]
);
```

This is the **forward-compatibility contract** Epic 3 depends on.

---

## 11. Constraints & Dependencies

| Constraint | Detail |
|---|---|
| **Epic 1 dependency** | `solar_system.js` must be complete and expose the `SolarSystem` public API before Epic 2 development begins |
| **Horizons API availability** | Live external service — requires internet access |
| **CORS** | Horizons API supports cross-origin requests; no proxy or server required |
| **File writing** | Full filesystem write requires Chrome with File System Access API; Firefox/Safari use download-only fallback |
| **Scale convention** | 1 AU = 175 px (inherited from `atlas_data.js`) — must remain consistent across all epics |
| **Coordinate frame** | Horizons VECTORS with `CENTER=500@10` returns ICRF/J2000 coordinates. The existing `shared_render.js` treats the XY plane as the ecliptic — this is a standard approximation (ecliptic obliquity ≈ 23.4° from equatorial) that is acceptable for visual purposes in Epic 2. A precise frame rotation is deferred to Epic 3. |
| **Image storage** | Images are stored as separate files alongside `trajectory.json`, not embedded in the JSON, to keep the JSON lean and git history clean |
| **data/ folder** | Committed to the repository — no `.gitignore` entry for this folder |

---

## 12. Open Questions

*All open questions resolved. No outstanding items.*

---

*End of PRD — Epic 2: Object Motion Tracker*

---

**Document version:** 1.1
**Depends on:** Epic 1 — Interactive Solar System Viewer (must be complete)
**Next step:** Create Epics & Stories, or proceed to architecture design for Epic 2
