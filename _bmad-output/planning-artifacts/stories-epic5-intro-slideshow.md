# Stories — Epic 5: Intro Slideshow

**Author:** orly
**Date:** 2026-03-10
**Status:** Draft
**Epic:** 5 — Intro Slideshow
**Source PRD:** `prd-epic5-intro-slideshow.md`

---

## Story Index

| Story | Title | Status |
|---|---|---|
| [5.1](#story-51--intro-slideshow-shell--navigation) | Intro Slideshow Shell & Navigation | 🔲 Pending |
| [5.2](#story-52--wow-signal-opening-slide) | Wow! Signal Opening Slide | 🔲 Pending |
| [5.3](#story-53--comets-101-slide) | Comets 101 Slide | 🚫 Cancelled |
| [5.4](#story-54--gravity--orbit-basics-slide) | Gravity & Orbit Basics Slide | 🔲 Pending |
| [5.5](#story-55--lagrange-points-slide) | Lagrange Points Slide | 🔲 Pending |
| [5.6](#story-56--perseids-on-12-august--debris-formation) | Perseids on 12 August & Debris Formation | 🚫 Cancelled |
| [5.7](#story-57--solar-wind-vs-solar-flare-slide) | Solar Wind vs Solar Flare Slide | 🚫 Cancelled |
| [5.8](#story-58--mars-transfer-vs-lagrange-mission-slide) | Mars Transfer vs Lagrange Mission Slide | 🚫 Cancelled |

---

## Story 5.1 — Intro Slideshow Shell & Navigation

**As a** presenter,
**I want** a short intro slideshow before the main experience,
**so that** I can explain the science in sequence before launching the interactive content.

### Acceptance Criteria

- [ ] A new intro slideshow screen exists before the main experience
- [ ] The slideshow supports `Start`, `Next`, `Back`, and `Skip`
- [ ] The slideshow shows a clear current slide position
- [ ] The visual style fits the project's existing space aesthetic
- [ ] The user can exit the slideshow and continue to the main experience

### File List

- `index.html`
- `index.js`

---

## Story 5.2 — Wow! Signal Opening Slide

**Status:** 🚧 In Progress

**Note:** Scope updated by user request on 2026-03-14: the `Wow! Signal` content is now a dedicated ending slide that should always appear last in the slideshow.

**As a** viewer,
**I want** a dedicated `Wow! Signal` slide in the slideshow,
**so that** I end with a strong mystery and historical hook.

### Acceptance Criteria

- [ ] A dedicated slide is about the `Wow! signal`
- [ ] The slide explains that it was detected in `1977`
- [ ] The slide shows the historical printout image
- [ ] The slide includes the date `12 Aug 1977`
- [ ] The slide mentions Jerry Ehman writing `Wow!` on the printout
- [ ] The slide notes the signal lasted about `72 seconds`
- [ ] The slide explains that it has never been conclusively identified or repeated
- [ ] The wording stays short enough for slideshow narration
- [ ] The slide is always the last slide in the slideshow order

### File List

- `index.html`
- `index.js`
- `assets/`

---

## Story 5.3 — Comets 101 Slide

**Status:** 🚫 Cancelled

**Note:** Removed from the Epic 5 slideshow scope by user request on 2026-03-14.

**As a** viewer,
**I want** a simple explanation of comets,
**so that** I understand the basics before hearing about debris and meteor showers.

### Acceptance Criteria

- [ ] A slide explains that comets are icy and dusty bodies orbiting the Sun
- [ ] The slide explains that heating near the Sun creates a glowing coma and tails
- [ ] The wording avoids unnecessary jargon
- [ ] The slide supports a visual or image area for illustration

### File List

- `index.html`
- `index.js`
- `assets/`

---

## Story 5.4 — Gravity & Orbit Basics Slide

**As a** viewer,
**I want** a simple explanation of gravity and orbit,
**so that** I can understand the basic motion that shapes planets, comets, and spacecraft paths.

### Acceptance Criteria

- [ ] A slide explains that gravity is the pull between masses
- [ ] The slide explains orbit in simple language as falling around a larger body instead of straight into it
- [ ] The wording stays intuitive and avoids equations
- [ ] The slide supports a visual or image area for illustration

### File List

- `index.html`
- `index.js`

---

## Story 5.5 — Lagrange Points Slide

**As a** viewer,
**I want** a simple explanation of `Lagrange points`,
**so that** I understand why they are useful places for spacecraft.

### Acceptance Criteria

- [ ] A slide explains that `Lagrange points` are balance regions created by gravity and motion in a two-body system
- [ ] The slide explains that spacecraft can use these regions while spending relatively little fuel to stay in useful positions
- [ ] The slide includes at least one `Sun-Earth` example such as `L2` for `James Webb`
- [ ] The slide includes at least one `Earth-Moon` relevance note such as staging, communication, or observation
- [ ] The wording stays short enough for slideshow narration

### File List

- `index.html`
- `index.js`

---

## Story 5.6 — Perseids on 12 August & Debris Formation

**Status:** 🚫 Cancelled

**Note:** Removed from the Epic 5 slideshow scope by user request on 2026-03-14.

**As a** viewer,
**I want** to understand why `12 August` matters and where meteor debris comes from,
**so that** I can connect comet motion with what we see in Earth's sky.

### Acceptance Criteria

- [ ] A slide explains that the Perseid meteor shower usually peaks around `12-13 August`
- [ ] The slide links the Perseids to Comet `109P/Swift-Tuttle`
- [ ] The slide explains that Earth crosses the comet's debris stream each year
- [ ] The slide explains that solar heating causes comet ice to sublimate and release dust and rocky grains
- [ ] The slide makes clear that the bright meteors are those particles burning in Earth's atmosphere
- [ ] The slide includes an optional external explainer or video link

### File List

- `index.html`
- `index.js`

---

## Story 5.7 — Solar Wind vs Solar Flare Slide

**Status:** 🚫 Cancelled

**Note:** Removed from the Epic 5 slideshow scope by user request on 2026-03-14.

**As a** viewer,
**I want** a simple explanation of solar activity,
**so that** I do not confuse solar wind with solar flares.

### Acceptance Criteria

- [ ] A slide explains that `solar flare` means a burst of energy from the Sun
- [ ] A slide explains that `solar wind` is a steady flow of charged particles from the Sun
- [ ] The hair-blowing analogy is used for `solar wind`, not for `solar flare`
- [ ] The wording stays simple enough for children or general audiences
- [ ] The slide connects solar activity back to comet tails or space weather in a simple way

### File List

- `index.html`
- `index.js`

---

## Story 5.8 — Mars Transfer vs Lagrange Mission Slide

**Status:** 🚫 Cancelled

**Note:** Removed from the Epic 5 slideshow scope by user request on 2026-03-14.

**As a** viewer,
**I want** a simple comparison between a Mars mission path and a Lagrange point mission,
**so that** I do not assume all spacecraft follow the same type of route.

### Acceptance Criteria

- [ ] A slide explains that Mars missions usually use a curved transfer orbit around the Sun rather than a straight line
- [ ] The slide explains that a Lagrange mission targets a useful balance region rather than a planet destination
- [ ] The slide includes one recommended external Mars trajectory explainer
- [ ] The slide includes one recommended external Lagrange-point mission explainer
- [ ] The wording stays short enough for slideshow narration

### File List

- `index.html`
- `index.js`

