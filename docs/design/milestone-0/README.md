# Milestone 0 baseline evidence

Gate evidence for `HOMEPAGE_CINEMATIC_TRANSFORMATION_PLAN.md` §22.

## Layout

| Path | Meaning |
| --- | ---: |
| `../../.verification/milestone-0/main/` | Clean `main` @ `216e38d` — pre-foundation baseline |
| `../../.verification/milestone-0/post-m0/` | Integration branch after Milestone 0 foundation |

Each label contains:

- `baseline/` — idle desktop/tablet/mobile screenshots + `capture-report.json`
- `sections/` — hero / projects / about / contact at 1440×900
- short rAF frame trace on 1440×900 (in the report)

## Required metrics (present in reports)

- transfer hints (GLB Resource Timing)
- draw calls / triangles / textureMemoryEstimateMb
- fps, workMsP95/Worst, frameMsP95/Worst
- visual state: fluid/boot/hero/waterSection/worldDepth/glyphCount
- `oceanBridge` flag (false on main, true on post-m0)

## Recapture

```bash
# clean main worktree on :3001
npm run capture:m0:main -- http://127.0.0.1:3001

# this branch on :3000
npm run capture:m0 -- http://127.0.0.1:3000
```

## Unchanged-homepage note

Post-M0 idle metrics stay within the same draw/triangle/RT envelope as main.
`data-experience-chapter` is diagnostic-only in M0 and may diverge from
`data-water-section` until authored journey travel lands in later milestones.
Water-section chrome remains measured world-state geometry.
