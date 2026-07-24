# Ezzy Rappeport - Portfolio

The source for [ezzyrappeport.com](https://ezzyrappeport.com): a personal portfolio for Ezzy Rappeport, a software engineer, AI systems builder, and founder.

The site pairs an editorial portfolio with an interactive liquid surface. It is built to make the work legible first, then add motion and depth when the device can support it.

## What is included

- A responsive landing page covering the portfolio, about, and contact sections.
- Seven project case studies with dedicated, statically generated routes, including MonkeyClaw, Velox, FlowE, NexaRad, and Etch.
- Project-specific media, verified links, capability details, and clear demo/research boundaries where appropriate.
- A custom WebGL2 fluid renderer with a water-material hero title, pointer ripples, and scroll response.
- A poster/CSS fallback when WebGL2 is unavailable, plus a static mode for reduced motion and data-saving contexts.
- Adaptive rendering quality based on input type, device memory, connection preferences, and frame timing.

## Stack

- [Next.js 15](https://nextjs.org/) with React 19 and TypeScript
- Three.js r180 with a custom WebGL2 render graph, thickness/refraction shaders, and a GPU fluid simulation
- CSS-first responsive design with self-hosted `next/font/local` (General Sans + Geist Mono)
- ESLint and TypeScript for static checks
- Package manager: **npm** only (`package-lock.json`; see `packageManager` in `package.json`)

## Local development

### Requirements

- Node.js 18.18 or later
- npm 11.x (bundled with recent Node.js; matches `packageManager`)

### Run the site

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Generate fluid-image assets

The generated background assets are committed, so this is only needed when regenerating them:

```bash
npm run assets:fluid
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run build` | Create an optimized production build. |
| `npm run start` | Serve a production build. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run assets:fluid` | Regenerate the liquid-background assets. |
| `npm run test:portfolio` | Node contract suite for water physics, bands, and content. |
| `npm run capture:master` | Capture desktop/mobile baselines (server on :3000). |
| `npm run resume:pdf` | Print `/resume` to `public/resume.pdf`. |

Probe scripts under `scripts/probe-*.mjs` share `scripts/lib/chrome.mjs` (puppeteer-core + `CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH`).

## QA loop

After visual or renderer changes:

1. `npm run typecheck && npm run lint && npm run test:portfolio`
2. `npm run capture:master` against a running `npm run dev` (or `next start`) on port 3000
3. Confirm console stays clean and canvas `frameMsP95` stays ≤ 17ms on idle captures

Depth bands (`data-depth-band`) and `--world-depth` share one threshold story across DOM styling and the WebGL world.

The liquid treatment is decorative; the portfolio content, heading structure, navigation, project routes, and contact paths remain usable without it. The renderer selects a lower-cost or static profile for coarse pointers, `prefers-reduced-motion`, `Save-Data`, and constrained devices. If WebGL2 initialization fails, the page retains its poster treatment instead of blocking the content.

The index is one measured water journey: section geometry maps the hero, Projects, About, and Contact ranges to a monotonic reversible depth curve. Case-study routes use the same renderer at a shallow mooring and add route-scoped wakes and arrival presses. Deep Contact adds procedural god rays, two quality-gated marine-snow layers, floor caustics, and a restrained slab rim. Reduced motion freezes one composed frame; poster/CSS fallbacks preserve essential content.

The source asset workflow is `public/assets/hero/ezzy-rappeport-glyphs.glb` plus its manifest and the generated optical water plates. Regenerate only through the documented asset scripts, then run the full validation suite, including `npm run test:portfolio`.

## Project structure

```text
src/
  app/                 # Next.js App Router pages, metadata, sitemap, robots
  components/portfolio # Owned UI: nav, sections, case chrome, adapters
  features/kinetic-canvas # WebGL water renderer (owned separately)
  hooks/portfolio
  lib/portfolio        # Motion policy, liquid bus, world state, sound
public/                # Static assets, self-hosted fonts, project media
scripts/               # Regression tests, capture/probe helpers
```
