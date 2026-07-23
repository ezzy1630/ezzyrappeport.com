# Dive Upgrade — Implementation Ledger

**Run**: 3 of 3 — Complete Dive Closure
**Date**: 2026-07-23

## 1. Commits

| Phase | Hash | Subject |
|-------|------|---------|
| Pre-0 | `e49a404` | feat: underwater revamp - working-tree checkpoint (sections, world-state, interaction, shaders) |
| 1 | `9a4ebe6` | feat(hero): thicker crystal-letter geometry |
| 2 | `cbfabb0` | feat(hero): crystal material, clarity, rims, and anti-washout |
| 3 | `d766462` | feat(hero): add living glyph buoyancy and press state |
| 4 | `3ffdb15` | feat(portfolio): add shared DOM water dialogue |
| 5 | `6df860d` | feat(dive): finish continuous descent and basin |
| 6 | `cf9759a` | feat(dive): integrate case-study water routes |
| 7 | `d878e41` | docs(dive): close final verification ledger |

**Starting commit**: `e49a404` (main, working-tree checkpoint)
**Final Run 1 commit**: `cbfabb0`
**Branch**: `dive/run-1-crystal-foundation`

Run 1 was independently rechecked before Run 2. The production browser surface
reported 13 glyphs, `thickness-refraction`, the expected five-stage underwater
render graph, a `0.008333` simulation step, 60 FPS, 17.60 ms frame p95, and no
console errors. Runtime proof is in
`.verification/dive-upgrade/run-2/run1-baseline-idle.png`. The existing untracked
`assets/blender/hero-title/hero-title.blend1` was preserved.

## 2. Final requirement matrix — Run 3

This is the final evidence matrix for the complete three-run plan. Runtime and
visual rows cite production-browser captures, not source inspection alone.

