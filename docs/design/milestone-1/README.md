# Milestone 1 — hero optics and per-letter authorship

Gate evidence for `HOMEPAGE_CINEMATIC_TRANSFORM_PLAN.md` §22 Milestone 1.

## Delivered

- Manifest **v2 on disk** with per-letter `physics` + `optics` for all 13 glyphs (`public/assets/hero/ezzy-rappeport-glyphs.json`)
- Geometry GLB retained from inflated Inter Tight v2; metadata enriched without unnecessary mesh regen (Blender script also emits v2 on full rebuild)
- Submerged water/glyph relative IOR, Beer-Lambert path absorption, water/glyph Fresnel
- Tiered optical path: high (5 env samples + full spectral edges), balanced (3 samples + cheap chroma), low (1 sample, no dispersion)
- Authored mass / corrected inertia axes / density-scaled buoyancy / drag / COM torque / optical variation
- Pressure-probe approach, hold pressure cap, drag follow, scaled click-storm impulse budget (never hard-drops)
- Surface-coupled caustic coherence
- Hero CTA/copy never inert or focus-blocked waiting on WebGL
- Below-fold Projects / About / Contact visually unchanged

## §8.4 Transmission path decision

Compared for Milestone 1:

| Path | Edge stability | Viewport boundaries | GPU cost | Verdict |
| --- | ---: | ---: | ---: | ---: |
| Screen-space thickness refraction (front/back depth + env sample) | High with UV clamp | Guarded `[0.002,0.998]` | Tiered taps 1/3/5 | **Selected** |
| Pure environment-cube / reflection-probe only | Softer letter grounding | Stable | Lower | Rejected — loses submerged path-length mass |

The production thickness material remains environment-assisted (samples the live optical plate through thickness), not a detached cubemap chrome look. Water IOR `1.333` outside + glyph IOR family ~`1.49` keeps bending subtler than air/glass.

## Explicitly deferred to Milestone 2

- Reverse-scroll hero reconstruction / pass-under departure choreography
- Full departure stress traces

## Evidence layout

| Path | Meaning |
| --- | ---: |
| `../../.verification/milestone-1/rest/` | Idle hero frames (+ balanced tier) |
| `../../.verification/milestone-1/interaction/` | Hover / hold / drag / release / cancel-after-storm |
| `../../.verification/milestone-1/reduced-motion/` | `prefers-reduced-motion` |
| `../../.verification/milestone-1/failure/` | WebGL-blocked non-realtime path |
| `../../.verification/milestone-1/sections/` | Below-fold unchanged check |
| `../../.verification/milestone-1/capture-report.json` | Metrics + frame traces |

## Recapture

```bash
npm run capture:m1 -- http://127.0.0.1:3000
```

## Enrich / regenerate authorship

```bash
# Metadata-only (keeps existing GLB) — required after authorship table changes
npm run assets:hero-manifest

# Full geometry rebuild (Blender)
blender --background --factory-startup --python-exit-code 1 \
  --python scripts/blender/build_hero_glyphs.py -- \
  --font "$(pwd)/assets/blender/hero-title/fonts/InterTight-Black-900.ttf" \
  --output "$(pwd)"
```
