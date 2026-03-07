# 3I/ATLAS · Interstellar Visitor — Animation Documentation

A single-file HTML5 canvas animation (`solar_comet.html`) telling the story of our solar system's ecliptic plane and the real interstellar comet **3I/ATLAS**, discovered July 1, 2025. All rendering is procedural — no external assets, no libraries — just Canvas 2D API and JavaScript.

---

## Architecture Overview

| Component | Description |
|---|---|
| **Renderer** | HTML5 Canvas 2D, 60 fps `requestAnimationFrame` loop |
| **3D Engine** | Custom look-at camera with azimuth + elevation, full perspective projection |
| **Scenes** | 8 sequential scenes, navigated with interactive timeline slider + time indicators |
| **Controls** | Timeline scrubber with scene markers, pause/play toggle, forward/back buttons |
| **Comet physics** | Scene 2: scripted 3D trajectories. Scenes 3–7: Catmull-Rom spline over real 3I/ATLAS keyframes |
| **Closeup panel** | Procedural telescope-view inset, 220×220 px, bottom-right corner |

---

## The 3D Camera System

The camera is a true **orbiting camera** — the solar system stays fixed in world space, and the camera flies around it. This was a deliberate design choice to avoid the "solar system spinning" illusion that a rotating-world approach creates.

**Parameters:**
- `az` — azimuth in radians (horizontal orbit around the Z axis)
- `el` — elevation in degrees (90 = directly above, 0 = edge-on, negative = below)
- `dist` — distance from the look-at target
- `tx, ty, tz` — look-at target point in world space

Each frame the camera builds a full view matrix via `buildCamera()`, computing the camera's world-space position from spherical coordinates, then constructing right/up/forward vectors for perspective projection. All camera values are smoothly interpolated (`lerp`) toward their per-scene targets every frame.

**World scale:** 1 AU ≈ 175 px. Earth orbit radius = 170 px, Saturn = 488 px.

---

## Scene-by-Scene Breakdown

### Scene 0 — The Solar System
**Camera:** Pure top-down (elevation 90°), distance 950.

The classic overhead view. Seven planets orbit the Sun (Mercury through Uranus — Neptune intentionally omitted to keep the visible disc from becoming too sparse). Orbit rings glow at full brightness. Planet labels are visible. The Sun has a multi-layer radial gradient corona.

---

### Scene 1 — The Ecliptic Plane
**Camera:** Sweeps from 90° → 45° → 0° (edge-on) → −45° (below) → 0° → 45°. Azimuth slowly rotates for drama.