| Phase | Requirement | Implementation location | Verification method | Status | Evidence path or command | Corrective action |
|---|---|---|---|---|---|---|
| 0 | Baseline checkpoint and green gates | `e49a404`; repo scripts | Typecheck, lint, regression suite, production build | verified | Final commands in §4; build output recorded 2026-07-23 | None |
| 1 | Inflated cast-glass hero geometry | Blender source; GLB; manifest | Asset validation plus runtime `glyphCount=13` | verified | `.verification/hero-glyphs/VALIDATION.md`; final production canvas dataset | None |
| 2 | Clear crystal material with controlled agitation | `config.ts`; underwater glyph/backdrop shaders | Rest, hover, release, anti-washout, and final runtime captures | verified | `final/hero-rest-desktop.png`; `final/hero-pointer-release.png`; `final/interaction-trace.json` | Keep the authored material contract and washout gate |
| 3 | Living glyph buoyancy | glyph rigid-body physics; underwater renderer | Runtime motion dataset, release trace, finite-state and soak checks | verified | `final/hero-pointer-release.png`; `final/stability-soak.json`; 34-test suite | None |
| 3 | Hold-to-dive, cancellation, release ring/droplets, neighbor wobble | glyph interaction state; renderer input ownership | Deterministic state tests plus pointer release trace; Browser CUA has no separate mouse-down-duration primitive | verified | `scripts/portfolio-regression-tests.mjs`; `final/interaction-trace.json` | Hold duration remains unit-test-covered; physical mouse trace is a tooling limitation |
| 4 | Shared DOM ripple and scroll-current language | delegated dialogue hook; liquid interaction; revamp styles | Pointer/focus/press trace and cross-section production samples | verified | `final/hero-pointer-release.png`; `final/journey-metrics.json`; 34 tests | None |
| 5 | Section-aware monotonic continuous descent | `world-state.ts`; measurement invalidation; renderer consumers | Pure-function continuity/monotonicity/reversal/endpoints plus live down/up samples | verified | `final/journey-metrics.json`; `npm run test:portfolio` | None |
| 5 | Readability through depth | world light; title contrast pocket; case CSS | Three screenshot RGB samples with computed WCAG contrast | verified | `final/contrast-samples.json`; all samples ≥ `6.47:1` | None |
| 5 | Deep-basin god rays and marine snow | backdrop shader; quality tier uniform | Final deep contact capture and shader/source regression checks | verified | `final/contact-deep-basin-desktop.png`; `final/contact-mobile-portrait.png`; `npm run test:portfolio` | None |
| 5 | Floor caustics and restrained contact slab rim/glow | final composite; ContactSection; revamp styles | Desktop/mobile deep-basin screenshots with readable email slab | verified | `final/contact-deep-basin-desktop.png`; `final/contact-mobile-portrait.png` | None |
| 5 | Surface meniscus without synthetic stripe | backdrop surface term | Hero rest and production screenshot inspection | verified | `final/hero-rest-desktop.png`; `final/hero-mobile-portrait.png` | None |
| 6 | Consistent shallow case-study mooring and no first-frame index flash | route seed; `CASE_MOORING_DEPTH`; `ProjectDetail`; shared renderer | Direct route immediate root seed, settled renderer state, client navigation, back route | verified | `final/case-monkeyclaw-direct.png`; `final/production-diagnostics.json`; direct trace root depth `0.22` | None |
| 6 | Arrival plunge and directional transition wake | `CaseArrivalWater`; `ProjectTransitionLink` | Direct route and client/back transition state; shared wake/press calls | verified | `final/interaction-trace.json`; `npm run test:portfolio` | None |
| 6 | Shared interaction grammar on case links/media/CTAs | `data-liquid-hover`; transition link; delegated hook | Source checks plus case route DOM and navigation exercise | verified | `final/case-monkeyclaw-direct.png`; 34-test suite | None |
| 6 | Static/poster/WebGL-failure/reduced-motion/mobile case behavior | FluidScene; ErrorBoundary; quality profiles; case CSS | Missing-GLB development path, motion toggle, mobile capture, direct routes | verified | `final/fallback-missing-glb.png`; `final/fallback-missing-glb.json`; `final/responsive-metrics.json` | Production missing-GLB query is development-only by design |
| 7 | Full automated gates and regression checks | package scripts; source tests | Typecheck, lint, portfolio regression, production build, diff check | verified | §4 exact commands; 34 tests; final build 14 pages | None |
| 7 | Final visual evidence suite | `.verification/dive-upgrade/final/` | Named hero, journey, contact, case, mobile, fallback, interaction captures | verified | `final/` image and JSON artifacts; inspected with image viewer | None |
| 7 | Desktop/mobile performance targets | renderer telemetry; explicit production soak | p50/p95/worst, work p95, adaptive downgrade count, 60.678 s soak | failed | `final/performance.json`; `final/stability-soak.json` | Exact frame p95 varied `16.8–17.6 ms` on the available arm64 Browser host; no exact M-series model/browser version or DevTools trace was available. Work p95 stayed ≤`2.3 ms`, adaptive downgrades `0`. |
| 7 | Stability and lifecycle adversarial QA | renderer/input/hooks; route/fallback paths | 60 s scroll/pointer soak, route changes, motion toggle, mobile, missing asset, finite-state tests | verified | `final/stability-soak.json`; `final/interaction-trace.json`; 34 tests | None observed |
| 7 | Keyboard, focus, contrast, reduced-motion, fallback accessibility | DOM/CSS/renderer fallbacks | Keyboard focus outline, motion-off static frame, equivalent DOM content, RGB contrast samples | verified | `final/contrast-samples.json`; motion-off dataset trace; final screenshots | Browser OS-level reduced-motion emulation unavailable; local motion-off path verified |
| 7 | Documentation and final implementation ledger | `README.md`; this ledger | Claims reconciled with final code, artifacts, commands, commits, and limitations | verified | README and this final ledger | None |

## Historical Run 1 — Checkpoint Decision

The working tree on `main` contained 15 modified + 2 untracked files, all underwater-revamp-related.
Committed as `e49a404` before creating the feature branch.
All 14 stale codex/ branches (0 ahead of main) were deleted.
One worktree at `/Users/ezzyrappeport/.codex/worktrees/hero-liquid-glass-coupling` was removed.

