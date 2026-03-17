# 3i-web Project Structure

## Entry Points

- `index.html` / `index.js`: bundled-project list, local-draft discovery, and page routing.
- `object_motion.html` / `object_motion.js`: trajectory authoring workflow.
- `trajectory_player.html` / `trajectory_player.js`: playback UI, overlays, timeline, and player bootstrap.
- `presentation.html` / `presentation.js`: slideshow shell that loads `data/<designation>/presentation.json`.

## Shared Runtime

- `shared_render.js`: shared canvas rendering helpers.
- `solar_system.js`: solar-system scene/runtime used by the player and related pages.
- `translations.js` and `data/translations.json`: locale loading and runtime text replacement.

## Bundled Data

- `data/3I/trajectory.json`
- `data/2I_Borisov/trajectory.json`
- `data/Oumuamua/trajectory.json`
- `data/objects.json`
- `data/3I/presentation.json`

## Supporting Features

- `anomalies_panel.*` and `anomalies_shared.js`: date-driven anomaly panel.
- `more_info_*` files: point-level detail modal and custom info pages.
- `scripts/prepare-hosting.js`: packages the public site bundle.

## Tests

- `tests/trajectory_player.test.js`
- `tests/presentation.test.js`
- `tests/index.test.js`
- `tests/prepare_hosting.test.js`
