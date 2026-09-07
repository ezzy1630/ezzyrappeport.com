# Local portfolio revamp review

Historical snapshot. The later [glass finish](2026-09-06-glass-finish.md) supersedes the optics handoff and remaining local GPU checks below.

Imported `/Users/ezzyrappeport/Downloads/ezzy-portfolio-revamp.zip` into the clean checkout at `8ad91e0`. The archive identifies source commit `28456ce7d765e2e4fc1910be2ff54de76dcbfbc9`; it contains all existing tracked paths. Dependencies and the lockfile are unchanged. No Blender assets were regenerated locally. No commit, push, or deployment was performed.

## Local fixes beyond the ZIP

- Cap the title's desktop framing by hero height, move its center upward, and keep poster/live composition aligned. The original live title crowded the intro at the normal desktop window size.
- Initialize the scene when reduced motion is disabled after a static cold load. Dispose it and return to the poster when reduced motion is enabled during the visit.
- Require the touch interaction toggle before touch pointers drag letters or disturb the surface; ordinary touch scrolling remains the default.
- Limit old fixed-navigation anchor offsets to the legacy portfolio shell. The new gallery and case-study navigation use normal document scrolling.

## Evidence

- `npm run typecheck`, `npm run lint`, `npm run test:playground`, and `npm run build` pass.
- Production HTTP checks: nine routes, section anchors, 32 image/script/download assets, and unknown-project 404 pass.
- Chrome renders the live WebGL hero. Exercised wave, drag/release, pause/resume, reset, project navigation, FlowE and Etch case studies, and opening a full-size Etch image in a new tab.
- Browser responsive checks include 390×844 and 320×740 homepages, 320×740 case study, and 1920×780 desktop hero. The capped desktop title leaves visible separation above the intro. The Projects anchor lands 30px from the viewport top after the legacy offset fix. The inspected mobile pages have no horizontal document overflow. Etch's case study has no canvas.
- Reduced-motion cold load has zero canvases. Disabling the preference initializes one canvas; enabling it removes that canvas and hides the live controls.
- Touch controls were checked with Chrome touch emulation. This is not physical iPhone or Safari evidence.
- The retained renderer's independent runtime audit passes all 14 checks. `test:portfolio` still stops at its existing em-dash assertion in unchanged `src/lib/portfolio/content.ts`. This is not a new hero physics failure.

## 3D handoff for ChatGPT Work

The pre-rendered poster has clear, dark glass contours. The live Three.js title is markedly paler and loses edge definition against the bright water, especially on mobile. The geometry is present and interactive; a successful asset build does not establish visual parity.

Compare `public/assets/hero/playground-title.webp` with the live browser scene. Review lighting/material parity between `assets/blender/playground/polished-glyphs.blend` and `src/components/playground/glass-scene.ts`. The runtime's physical transmission material differs from the poster's art-directed Fresnel mix. Determine whether this requires a revised poster/lighting asset or coordinated runtime material tuning before rebuilding geometry.

Keep all 13 independent glyphs, their pivots and rest transforms, shared geometry, and decoder-free GLB. Preserve the local responsive framing fixes. Acceptance: legible glass contours on desktop/mobile, consistent silhouette and framing before/after initialization, no obvious lighting flash, and no additional startup or interaction performance regression. Return any asset work as an explicit patch or ZIP; deployment remains separate.

## Remaining validation

Physical-device touch scrolling/dragging, Safari WebGL rendering, sustained interaction frame-time measurements, and GPU context-loss recovery remain to be verified. No universal frame-rate or release-readiness claim is made.

## Reference follow-up: runtime optics

After comparing the supplied `image(33).png` with the live scene, a bounded runtime pass improved the glass without regenerating Blender assets:

- Increased reflection contrast in the existing studio HDR before PMREM generation and adjusted its orientation.
- Enabled rear-surface transmission, reduced material roughness, and tuned optical thickness and absorption.
- Used a cropped, denser caustic sample with dark-blue/white contrast only in the transmission pass. The page's water plate remains unchanged.
- Raised the mobile refraction resolution while retaining the existing overall pixel cap and adaptive downscaling.

The live browser now shows stronger internal reflections and clearer edges. The existing rounded GLB is usable; a new Blender model is not yet justified. The reference's smoother sculpted highlights and poster/live parity remain art-direction targets. Rear-surface rendering and the mobile resolution increase add GPU work; physical-device frame-time measurements are still needed. No identical-reference or sustained-frame-rate claim is made.
