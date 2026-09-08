# Downright and MonkeyClaw project stories

Local implementation on the portfolio checkout, following `1967112`. Validation below was completed before commit and push; public deployment was not verified.

## Result

- Downright has a document-centered narrative, an on-demand ten-second recording from the public README, architectural decisions with tradeoffs, and a detail crop of the real renderer capture.
- MonkeyClaw follows one recorded mock-sandbox finding through reproduction. Individual contributions link to authored commits. The page states that this fixture contains no completed patch and distinguishes the detection oracle from end-to-end verification.
- Shared opening, chapter, decision, source, media, authorship, and finding components support both stories. Chapter links track the reading position; return links land on the corresponding homepage project.
- The homepage pairs Downright with an actual product capture and MonkeyClaw with a labeled fixture summary. Their smaller artwork remains draggable. The résumé PDF reflects the updated contribution descriptions.

## Evidence provenance

Downright architecture and capture provenance are pinned to `18e46e3a583bd8ece34e15f286346ca582bf5a1b`. MonkeyClaw source and `demo/fixtures/seed.db` are pinned to `cd1507cbb52a91d45821f75ed89e7c3657da4305`. Exact links live in `src/lib/portfolio/story-evidence.ts`.

The selected MonkeyClaw fixture is finding `FND-e4b8317b684d` / package `MC-2026-0001`: two original requests, one retained reproduction request, and no recorded patch. These are controlled demo records, not live deployment results. Individual contribution links cover the native telemetry adapter, transcript reproduction changes, and dashboard updates.

## Local verification

- Typecheck, lint, and production build passed. The final build includes Next.js type and lint validation.
- `test:water` and `test:playground` passed. All 14 renderer runtime audit checks passed.
- `test:portfolio` retains the existing `/Study for psych quiz/` assertion failure in the older FlowE scene test. That renderer was not changed.
- Production HTTP checks passed for 10 routes, section and return-to-project anchors, 38 assets/downloads, and the unknown-project 404.
- Browser inspection covered desktop 1440×900, mobile 390×844, and tablet 768×1024. Inspected layouts had no horizontal overflow.
- The recording makes no video request before Play. Production playback completed and returned keyboard focus to Play. The clip is user-triggered and does not loop.
- All four detection outcomes were exercised with the keyboard in development; the production control was rechecked. With JavaScript disabled, controls are disabled and the static four-outcome reference remains readable.
- Chapter navigation and return links were exercised. Dragging the smaller homepage artwork moved the artwork without navigating away.
- The regenerated résumé was visually inspected as a single page. The production download matches the local PDF byte for byte.

Build, test, and HTTP logs are retained under `/tmp/portfolio-stories-*.log`. These checks establish local production-preview behavior, not a public release or a fresh audit of either featured product.
