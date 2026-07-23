# Underwater revamp acceptance record

## Locked target

- Desktop art direction: the supplied 1672 x 941 underwater reference (bright glass-letter hero) and the deep ocean-floor contact reference.
- Hero geometry: two-line centered title, integrated navigation, lower-left role and CTA, lower-right location.
- Motion: calm continuous optical flow. Pointer travel creates a directional wake everywhere on the page. Presses are droplet pulses everywhere; in the hero they also displace and tilt local glyphs, then settle.
- Continuity: one renderer, one heightfield, and one continuous world-depth curve persist through Hero, Projects, About, Contact, and case-study routes.

## Production system

- Procedural GPU water volume: perspective free surface, water column, floor plane, volumetric shafts, depth fog, particulate, absorption, and two independently moving caustic networks.
- Four art-directed plates are crossfaded by a continuous plate coordinate (shallow → mid → basin) so a scroll-driven descent never pops textures; a restrained high-pass recovery keeps subpixel caustic filaments. Full-color plates are used directly only for startup, constrained-device, and renderer-failure posters.
- **World depth**: `src/lib/portfolio/world-state.ts` maps scroll position to one normalized, monotonic, reversible depth (0 = surface, 1 = ocean floor) with viewport-aware section anchors. The renderer consumes it for theme, plates, fog, calm pockets, and the hero name's exit; the DOM consumes it through `--world-depth`, `--world-light`, `--world-calm`, and `--nav-l`. Scrolling upward retraces the exact inverse journey.
- **Global interaction**: pointer wakes and droplet presses register in the shared heightfield from every section, not only the hero. The physics loop suspends only for hidden tabs. Suspended objects (project showcases, the contact slab) inject their own presses and redirect currents with directional wakes.
- **Hero name exit**: the 13-glyph rigid-body volume rises toward the surface, drifts up-frame, and dissolves optically into the water (`uExitFade`) as depth begins — fully exited before Projects arrive, returning on the way back up. No intersection-observer visibility flips.
- Low-resolution damped heightfield for pointer, press, and glyph-feedback disturbances.
- Independent rigid-body state for all 13 desktop glyphs.
- Dedicated portrait camera with the same 13 independently rendered rounded glyphs; semantic title fallback remains available only when live rendering is unavailable.
- Reduced motion: one complete composed frame (glyphs, refraction, caustics), then the render loop stops (`data-motion-loop="stopped"`). Scroll, resize, visibility, and the motion toggle each wake exactly one frame. Save-Data/static mode uses the depth-matched poster.

## Acceptance evidence

Evidence lives in `.verification/underwater-revamp/` and is intentionally excluded from the production bundle.

Measured values must be regenerated from the final production build. Prior values were removed because they predated the current optical-volume and authored-glyph pipeline.

## Mismatch ledger

- The verified GLB is the production geometry source. Every glyph keeps an independent pivot and rigid-body state; repeated letters share cloned authored geometry rather than a generic runtime font approximation.
- Safari needs a final human device check. Chrome-compatible production rendering, static fallback, mobile layout, and WebGL failure behavior are covered by the evidence above.
