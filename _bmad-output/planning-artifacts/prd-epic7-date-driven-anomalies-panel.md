# PRD — Epic 7: Date-Driven Anomalies Panel

**Author:** orly
**Date:** 2026-03-11
**Status:** Draft
**Epic:** 7 — Date-Driven Anomalies Panel

---

## Goal

Create a standalone, date-driven anomalies panel that can later be integrated into `trajectory_player`, using structured JSON stored alongside each object's `trajectory.json`.

## Problem

The current 3I/ATLAS anomaly notes live outside the app in a CSV and are not connected to the object's timeline. Presenters need a way to reveal anomaly entries in sync with key dates, especially stoppable points, without hard-coding content into the player UI.

## Users

- Authors preparing 3I/ATLAS anomaly content
- Presenters stepping through the cinematic trajectory
- Viewers following the anomaly narrative as dates progress

## User Outcomes

- Store anomaly content in a reusable JSON file next to `trajectory.json`
- Preserve the source title, subtitle, and full anomaly metadata
- Show a left-side slide-in panel that can be expanded and collapsed with a tab
- Feed the panel a date and reveal matching anomaly rows one at a time
- Support dates that add zero, one, or multiple anomaly rows
- Animate each newly revealed anomaly row so the table feels intentionally built during presentation, with a typewriter-style reveal for the anomaly text
- Reuse the same panel logic later inside `trajectory_player`

## Functional Requirements

1. The solution must be designed as a standalone feature first, not tightly coupled to `trajectory_player`.
2. An anomaly data file must live at `data/<designation>/anomalies.json`, next to `trajectory.json`.
3. `anomalies.json` must store top-level `title`, `subtitle`, and an `entries` array.
4. Each anomaly entry must preserve the source content needed from the CSV, including:
   - `dateLabel`
   - `triggerDate`
   - `category`
   - `anomaly`
   - `probability`
   - `explanation`
   - `consensusNote`
   - `skip`
5. The UI must show the source `title` and `subtitle`.
6. Entries with `skip: true` must remain in the JSON but must not appear in the rendered table.
7. The visible table must initially show only `anomaly` and `probability` columns.
8. The anomalies area must occupy roughly one third of the screen width when expanded.
9. The anomalies area must slide in from the left and leave behind a small visible tab when collapsed.
10. Clicking the tab must expand or collapse the panel.
11. The panel logic must accept a date input from the host page or controller.
12. When a date is applied, the panel must queue any non-skipped entries whose `triggerDate` matches that date.
13. Some dates may add no entries; this must be treated as a normal case with no error state.
14. Some dates may add multiple entries; these must be revealable one by one.
15. A button in the panel must reveal the next queued entry for the active date.
16. Each newly revealed anomaly row must enter with a polished, readable animation instead of appearing instantly.
17. The `anomaly` text for each newly revealed row must use a typewriter-style reveal.
18. The `probability` value may appear immediately or with a short subtle fade, but should not wait for a long typewriter sequence.
19. The entrance animation should apply only to newly added rows, not to the entire table on every update.
20. The animation should remain presentation-friendly: visually noticeable, but not so slow or flashy that it hurts readability.
21. When no more queued entries remain for the active date, the reveal button must become disabled.
22. The standalone implementation must expose a small, reusable API that later allows `trajectory_player` to pass in the current stoppable-point date.
23. Ambiguous source dates from the CSV must not be parsed heuristically at runtime; instead, each JSON entry must store an explicit `triggerDate` chosen during data preparation, while preserving the original `dateLabel`.

## Non-Goals

- Editing anomaly content inside the panel UI
- Showing all anomaly metadata in the first table version
- Replacing the current point annotation or `more_info` systems
- Shipping the full `trajectory_player` integration in the same first standalone story set

## Constraints

- The project remains plain static HTML, CSS, and JavaScript with no bundler
- The anomaly data must stay file-based and local to each object folder
- The UI should fit the existing visual language used by the project
- The panel behavior must remain deterministic even when source dates are approximate or range-based

## Success Criteria

- `data/3I/anomalies.json` exists and preserves the CSV title, subtitle, and row data
- A standalone anomalies panel can load the JSON and render the title and subtitle
- The panel expands and collapses from a left-side tab and uses about one third of the viewport width
- Applying a date can add zero, one, or many anomalies into a reveal queue
- The reveal button adds anomaly rows one at a time and disables correctly at the end
- Each newly revealed row animates in cleanly, with typewriter-style anomaly text, without reanimating older rows
- Hidden rows marked with `skip: true` never appear in the table
- The standalone controller exposes a clean handoff API for later `trajectory_player` integration