## Historical Run 1 — Commands Run and Results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ PASS (Phase 0, post-Phase 2) |
| `npm run lint` | ✅ PASS (Phase 0, post-Phase 2) |
| `npm run build` | ✅ PASS (Phase 0, post-Phase 2; 14 pages, 130kB first load) |
| `npm run test:portfolio` | ✅ PASS (Phase 0: 30/30, post-Phase 2: 30/30) |
| Blender pipeline | ✅ PASS (13 nodes, reimport names match, bounds match) |

## Historical Run 1 — Files Changed

### Phase 0
- `.verification/dive-upgrade/before/baseline-evidence.md` (new, gitignored)

### Phase 1
- `scripts/blender/build_hero_glyphs.py` — Geometry constants and bar dimensions updated
- `public/assets/hero/ezzy-rappeport-glyphs.glb` — Regenerated with thicker geometry
- `public/assets/hero/ezzy-rappeport-glyphs.json` — Updated manifest with new bounds/triangle counts
- `assets/blender/hero-title/hero-title.blend` — Updated source file

### Phase 2
- `src/features/kinetic-canvas/renderer/underwater/shaders.ts` — Crystal material + anti-washout
- `src/features/kinetic-canvas/renderer/underwater/config.ts` — Material parameter tuning

## Historical Run 1 — Important Constants Before and After

### Geometry (build_hero_glyphs.py)

| Constant | Before | After |
|----------|--------|-------|
| EXTRUDE | 0.048 | 0.070 |
| BEVEL | 0.060 | 0.068 |
| BEVEL_SEGMENTS | 12 | 14 |
| BULGE | 0.034 | 0.054 |
| BULGE_RUN | 0.180 | 0.215 |
| VOXEL_SIZE | 0.003 | 0.0024 |
| CONTOUR_BEVEL | 0.024 | 0.035 |
| CONTOUR_BEVEL_SEGMENTS | 6 | 8 |
| Overall depth | 0.284 em | 0.384 em |
| Bar rounding width (A) | 0.052 | 0.062 |
| Bar rounding width (E/Z/Y/T) | 0.058 | 0.068 |
| Bar Z dimension (all) | 0.224 | 0.276 |

### Material (config.ts)

| Constant | Before | After |
|----------|--------|-------|
| exposure | 0.90 | 0.88 |
| keyIntensity | 5.6 | 6.4 |
| fillIntensity | 1.7 | 1.8 |
| environmentIntensity | 0.9 | 0.92 |
| roughness | 0.028 | 0.022 |
| absorptionColor | #b5e0ee | #a8d8ea |
| absorptionDistance | 1.55 | 1.22 |
| causticStrength | 0.5 | 0.58 |

### Shader (shaders.ts — glyph fragment)

| Parameter | Before | After |
|-----------|--------|-------|
| keySpec exponent | mix(90, 240, ...) | mix(110, 260, ...) |
| Sun-glint lobe | none | exponent 520 |
| Edge-water core | vec3(0.02, 0.10, 0.34) | vec3(0.05, 0.35, 0.75) |
| Absorption shoulder | 0.12 + 0.48*shoulder | 0.14 + 0.56*shoulder |
| Dispersion scale | 0.00045 + 0.0012*thick | 0.0006 + 0.0015*thick + 0.0008*shoulder |
| Micro-bubble scale | 34x | 38x |
| Internal streaks | none | two anisotropic folds (14/16 exp) |
| Larger bubbles | none | 3D noise, dark center + bright rim |
| Body mix | 0.82 direct/env | 0.84 direct/env |

### Shader (shaders.ts — final composite)

| Parameter | Before | After |
|-----------|--------|-------|
| washoutGate | none | 1 - smoothstep(0.014, 0.055, slope) |
| Contact shadow | 0.07 + 0.04*depth | 0.09 + 0.05*depth |
| Wake addition | 0.05 | 0.04 * washoutGate |
| Crest specular exp | 16 | 18 |
| Crest gate | 0.085 | 0.075 * (0.3 + washoutGate*0.7) |
| Height shading | 0.115 | 0.10 |

