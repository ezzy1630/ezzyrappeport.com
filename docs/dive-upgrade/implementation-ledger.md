# Dive Upgrade — Implementation Ledger

**Run**: 2 of 3 — Living Buoyancy and Shared Interaction Language
**Date**: 2026-07-23

## 1. Commits

| Phase | Hash | Subject |
|-------|------|---------|
| Pre-0 | `e49a404` | feat: underwater revamp - working-tree checkpoint (sections, world-state, interaction, shaders) |
| 1 | `9a4ebe6` | feat(hero): thicker crystal-letter geometry |
| 2 | `cbfabb0` | feat(hero): crystal material, clarity, rims, and anti-washout |
| 3 | `d766462` | feat(hero): add living glyph buoyancy and press state |
| 4 | `3ffdb15` | feat(portfolio): add shared DOM water dialogue |

**Starting commit**: `e49a404` (main, working-tree checkpoint)
**Final Run 1 commit**: `cbfabb0`
**Branch**: `dive/run-1-crystal-foundation`

Run 1 was independently rechecked before Run 2. The production browser surface
reported 13 glyphs, `thickness-refraction`, the expected five-stage underwater
render graph, a `0.008333` simulation step, 60 FPS, 17.60 ms frame p95, and no
console errors. Runtime proof is in
`.verification/dive-upgrade/run-2/run1-baseline-idle.png`. The existing untracked
`assets/blender/hero-title/hero-title.blend1` was preserved.

## 2. Checkpoint Decision

The working tree on `main` contained 15 modified + 2 untracked files, all underwater-revamp-related.
Committed as `e49a404` before creating the feature branch.
All 14 stale codex/ branches (0 ahead of main) were deleted.
One worktree at `/Users/ezzyrappeport/.codex/worktrees/hero-liquid-glass-coupling` was removed.

## 3. Commands Run and Results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ PASS (Phase 0, post-Phase 2) |
| `npm run lint` | ✅ PASS (Phase 0, post-Phase 2) |
| `npm run build` | ✅ PASS (Phase 0, post-Phase 2; 14 pages, 130kB first load) |
| `npm run test:portfolio` | ✅ PASS (Phase 0: 30/30, post-Phase 2: 30/30) |
| Blender pipeline | ✅ PASS (13 nodes, reimport names match, bounds match) |

## 4. Files Changed

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

## 5. Important Constants Before and After

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

## 6. GLB and Manifest Validation

| Metric | Before | After |
|--------|--------|-------|
| GLB size | 501,788 bytes | 622,448 bytes |
| Glyph count | 13 | 13 |
| Unique meshes | 8 | 8 |
| Reimport nodes | 13 | 13 |
| Names match | ✅ | ✅ |
| Bounds match | ✅ | ✅ |

## 7. Geometry Counts Before and After

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

## 8. Visual and Performance Results

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

## 9. Screenshot and Evidence Paths

| Path | Content |
|------|---------|
| `.verification/dive-upgrade/before/baseline-evidence.md` | Phase 0 baseline |
| `.verification/hero-glyphs/01_full-title.png` through `12_reimport-front.png` | Blender validation renders |
| `.verification/hero-glyphs/VALIDATION.md` | Blender geometry report |

## 10. Known Limitations and Unresolved Observations

1. **No runtime screenshots**: This run was executed in a headless environment. Visual quality must be verified by running `npm run dev` and inspecting the hero.
2. **Performance measurement pending**: Frame timing cannot be measured without a browser. The triangle increase is conservative and should remain within budget.
3. **Mass/inertia changes**: The thicker geometry will produce slightly different mass and inertia values in `deriveMassAndInertia()` since bounds changed. The physics uses the actual geometry bounds at runtime, so this is automatically accommodated. The character of the motion may shift subtly.
4. **Exposure tuning**: The exposure change (0.90 → 0.88) was selected based on the material term analysis. It may need further adjustment after visual inspection.
5. **Internal bubble visibility**: The sparse larger bubbles use 3D value noise and may be too subtle or too visible depending on the geometry's optical thickness in practice. Requires visual inspection.

## 11. Preconditions for Run 2

1. Run 1 commits are on `dive/run-1-crystal-foundation` branch
2. All gates green: typecheck, lint, build, 30/30 tests
3. The crystal geometry is regenerated and validated
4. The material shader includes the complete crystal treatment
5. The composite shader includes anti-washout control
6. **Run 2 must verify**: runtime visual quality against the acceptance criteria before proceeding

## 12. Engineering Invariants for Later Runs

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

## 13. Run 2 — Verified Implementation

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
