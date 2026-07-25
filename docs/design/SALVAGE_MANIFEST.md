# Rejected-branch salvage manifest

Status: Milestone 0 foundation complete on `codex/cinematic-home-v2`

Source rejected branch: `codex/cinematic-scrollytelling` @ `cf0be54`
Integration branch: `codex/cinematic-home-v2`
Plan: `docs/design/HOMEPAGE_CINEMATIC_TRANSFORMATION_PLAN.md` §21

This manifest records what was extracted, rewritten, or discarded. Do not cherry-pick whole rejected commits.

## Extracted into `src/features/ocean-experience/`

| Rejected source | Destination | Notes |
| --- | --- | --- |
| `scroll/scroll-mapping.ts` | `scroll/scroll-mapping.ts` | Pure math kept; chapter tables retargeted to approved §5 beats. |
| `scroll/ScrollDirector.ts` | `scroll/ScrollDirector.ts` | One listener + rAF coalesce + seek; Method/Observatory CSS removed. M0 travel uses document maxScroll. |
| `state/experience-store.ts` | `state/experience-store.ts` | Continuous/discrete split retained; new `ChapterId` schema. |
| `state/preferences-store.ts` | `state/preferences-store.ts` | Versioned prefs + OS motion ceiling; storage key `ocean-experience-prefs.v1`. |
| `diagnostics/experience-debug.ts` | `diagnostics/experience-debug.ts` | `window.__oceanExperience`; adds frame faults + resource status. |
| `scene/SceneDirector.ts` | `contracts/scene.ts` | Added `LoadContext` / abortable load. |
| `scene/SceneRuntime.ts` | `runtime/ExperienceRuntime.ts` | Abortable load generation + resource registry wiring. |
| `scene/NullSceneDirector.ts` | `runtime/NullSceneDirector.ts` | Accepts optional `LoadContext`. |
| `observatory-frame-stats.ts` | `diagnostics/frame-stats.ts` | Ring buffer only; observatory knobs discarded. |
| `navigation/chapter-hash-click.ts` | `navigation/chapter-hash-click.ts` | Unchanged pure click guard. |
| `story/chapters.ts` | `contracts/chapter.ts` | **Rewrite** — no Method/Observatory; approved nine-beat journey. |

## Created new (not present on rejected branch)

| Destination | Purpose |
| --- | --- |
| `runtime/frame-fault-policy.ts` | Bounded subscriber disable policy. |
| `runtime/resource-registry.ts` | Refcounted dispose + abortable load generations. |
| `scroll/input-shaping-policy.ts` | Identity/no-shaping stub for later viscous zones. |
| `contracts/quality.ts` | `ResolvedQuality` for ExperienceFrame. |
| `OceanExperienceBridge.tsx` | M0 mount: sole scroll owner without visual change. |

## Shared runtime hardening

| File | Change |
| --- | --- |
| `src/lib/portfolio/frame-clock.ts` | Per-subscriber try/catch; next frame scheduled in `finally`; fault policy disable. |

## Homepage ownership consolidation (no visual change)

| Before | After |
| --- | --- |
| `PortfolioShell.useWaterSection` window scroll/resize | Removed; `ScrollDirector` publishes `data-water-section` |
| `Navigation` window scroll/resize | Removed; frame-clock cadence only |
| `SmoothScrollProvider` native scroll listener | Removed; subscribes to `ScrollDirector` samples |
| Lenis scroll callback | Retained (Lenis owns inertial scroll position; director samples journey) |

## Explicitly rejected (do not import)

- `CinematicHome.tsx` / `CinematicHome.module.css`
- `/experience-lab` route
- Method + Observatory chapters and step mappers
- `UnderwaterObservatoryEngine.ts` and observatory scene/state/shader/station modules
- Generated observatory / station / synthesis-engine / end-chamber GLBs and Blender sources
- Fixed 1000/610vh product rail
- Industrial titanium/amber visual system, chapter HUD, mission labels

## Verification

- New branch must not import `src/features/cinematic-home` or `/experience-lab`.
- Milestone 0 gate: homepage visually unchanged; regression + typecheck pass; one journey scroll owner (`ScrollDirector`) and one frame owner (`frame-clock`).

## Branch retirement

Do not delete `codex/cinematic-scrollytelling` until the user reviews this salvage result and any uncommitted rejected work is archived if desired.
