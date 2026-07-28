# Milestone 2 — hero release and descent seam

Gate evidence for `HOMEPAGE_CINEMATIC_TRANSFORMATION_PLAN.md` §22 Milestone 2.

## Delivered

- **Local hero progress phases** (`src/features/ocean-experience/scroll/hero-journey.ts`):
  arrival `0.00–0.18`, living name `0.18–0.52`, release `0.52–0.82`,
  pass-under `0.82–1.00` — pure functions of the sole ScrollDirector's
  journey progress over the surface + descent chapters (desktop end `0.22`,
  mobile `0.24`).
- **Deterministic camera descent** (`cameraRig.ts`): release drop/dolly plus
  pass-under drop (`heroPassDropZ 1.65`), pitch, and FOV tightening, composed
  with the existing world-depth drive and pointer parallax under one ceiling.
- **Buoyant pass-under** (renderer): back-loaded per-glyph rise with the
  approved ~0.028/index stagger, lateral parting so the camera travels
  beneath/between the letters, and per-letter dissolve that trails each
  glyph's own rise — the name fragments optically through the waterline,
  never shatters.
- **Secondary physical response** (`glyphRigidBodies.ts`): bounded
  `releaseLift` buoyant surge + velocity-keyed `releaseTorque` so letters
  lag, rotate independently, and jostle during release. Forces vanish on
  reverse; the critically damped solver re-seats manifest rest.
- **Caustic descent beam** (`shaders.ts` `uDescentBeam`): focused caustic
  energy stretches downward through the pass-under and persists as the light
  path into the first project waters.
- **Living-phase tension**: scroll stirs surface distortion/caustics before
  anything departs (`heroState.tension`).
- **Deep-link / restoration snap**: first frame lands on the authored
  departure state (`heroSnap`) — no catch-up rise, no pop.
- Projects / About / Contact content and the world-depth plate/fog/exposure
  curve are unchanged.

## Gate results (captured `.verification/milestone-2/`)

| Gate | Result |
| --- | --- |
| Sequence phases match contract | 7/7 beats (arrival→living→release→pass-under) |
| Release master monotonic | pass |
| Camera descends through pass-under | camZ 0.171 → 1.887 |
| Descent beam ignites near handoff | 0.000 → 0.406 → 0.600 |
| Letters gone after descent chapter | release 1.000, offHero true |
| Reverse returns to approved hero | phase arrival, max glyph drift 0.11 px |
| Reverse release master → 0 | 0.000 |
| Down/up hero progress convergence | 0.681 vs 0.682 |
| Down/up camera convergence | ΔcamZ 0.001 |
| Rapid reversals (8 cycles) settle finite | release 0.000 |
| Fast scroll (instant jumps) keeps live frame | ready at mid + floor |
| Deep link `#projects` cold load | snaps to authored state, Δrelease 0.000 |
| Mobile sequence | arrival → release → pass-under |
| Below-fold sections intact | projects/about/contact present |
| Frame trace during release | p95 17.2 ms @ 60 FPS, work p95 1.6 ms |

## Evidence layout

| Path | Meaning |
| --- | ---: |
| `../../.verification/milestone-2/sequence/` | 7 desktop beats + 3 mobile beats |
| `../../.verification/milestone-2/reversal/` | reversed-to-rest, down/up equality, rapid reversals |
| `../../.verification/milestone-2/deep-link/` | cold `#projects` load, early vs settled |
| `../../.verification/milestone-2/fast-scroll/` | instant jump to mid + floor |
| `../../.verification/milestone-2/sections/` | below-fold unchanged check |
| `../../.verification/milestone-2/capture-report.json` | metrics, checks, frame trace |

## Recapture

```bash
npm run capture:m2 -- http://127.0.0.1:3000
```

## Notes

- `glyphExitForDepth` / `staggeredGlyphExit` (DOM-depth-derived fly-away) are
  removed; glyph release is owned exclusively by the hero journey. Regression
  assertions were retargeted to the new symbols.
- Per-letter `uExitFade` now derives from each glyph's own staggered release,
  so the dissolve peels letter by letter instead of globally.
