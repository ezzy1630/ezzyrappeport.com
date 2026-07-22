# Underwater revamp acceptance record

## Locked target

- Desktop art direction: the supplied 1672 x 941 underwater reference.
- Hero geometry: two-line centered title, integrated navigation, lower-left role and CTA, lower-right location.
- Motion: calm continuous optical flow. Pointer travel creates a directional wake. Presses displace and tilt local glyphs, then settle.
- Continuity: one renderer persists through Projects, About, Contact, and case-study routes, changing apparent depth and light by section.

## Production system

- Procedural GPU water volume: perspective free surface, water column, floor plane, volumetric shafts, depth fog, particulate, absorption, and two independently moving caustic networks.
- Four art-directed sources are locally low-pass filtered in the live shader; only their high-frequency residual contributes irregular optical detail. Their full-color composition is used only for startup, reduced-motion, constrained-device, and renderer-failure posters, never as the ready WebGL background.
- Low-resolution damped heightfield for pointer, press, and glyph-feedback disturbances.
- Independent rigid-body state for all 13 desktop glyphs.
- Dedicated portrait camera with the same 13 independently rendered rounded glyphs; semantic title fallback remains available only when live rendering is unavailable.
- Static poster parity for reduced motion, renderer startup, context recovery, and renderer failure.

## Acceptance evidence

Evidence lives in `.verification/underwater-revamp/` and is intentionally excluded from the production bundle.

- `living-rest-a.png`, `living-rest-b.png`: one-second resting-state motion pair.
- `living-wake.png`, `living-press.png`: pointer and click response.
- `production-mobile.png`: 390 x 844 portrait mode.
- `production-contact.png`: deep-basin section state.
- `production-case.png`: case-study renderer continuity.
- `production-reduced-motion.png`: exact static fallback.
- `renderer-failure.png`: renderer-failure fallback.

Measured values must be regenerated from the final production build. Prior values were removed because they predated the current optical-volume and authored-glyph pipeline.

## Mismatch ledger

- The verified GLB is the production geometry source. Every glyph keeps an independent pivot and rigid-body state; repeated letters share cloned authored geometry rather than a generic runtime font approximation.
- Safari needs a final human device check. Chrome-compatible production rendering, static fallback, mobile layout, and WebGL failure behavior are covered by the evidence above.
