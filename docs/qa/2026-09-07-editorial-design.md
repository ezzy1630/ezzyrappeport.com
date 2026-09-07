# Portfolio design and interaction verification · 2026-09-07

## Delivered design

- Downright leads the homepage and has a full portfolio case study with an actual public product capture. Case-study navigation follows the homepage order. Project names are consistent across the gallery, case studies, résumé and metadata.
- Identity artwork sits directly in the water. Downright and FlowE use app icons; MonkeyClaw and Argyph use authored identity marks; Etch adapts its existing nib geometry. Shared object sizing, lighting direction and soft shadows connect the artwork. These marks are identity assets, not product screenshots.
- Featured artwork is a separate link and drag surface. Text is stable and selectable; titles and explicit project links provide ordinary navigation. Supporting links and case-study figures are not draggable.
- Static, feathered reading washes quiet the water behind project descriptions. Case studies use one continuous pale veil. No backdrop blur, new animation loop or additional WebGL pass was introduced.
- Consolidated the homepage stylesheet from 860 lines at the start of the final pass to 142 lines, with shared spacing, color and typography tokens. Removed obsolete spotlight/panel rules and competing hover transforms. Image arrival fades preserve authored centering.
- Résumé uses a static document layout with no legacy renderer. The PDF was regenerated from the production HTML using ReportLab and the site's General Sans fonts because browser PDF printing was unavailable. Inspected the rendered one-page US Letter PDF; five projects, Downright first, no clipping.

## Local evidence

Canonical checkout: `/Volumes/Neural/EzzyRappeport.com`. Production server: `http://127.0.0.1:3000`. Checks use builds made from this checkout; development servers were not used as release evidence.

Passed: TypeScript, ESLint, production build, water optics/interaction tests, playground physics/poster tests, and all 14 retained renderer runtime audits. HTTP checks passed 10 routes, 38 discovered image/script/download assets, local anchors and unknown-project 404.

The broad `test:portfolio` suite remains red at the retained FlowE scene assertion expecting `Study for psych quiz` (line 2142). Its scene source is unchanged by this task. Logs retain this failure. Updated the earlier scroll-owner inventory to include the actual retained/current renderers, and removed obsolete assertions that required historical README test counts in public copy; runtime, media and route contracts remain intact.

Browser checks covered 1440×900 desktop and 390×844 mobile layouts, project artwork, Downright case study, résumé and reading contrast. No horizontal overflow was observed. On a desktop artwork drag, the text rectangle stayed exactly `(836.77, 313.19, 440, 390.24)` while the artwork moved; release suppressed navigation. Double-clicking the description selected `Markdown`, with no surface drag. Artwork and title links both opened Downright. Pause cleared artwork transforms; reset and resume worked. Reduced-motion emulation paused the scene and left all five artwork transforms empty.

With JavaScript disabled on the final production build, the hero poster, document typography and navigation remained visible.

Native touch injection and keyboard activation were unavailable through this in-app browser's input adapter. Mobile dimensions/DPR and coarse touch mode were emulated; this is not physical-device evidence. Ordinary link semantics, native touch scrolling policy and visible focus styles remain in source. A full hardware touch/keyboard test is not claimed.

## Performance samples

These are local browser samples on a shared Mac, not production measurements or a claimed speedup. Debug diagnostics were enabled with `?capture=1`. Frame intervals are render cadence; CPU and GPU percentiles are measured separately and must not be added as end-to-end latency.

| Scenario | CPU p95 | GPU p95 | Median / p95 interval |
| --- | ---: | ---: | ---: |
| Desktop project view, 1440×900 DPR1 | 0.4 ms | 5.37 ms | 16.7 / 17.6 ms |
| Constrained mobile hero idle, 390×844 DPR2, 4× CPU slowdown | 1.5 ms | 13.5 ms | 16.7 / 17.6 ms |
| Constrained mobile project view after scrolling | 3.3 ms | 11.64 ms | 16.7 / 17.5 ms |
| Desktop Downright case study idle | 0.3 ms | 5.47 ms | 16.7 / 17.7 ms |

With cache bypass, 150 ms simulated latency, 200,000 bytes/s download and 4× CPU slowdown, first contentful paint was 960 ms and page load completed at 2,358 ms. Subsequent resources, including progressive enhancement, totaled about 1.12 MB. The optimized Downright homepage icon transferred about 15 KB in the mobile run. The poster and document content load before the live scene; page-load timing does not mean WebGL initialization has completed.

GPU work dominates the sampled frame cost. Preserved the established renderer budget because measured cadence remained stable. This pass reduces DOM motion owners, uses appropriately sized responsive identity images, removes unused CSS and keeps the résumé free of WebGL. No additional frame-rate improvement is claimed.

## Logs

- `/tmp/portfolio-cohesion-final-types.log`
- `/tmp/portfolio-cohesion-final-lint.log`
- `/tmp/portfolio-cohesion-release-build.log`
- `/tmp/portfolio-cohesion-water.log`
- `/tmp/portfolio-cohesion-playground.log`
- `/tmp/portfolio-cohesion-portfolio-3.log` (exit 1, retained scene wording assertion)
- `/tmp/portfolio-cohesion-runtime.log`
- `/tmp/portfolio-cohesion-final-http.log`

## Source record

Read public repository descriptions/READMEs and release metadata using the authenticated GitHub CLI. These establish documented project scope, not independently executed product tests. Private repository internals were not added to public copy.

- [MonkeyClaw README](https://github.com/justin06lee/monkeyclaw/blob/master/README.md): security loop, deterministic demo, detection-as-pass verification.
- [FlowE public site](https://flowe.cc): brain dump, daily planning, focus, and calendar context. Existing authorized portfolio facts supply the implementation stack. Public App Store availability is not claimed.
- [Etch README](https://github.com/ezzy1630/Etch): requirement/spec/RTL workflow, independent verification, completed FIFO example, physical-signoff boundary.
- [Argyph README](https://github.com/ezzy1630/Argyph) and [v1.0.4 release](https://github.com/ezzy1630/Argyph/releases/tag/v1.0.4): local retrieval, indexing, tool set, distribution. Memory tools mean the entire server is not read-only.
- [Downright README](https://github.com/ezzy1630/Downright) and [original renderer showcase](https://github.com/ezzy1630/Downright/blob/main/Docs/downright-renderer-showcase.png): AppKit/TextKit 2 document behavior and actual product imagery. Showcase blob SHA: `9ac938df8bcf7a547d66217beb5042611a84f217`.
- [Terminus README](https://github.com/ezzy1630/Terminus): runtime/kernel direction, explicitly in development.
- [Velox README](https://github.com/ezzy1630/Velox): visible research tabs, cited output, demo/alpha scope.
- [MathPilot README](https://github.com/ezzy1630/MathPilot): diagnostic/practice/review workflow, local symbolic checks, optional coaching.
- [CoOps README](https://github.com/ezzy1630/CoOps): department handoffs, permissions, human approvals, receipts.


No deployment or public production verification was performed. The pre-existing untracked `AGENTS.md` is excluded from the design commit.
