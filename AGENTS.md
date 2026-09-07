# Working in this portfolio

## Execution

- Make routine decisions and finish authorized work through relevant verification. Ask only when missing information would materially change the result and cannot be inferred. Audits and plans are read-only unless implementation is requested.
- Inspect the branch and relevant diffs before editing. Preserve unrelated work, including untracked assets. Use the current checkout for ordinary local work; isolate when changes would overlap another task.
- Commit, push, PR, merge, publication, deployment, and domain/hosting changes need authorization for that action. Reuse authorization already given.
- Use parallel agents for independent investigations when breadth warrants it. Parallel writers need separate worktrees and explicit ownership; review and validate the integrated result.
- Keep updates and final reports concise: result, verification, and remaining limits. Avoid narrating routine tool calls.

## Find the current implementation

- This is a Next.js App Router portfolio using React, TypeScript, and Three.js. Use `package.json`, the lockfile, and source for current tools and behavior. Read `README.md` for asset workflows; historical design/QA reports describe snapshots, not current blockers or release proof.
- Home: `src/app/page.tsx` → `src/components/playground/Portfolio.tsx`. Its styles live in `src/components/playground/Portfolio.module.css`; inspect `src/app/layout.tsx` for global styles and metadata.
- Content: `src/lib/portfolio/content.ts` owns existing case-study facts and bio; `src/components/playground/catalog.ts` adds gallery projects and presentation.
- Water scene: `src/components/water-study/WaterHero.tsx` loads `scene.ts`; `world-motion.ts` owns artwork motion, and the shared spring/contact/pressure-field primitives live in `src/components/playground/`.
- Case studies: `src/app/project/[slug]/page.tsx`, `ProjectDetail.tsx`, and `CaseStudy.module.css`. Resume: `src/app/resume/`.
- Hero assets: `public/assets/hero/`; editable Blender sources: `assets/blender/playground/`; generation tools: `scripts/blender/`. Preserve source scenes and keep intermediate renders outside the repo.
- Older renderers remain in `src/components/playground/GlassHero.tsx`, `glass-scene.ts`, `src/features/kinetic-canvas/`, and `src/features/ocean-experience/`. Verify actual imports before changing them or treating historical capture scripts as homepage checks.

## Preserve the experience

- Keep project content, navigation, and the hero poster usable before JavaScript/WebGL. The live scene is progressive enhancement; preserve reduced-motion, Save-Data, initialization-failure, and context-loss fallbacks.
- Preserve normal document scrolling, touch scroll/play modes, keyboard controls, and visible focus. Home and case studies share the water background; only home initializes glass lettering. The résumé stays static. Keep project text selectable and stable, with dragging limited to artwork.
- Preserve pause/reset behavior, offscreen and hidden-tab suspension, bounded simulation steps, and disposal of GPU resources/listeners. Measure runtime performance before claiming frame rates or increasing rendering budgets.
- Keep poster and live geometry/framing aligned. Check the transition visually after asset or camera changes; physics tests cannot prove lighting parity.
- Ground portfolio claims in project evidence. Distinguish real product captures from artwork and identity assets; do not invent metrics, roles, testimonials, or shipped capabilities.

## Verify only what the change needs

Commands run from the repo root. Install locked dependencies with `npm ci` when needed; `npm run dev` starts the local preview. Verify the running server belongs to this checkout before using it as evidence.

| Changed area | Checks |
| --- | --- |
| TypeScript / React / styles | `npm run typecheck` and `npm run lint`; `npm run build` for route, rendering, dependency, or production-output changes. |
| Water / hero physics / assets | `npm run test:water` and `npm run test:playground`, plus live browser checks for rendering and interaction changes. |
| Shared portfolio / retained renderers | `npm run test:portfolio`; inspect failures against the starting state rather than assuming an old documented failure still applies. |
| Routes / links / downloads | With a production server running, `python3 scripts/check-portfolio-server.py http://127.0.0.1:3000` (substitute its actual origin). This checks HTTP content/assets, not browser behavior. |
| Documentation only | Check content, referenced paths/commands, and `git diff --check`; no application build needed. |

- For visible changes, inspect affected desktop/mobile layouts and interactions in the intended running artifact. Hero changes also need a WebGL-capable browser: cold load, poster transition, drag/release, pause/reset, scrolling, and relevant fallback/lifecycle states.
- Add tests for meaningful behavior or regressions, not assertions that merely match source spelling. Expand checks only for failures, new changes, or unresolved risks.
- Preserve failed-run logs and exit status. Review the task-owned diff before finishing; distinguish local checks, browser evidence, preview deployment, and public production behavior. Report unavailable checks without treating them as passed.
