# PRD — Epic 6: Point More Info Modal

**Author:** orly
**Date:** 2026-03-10
**Status:** Draft
**Epic:** 6 — Point More Info Modal

---

## Goal

Allow individual trajectory points to expose richer contextual media and text through a reusable `More Info` modal available from both the Object Motion Tracker and the Trajectory Player.

## Problem

Some trajectory points need more than a single image and short description. The current point annotation model does not provide a structured way to show multiple images, longer text, video, or a custom embedded page for selected points.

## Users

- Authors annotating trajectory points
- Presenters showing the cinematic player
- Viewers exploring a highlighted moment in the trajectory

## User Outcomes

- Open richer point details without leaving the current page
- Reuse the same `more_info` data in both the editor and the player
- Support custom embedded content when a point specifies a dedicated page
- Support carefully curated one-off science explainer pages for selected points
- Keep bundled and local draft behavior aligned

## Functional Requirements

1. A point may include an optional `more_info` object inside `trajectory.json`.
2. `more_info` supports:
   - `images`: a list of `{ url, caption? }`
   - `video`: either a URL string or `{ url, title? }`
   - `text`: additional long-form text
   - `page_name`: an optional page or route to embed in an iframe
3. The Object Motion Tracker shows a `More Info` button for the active point only when `more_info` is not empty.
4. The Trajectory Player overlay shows a `More Info` button for the current point only when `more_info` is not empty.
5. Activating `More Info` opens a modal with a close `X`.
6. If `page_name` is present, the modal embeds that page in an iframe.
7. If `page_name` is absent, the modal renders the generic template using the point date plus `more_info` text, images, and video.
8. Relative image and video paths resolve against `data/<designation>/`.
9. The feature works for both bundled web trajectories and local draft trajectories.
10. Shared parsing/normalization logic is reused instead of duplicating `more_info` rules separately in each page.
11. The Hosting bundle includes any new shared runtime files required by the modal feature.
12. Selected points may embed a custom educational page that uses externally hosted images and page-local animation started by an explicit `Play` button.

## Non-Goals

- A dedicated standalone `more_info` page for each point
- Editing `more_info` fields inside the tracker UI
- Cloud-hosted CMS content or remote authoring

## Constraints

- The site remains plain static HTML/JS with no bundler
- The modal must fit the existing visual style
- The same point data should work in both local and hosted usage
- Existing point fields and playback behavior must continue to work unchanged

## Success Criteria

- A point with `more_info` shows a `More Info` button in both the editor and player
- The modal can render multiple images, optional video, and additional text
- A point with `page_name` embeds the custom page in an iframe inside the modal
- A selected point can present a richer science explainer page without changing shared modal runtime behavior
- Relative media paths work from trajectory data
- Local draft playback and bundled playback both read the same `more_info` content
