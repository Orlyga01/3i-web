# 3I/ATLAS · Interstellar Visitor — Animation

A two-part HTML5 canvas animation showcasing our solar system's ecliptic plane and the real interstellar comet **3I/ATLAS** (C/2025 N1), discovered July 1, 2025.

## Quick Start

1. Open `solar_comet.html` in a modern web browser
2. The animation will automatically progress through:
   - **Part 1:** Solar System Overview (ecliptic plane, interstellar visitors)
   - **Part 2:** 3I/ATLAS Journey (automatically transitions to `atlas_journey.html`)

## Project Structure

### HTML Files
- **`solar_comet.html`** — Entry point, 2 scenes introducing the ecliptic plane
- **`atlas_journey.html`** — 3I/ATLAS trajectory, 5 scenes from discovery to Jupiter flyby

### JavaScript Files
- **`shared_render.js`** — Common rendering functions:
  - Canvas setup & 3D camera system
  - Planet, sun, star, and ecliptic plane rendering
  - Utilities (lerp, clamp, easing functions)
  
- **`main.js`** — Solar system overview logic (2 scenes)
- **`atlas_main.js`** — 3I/ATLAS journey logic (5 scenes)
- **`atlas_data.js`** — Real JPL Horizons trajectory data

### Assets
- **`assets/earth.png`** — Earth texture (center-cropped square)
- **`assets/jupiter.gif`** — Jupiter texture (center-cropped square)

### Styling
- **`styles.css`** — All CSS styles for both HTML files

## Features

### Rendering Technology
- **HTML5 Canvas 2D API** — 60fps `requestAnimationFrame` loop
- **Custom 3D Engine** — Orbiting camera with perspective projection
- **Procedural Graphics** — Stars, orbital paths, comet tails
- **Texture Mapping** — Earth and Jupiter use real image textures
  - Center-cropped to square format
  - Circular clipping mask at 95% radius (prevents edge artifacts)
  - Glow effects for depth

### Planet Rendering
| Planet | Radius | Orbit (px) | Texture |
|--------|--------|------------|---------|
| Mercury | 5 | 72 | Procedural |
| Venus | 8 | 118 | Procedural |
| **Earth** | 9 | 170 | `earth.png` |
| Mars | 7 | 235 | Procedural |
| **Jupiter** | 44 | 365 | `jupiter.gif` |
| Saturn | 18 | 488 | Procedural + rings |
| Uranus | 13 | 608 | Procedural |

*Note: Jupiter is twice its proportional size (44 vs 22) for visual prominence*

### Interactive Controls
- **Timeline Slider** — Click/drag to scrub through scenes
- **Pause/Play** — Toggle animation playback
- **Scene Markers** — Visual indicators for scene boundaries
- **Auto-progression** — Animation advances automatically

## Scene Breakdown

### Part 1: Solar System Overview (`solar_comet.html`)

#### Scene 0 — The Ecliptic Plane
**Duration:** ~13 seconds (with 1-second initial delay)

Camera sweeps from 90° (top-down) through various angles to reveal the flat orbital plane. All planets orbit within this disc.

#### Scene 1 — Interstellar Visitors
**Duration:** ~14 seconds per comet

Two example comets demonstrate different arrival angles:
- **Comet A** — 90° vertical approach (blue-white)
- **Comet B** — -45° from below, blue, intersects near Saturn

### Part 2: 3I/ATLAS Journey (`atlas_journey.html`)

#### Scene 0 — 3I/ATLAS Approaches
**Camera:** Rides behind the comet looking forward

Discovery on July 1, 2025 at 4.5 AU from Sun, traveling at 137,000 mph. The comet appears as a golden-orange dot approaching the ecliptic plane.

#### Scene 1 — Entering the System
**Camera:** Comet's perspective, nearly edge-on view

Retrograde orbit, 5° from ecliptic. Camera compresses from distance 1100 → 700 as the comet approaches perihelion.

#### Scene 2 — Oct 3 · Near Mars
**Camera:** Dynamic, Mars closeup → Sun view

- **Oct 3:** Mars closest approach (0.19 AU)
- **Oct 29:** Perihelion at 1.36 AU from Sun, 68 km/s

#### Scene 3 — Dec 19 · Earth Alignment
**Camera:** Frames both Earth and outbound comet

Earth enters the comet's ion tail at 1.8 AU distance. Blue dashed line shows alignment.

#### Scene 4 — Mar 16 · Jupiter Flyby
**Camera:** Wide view showing full trajectory with milestone dates

Final encounter at 0.36 AU from Jupiter (near Hill radius). Comet exits solar system forever.

## 3I/ATLAS Trajectory Data

Based on **JPL Horizons ephemeris** for C/2025 N1 (ATLAS):

| Parameter | Value |
|-----------|-------|
| Eccentricity (e) | 6.137 (hyperbolic) |
| Perihelion (q) | 1.356 AU |
| Inclination (i) | 175.11° (retrograde, 5° from ecliptic) |
| Entry speed (v∞) | 58 km/s |
| Perihelion speed | 68 km/s |

**Key Events:**

| Date | Event | Frac |
|------|-------|------|
| Jul 1, 2025 | Discovery at 4.5 AU | 0.00 |
| Oct 3, 2025 | Mars flyby (0.19 AU) | 0.32 |
| Oct 29, 2025 | Perihelion (1.36 AU) | 0.42 |
| Dec 19, 2025 | Earth alignment (1.8 AU) | 0.60 |
| Mar 16, 2026 | Jupiter flyby (0.36 AU) | 0.92 |

The trajectory uses **Catmull-Rom spline interpolation** through 15 keyframes for smooth animation.

## Camera System

### Parameters
- **Azimuth (az)** — Horizontal angle around Z-axis (radians)
- **Elevation (el)** — Vertical angle (degrees: 90 = top-down, 0 = edge-on, negative = below)
- **Distance (dist)** — Camera distance from look-at point
- **Look-at (tx, ty, tz)** — Target point in world space

### Projection
- Full perspective projection from 3D world → 2D screen
- Smooth interpolation (lerp) for all camera movements
- Scale-based rendering (distant objects appear smaller)

### World Scale
- 1 AU ≈ 175 pixels
- Earth orbit = 170 px
- Jupiter orbit = 365 px

## Technical Notes

### Timeline System
- **Global Progress:** 0-1 value spanning all scenes
- **Scene Markers:** Divide timeline into equal segments
- **Drag Scrubbing:** Pauses animation, updates scene state, resumes on release
- **Auto-advance:** Based on `TIMELINE_SPEED = 0.00008`

### Navigation Flow
```
solar_comet.html (Scenes 0-1)
    ↓ auto-advance
atlas_journey.html (Scenes 0-4)
    ↓ click Prev from Scene 0
solar_comet.html
```

### Coordinate System
- **Heliocentric ecliptic coordinates** (Sun at origin)
- **X-axis:** Vernal equinox direction
- **Y-axis:** 90° from X in ecliptic plane
- **Z-axis:** Perpendicular to ecliptic (positive = north)

## Browser Compatibility

Requires:
- HTML5 Canvas support
- ES6+ JavaScript
- `requestAnimationFrame`
- Image loading (for planet textures)

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Credits

- **JPL Horizons** — Trajectory data for C/2025 N1 (ATLAS)
- **Textures** — Earth and Jupiter images

## License

Educational/demonstration project.

## Future Ideas

- Sound design (approach rumble, pierce sfx)
- Hover tooltips on planets/milestones
- Speed multiplier control (0.5× to 3×)
- Comparison with 1I/ʻOumuamua and 2I/Borisov
- Animated nucleus rotation matching real spin period
