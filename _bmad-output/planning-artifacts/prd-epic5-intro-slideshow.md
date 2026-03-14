# PRD — Epic 5: Intro Slideshow

**Author:** orly
**Date:** 2026-03-10
**Status:** Draft
**Epic:** 5 — Intro Slideshow

---

## Goal

Create a short slideshow-style intro that teaches the audience a few key space ideas before they enter the main 3i-web experience.

## Problem

The current project can launch straight into the object experience, but there is no guided introduction that helps a presenter explain the science in a simple, memorable order.

## Users

- Presenters introducing the topic to an audience
- Viewers who need simple science context before the interactive experience
- Students and casual visitors with little astronomy background

## User Outcomes

- Understand what the `Wow! signal` was and why people still talk about it
- Understand what comets are in plain language
- Understand the basic idea of gravity and orbit
- Understand what `Lagrange points` are and why spacecraft use them
- Learn why `12 August` is an important annual sky date
- Understand how comet debris is created near the Sun
- Understand the difference between a `Mars transfer trajectory` and a mission to a `Lagrange point`
- Get a simple mental model for solar wind and solar flares

## Functional Requirements

1. The project includes a new intro slideshow experience shown before the main content.
2. The slideshow presents one topic per slide with simple presenter-friendly wording.
3. The first slide explains the `Wow! signal` as a famous unexplained radio signal detected in 1977 by Ohio State's Big Ear telescope.
4. The `Wow! signal` slide includes memorable facts:
   - Jerry Ehman wrote `Wow!` on the printout
   - the signal lasted about 72 seconds
   - it has never been confirmed again
5. A comet slide explains that comets are icy, dusty bodies that orbit the Sun and can grow glowing comas and tails when heated.
6. A gravity slide explains that gravity is the pull between masses and that orbit happens when an object keeps falling around a larger body instead of crashing straight into it.
7. A `Lagrange points` slide explains that these are special balance regions in a two-body system where gravity and motion make it easier for spacecraft to stay in useful positions with relatively low station-keeping fuel.
8. The `Lagrange points` slide gives at least two concrete examples:
   - `Sun-Earth L2` for observatories such as `James Webb`
   - an Earth-Moon Lagrange-region orbit as a useful staging / communications region for spacecraft
9. A meteor-shower slide explains why `12 August` matters:
   - Earth passes through debris from Comet `109P/Swift-Tuttle`
   - this creates the annual Perseid meteor shower peak around `12-13 August`
10. A debris-formation slide explains that when a comet gets closer to the Sun, heat causes ice to sublimate and release dust and rocky grains that spread along the comet's orbit.
11. A mission-trajectory slide explains that a `Mars mission` usually follows a long curved transfer orbit around the Sun, while a `Lagrange point mission` aims for a balance region rather than flying straight to a planet.
12. The mission-trajectory slide includes at least one recommended external video or explainer for:
   - a Mars transfer trajectory
   - a mission to a Lagrange point
13. A solar-activity slide explains the difference between:
   - `solar flare`: a burst of energy/radiation from the Sun
   - `solar wind`: a constant stream of particles flowing outward from the Sun
14. The solar-activity slide uses a child-friendly analogy where `solar wind` is compared to wind blowing hair, while clearly stating that the analogy describes the wind-like particle flow rather than the flare itself.
15. At least one slide includes a recommended external video or explainer link for presenters who want optional deeper context.
16. The slideshow supports clear `Next`, `Back`, `Start`, and `Skip` style navigation.
17. The content remains short enough to be read aloud in a live presentation.

## Non-Goals

- Building a full classroom curriculum
- Covering the full history of radio astronomy or comet science
- Teaching advanced plasma physics
- Replacing the existing interactive trajectory experience

## Constraints

- The experience should match the current project's simple static HTML/JS architecture
- The wording should stay friendly and accurate rather than overly technical
- The science content should be grounded in reputable public references such as NASA, PBS, and Big Ear / Ohio State materials

## Content Notes

- The `Wow! signal` was detected on `1977-08-15` near the hydrogen line and remains unexplained because it was never repeated.
- The gravity explanation should stay intuitive and avoid equations.
- The `Lagrange points` slide should present them as useful balance zones or parking regions, while noting that some require periodic course correction.
- The annual `12 August` reference should be framed as the usual Perseid peak window, not as an exact guaranteed peak every year.
- The comet-debris explanation should emphasize `sublimation` and dust release when solar heating activates the nucleus.
- The Mars slide should avoid implying that missions travel in straight lines through space; it should emphasize curved transfer paths.
- The Sun slide should avoid implying that a solar flare is literally wind; instead, explain that `solar wind` behaves more like the hair-blowing analogy.

## Suggested Reference Links

- [NASA Perseids in-depth](https://solarsystem.nasa.gov/asteroids-comets-and-meteors/meteors-and-meteorites/perseids/in-depth/)
- [NASA Comets overview](https://science.nasa.gov/solar-system/comets/)
- [NASA What Is Gravity?](https://spaceplace.nasa.gov/what-is-gravity/en/)
- [NASA What Is an Orbit?](https://www.nasa.gov/solar-system/what-is-an-orbit-grades-5-8/)
- [NASA What are Lagrange Points?](https://science.nasa.gov/solar-system/resources/faq/what-are-lagrange-points/?linkId=135772505)
- [NASA We Asked a Scientist: Lagrange Points](https://www.nasa.gov/solar-system/what-are-lagrange-points-we-asked-a-nasa-scientist-episode-9/)
- [Webb orbit at L2](https://jwst.nasa.gov/orbit.html)
- [NASA Hohmann Transfer Orbit](https://mars.nasa.gov/resources/6042/hohmann-transfer-orbit)
- [NASA What Is the Solar Wind?](https://science.nasa.gov/sun/what-is-the-solar-wind/)
- [NASA What is a Solar Flare?](https://science.nasa.gov/solar-system/what-is-a-solar-flare)
- [Big Ear Wow! signal report](https://www.bigear.org/Wow30th/wow30th.htm)
- [PBS explainer on the August Perseid meteor shower](https://www.pbs.org/newshour/science/explainer-why-the-august-night-sky-lights-up-with-the-perseid-meteor-shower)

## Success Criteria

- A presenter can use the intro to explain the science in a clear sequence before starting the main experience
- The `Wow! signal` is positioned as the opening hook
- The gravity slide makes orbit understandable in simple language
- The `Lagrange points` slide explains why they are useful places for spacecraft
- The `12 August` slide accurately explains the Perseids and Comet `Swift-Tuttle`
- The debris slide clearly connects solar heating with dust release
- The mission slide clearly separates a `Mars transfer` from a `Lagrange point` mission
- The Sun slide clearly separates `solar flare` from `solar wind`
- The content is short, visual, and appropriate for slideshow delivery
