# Portfolio polish · September 7, 2026

## Changes

- A shared paper-colored scrim dissolves both the live water and its poster into Selected Work. The mobile fade starts below the lettering. The previous masked poster has been replaced with a complete matching camera capture and an opacity transition into WebGL.
- Scroll camera travel is reduced to keep the lettering away from the hero copy. Held letters follow a stronger damped spring. Surface normals now sample the converged ray intersection; out-of-bounds glass projections resolve to the floor. Glass attenuation and fold tint are lighter, with a slightly stronger simulated caustic contribution. Drawing-buffer budgets are unchanged.
- Project imagery uses quiet frames instead of nested floating cards. Typography, section spacing, hover feedback, About, contact, and case-study surfaces use consistent geometry and color.
- Static case-study routes can prefetch. Next Project follows the homepage gallery order before continuing through the remaining projects.
- Pausing or enabling reduced motion exits touch play and restores vertical scrolling. Ripple/touch controls are disabled while paused. Scene settings close on outside pointer input or Escape.

## Local verification

The production server was rebuilt from `/Volumes/Neural/EzzyRappeport.com` and restarted at `http://127.0.0.1:3000`.

- Typecheck, ESLint, production build, playground physics tests, optical tests including current poster hashes, and all 14 retained-renderer runtime audit tests passed.
- HTTP audit passed: nine routes, local anchors, 32 image/script/download assets, and unknown-project 404.
- Browser review: desktop at 1440×810 and 1280×720; mobile at 390×844. Inspected hero, hero-to-work transition, gallery, About/contact, and MonkeyClaw case study. No horizontal overflow on the inspected desktop/mobile case-study layouts.
- Exercised letter drag/release and keyboard movement; diagnostics recorded displacement and tilt during interaction. Pause/reset and touch-play state changes worked, with `touch-action: pan-y` restored on pause. Offscreen diagnostics entered `offscreen` after navigating to About.
- JavaScript-disabled production load retained the complete hero and content. Simulated WebGL context loss removed the canvas and retained the poster and navigation. Reduced-motion emulation produced the resting view. Browser emulation was restored after testing.
- Desktop/mobile posters were exported at Retina density, subject to the existing 3.2-million-pixel cap, and encoded using the repository script.
- A read-only review of the integrated diff found no actionable defects.

## Limits

`npm run test:portfolio` still stops at its existing em-dash assertion in `src/lib/portfolio/content.ts:766`. The same text is present in HEAD and was not changed. The separately executed renderer runtime audit passes.

These checks are local Chromium evidence, including emulated mobile controls, not physical-phone or Safari verification, hosted CI, or public deployment. No commit, push, or deployment was performed. Frame-rate observations from this Mac do not establish performance on other hardware.
