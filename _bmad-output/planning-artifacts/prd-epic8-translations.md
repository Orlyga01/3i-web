# PRD — Epic 8: Translation & Localization

**Author:** orly  
**Date:** 2026-03-15  
**Status:** Draft  
**Epic:** 8 — Translation & Localization

---

## Goal

Introduce a lightweight localization system that pulls the app's English content into a shared JSON file, adds Hebrew as the first translated locale, and carries the selected language from `index.html` through the rest of the flow.

## Problem

The current app mixes English content directly into page shells, slide pages, solar-system labels, trajectory descriptions, and more-info content. That makes translation slow, inconsistent, and hard to maintain. The user also needs one place to choose a language and keep that choice while moving between index, presentation, tracker, player, and more-info pages.

## Users

- Presenters showing the 3I/ATLAS experience in different languages
- Viewers consuming the presentation and player narrative in Hebrew
- Authors who need one structured source for translatable content

## User Outcomes

- Choose a language on `index.html`
- Preserve the selected language while navigating between pages
- Keep buttons in English, as requested
- Render translated presentation copy, solar-system labels, trajectory descriptions, and more-info content
- Store English and Hebrew strings in one shared JSON file with `en` as the fallback

## Functional Requirements

1. The app must add a shared translation JSON file that includes `en` and `he`.
2. English content in the covered feature set must be represented in the translation JSON instead of remaining only as scattered hardcoded strings.
3. `en` must act as the default locale and fallback when `lang` is missing or unsupported.
4. `index.html` must contain the only language-selection control in the main app flow.
5. The selected language must be passed via URL parameter across:
   - `index.html`
   - `object_motion`
   - `presentation`
   - `trajectory_player`
   - custom more-info pages and translated slide pages
6. Buttons must remain in English.
7. The index page must localize its non-button shell copy, column headers, helper text, and modal copy.
8. The presentation shell must load localized manifest titles and localized slide URLs.
9. Presentation slide pages with visible English copy must read their strings from the shared translation source.
10. The solar-system view must localize planet names and interstellar-comet scene labels.
11. The trajectory player must localize non-button shell copy, status labels, floating distance text, overlay labels, and translated point descriptions.
12. The shared more-info modal must localize its section headers and empty states.
13. Point descriptions and more-info content for bundled 3I data must render from the translation layer without breaking the existing file format.
14. The custom `more_info_2025_12_13.html` page must support Hebrew through the same translation source.

## Non-Goals

- Full runtime language switching from every page
- Translating every external image or video asset
- Replacing the current trajectory JSON schema
- Adding third-party i18n libraries or a bundler

## Constraints

- The project remains plain static HTML, CSS, and JavaScript
- Translation data must stay file-based
- Existing button labels remain English
- Existing pages must continue to work if translation loading fails, using English fallbacks

## Success Criteria

- A shared translation JSON exists with `en` and `he`
- `index.html` can choose `English` or `עברית`
- Links generated from the index, tracker, presentation, and player preserve `lang`
- Hebrew presentation/slide content, solar-system labels, point descriptions, and more-info content render correctly
- English continues to work as the default fallback when no locale is provided
