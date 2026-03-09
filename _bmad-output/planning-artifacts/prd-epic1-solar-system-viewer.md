# Product Requirements Document
## Epic 1 — Interactive Solar System Viewer

**Author:** orly
**Date:** 2026-03-08
**Status:** Draft
**Epic:** 1 — Solar System Interactive Viewer
**Project:** 3i-web

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [Scope — What Is Extracted from the Existing System](#5-scope--what-is-extracted-from-the-existing-system)
6. [Functional Requirements](#6-functional-requirements)
   - 6.1 [Real Orbital Velocity Movement](#61-real-orbital-velocity-movement)
   - 6.2 [Date Input — Planet Position by Date](#62-date-input--planet-position-by-date)
   - 6.3 [Zoom Rulers (In/Out)](#63-zoom-rulers-inout)
   - 6.4 [Full-Sphere Point-of-View Controls](#64-full-sphere-point-of-view-controls)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Out of Scope for Epic 1](#8-out-of-scope-for-epic-1)
9. [User Journeys](#9-user-journeys)
10. [Constraints & Dependencies](#10-constraints--dependencies)
11. [Open Questions](#11-open-questions)

---

## 1. Executive Summary

The 3i-web project contains a cinematic 3D rendering of the solar system built in vanilla JavaScript and Canvas 2D API (`shared_render.js`, `atlas_main.js`). This existing solar system is embedded inside a scripted 8-scene animation focused on the 3I/ATLAS interstellar comet journey — it is not independently explorable.

Epic 1 extracts the solar system layer from that animation and turns it into a **standalone, interactive Solar System Viewer** — a dedicated page where the user can freely:

- Watch planets orbit with **real, astronomically accurate velocities**
- Jump to any **calendar date** and see where each planet actually is
- **Zoom in and out** using intuitive dual-range ruler controls
- **Rotate the view** freely across the entire celestial sphere — top-down, edge-on, any angle

This viewer becomes the foundational interactive module that future epics (e.g., 3I/ATLAS overlay, mission planning, educational mode) will build upon.

---

## 2. Problem Statement

### Current State

The existing solar system rendering (`shared_render.js`) has:

| Component | Current Implementation | Limitation |
|---|---|---|
| Planet positions | `p.angle += p.speed * 0.065` per frame — animation-speed only | Not tied to real dates or real orbital periods |
| Orbital speeds | Arbitrary multipliers (`Mercury=0.047`, `Earth=0.029`, etc.) | Correct relative ordering but wrong absolute periods |
| Camera control | Hard-coded per scene (`elTgt`, `azTgt`, `distTgt`) | User cannot control the camera at all |
| Zoom | Fixed distances per scene (e.g., `distTgt = 1200`) | No interactive zoom |
| Planet data | 7 planets with orbit radii in pixels | No connection to real AU values for date lookup |

### The Gap

A viewer who wants to ask "where is Mars on my birthday?" or "what does the solar system look like edge-on from below?" has no way to do so. The system is a movie, not a tool.

---

## 3. Goals & Success Metrics

### Goals

| # | Goal |
|---|---|
| G1 | Deliver a standalone `solar_system.html` page independent of the 3I/ATLAS animation |
| G2 | Planet positions update in real time based on a user-selected calendar date |
| G3 | Planetary motion speed reflects real sidereal orbital periods (not animation-speed approximations) |
| G4 | User can zoom from "full solar system overview" to "inner planets close-up" using a ruler control |
| G5 | User can rotate the viewpoint to any direction on the celestial sphere using on-screen controls |

### Success Metrics

| Metric | Target |
|---|---|
| Earth orbital period accuracy | Within ±2 days of real period (365.25 days) at any given date |
| Planet angular position accuracy | Within ±5° of VSOP87 simplified positions |
| Zoom range | Full outer-planet view (Uranus) down to inner-planet only (inside Earth orbit) |
| POV coverage | Full 360° azimuth, −90° to +90° elevation without gimbal lock |
| Frame rate | ≥ 55 fps on a modern laptop at 1920×1080 |
| Date picker responsiveness | Planet positions update within 1 frame of date change (no async wait) |

---

## 4. User Personas

### Primary: The Curious Explorer
- Wants to see "what the solar system looked like on my birthday"
- Non-technical; needs intuitive, visual controls
- Will share screenshots on social media

### Secondary: The Science Communicator
- Uses the viewer in educational presentations
- Needs accurate positions and a clean, label-friendly layout
- Wants to show the ecliptic plane from multiple angles

### Tertiary: The 3I/ATLAS Fan
- Following the existing 3I/ATLAS animation project
- Wants a free-roam version of the solar system view they already know
- Expects visual and UX consistency with the existing cinematic viewer

---

## 5. Scope — What Is Extracted from the Existing System

The following components from the existing codebase are **carried forward** into the standalone viewer, with the modifications described in Section 6.

### From `shared_render.js`

| Component | Extract As-Is | Modify |
|---|---|---|
| `canvas` + `ctx` setup | ✅ | — |
| `buildCamera(el, az, dist, tx, ty, tz)` | ✅ | — |
| `project3(wx, wy, wz)` — 3D→2D projection | ✅ | — |
| `drawStars()` — starfield background | ✅ | — |
| `planets[]` array — 7 planets (Mercury → Uranus) | Carry structure | Replace `speed` with real orbital period data |
| `drawOrbit(p, alpha)` | ✅ | — |
| `drawPlanet(p, showLabel)` — texture + procedural render | ✅ | Always show labels |
| `drawSun()` | ✅ | — |
| `drawEclipticPlane()` | ✅ | — |
| `lerp`, `clamp`, `eio`, `lighten`, `darken` utils | ✅ | — |

### From `atlas_main.js`

| Component | Extract | Discard |
|---|---|---|
| Scene 0 camera logic (top-down ecliptic view) | Use as default start position | — |
| `atlasFrac`, `atlasTrail`, `atlasPos`, `drawAtlasTrail` | ❌ | Discard (Epic 2+) |
| `drawAtlasCloseup` | ❌ | Discard |
| `SCENES`, `currentScene`, scene transitions | ❌ | Discard |
| Timeline/progress bar | ❌ | Discard |
| `fracToDate` | Adapt | Re-implement as `dateToAngle(planet, date)` |

### From `atlas_data.js`

| Component | Use |
|---|---|
| `ATLAS_PATH`, `SC_FRAC`, `AT_*` constants | ❌ Discard (Epic 2+) |
| Scale comment (`1 AU ≈ 175 px`) | ✅ Keep as canonical scale reference |

---

## 6. Functional Requirements

---

### 6.1 Real Orbital Velocity Movement

**Context:** Currently, each planet's angle is incremented by an arbitrary `speed` constant multiplied by a fixed animation step. This produces correct relative speed ordering but does not correspond to real astronomical orbital periods.

**Requirement:** Planet angular positions shall be driven by real sidereal orbital periods referenced to a simulation clock.

#### FR-1.1 — Orbital Period Data

Each planet shall have a defined sidereal orbital period in Earth days:

| Planet | Sidereal Period (days) |
|---|---|
| Mercury | 87.97 |
| Venus | 224.70 |
| Earth | 365.25 |
| Mars | 686.97 |
| Jupiter | 4332.59 |
| Saturn | 10759.22 |
| Uranus | 30688.50 |

#### FR-1.2 — Simulation Clock

- The viewer shall maintain a `simulationDate` (JavaScript `Date` object) as the authoritative time source.
- When running freely (not paused), `simulationDate` shall advance at a configurable **time multiplier** (default: 1 day per second of real time).
- A **speed control** (×1, ×7, ×30, ×365 — days/second) shall be available in the UI.

#### FR-1.3 — Angle Derivation

Each planet's heliocentric ecliptic longitude shall be computed as:

```
meanLongitude(planet, date) = L0 + (360 / period_days) × daysSinceEpoch(date)
```

Where:
- `L0` = mean longitude at J2000 epoch (Jan 1.5, 2000)
- `period_days` = sidereal orbital period
- `daysSinceEpoch(date)` = Julian Day Number difference from J2000.0

J2000 mean longitudes at epoch (degrees):

| Planet | L0 (deg) |
|---|---|
| Mercury | 252.25 |
| Venus | 181.98 |
| Earth | 100.46 |
| Mars | 355.43 |
| Jupiter | 34.33 |
| Saturn | 50.08 |
| Uranus | 314.20 |

#### FR-1.4 — Position Computation

Planet world position in animation pixels (ecliptic plane, Z=0 for all inner planets in the simplified model):

```
wx = cos(meanLongitude_rad) × orbit_px
wy = sin(meanLongitude_rad) × orbit_px
wz = 0
```

Where `orbit_px` uses the existing pixel orbit radii from `shared_render.js` (`Mercury=72`, `Venus=118`, `Earth=170`, `Mars=235`, `Jupiter=365`, `Saturn=488`, `Uranus=608`).

> **Note:** A simplified circular orbit model is sufficient for Epic 1. Elliptical Keplerian correction is deferred to Epic 3 (high-fidelity mode).

---

### 6.2 Date Input — Planet Position by Date

**Requirement:** The user shall be able to type or pick any calendar date, and all planet positions shall instantly update to reflect that date.

#### FR-2.1 — Date Picker Control

- A date input field (`<input type="date">`) shall be rendered in the viewer's UI panel.
- Supported date range: **Jan 1, 1900 — Dec 31, 2099**
- Default value on page load: **today's date** (`new Date()`)

#### FR-2.2 — Live Update on Date Change

- On every `change` event from the date picker, `simulationDate` shall be set to the selected date.
- All planet angles shall be recomputed immediately using FR-1.3.
- The canvas shall re-render within the same animation frame.
- The simulation shall **pause** when the user is actively changing the date (resume on blur or play button).

#### FR-2.3 — Date Display in Canvas

- The current simulation date shall be displayed on the canvas (top-left or bottom-left region) in the format: `MMM DD, YYYY` (e.g., `MAR 08, 2026`).
- This display shall update every frame while the simulation is running.

#### FR-2.4 — Planet Info on Hover

- When the user hovers over a rendered planet, a tooltip shall display:
  - Planet name
  - Current heliocentric distance from Sun (in AU, computed from `orbit_px / 175`)
  - Current heliocentric ecliptic longitude (degrees)
  - Distance from Earth (AU)

---

### 6.3 Zoom Rulers (In/Out)

**Requirement:** The viewer shall include two ruler controls that govern zoom level in **direct, real-time, frame-immediate** response. Moving either ruler by any amount must produce a visible change on the canvas **within the same animation frame** — no lerp smoothing, no async delay, no queued transitions. What the user drags is exactly what they see.

- **Zoom In Ruler:** Range `0` to `100`. Moves the camera closer to the solar system.
- **Zoom Out Ruler:** Range `0` to `−100`. Pulls the camera further away.

The two rulers are **independent** — both can hold non-zero values simultaneously. The final camera `dist` is the result of combining both ruler values (see FR-3.2).

#### FR-3.1 — Dual Ruler Layout

- Two range slider elements (`<input type="range">`) shall be rendered as part of the on-screen control panel.
- **Zoom In Ruler:** `min=0`, `max=100`, default `0`. Label: `ZOOM IN +`.
- **Zoom Out Ruler:** `min=-100`, `max=0`, default `0`. Label: `ZOOM OUT −`.
- Both rulers are visible at all times, with numeric tick marks displayed beside each at `0`, `25`, `50`, `75`, `100` (and their negative equivalents).

#### FR-3.2 — Zoom Mapping to Camera Distance (Direct, No Smoothing)

The camera `dist` is computed **every frame** directly from the current ruler positions. No lerp is applied to ruler-driven distance changes.

Let `zoom` = single ruler value (−100 to +100, 0 = neutral centre):

```
baseNeutral = 1200

dist = zoom >= 0
     ? lerp(baseNeutral, 80,   zoom  / 100)   //  0..+100 → 1200 → 80   (zoom in)
     : lerp(baseNeutral, 6000, -zoom / 100)   // -100..0  → 1200 → 6000 (zoom out)
```

This means:
- Ruler at `0`: `dist = 1200` — full solar system view (Uranus visible)
- Ruler at `+100`: `dist = 80` — inner planets fill the screen
- Ruler at `−100`: `dist = 6000` — entire solar system is a small cluster

#### FR-3.3 — Ruler Interaction Rules

- **Every `input` event** (not just `change`) on either ruler shall immediately recompute `dist` and trigger a canvas redraw — this ensures the view updates as the thumb is being dragged, not only when released.
- **No camera lerp** shall be applied to the `dist` value when it is changed by a ruler. The rendered distance equals the computed distance exactly on the same frame.
- Camera lerp smoothing (`sp * 0.65`) is only applied during **mouse-drag orbit** and **preset button transitions** (see FR-4.4), not ruler input.
- A **double-click** on either ruler handle shall reset that ruler to `0`.
- **Mouse scroll wheel** on the canvas shall drive the Zoom In ruler: scroll up → increase `zIn`, scroll down → decrease `zIn`. Scroll events shall also update the Zoom In ruler position visually in real-time.

#### FR-3.4 — Ruler Visual Design

- Rulers shall be styled to match the dark space aesthetic of the existing viewer (dark background, glowing accent marks, semi-transparent panel).
- Ruler track color: `rgba(130, 180, 255, 0.4)`
- Active fill color: `rgba(100, 210, 255, 0.8)`
- Thumb: circular, white, 14px diameter
- Current numeric value displayed beside or below each ruler thumb as it moves

---

### 6.4 Full-Sphere Point-of-View Controls — Arcball Controller

**Requirement:** The user shall be able to rotate the viewpoint to any direction on the full celestial sphere using an **arcball (trackball) controller** — the industry-standard UX for free 3D rotation used in Blender, Sketchfab, Three.js, and CAD tools. The mental model is: _"I am grabbing the solar system with my hand and spinning it."_

The arcball is rendered as a small interactive sphere widget in a corner of the screen. Dragging anywhere on it — or dragging directly on the main canvas — rotates the camera around the Sun. The motion is spatially intuitive: dragging right spins the system clockwise, dragging up tilts it toward the viewer, dragging diagonally combines both.

No separate azimuth/elevation sliders are needed — the arcball replaces them entirely. The underlying camera math (`buildCamera`, `aEl`, `aAz`) remains unchanged; the arcball simply writes to those same variables.

#### FR-4.1 — Arcball Widget

- A small sphere approximately **120×120 px** shall be rendered in the **bottom-right corner** of the canvas (or control panel), always visible.
- The sphere shall be drawn using Canvas 2D with:
  - A translucent dark body (`rgba(0, 5, 20, 0.75)`) with a subtle radial highlight to read as a 3D sphere
  - Three axis rings drawn on its surface representing X (red), Y (green), and Z/ecliptic (blue) axes — styled faintly so they orient the user without cluttering
  - A small dot or crosshair showing the current "north pole up" direction on the sphere surface
  - A thin border ring: `rgba(130, 180, 255, 0.5)`
- The widget shall update its visual orientation every frame to reflect the current `aEl` / `aAz` values, so it always mirrors what the main canvas is showing.

#### FR-4.2 — Arcball Drag Interaction

**How it works (arcball math):**

When the user begins a drag (mousedown) anywhere on the arcball widget or on the main canvas (see FR-4.3), the system records the start position and projects it onto an imaginary unit sphere. As the mouse moves, the system computes the rotation that maps the start-sphere-point to the current-sphere-point, then applies that rotation to the camera's `aEl` and `aAz`.

In practice for this project (spherical camera with azimuth + elevation), the arcball drag maps cleanly to:

```
onDrag(dx, dy):
  aAz += dx * sensitivity     // horizontal drag → azimuth
  aEl += dy * sensitivity     // vertical drag   → elevation
  aEl  = clamp(aEl, -89, 89)  // prevent pole flip
```

- Default drag sensitivity: **`0.4° per pixel`**
- Camera lerp smoothing (`sp = 0.12`) is applied to `aEl` and `aAz` targets so the view glides to a smooth stop after the user releases — this is the **only** place lerp is used for POV (ruler zoom remains instant per FR-3.3).

#### FR-4.3 — Direct Canvas Drag (Same Arcball Behavior)

- **Left-click drag anywhere on the main canvas** (outside UI panels) shall produce identical arcball rotation behavior as dragging the widget.
- This is the primary interaction path for most users — they will drag directly on the solar system, not on the widget.
- The widget serves as a visual reference and a secondary drag target.
- While dragging, a subtle cursor change (`cursor: grabbing`) shall indicate the interaction is active.

#### FR-4.4 — Preset View Buttons

One-click presets shall smoothly animate the camera (`aEl`, `aAz` lerp to targets over ~40 frames) to standard orientations:

| Button Label | `el` | `az` | Description |
|---|---|---|---|
| Top-Down | +89° | 0° | Looking straight down onto the ecliptic plane |
| Ecliptic | +5° | 0° | Near edge-on with a slight tilt — default on load |
| Side View | 0° | 90° | True edge-on view from the side |
| Isometric | +35° | 45° | Classic 3/4 perspective view |
| From Below | −89° | 0° | Looking straight up from south of the ecliptic |

- Clicking a preset while already at that orientation has no effect.
- Clicking a preset while the user is mid-drag cancels the drag and animates to the preset.
- The arcball widget visually animates during preset transitions, reflecting the live `aEl`/`aAz` values each frame.

#### FR-4.5 — Gimbal Lock Prevention

- `aEl` is clamped to `[−89°, +89°]` in all input paths (drag, preset, any programmatic set).
- The existing `buildCamera` function in `shared_render.js` already handles the camera `up` vector flip near ±88° — **no change to projection math is needed**.
- The arcball widget handles the visual near-pole case by keeping the axis indicators readable at all elevations.

---

### 6.5 Live Camera State HUD

**Requirement:** A small, always-visible readout shall be displayed on screen showing the current numeric values of all camera parameters. It updates in real-time during any user interaction and retains the last values when the user stops moving.

#### FR-5.1 — What Is Displayed

The HUD shall show three values at all times:

| Label | Value | Example |
|---|---|---|
| `ZOOM` | Combined zoom level as a signed integer from −100 to +100 | `+62` |
| `ELEVATION` | Current `aEl` value in degrees, signed | `+34°` |
| `AZIMUTH` | Current `aAz` value in degrees, 0–360 | `127°` |

- **Date** is optional — if the simulation date is already displayed on canvas (per FR-2.3), it does not need to be duplicated in the HUD. If no date is shown elsewhere, it may be added as a fourth row.
- Values are always rounded to the nearest integer for readability.

#### FR-5.2 — Real-Time Update Behaviour

- Values shall update **every animation frame** while the user is dragging the arcball, dragging the canvas, or moving the zoom rulers.
- When the user **stops interacting**, the values remain displayed showing the last state — they do not fade, hide, or reset.
- There is no animation or transition on the numbers themselves — they snap to the current value each frame.

#### FR-5.3 — HUD Placement and Visual Design

- The HUD shall be positioned in a **fixed corner of the screen** (proposed: top-right, or bottom-left away from the zoom rulers and arcball widget) so it never overlaps the main solar system view.
- Visual style consistent with the existing 3i-web dark aesthetic:
  - Background: `rgba(0, 5, 20, 0.65)` semi-transparent dark panel
  - Border: `rgba(130, 180, 255, 0.25)`
  - Label text: `rgba(130, 180, 255, 0.7)` — dim blue
  - Value text: `rgba(220, 235, 255, 1.0)` — bright white, slightly larger font
  - Font: `Georgia` or monospace, consistent with existing canvas labels
- The panel shall be compact — three rows, no wasted space.

#### FR-5.4 — Scope Boundary

- The HUD is **read-only** in Epic 1. The values are for the user to observe and note manually.
- No copy button, no input fields, no URL encoding, no save/load. Those are deferred to a future epic.

---

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Canvas render loop (`requestAnimationFrame`) must maintain ≥ 55 fps at 1920×1080 on a mid-tier laptop |
| NFR-2 | Performance | Date change → planet position update must complete in < 2ms (synchronous computation, no API calls) |
| NFR-3 | Accuracy | Planet angular positions accurate to within ±5° of VSOP87 simplified values for dates 1900–2099 |
| NFR-4 | Compatibility | Must work in Chrome 120+, Firefox 120+, Safari 17+ without polyfills |
| NFR-5 | Responsiveness | Canvas must resize correctly on window resize; controls must remain accessible at viewport widths ≥ 768px |
| NFR-6 | Accessibility | All interactive controls (sliders, date picker, buttons) must have ARIA labels and keyboard support |
| NFR-7 | Consistency | Visual language (colors, fonts, backgrounds) must match the existing 3i-web dark space aesthetic |
| NFR-8 | Independence | `solar_system.html` must function with zero dependency on `atlas_data.js`, `atlas_main.js` or `main.js` |

---

## 8. Out of Scope for Epic 1

The following are explicitly deferred:

| Feature | Deferred To |
|---|---|
| 3I/ATLAS comet overlay on the solar system | Epic 2 |
| Neptune and dwarf planets (Pluto, Ceres) | Epic 3 |
| Elliptical (non-circular) Keplerian orbits with eccentricity | Epic 3 |
| Moons of planets | Epic 3 |
| Real-time solar wind / heliosphere visualization | Epic 4 |
| Mobile touch support (pinch-to-zoom, two-finger rotate) | Epic 5 |
| 3D extruded orbital inclinations above/below ecliptic | Epic 3 |
| Data export (CSV positions, screenshots) | Epic 5 |
| Multi-language UI | Epic 6 |

---

## 9. User Journeys

### Journey 1: "Where was Jupiter on the day I was born?"

1. User opens `solar_system.html` — sees solar system from above, planets orbiting in real time at today's date.
2. User clicks the **date picker**, types `1985-06-15`.
3. All planets immediately snap to their June 15, 1985 positions.
4. User hovers over Jupiter — tooltip shows `Jupiter · 5.20 AU from Sun · 152° longitude`.
5. User uses the **Zoom In ruler** (drag to `~60`) to get closer to Jupiter's orbit ring.
6. User drags the **elevation control** toward `+60°` to tilt the view slightly.
7. User clicks **Ecliptic** preset — view snaps to near-edge-on view. Jupiter is visible with its ring plane.

### Journey 2: "Show me the solar system from below"

1. User opens the viewer at default top-down view.
2. User clicks preset button **South Pole** (`el = −90°`).
3. Camera smoothly interpolates to directly below the ecliptic. Planets orbit counter-clockwise (retrograde apparent motion from south).
4. User drags left-click to rotate azimuth to see a specific orientation.
5. User scrolls mouse wheel outward — Zoom Out ruler advances toward −50, camera pulls back to `dist ≈ 3600`.

### Journey 3: "Compare inner vs outer planets"

1. User at default view (`el = 45°`, `dist = 1200`).
2. User drags **Zoom In ruler** fully to `100` — camera pulls in to `dist = 80`. Mercury, Venus, Earth, Mars are large and clearly separated.
3. User drags **Zoom Out ruler** to `−100` — camera pulls back to `dist = 6000`. All 7 planets visible as small dots, relative orbital spacing clear.
4. User resets zoom — both rulers return to 0.

---

## 10. Architecture — Encapsulation & Layer Design

### 10.1 File Structure

```
3i-web/
├── solar_system.html        ← NEW: standalone entry point (Epic 1)
├── solar_system.js          ← NEW: all Epic 1 logic, self-contained
├── shared_render.js         ← UNCHANGED: shared 3D primitives (camera, planets, sun, orbits)
├── styles.css               ← UNCHANGED: reused as-is for dark space visual language
└── assets/                  ← UNCHANGED: earth.png, jupiter.gif reused
```

`solar_system.html` has **zero dependency** on `atlas_data.js`, `atlas_main.js`, or `main.js`.

---

### 10.2 Encapsulated Modules inside `solar_system.js`

All logic is organised into discrete, named modules (plain JS objects/closures — no framework):

| Module | Responsibility |
|---|---|
| `PlanetaryEngine` | J2000 mean longitude computation, `dateToAngles(date)`, simulation clock, speed multiplier |
| `CameraController` | Arcball drag state, zoom ruler values, `aEl`/`aAz`/`aDist` targets, preset animations |
| `HUD` | Reads camera state each frame and renders the live ZOOM / ELEVATION / AZIMUTH overlay |
| `LayerManager` | Ordered list of draw functions; exposes `register(name, fn)` and `draw()` |
| `UIControls` | DOM wiring: date picker, zoom rulers, preset buttons, arcball widget canvas |

---

### 10.3 Layered Render Pipeline

The render loop calls `LayerManager.draw()` each frame. Layers execute in registration order:

```
Frame tick
 └─ LayerManager.draw()
     ├── Layer 0: 'background'   → drawStars()
     ├── Layer 1: 'ecliptic'     → drawEclipticPlane()
     ├── Layer 2: 'orbits'       → drawOrbit() × 7
     ├── Layer 3: 'planets'      → drawPlanet() × 7
     ├── Layer 4: 'sun'          → drawSun()
     ├── Layer 5: 'hud'          → HUD.draw()
     └── Layer N: (future)       → registered by Epic 2, 3, etc.
```

Future epics add their content without modifying `solar_system.js`:

```javascript
// Epic 2 — 3I/ATLAS overlay (example, not built in Epic 1)
SolarSystem.layers.register('atlas-comet', () => {
    drawAtlasTrail();
    drawComet(...);
});
```

The `register(name, fn)` call appends to the layer stack. Layers can be toggled by name. This is the **extension contract** Epic 1 publishes.

---

### 10.4 Public API Surface

`solar_system.js` exposes a single global `SolarSystem` object:

```javascript
SolarSystem = {
    layers:  { register(name, fn), remove(name), toggle(name) },
    camera:  { setDate(date), setPreset(name), getState() },
    engine:  { simulationDate, speedMultiplier, pause(), resume() },
}
```

This is the interface future epics and embedding contexts use. Internals are not exposed.

---

### 10.5 Constraints & Dependencies

| Constraint | Detail |
|---|---|
| **Technology** | Vanilla JavaScript + HTML5 Canvas 2D API only (no WebGL, no frameworks) |
| **Shared code** | `shared_render.js` is the sole shared dependency; Epic 1 must not break the existing `solar_comet.html` page |
| **Scale convention** | 1 AU = 175 pixels (established in `atlas_data.js`) — must remain consistent |
| **J2000 epoch** | All planetary position calculations use J2000.0 (Jan 1.5, 2000, TT) as the reference epoch |
| **Circular orbits** | Epic 1 uses circular orbits only; `orbit_px` radii in `shared_render.js` are treated as semi-major axes |
| **No external APIs** | Planet positions are computed client-side; no Horizons API or server calls |
| **Asset reuse** | Existing textures (`assets/earth.png`, `assets/jupiter.gif`) shall be reused |

---

## 11. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | ~~Should the Zoom In and Zoom Out rulers be displayed as vertical sliders on the side or a single bidirectional bar?~~ | orly | **Resolved** — two independent rulers (Zoom In 0→100, Zoom Out 0→−100), both always visible |
| OQ-2 | ~~Should mouse-drag orbit require a modifier key?~~ | orly | **Resolved** — arcball: direct left-click drag on canvas or widget, no modifier key needed |
| OQ-3 | What is the preferred date format for the on-canvas date display — `MMM DD, YYYY` (current `atlas_data.js` style) or a full ISO format? | orly | Open |
| OQ-4 | Should the viewer include **Neptune** (period = 60,182 days) in Epic 1, or is 7 planets (Mercury–Uranus) sufficient for the first release? | orly | Open |
| OQ-5 | Should the time-speed control (×1, ×7, ×30, ×365) be visible by default or hidden behind an "Advanced" toggle? | orly | Open |
| OQ-6 | Should the arcball widget be positioned **bottom-right** (default proposal) or another corner? Should it remain visible at all times or only when the user is hovering near it? | orly | Open |
| OQ-7 | Should the axis rings on the arcball widget be labeled (X/Y/Z or N/S/E/W) or left unlabeled for a cleaner look? | orly | Open |

---

*End of PRD — Epic 1: Interactive Solar System Viewer*

---

**Document version:** 1.0
**Next step:** Create Epics & Stories (use `[CE]` command in the PM agent, or proceed to architecture design)
