# 3I/ATLAS Project Structure

## Overview
The project is now split into two separate animations:
1. **Solar System Overview** (`solar_comet.html`) - Introduces the ecliptic plane and interstellar visitors
2. **3I/ATLAS Journey** (`atlas_journey.html`) - Follows the 3I/ATLAS comet through the solar system

## File Structure

### HTML Files
- **`solar_comet.html`** - Main entry point, scenes 0-1 (Ecliptic Plane, Interstellar Visitors)
- **`atlas_journey.html`** - ATLAS journey, scenes 0-4 (Approach → Jupiter Flyby)

### JavaScript Files
- **`shared_render.js`** - Common rendering functions used by both animations:
  - Canvas setup
  - Utilities (lerp, clamp, eio, lighten, darken)
  - 3D camera system
  - Stars, planets, sun rendering
  - Ecliptic plane and flash effects
  - Comet drawing
  
- **`main.js`** - Solar system overview logic (scenes 0-1):
  - Ecliptic plane reveal animation
  - Example comets (A and B) piercing the plane
  - Scene navigation
  - Auto-redirects to `atlas_journey.html` when complete
  
- **`atlas_main.js`** - 3I/ATLAS journey logic (scenes 0-4):
  - 3I/ATLAS trajectory calculations
  - Trail rendering
  - Milestone markers (Discovery, Mars, Perihelion, Earth, Jupiter)
  - Telescope closeup panel with evolving comet phases
  - Calendar display showing real dates
  - Redirects back to `solar_comet.html` when going backwards from scene 0
  
- **`atlas_data.js`** - 3I/ATLAS trajectory data:
  - JPL Horizons coordinates (ATLAS_PATH)
  - Key event fractions (AT_ENTRY, AT_MARS, AT_PERIHELION, AT_EARTH, AT_JUPITER)
  - Scene fraction boundaries (SC_FRAC)
  - Date conversion function (fracToDate)

### Styling
- **`styles.css`** - Shared CSS for both HTML files

### Assets
- **`assets/earth.png`** - Earth texture (used in planet rendering)
- **`assets/jupiter.gif`** - Jupiter texture (used in planet rendering)

## Navigation Flow

```
solar_comet.html (Scenes 0-1)
    ↓ (auto-advance or click Next)
atlas_journey.html (Scenes 0-4)
    ↓ (click Prev from scene 0)
solar_comet.html
```

### Scene Breakdown

**solar_comet.html:**
- Scene 0: THE ECLIPTIC PLANE - Camera sweeps showing the orbital plane
- Scene 1: INTERSTELLAR VISITORS - Two example comets pierce the plane at different angles

**atlas_journey.html:**
- Scene 0: 3I/ATLAS APPROACHES - Discovery on July 1, 2025, camera rides behind comet
- Scene 1: ENTERING THE SYSTEM - Edge-on view from comet's perspective
- Scene 2: OCT 3 — NEAR MARS - Mars flyby, then perihelion on Oct 29
- Scene 3: DEC 19 — EARTH ALIGNMENT - Earth enters comet's ion tail
- Scene 4: MAR 16 — JUPITER FLYBY - Final encounter, exits solar system

## Key Features

### Shared Between Both Files
- 3D camera system with smooth interpolation
- Procedurally generated stars and orbits
- Planet rendering:
  - **Earth** (r: 9) - Textured with `earth.png`
  - **Jupiter** (r: 44, twice normal size) - Textured with `jupiter.gif`
  - Other planets - Procedurally rendered with radial gradients
- Ecliptic plane visualization
- Pause/play controls
- Timeline slider with scene markers and scrubbing support

### ATLAS-Specific Features
- Real JPL Horizons trajectory data
- Historical trail accumulation
- Milestone markers for key events
- Real-time calendar display
- Telescope closeup panel showing:
  - Phase 0: Green C₂ coma (discovery)
  - Phase 1: Warming, orange-red transition
  - Phase 2: Perihelion, brilliant blue-white ion tail
  - Phase 3: Post-perihelion, anti-tail appears
  - Phase 4-5: Three jets at 120° spacing, fading

## Technical Details

### Planet Texture Rendering
- **Earth** and **Jupiter** use image textures loaded at runtime
- Images are center-cropped to square format (crops left/right sides equally)
- Circular clipping mask (95% of planet radius) prevents edge artifacts
- Glow effect rendered behind planets for depth
- Other planets use procedural radial gradients with lighting effects

### Camera System
- Smooth interpolation between target positions using `lerp`
- Parameters: azimuth, elevation, distance, look-at point (x, y, z)
- Perspective projection from 3D world coordinates to 2D screen space
- Scale-based rendering (objects farther away appear smaller)

### Timeline System
- Global timeline progress (0-1) spans all scenes
- Scene markers divide timeline into equal segments
- Drag scrubbing: pauses animation, updates scene time/fraction, resumes on release
- Auto-progression based on `TIMELINE_SPEED` constant

## Development Notes

- Both files share `shared_render.js` for common rendering functions
- `atlas_data.js` is only used by `atlas_journey.html`
- Navigation between files is automatic when reaching scene boundaries
- All coordinates use heliocentric ecliptic frame
- Scale: 1 AU ≈ 175 pixels (Earth orbit ≈ 170 px)
- Jupiter's size (r: 44) is proportionally larger than real scale for visual prominence