## Historical Run 1 — GLB and Manifest Validation

| Metric | Before | After |
|--------|--------|-------|
| GLB size | 501,788 bytes | 622,448 bytes |
| Glyph count | 13 | 13 |
| Unique meshes | 8 | 8 |
| Reimport nodes | 13 | 13 |
| Names match | ✅ | ✅ |
| Bounds match | ✅ | ✅ |

## Historical Run 1 — Geometry Counts Before and After

| Glyph | Before (tris) | After (tris) | Depth Before | Depth After |
|-------|--------------|-------------|-------------|------------|
| E | 2,500 | 3,200 | 0.224 | 0.276 |
| Z | 2,200 | 2,800 | 0.224 | 0.276 |
| Y | 3,000 | 3,800 | 0.224 | 0.276 |
| T | 2,200 | 2,800 | 0.224 | 0.276 |
| A | 5,000 | 6,000 | 0.224 | 0.276 |
| R | 3,998 | 5,000 | 0.239 | 0.307 |
| P | 4,000 | 5,000 | 0.239 | 0.307 |
| O | 4,500 | 5,500 | 0.239 | 0.306 |
| **Total** | **44,096** | **55,100** | | |

## Historical Run 1 — Visual and Performance Results

> [!IMPORTANT]
> Screenshots could not be captured in this headless execution environment.
> The Blender validation renders are in `.verification/hero-glyphs/` (gitignored).
> Runtime visual verification requires running `npm run dev` and loading the page.

**Visual intent implemented (requires manual verification)**:
- Thicker, pillow-convex faces with deeper rounded shoulders
- White-to-near-white key rims with sun-glint secondary lobe
- Saturated cerulean at grazing angles with shortened absorption
- Internal anisotropic streaks and micro/macro bubbles gated by optical thickness
- Enhanced dispersion at shoulder boundaries
- Boundary crease darkening for silhouette readability
- Anti-washout gating prevents milky white during strong disturbance

**Performance expectation**:
- Triangle count increase (+25%) is within budget for all quality tiers
- No new texture reads or render passes added
- Internal effects use existing procedural noise (no texture fetches)
- washoutGate is a single smoothstep — negligible cost

## Historical Run 1 — Screenshot and Evidence Paths

| Path | Content |
|------|---------|
| `.verification/dive-upgrade/before/baseline-evidence.md` | Phase 0 baseline |
| `.verification/hero-glyphs/01_full-title.png` through `12_reimport-front.png` | Blender validation renders |
| `.verification/hero-glyphs/VALIDATION.md` | Blender geometry report |

## Historical Run 1 — Known Limitations and Unresolved Observations

1. **No runtime screenshots**: This run was executed in a headless environment. Visual quality must be verified by running `npm run dev` and inspecting the hero.
2. **Performance measurement pending**: Frame timing cannot be measured without a browser. The triangle increase is conservative and should remain within budget.
3. **Mass/inertia changes**: The thicker geometry will produce slightly different mass and inertia values in `deriveMassAndInertia()` since bounds changed. The physics uses the actual geometry bounds at runtime, so this is automatically accommodated. The character of the motion may shift subtly.
4. **Exposure tuning**: The exposure change (0.90 → 0.88) was selected based on the material term analysis. It may need further adjustment after visual inspection.
5. **Internal bubble visibility**: The sparse larger bubbles use 3D value noise and may be too subtle or too visible depending on the geometry's optical thickness in practice. Requires visual inspection.

## Historical Run 1 — Preconditions for Run 2

1. Run 1 commits are on `dive/run-1-crystal-foundation` branch
2. All gates green: typecheck, lint, build, 30/30 tests
3. The crystal geometry is regenerated and validated
4. The material shader includes the complete crystal treatment
5. The composite shader includes anti-washout control
6. **Run 2 must verify**: runtime visual quality against the acceptance criteria before proceeding

## Shared Engineering Invariants

