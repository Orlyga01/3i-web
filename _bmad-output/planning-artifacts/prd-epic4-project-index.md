# PRD — Epic 4: Project Index & Source Selection

**Author:** orly
**Date:** 2026-03-10
**Status:** Draft
**Epic:** 4 — Project Index & Source Selection

---

## Goal

Create a new root landing page that lists all available trajectory projects, merges bundled web data with local draft data, lets the user explicitly choose whether to open the local or bundled version when both exist, supports multiple bundled objects through a manifest file, and deploys only public website assets to Firebase Hosting.

## Problem

The project currently has no dedicated home page for managing objects. Users must know direct URLs, and when a bundled object also has a local draft there is no clear way to choose which version should open.

## Users

- Authors editing trajectory annotations
- Presenters launching the cinematic player
- Returning users resuming unsaved local work

## User Outcomes

- See all known objects in one place
- Resume local work even when the bundled file was never reopened
- Avoid accidentally opening the wrong source when both local and web versions exist
- Start a brand new object from the homepage

## Functional Requirements

1. A new root `index.html` page lists all bundled objects currently shipped with the site.
2. The same page also scans browser `localStorage` for `objectMotion:<designation>` drafts and merges them into the list.
3. Each row exposes:
   - `Play` linking to `trajectory_player?designation=<object>`
   - `Edit` linking to `object_motion?designation=<object>`
4. If an object exists in both bundled web data and local draft data:
   - Do not show action buttons immediately
   - Show a source dropdown with `From local` and `From web`
   - After selection, reveal the buttons
   - When `From local` is selected, action buttons are orange
   - When `From web` is selected, show the warning text: `this will overwrite the local version.`
5. A `+` action lets the user create a new object by entering a designation and opening the Object Motion Tracker for that object.
6. `object_motion.js` must honor a `source=local|web` URL parameter so the homepage choice is respected.
7. `trajectory_player.js` must honor a `source=local|web` URL parameter so local drafts can be played directly.
8. The existing `solar_comet.html` page remains unchanged.
9. Firebase initialization is added to the new root page using the provided Astro project configuration.
10. Bundled web objects are sourced from a static manifest file at `data/objects.json` rather than hardcoded in `index.js`.
11. A repository script generates `data/objects.json` by scanning subfolders under `data/` that contain `trajectory.json`.
12. If the manifest is missing or invalid, the homepage falls back safely to a default bundled object list so the page does not fail completely.
13. Firebase Hosting must publish from a dedicated output folder containing only public web files and assets.
14. A repository script prepares the Hosting output folder before deploy.
15. A GitHub Actions workflow deploys Firebase Hosting automatically on pushes to `main`.

## Non-Goals

- Replacing `solar_comet.html`
- Building authentication or cloud persistence
- Auto-discovering bundled objects from the server filesystem
- Publishing docs, tests, BMAD artifacts, or development-only files to public Hosting

## Constraints

- The site is plain static HTML/JS hosted on Firebase Hosting
- No bundler is currently used
- The homepage must work with current localStorage draft format from Epic 2
- Bundled object discovery must work in a static-hosting environment without directory listing APIs
- The browser homepage can read the generated manifest, but only Node-side tooling can scan the `data/` directory directly
- GitHub-hosted deploy automation must work without exposing internal repo folders to Hosting

## Success Criteria

- The root URL opens the new homepage
- `3I` is shown from bundled data
- Bundled objects can be expanded by editing `data/objects.json` instead of changing application code
- Bundled objects can also be refreshed automatically from the `data/` folders by running the generator script
- A local draft-only object appears without needing a bundled file
- A mixed local/web object requires a source choice before actions appear
- `source=local` opens the draft version in both editor and player
- `source=web` bypasses the draft and loads bundled data
- Firebase Hosting publishes only the curated `site/` output instead of the full repository root
- Pushes to `main` can deploy automatically through GitHub Actions once the Firebase service-account secret is configured
