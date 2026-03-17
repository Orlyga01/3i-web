# 3i-web

`3i-web` is a browser-based solar-system viewer for building, playing, and presenting annotated object trajectories.

## Main Pages

- `index.html` lists bundled objects and local drafts.
- `object_motion.html` is the editor used to fetch, annotate, and export trajectory points.
- `trajectory_player.html` plays saved trajectories with camera motion, overlays, and playback controls.
- `presentation.html` runs the 3I slideshow shell. Its current interstellar comparison section now uses autoplaying `trajectory_player` slides for `2I/Borisov` and `Oumuamua`.

## Bundled Objects

- `3I`
- `2I/Borisov`
- `Oumuamua`

## Core Files

- `trajectory_player.js` contains the player loader, playback engine, and overlay logic.
- `presentation.js` loads the JSON slideshow manifest and hosts each slide inside an iframe.
- `shared_render.js` and `solar_system.js` provide the shared rendering/runtime layer.
- `data/*/trajectory.json` stores bundled object trajectories.

## Development

```bash
npm test
```

The test suite covers the player, presentation helpers, index logic, and hosting-prep scripts.