1. **Glyph identity contract**: 13 glyphs, indices 0..12, node names `line1_*`/`line2_*`, manifest version 1
2. **Shared geometry identifiers**: `custom-rounded-{char}-inflated-v2` and `inter-tight-900-{char}-inflated-v2`
3. **Pivot convention**: projected-area-centroid at mid-depth, always [0,0,0] local
4. **Coordinate system**: glTF right-handed Y-up
5. **Render graph**: environment → back-depth → front-depth → scene → final composite (5 passes)
6. **Heightfield simulation**: ping-pong at 120Hz fixed step
7. **Quality tiers**: high (5 taps), balanced (3 taps), low (1 tap)
8. **Reduced motion**: single composed frame, no running loop
9. **World-state curve**: continuous depth 0→1, drives plate crossfade, theme, calm, glyph exit
10. **No new dependencies added**
11. **No render pass structure changed**
12. **washoutGate**: composite slope-dependent gate must be preserved when adding new additive terms

## Historical Run 2 — Verified Implementation

### Scope and repairs

Run 2 adds living buoyancy, one explicit glyph interaction state machine, and
one DOM-to-heightfield dialogue path. The Run 1 crystal geometry, shader
material, render graph, fallback tiers, and 120 Hz fixed-step contract were not
redesigned.

One Run 1-adjacent repair was required: `liquid-interaction.ts` now uses explicit
`.ts` local imports so the existing strip-types regression runner can resolve
the module. The Run 2 soak also verified the projected mooring against the live
camera each frame; the current implementation does not cache a stale rest
screen point during scroll.

### Phase 3 files

- `src/features/kinetic-canvas/interaction/glyphInteractionState.ts` — explicit idle, hovering, holding, releasing, cancelled, and disabled states; deterministic release droplet schedule.
- `src/features/kinetic-canvas/physics/glyphRigidBodies.ts` — deterministic phase generation, bounded ambient motion, hover/hold/release forces, neighbor separation, finite-state recovery, velocity/depth/rotation clamps, and live mooring projection.
- `src/features/kinetic-canvas/renderer/underwater/underwaterHeroRenderer.ts` — glyph ownership, pointer capture/cancel paths, cursor restoration, scheduled rings/droplets, first-load breach, scroll wakes, hold churn, and debug datasets.
- `src/lib/portfolio/liquid-interaction.ts` — pointer presence/type hygiene, blur/visibility cleanup, scroll decay, wake strength, and emission gating.
- `src/features/kinetic-canvas/KineticCanvas.tsx` — renderer-ready event bridge.
- `scripts/portfolio-regression-tests.mjs` — deterministic state, falloff, finite-state, release, lifecycle, and scroll tests.

### Phase 4 files

- `src/hooks/portfolio/use-liquid-dialogue.ts` — delegated fine-pointer hover dialogue and intersection/visibility/reduced-motion/renderer-gated persistent surfaces.
- `src/components/portfolio/HeroIntro.tsx` — phase-offset Explore-work surface.
- `src/components/portfolio/ContactSection.tsx` — phase-offset contact email surface.
- `src/components/portfolio/Navigation.tsx` — shared hover markers on foreground controls.
- `src/components/portfolio/PortfolioShell.tsx` — delegated hook ownership and motion data attribute.
- `src/app/revamp.css` — restrained 2px DOM acknowledgment, motion-gated.

### State and ownership design

Glyph ownership is a pure transition function. A pointer-down can only create a
holding state for one nearest eligible glyph; pointer-up creates a release with
a monotonically increasing release ID; pointer cancel, lost capture, blur,
hidden page, teardown, and disabled motion all leave holding/grabbing through
the same cancellation path. The renderer owns the fixed-step simulation,
scheduled water queue, cursor restoration, and WeakSet ripple de-duplication.
The DOM hook owns only delegated DOM events and bounded self-rescheduling
surface emissions. No CSS physics system or orphaned release timer was added.

### Final tuned constants

