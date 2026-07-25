# Milestone 0 baseline evidence

Captured against the Milestone 0 foundation on `codex/cinematic-home-v2` before any visual homepage changes.

## Contents

- `../../.verification/milestone-0/baseline/` — idle desktop/tablet/mobile screenshots + `capture-report.json` (fps, workMsP95, chapter, GLB transfer hints)
- `../../.verification/milestone-0/sections/` — hero / projects / about / contact frames at 1440×900

## Gate notes

- Homepage layout and measured world-depth chrome are unchanged.
- `data-water-section` still comes from measured `world-state` geometry.
- Authored chapter progress is published for diagnostics (`data-experience-chapter`) and does not yet drive layout.
- Recapture: `npm run capture:m0` with the site on `http://127.0.0.1:3000`.
