# Stories — Epic 4: Project Index & Source Selection

**Author:** orly
**Date:** 2026-03-10
**Status:** Draft
**Epic:** 4 — Project Index & Source Selection
**Source PRD:** `prd-epic4-project-index.md`

---

## Story Index

| Story | Title | Status |
|---|---|---|
| [4.1](#story-41--root-project-index-shell--firebase-init) | Root Project Index Shell & Firebase Init | ✅ Done |
| [4.2](#story-42--bundled--local-project-catalog) | Bundled + Local Project Catalog | ✅ Done |
| [4.3](#story-43--source-selection--action-routing) | Source Selection & Action Routing | ✅ Done |
| [4.4](#story-44--create-new-object-entry-point) | Create New Object Entry Point | ✅ Done |
| [4.5](#story-45--bundled-object-manifest) | Bundled Object Manifest | ✅ Done |
| [4.6](#story-46--generated-manifest-from-data-folders) | Generated Manifest from `data/` Folders | ✅ Done |
| [4.7](#story-47--firebase-hosting-bundle--github-deploy) | Firebase Hosting Bundle & GitHub Deploy | ✅ Done |
| [4.8](#story-48--global-localstorage-kill-switch) | Global LocalStorage Kill Switch | ✅ Done |

---

## Story 4.1 — Root Project Index Shell & Firebase Init

**As a** visitor,
**I want** a dedicated root homepage for project management,
**so that** I land on a clear entry point instead of a scene page.

### Acceptance Criteria

- [x] A new `index.html` file exists and serves as the root page
- [x] A new `index.js` file powers the page
- [x] The page follows the existing dark space aesthetic without changing `solar_comet.html`
- [x] Firebase is initialized on the new page using the provided Astro Hosting configuration
- [x] The page renders a table-based project list shell with room for object name, availability, source, and actions

### File List

- `index.html`
- `index.js`

---

## Story 4.5 — Bundled Object Manifest

**As a** maintainer,
**I want** bundled homepage objects to come from a manifest file,
**so that** I can add more hosted objects without editing application code.

### Acceptance Criteria

- [x] Bundled web objects are loaded from `data/objects.json`
- [x] The manifest supports a simple `objects` list and ignores invalid entries safely
- [x] `index.js` no longer hardcodes the bundled object list as the primary source
- [x] If `data/objects.json` is missing or malformed, the homepage falls back to a safe default list
- [x] Tests cover manifest normalization behavior

### File List

- `data/objects.json`
- `index.js`
- `tests/index_logic.js`
- `tests/index.test.js`

---

## Story 4.6 — Generated Manifest from `data/` Folders

**As a** maintainer,
**I want** the bundled object manifest to be generated from the `data/` folders,
**so that** the hosted homepage stays aligned with the repository structure instead of a hand-maintained list.

### Acceptance Criteria

- [x] A repository script scans `data/*/trajectory.json`
- [x] The script writes `data/objects.json`
- [x] The script prefers the trajectory designation from JSON when present and falls back to the folder name
- [x] `package.json` exposes a command to regenerate the manifest
- [x] Automated tests cover the generator behavior

### File List

- `scripts/generate-object-manifest.js`
- `package.json`
- `data/objects.json`
- `tests/object_manifest_generator.test.js`

---

## Story 4.7 — Firebase Hosting Bundle & GitHub Deploy

**As a** maintainer,
**I want** Firebase Hosting to publish only the site assets and deploy automatically from GitHub,
**so that** internal project files stay private and production updates happen on pushes to `main`.

### Acceptance Criteria

- [x] Firebase Hosting publishes from a dedicated `site/` folder instead of the repository root
- [x] A repository script prepares `site/` by copying only public HTML, JS, CSS, `assets/`, and `data/`
- [x] Internal folders such as `docs/`, `tests/`, `_bmad/`, and `_bmad-output/` are excluded from the Hosting bundle
- [x] `package.json` exposes commands to prepare and deploy the Hosting bundle
- [x] A GitHub Actions workflow deploys Hosting on pushes to `main`
- [x] Generated Hosting output is ignored by git

### File List

- `scripts/prepare-hosting.js`
- `firebase.json`
- `package.json`
- `.gitignore`
- `.github/workflows/deploy-hosting.yml`
- `tests/prepare_hosting.test.js`

---

## Story 4.8 — Global LocalStorage Kill Switch

**As a** maintainer,
**I want** one global switch that disables browser-local draft storage,
**so that** the editor, player, and homepage can be forced to use bundled web data only.

### Acceptance Criteria

- [x] A shared app-level config flag controls whether localStorage is used
- [x] The default config in this repository sets the flag to `no` / `false`
- [x] `object_motion.js` does not read, write, restore, or clear local drafts when the flag is off
- [x] `trajectory_player.js` ignores `source=local` and loads bundled web data when the flag is off
- [x] The homepage behaves as web-only when the flag is off, so mixed local/web source choices are not shown
- [x] Tests cover the web-only fallback behavior

### File List

- `app_config.js`
- `app_config_shared.js`
- `index.html`
- `index.js`
- `object_motion.html`
- `object_motion.js`
- `trajectory_player.html`
- `trajectory_player.js`
- `tests/index_logic.js`
- `tests/index.test.js`
- `tests/trajectory_player_logic.js`
- `tests/trajectory_player.test.js`

---

## Story 4.2 — Bundled + Local Project Catalog

**As a** returning author,
**I want** the homepage to merge bundled objects with browser-local drafts,
**so that** I can resume work even if the bundled file was never reopened.

### Acceptance Criteria

- [x] Bundled objects are listed on the homepage
- [x] Local drafts are discovered from `localStorage` keys matching `objectMotion:<designation>`
- [x] Local draft metadata uses the stored JSON designation when available instead of only the sanitized key
- [x] Objects that exist only locally still appear in the table
- [x] Bundled and local entries are merged by sanitized designation so duplicates do not render twice

### File List

- `index.js`
- `tests/index_logic.js`
- `tests/index.test.js`

---

## Story 4.3 — Source Selection & Action Routing

**As a** user with both a bundled object and a local draft,
**I want** to explicitly choose which source to open,
**so that** I do not accidentally open or overwrite the wrong version.

### Acceptance Criteria

- [x] Each row exposes `Play` and `Edit` actions
- [x] Web-only rows show actions immediately
- [x] Local-only rows show actions immediately and style them in orange
- [x] Rows with both local and web versions hide actions until a source is selected
- [x] Mixed-source rows offer a dropdown with `From local` and `From web`
- [x] Selecting `From local` reveals orange `Play` and `Edit` actions
- [x] Selecting `From web` reveals actions and shows the warning text `this will overwrite the local version.`
- [x] `trajectory_player.js` honors `source=local|web`
- [x] `object_motion.js` honors `source=local|web`
- [x] The Object Motion Tracker `Play Video` action now opens the local draft in the player

### File List

- `index.js`
- `object_motion.js`
- `trajectory_player.js`
- `tests/trajectory_player_logic.js`
- `tests/trajectory_player.test.js`
- `tests/index_logic.js`
- `tests/index.test.js`

---

## Story 4.4 — Create New Object Entry Point

**As a** user starting a new object,
**I want** a clear create action on the homepage,
**so that** I can begin a new trajectory workflow without typing URLs manually.

### Acceptance Criteria

- [x] A `+` action is visible on the homepage
- [x] Activating it prompts for an object designation inside the page
- [x] Submitting a designation opens `object_motion?designation=<object>`
- [x] Empty submission is blocked with a clear validation message
- [x] The existing `solar_comet.html` page remains untouched

### File List

- `index.html`
- `index.js`