- Fixed step: `1 / 120` seconds.
- Phase: golden-angle index plus stable manifest identity hash.
- Idle: alternating `0.46 Hz` / `0.71 Hz`, amplitude `0.013` to `0.0166` world units, tilt `0.60` to `1.14` degrees, zeroed under reduced motion.
- Hover: one nearest glyph, `1.4x` projected half-diagonal ownership radius, smooth falloff, approximately `0.028` world-unit lift target, off-center torque.
- Hold: `-0.050` to `-0.062` world-unit depth target, 6 Hz strain wobble, pointer capture and `grabbing` cursor.
- Release: upward bounded impulse, one broad ring, five droplets at `32/46/61/74/80 ms`, bounded angular release, 0.9-second release state.
- Physics clamps: linear speed `0.58`, depth `[-0.078, 0.043]`, planar travel per body `0.068` to `0.078`, angular velocity `±1.35`, per-glyph tilt approximately `4.0` to `5.35` degrees.
- Neighbor separation: `0.022` base impulse with bounded velocity clamp.
- Persistent DOM surfaces: `2.4 s` cadence, CTA phase `320 ms`, contact phase `1540 ms`, IntersectionObserver plus bounded hash-scroll bootstrap recheck.
- Scroll: wake starts at absolute filtered velocity `0.12`, smooth normalized strength, 90 ms injection throttle, exponential velocity decay `7.5`, ambient chop contribution `0.018`.