Reveals the ecliptic plane — the flat disc within which all planets orbit. The plane is rendered as a filled 3D polygon (200-segment polyline of Uranus's orbit) with a **uniform flat fill** (`rgba(155,205,255,0.30)`) so the disc reads clearly even at the edges, plus a bright rim stroke. Visibility fades toward zero when the camera is nearly top-down (el > 80°), since a disc viewed from directly above has zero apparent thickness.

---

### Scene 2 — Interstellar Visitors
**Camera:** Per-comet azimuth, elevation sweeps to follow each comet's direction of travel.

Two example comets demonstrate how interstellar visitors arrive from different directions, piercing the ecliptic plane at different angles. Each comet flies the full trajectory — it is never position-clamped after passing through the plane.

**Comet A — 90° to plane (blue-white)**
Drops vertically. Camera starts above (el 50°), sweeps to −34° as it exits below. The most dramatic pierce.

**Comet B — −45° from below (blue)**
Comes from *below* the plane (`wz` starts at −600, rises through 0, exits above). Camera starts *below* the ecliptic (el −42°) and sweeps upward to +34°, tracking the comet's ascent. The comet is precisely targeted to pass **directly through Saturn's orbital position** when it pierces the plane, demonstrating a close planetary encounter. A plane-flash effect (golden burst + 5 expanding ripple rings) fires at the pierce point and is drawn *above* all other elements.

**Phase indicator dots** at the bottom show A / B progress.

---

### Scene 3 — 3I/ATLAS Approaches
**Camera phase 1 (frames 0–100):** Wide establishing shot, top-down, full solar system visible at distance 2000.  
**Camera phase 2 (frames 100–300):** Sweeps around to azimuth **5.24 rad (= 300°)** — the Sagittarius direction from which 3I/ATLAS entered — and drops elevation to **6°**, nearly edge-on. The ecliptic plane appears as a glowing disc straight ahead, seen from the comet's own vantage point.

The comet appears as a warm golden-orange dot far out in the +X/+Y quadrant (4.5 AU from the Sun), with a faint trail accumulating behind it. A "Jul 1 · Discovery at 4.5 AU" milestone label marks the entry point.

---

### Scene 4 — Entering the System
**Camera:** Locked at elevation 5°, azimuth 5.24 rad (3I/ATLAS's own perspective). Distance compresses from 1100 → 700 as it approaches perihelion.

This is the **3I/ATLAS point-of-view scene**. The ecliptic plane is seen nearly edge-on — a bright glowing ribbon across the frame. The camera tracks the midpoint between the comet and the Sun. A perihelion target marker shows "Oct 29 · Perihelion ahead." The closeup panel shows the comet warming from green to orange.

---

### Scene 5 — Oct 3 · Near Mars
**Camera:** Elevation 22–30°, azimuth ~5.0, distance 700–820. Pans between the comet and the Sun/Mars region.

Covers the Mars flyby (Oct 3, 0.194 AU from Mars) through perihelion (Oct 29). Milestone markers appear for both events. The closeup panel shows peak perihelion brightness — brilliant blue-white ion tail, golden nucleus.

---

### Scene 6 — Dec 19 · Earth Alignment
**Camera:** Elevation 25°, azimuth 4.7, distance 900. Frames both Earth and the receding comet.

The comet is now outbound. Earth crosses through the direction of 3I/ATLAS's ion tail on December 19, 2025 (closest approach 1.8 AU). A **dashed blue line** connects the comet to Earth labeled "Earth in ion tail." The Earth milestone marker appears. The closeup panel shows the anti-tail spike now prominent alongside the main ion and dust tails.

---

### Scene 7 — Mar 16 · Jupiter Flyby
**Camera:** Elevation 28°, azimuth 4.5, distance 650 → 600. Locks between Jupiter and the comet.

The final chapter. 3I/ATLAS passes Jupiter at 0.36 AU — astonishingly close to Jupiter's Hill radius (the boundary of its gravitational dominance). A gold ring around Jupiter labels the flyby. Once the comet reaches frac > 0.97, an exit annotation reads "→ Exits solar system · never returns." The closeup panel shows the three-jet structure fading as the comet heads into interstellar space.

---

## 3I/ATLAS Trajectory

The trajectory is based on **real JPL orbital elements**:

| Parameter | Value |
|---|---|
| Eccentricity (e) | 6.137 (hyperbolic) |
| Perihelion distance (q) | 1.356 AU |
| Inclination (i) | 175.11° — retrograde, only 5° from ecliptic |
| Argument of perihelion (ω) | 128.01° |
| Ascending node (Ω) | 322.15° |
| Entry speed (v∞) | 58 km/s |
| Perihelion speed | 68 km/s |

The path is reconstructed as a **Catmull-Rom spline** through 15 keyframes derived from JPL Horizons ephemeris data. Because the eccentricity is 6.14, the trajectory is nearly a straight line — the slight curve is real. The comet moves **retrograde** (opposite to planetary orbital direction). The `wz` component (height above/below ecliptic) is slightly exaggerated for visual clarity since the real 5° inclination would be nearly invisible at most camera angles.

**Key dates encoded in the animation:**

| Date | Event | Frac |
|---|---|---|
| Jul 1, 2025 | Discovery at 4.5 AU from Sun | 0.00 |
| Oct 3, 2025 | Mars closest approach (0.194 AU from Mars) | 0.32 |
| Oct 29, 2025 | Perihelion — 1.36 AU from Sun, 68 km/s | 0.42 |
| Dec 19, 2025 | Earth closest approach (1.8 AU) | 0.60 |
| Mar 16, 2026 | Jupiter flyby (0.36 AU — near Hill radius) | 0.92 |

---

## The Evolving Closeup Panel

A 220×220 px inset in the bottom-right corner shows how 3I/ATLAS actually *looked* through telescopes as it progressed. All rendering is procedural — no images loaded.

### Phase 0 — Discovery · Green Glow (frac 0.00–0.20)
**Color: bright green.** The characteristic C₂ dicarbon molecular emission that gives active comets a vivid green coma. Short faint tail. Large diffuse halo. This matches early July–August 2025 ground-based observations.

### Phase 1 — Brightening · Warming (frac 0.20–0.38)
Color transitions **green → orange-red** as the nucleus heats up approaching 4 AU → 2 AU. Coma diameter grows, tail begins to extend meaningfully.

### Phase 2 — Perihelion · Peak Brightness (frac 0.38–0.46)
The most dramatic phase. Brilliant **blue-white ion tail** (plasma — ionized gas pushed directly anti-sunward by the solar wind) with a narrow bright core. Separate warmer **dust tail** curved slightly off-angle (dust follows a different trajectory to ions). Large golden-white nucleus at peak brightness. This matches Hubble and JUICE imagery from late October–early November 2025.

### Phase 3 — Post-Perihelion · Anti-Tail (frac 0.46–0.60)
Ion tail still long and blue. The **anti-tail** now appears — a thin bright spike pointing *toward* the Sun. This is not a jet; it's large dust particles that lag behind in the orbital path and appear sunward due to viewing geometry. Grows from nothing to ~40 px in length during this phase.

### Phase 4 — Three Jets · False Color (frac 0.60–0.85)
Based on post-perihelion false-color infrared imaging. **Three distinct jets** emerge from the nucleus at **120° spacing**, slowly rotating with the nucleus spin period (~7–16 hours, simulated as slow rotation). Each jet has its own color matching the false-color palette:
- **Jet 1 (north):** bright green/cyan — hottest material
- **Jet 2 (southeast):** orange-yellow
- **Jet 3 (southwest):** cyan-blue

The anti-tail is now prominent. All three tail structures (dust, ion, anti-tail) are simultaneously visible. A "false color" label appears in the panel corner.

### Phase 5 — Fading · Exit (frac 0.85–1.00)
All features fade uniformly. Jets still visible but dimming. Anti-tail elongates. The comet's water-ice sublimation has largely ceased; only CO₂ and CO still drive residual outgassing at this distance.

---

## Rendering Details

### Ecliptic Plane
- 200-point polyline forming a filled disc clipped to Uranus's orbit radius
- Uniform fill `rgba(155,205,255,0.30)` — no radial fade so edges stay bright
- Subtle inner brightening via clipped radial gradient
- Bright rim stroke `rgba(180,220,255,0.70)`
- Visibility: `showFactor = clamp((90 - |el|) / 75, 0, 1)` — invisible from top-down, full at edge-on

### Planet Bodies
- Radial gradient sphere with highlight offset
- Earth has continent patches clipped to disc
- Saturn has dual-ring ellipses (inner + outer) projected in 3D
- Labels shown when perspective scale > 0.3

### Comet Tail
- Tail direction: away from Sun in 3D world space (`dx/d3 * tailLen`), projected to screen
- Two quadratic Bézier curves forming a teardrop silhouette
- Linear gradient head-to-tip with alpha falloff
- Nucleus: separate radial gradient on top

### Plane Flash (Scene 2)
- Triggers when comet `|wz| < 60` during pierce
- Radial gradient burst: white center → golden → orange → purple → transparent
- 5 expanding stroke rings
- Drawn *last* so always on top of everything

### Trail Rendering
- Scene 2 comets: no persistent trail (they fly clean)
- 3I/ATLAS (scenes 3–7): golden-orange polyline, alpha increases toward head, max 800 points

---

## Interactive Controls

### Timeline Slider
A 600px interactive scrubber replaces traditional Prev/Next pagination, enabling smooth navigation through all 8 scenes:
- **Click or drag** on the timeline to jump to any scene instantly
- **Scene markers** — 8 vertical ticks marking each scene position
- **Gradient progress bar** — cyan-to-blue fill showing current position
- **Draggable thumb** — circular indicator with glow effect
- **Time indicator** above the timeline displays real dates during 3I/ATLAS scenes (Scenes 3–7):
  - Scene 3: "JUL 1, 2025 · Discovery"
  - Scene 4: "SEP 2025 · Approaching"
  - Scene 5: "OCT 29, 2025 · Perihelion"
  - Scene 6: "DEC 19, 2025 · Earth Alignment"
  - Scene 7: "MAR 16, 2026 · Jupiter Flyby"

### Playback Controls
- **Pause/Play button** — toggles animation (◼ Pause / ▶ Play)
  - When paused: all time-based updates freeze (planet motion, comet progression, scene timers, closeup animation)
  - Rendering continues at 60fps so camera smoothing and visual updates remain fluid
- **Forward/Back buttons** (◄ / ►) — step through scenes one at a time

---

## What's Next / Ideas

- **Sound design** — low rumble on approach, flash sfx at pierce, eerie tone during 3I/ATLAS POV
- **Tooltip on hover** — click on a planet or milestone to get a detailed fact card
- **Scene 2 additional comet** — a retrograde comet showing shallow near-ecliptic entry (like 3I/ATLAS itself)
- **Comparison inset** — show 1I/ʻOumuamua and 2I/Borisov trajectories as ghost paths
- **Nucleus rotation** — animate the closeup nucleus with the real 16.16 hr pre-perihelion period (spun up to 7.1 hr post-perihelion after tidal stresses at perihelion)
- **Timeline tooltips** — hover over timeline to preview scene names
- **Speed multiplier** — UI control to adjust animation playback speed (0.5× to 3×)