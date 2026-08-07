# Milestone 4 — Etch and FlowE encounters

Gate evidence for `HOMEPAGE_CINEMATIC_TRANSFORMATION_PLAN.md` §22 Milestone 4.

## Delivered

### Etch: pressure-forged verification path (§10.3)

- Unstable **intent pressure volume** (vertex-churn shader) crystallized by
  **3 typed constraint planes**; **3 candidate crystals** form, travel the
  verification ladder, and pass through **4 gate light planes** (saved FIFO
  run, simulation pass, bounded-formal pass). The **physical-signoff gate
  stays a visibly pending open frame** — no false completion (content.ts).
- Failed candidates stay visibly held, dimmed and sunk, at their stopping
  gate; the evidence-backed result crystal rests before the pending gate.
- Ladder pans laterally and settles slightly downward as scroll scrubs the
  gates (pure function of progress).
- **Probe signature**: pointer down perturbs the nearest candidate;
  constraint planes flash the violation bounds; critically damped return.
- Exit: result softens into **5 linked relax paths** toward FlowE.

### FlowE: luminous planning current (§10.4)

- Brighter mid-depth clearing; **26 loose obligation fragments** drift in,
  a **course-aware current** (3 breathing arc lines) groups them into
  **4 structured plan columns**, then narrows through a **focus lens** into
  one stream, and contracts into a **12-point local index field** (Argyph
  sonar hint). **90 ambient motes** settle as organization increases.
- Warm loose fragments cool into the planned stream (per-instance color).
- **Probe signature**: nudge the nearest unplanned fragment; the current
  reabsorbs it with a decaying rebalance (`current-rebalance` audio hook).

### Measured chapter knots (architecture)

- `ScrollDirector` now anchors chapter ranges to **measured DOM knots**
  (`CHAPTER_ANCHOR_SELECTORS` + per-chapter viewport offsets, validated,
  monotonic) with authored normalized ranges as fallback (case routes,
  missing anchors). Encounter visibility windows and the hero journey both
  track the same active ranges — the pass-under now completes exactly at
  the physical descent end, and DOM copy always matches its 3D scene.
- `chapterRangesFromKnots` rejects non-monotonic / collapsed spans.
- `experience-store` publishes active ranges discretely (identity-compared).
- Homepage rows reordered to the final topology (§4): monkeyclaw, etch,
  flowe, argyph, then the Charted Work catalog region (velox, nexarad,
  mathpilot). Facts and identity still come from `content.ts`.
- Hot-path allocation fixes: precomputed `VECTOR_TIMINGS`,
  `CANDIDATE_CLEARANCE` table.

## Gate results (`.verification/milestone-4/`, 14/14 checks)

| Gate | Result |
| --- | --- |
| Etch scene active through chapter | 5/5 beats |
| FlowE scene active through chapter | 4/4 beats |
| Etch copy matches scene | ETCH title visible in chapter |
| FlowE copy matches scene | FLOWE title visible in chapter |
| Etch facts (signoff pending) | present at every beat |
| FlowE facts | present at every beat |
| Draw calls (aggregate peak) | 34 (budget ≤ 90) |
| Triangles (aggregate peak) | 2,430 (budget ≤ 350k) |
| Etch probe perturbation | settles back, renderer live |
| FlowE probe nudge | renderer live |
| Causal seams | monkeyclaw→etch→flowe one water |
| Reversibility | etch state reconstructs (Δfade 0.000) |
| Mobile compositions | both active, DOM complete |
| Frame traces (holds) | p50 16.7 ms; renderer work p95 ≤ 1.1 ms |

## Evidence layout

| Path | Meaning |
| --- | ---: |
| `../../.verification/milestone-4/etch/` | intent → constraints → candidates → gates → relax |
| `../../.verification/milestone-4/flowe/` | drift → group → focus → contract |
| `../../.verification/milestone-4/seams/` | chapter handoffs + mobile frames |
| `../../.verification/milestone-4/capture-report.json` | metrics, checks, frame traces |

## Recapture

```bash
npm run capture:m4 -- http://127.0.0.1:3000
```

## Notes

- Headless capture display-interval p95 reads 17–19 ms across milestones
  (environment overhead); renderer main-thread work p95 is ≤ 1.1 ms
  (budget 4 ms). The ≤16.7 ms display target is an M1-device baseline
  measurement, re-verified in the Milestone 8 device matrix.
- DOM sticky span vs. chapter window pacing is a Milestone 8 tuning item;
  with measured knots the copy and scene never disagree about ownership.