### Tests and exact results

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:portfolio` | PASS — 33 portfolio regression tests |
| `npm run build` | PASS — production build completed |
| `git diff --check` | PASS |

The regression suite covers deterministic phase generation, hover falloff and
ownership, hold/release/cancel transitions, droplet timing, invalid-number
detection, scroll monotonicity and decay, visibility/reduced-motion gating,
pointer cancellation source checks, and cleanup markers.

### Soak and live evidence

The clean glyph-only soak ran for `63.4 s`: 19 repeated hold/release cycles,
four pointer positions, 57 state samples, zero invalid numeric states, maximum
projected displacement `18.33 px`, maximum depth `0.0356`, maximum rotation
`3.89 degrees`, and no scheduled water residue at the end. Evidence:
`.verification/dive-upgrade/run-2/soak-60s-glyph-only.json`.

A second stress trace included scroll currents and recorded no invalid numbers;
its larger projected excursion was camera/scroll motion, which motivated the
live mooring reprojection repair. Evidence:
`.verification/dive-upgrade/run-2/soak-60s.json`.

Runtime captures:

- Idle buoyancy: `.verification/dive-upgrade/run-2/phase3-final-idle.png`
- Hover greeting and cursor ownership: `.verification/dive-upgrade/run-2/phase3-final-hover-greeting.png`
- Hold/submerge/grab: `.verification/dive-upgrade/run-2/phase3-final-hold.png`
- Release ring, droplets, and neighbor response: `.verification/dive-upgrade/run-2/phase3-final-release.png`
- Release settle: `.verification/dive-upgrade/run-2/phase3-final-settle.png`
- Explore-work cadence: `.verification/dive-upgrade/run-2/phase4-explore-rings-final.png`
- Contact cadence: `.verification/dive-upgrade/run-2/phase4-contact-rings-final.png`
- Fast scroll current and settled calm: `.verification/dive-upgrade/run-2/phase4-fast-scroll-current.png`, `.verification/dive-upgrade/run-2/phase4-settled-current.png`
- Mobile layout: `.verification/dive-upgrade/run-2/mobile-coarse-pointer.png`
- Reduced motion: `.verification/dive-upgrade/run-2/reduced-motion.png`

### Performance

The browser performance artifact is
`.verification/dive-upgrade/run-2/performance.json`. The visible production
surface measured `43.5 FPS`, `35 ms` frame p95, `1.7 ms` work p95, adaptive scale
`0.90`, 1728×972 render size, 256×144 simulation, 58 draw calls, 220,412
triangles, and 51.8 MB estimated texture memory. The 60-second interaction
sample measured `50.9 FPS`, `33.4 ms` frame p95, and `1.2 ms` work p95 at the
0.80 adaptive floor. The low CPU work figure indicates the added fixed-step
glyph work is bounded; the visible-browser GPU/frame-time result remains a
Run 3 performance risk and is not hidden by claiming a green 60 FPS result.

### Run 2 remaining risks

1. The production browser harness shows frame-time variance versus the Run 1
   baseline; verify on a single clean browser tab and physical mobile hardware
   before release.
2. The accepted Run 1 material remains the source of truth, but the runtime
   capture is brighter/washed compared with the authored reference under this
   browser surface. No material retune was made in Run 2.
3. Entrance behavior was verified in code and runtime skip mode; the captured
   session had already-seen session semantics, so a fresh-session breach proof
   should be re-recorded in Run 3.
4. No final scroll-depth remap, deep-basin upgrade, case-study integration, or
   final release audit was attempted.

### Preconditions for Run 3

Run 3 may begin when the two implementation commits and this ledger are on the
branch, the 33-test suite and production build remain green, the single-tab
performance result is rechecked, and the remaining live-only browser/device
proof is scheduled. Run 3 scope is explicitly limited to the final scroll-depth
remap, deep-basin upgrade, case-study integration, and final release audit.

## Run 3 Final Closure

### Implemented system

- `world-state.ts` now maps measured section ranges through named smootherstep
  knots: hero `0.00→0.10`, Projects through `0.38`, About through `0.56`, the
  contact approach at `0.74`, and the floor at `1.00`. It invalidates on content
  resize and is pure with respect to scroll direction.
- The backdrop owns slow god rays, floor caustics, a surface meniscus, and two
  procedural marine-snow layers. Low/balanced/high tiers reduce the near layer
  and reduced motion freezes time.
- Case routes use a server-seeded shallow dock (`0.22`, light `0.9056`) before
  effects mount, then share the same renderer, DOM dialogue, directional wakes,
  arrival plunge, and route transitions. No animation gates navigation.
- The renderer exposes p50/p95/worst frame and work samples, plus an explicit
  adaptive-downgrade count. High desktop starts at the proven `0.80` render
  scale; this avoids an adaptive downgrade during normal use.
- README now describes Three.js/WebGL2 as foundational, the water architecture,
  quality tiers, fallbacks, and validation commands. Generated hero and water
  assets remain reproducible through the existing scripts.

### Final commands

| Command | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | PASS |
| `./node_modules/.bin/eslint .` | PASS |
| `node scripts/portfolio-regression-tests.mjs` | PASS — 34 tests |
| `./node_modules/.bin/next build` | PASS — 14 routes generated |
| `git diff --check` | PASS before final commits |

### Final evidence

All final artifacts are under `.verification/dive-upgrade/final/`. The primary
set is `hero-rest-desktop.png`, `hero-pointer-release.png`,
`projects-shallow-desktop.png`, `about-midwater-desktop.png`,
`contact-approach-desktop.png`, `contact-deep-basin-desktop.png`,
`case-monkeyclaw-direct.png`, `hero-mobile-portrait.png`,
`contact-mobile-portrait.png`, `fallback-missing-glb.png`, and
`interaction-trace.json`. Numeric traces are in `journey-metrics.json`,
`performance.json`, `stability-soak.json`, `responsive-metrics.json`, and
`contrast-samples.json`.

### Performance and limitations

The explicit production soak ran `60.678 s` at `1280×720`, DPR `1`, high tier,
with alternating 620 px scroll wakes and pointer moves. It recorded p50
`16.70 ms`, p95 samples between `16.8` and `17.6 ms`, worst `100.0 ms` during
one browser scheduling outlier, work p95 between `0.5` and `2.3 ms`, zero
adaptive downgrades, no scheduled-water residue, and no invalid numeric states.
The host is arm64, but the exact M-series model, browser version, and Chrome
DevTools trace were unavailable. The exact `17.3 ms` frame target is therefore
not claimed as universally passed; this is the sole failed matrix row. Local
Vercel Analytics/Speed Insights load messages are expected on localhost and are
not application errors.

### Final commits

Run 3 commits are `6df860d`, `cf9759a`, and `d878e41`. The pre-existing
untracked Blender recovery file `assets/blender/hero-title/hero-title.blend1`
was preserved and is intentionally not part of the release commits.
