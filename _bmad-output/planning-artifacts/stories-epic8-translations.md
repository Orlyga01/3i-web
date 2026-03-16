# Stories — Epic 8: Translation & Localization

**Author:** orly  
**Date:** 2026-03-15  
**Status:** Draft  
**Epic:** 8 — Translation & Localization  
**Source PRD:** `prd-epic8-translations.md`

---

## Story Index

| Story | Title | Status |
|---|---|---|
| [8.1](#story-81--shared-translation-json--runtime-loader) | Shared Translation JSON & Runtime Loader | ✅ Done |
| [8.2](#story-82--index-language-selector--link-propagation) | Index Language Selector & Link Propagation | ✅ Done |
| [8.3](#story-83--runtime-translation-for-presentation-player-and-solar-system) | Runtime Translation for Presentation, Player, and Solar System | ✅ Done |
| [8.4](#story-84--hebrew-seed-content-for-3i-descriptions-and-more-info) | Hebrew Seed Content for 3I Descriptions and More Info | ✅ Done |

---

## Story 8.1 — Shared Translation JSON & Runtime Loader

**As a** developer,  
**I want** one shared translation file and one lightweight runtime helper,  
**so that** the rest of the app can read localized strings without duplicating locale logic.

### Acceptance Criteria

- [ ] A shared translation JSON file exists in the repo
- [ ] The file includes `en` and `he`
- [ ] English is the default fallback
- [ ] A shared runtime helper can read `lang` from the URL
- [ ] The runtime helper can return nested translation values with fallback behavior
- [ ] The runtime helper can append `lang` to internal page URLs

### File List

- `data/translations.json`
- `translations.js`
- `tests/translations.test.js`

---

## Story 8.2 — Index Language Selector & Link Propagation

**As a** viewer,  
**I want** to choose a language from the homepage only,  
**so that** the rest of the app can follow that choice without showing extra locale controls everywhere.

### Acceptance Criteria

- [ ] `index.html` contains a language selector
- [ ] The selector supports `en` and `he`
- [ ] The index page localizes its non-button UI copy
- [ ] All generated internal links from the index include `lang`
- [ ] The selected language is preserved when opening `object_motion`, `presentation`, or `trajectory_player`

### File List

- `index.html`
- `index.js`
- `tests/index_logic.js`
- `tests/index.test.js`

---

## Story 8.3 — Runtime Translation for Presentation, Player, and Solar System

**As a** presenter,  
**I want** the presentation, player, and solar-system labels to follow the selected language,  
**so that** the cinematic experience reads as one coherent localized flow.

### Acceptance Criteria

- [ ] `presentation` loads localized shell copy and localized slide titles
- [ ] Slide pages with visible text can render localized content
- [ ] `trajectory_player` preserves `lang` and localizes non-button shell copy
- [ ] The player overlay and more-info modal can render translated content
- [ ] The solar-system layer localizes planet names and interstellar-visitor scene labels
- [ ] The solution preserves English button labels

### File List

- `presentation.html`
- `presentation.js`
- `trajectory_player.html`
- `trajectory_player.js`
- `shared_render.js`
- `solar_comet.html`
- `main.js`
- `more_info_modal.js`
- `slides/3I/*.html`

---

## Story 8.4 — Hebrew Seed Content for 3I Descriptions and More Info

**As a** Hebrew-speaking viewer,  
**I want** the existing 3I descriptive content translated into Hebrew,  
**so that** the most important narrative text reads naturally without editing raw data files per page.

### Acceptance Criteria

- [ ] Bundled 3I trajectory descriptions have Hebrew translations in the shared JSON
- [ ] 3I presentation manifest titles have Hebrew translations in the shared JSON
- [ ] 3I more-info page content has Hebrew translations in the shared JSON
- [ ] English remains available in the same JSON as the fallback source

### File List

- `data/translations.json`
- `more_info_2025_12_13.html`
- `data/3I/presentation.json`
- `data/3I/trajectory.json`

---

## Dev Agent Record

- **Date:** 2026-03-15
- **Implemented:** Stories `8.1` through `8.4`
- **Blocked:** None
- **Tests:** `npm test -- --runInBand`
- **Key decisions:** kept buttons in English, localized the app through one shared JSON plus `lang` URL propagation, overlaid translated 3I descriptions and more-info content at runtime instead of changing the existing trajectory schema, and added Hebrew support to standalone slide pages and the custom 2025-12-13 more-info page
