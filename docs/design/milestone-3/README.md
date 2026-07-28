# Milestone 3 — MonkeyClaw vertical slice

Gate evidence for `HOMEPAGE_CINEMATIC_TRANSFORMATION_PLAN.md` §22 Milestone 3.
This is the contract milestone for all remaining project encounters (§10.1).

## Delivered

### Encounter system (new `src/features/ocean-experience/render/`)

- **`encounter-contract.ts`** — typed `ProjectEncounter` module contract:
  abortable load, stage attach, pure `seek(chapterProgress)`, bounded
  `probe()`, fixed-step `update()`, idempotent detach/dispose, audio hook
  events for Milestone 8.
- **`encounter-visibility.ts`** — pure swept visibility tables: fade windows
  wrap each chapter range, preload one window ahead, eviction two chapters
  behind. Total function of journey progress; allocation-free table reuse.
- **`EncounterHost.ts`** — lifecycle owner: one camera-locked stage root per
  chapter (deterministic anchor from the live camera pose), lazy chunk
  factories, AbortController load cancellation on reversal, ray-mapped
  `probeFromViewport` (§7.4). Reads only the ScrollDirector snapshot — no
  competing scroll owner.
- **Renderer pass** — encounters composite into the same water between the
  optical plate and the glyph layer, writing depth so absorption/fog treat
  them as world geometry. Stage + objects live on `ENCOUNTER_LAYER`.

### MonkeyClaw: adversarial current field (§10.2)

- Suspended translucent agent core + cage + judge layer with **8 verifier
  gates**; **18 attack vectors** (the 18 seeded attack zones) approach from
  the surrounding water; the sandbox perimeter deflects 10; 8 judged vectors
  light the gates; verified detections return as **8 telemetry rails** that
  exit as one aligned family toward Etch.
- Loop: red pressure → judge convergence → blue response → purple telemetry,
  a pure function of chapter progress (exact reversal). Secondary idle pulses
  decay to the primary state.
- **Probe signature**: pointer down in open water spawns a bounded
  adversarial pulse (pool of 3) that is visibly routed → judged → blocked →
  recorded. Never required, never fake terminal output.
- Facts from `content.ts`: 18 zones, 8 gates, 1,051 tracked test functions
  (DOM proof line).

### Semantic surface

- `ProjectEncounter.tsx` — sticky chapter stage, copy on the calm right
  region (desktop) / centered under a pearl scrim (mobile). Title, value
  line, role/status, proof, Dive in + View source, all semantic DOM,
  complete without WebGL (`sceneHint` CSS current-field fallback).
- **Root fix**: global `overflow-x: hidden` → `clip` (hidden made html a
  scroll container and silently defeated `position: sticky` page-wide).
- Canvas metric renamed `data-encounter-scene*` to avoid colliding with the
  DOM `data-encounter` attribute.
- Case-study transition: existing `ProjectTransitionLink` water wipe into
  `/project/monkeyclaw`; homepage runtime stops on route exit.

## Gate results (`.verification/milestone-3/`, 14/14 checks)

| Gate | Result |
| --- | --- |
| Encounter hidden before window | fade 0.000 at descent |
| Active inside window | monkeyclaw at all 6 beats |
| Fade rises/falls across window | 1.000 → 0.006 |
| Draw calls at peak | 29 (budget ≤ 90) |
| Triangles at peak | 3,688 encounter (127k total with hero) |
| DOM complete with facts | proof text verified |
| Case-study + source links | `/project/monkeyclaw` + GitHub |
| Probe pulse | renderer live, decays to primary state |
| Reverse past window | released (evicted/hidden) |
| Mobile composition | active + DOM complete |
| Reduced motion | semantic encounter complete |
| WebGL-blocked fallback | complete surface + links |
| Case-study route | navigates, homepage runtime stops |
| Frame trace (chapter hold) | p95 16.8 ms @ 60 FPS |

## Evidence layout

| Path | Meaning |
| --- | ---: |
| `../../.verification/milestone-3/sequence/` | 7 desktop beats + mobile judge |
| `../../.verification/milestone-3/interaction/` | probe pulse + settled |
| `../../.verification/milestone-3/states/` | reduced-motion, WebGL-blocked, case arrival |
| `../../.verification/milestone-3/capture-report.json` | metrics, checks, frame trace |

## Recapture

```bash
npm run capture:m3 -- http://127.0.0.1:3000
```

## Known tuning notes (for Milestone 8)

- DOM sticky span vs. normalized chapter window: copy pins for the first
  ~2/3 of the chapter and releases as the scene exits. Final pacing tune
  lands when Etch/FlowE encounters replace their editorial rows (M4/M5) and
  in the M8 timing pass.
- Mobile meta pills wrap to two rows; spacing tightened but short landscape
  viewports should be re-verified in the M8 matrix.
