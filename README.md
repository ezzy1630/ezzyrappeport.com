# Eliezer Rappeport — Portfolio

The source for [eliezerrappeport.com](https://eliezerrappeport.com): a personal portfolio for Eliezer Rappeport, an engineer, AI builder, and founder.

The site pairs an editorial portfolio with an interactive liquid surface. It is built to make the work legible first, then add motion and depth when the device can support it.

## What is included

- A responsive landing page covering the portfolio, experience, about, location, and contact sections.
- Five project case studies with dedicated, statically generated routes: MonkeyClaw, Velox, FlowE, NexaRad, and Etch.
- Project-specific media, verified links, capability details, and clear demo/research boundaries where appropriate.
- A custom WebGL2 fluid renderer with a water-material hero title, pointer ripples, scroll response, and liquid-glass cards.
- A poster/CSS fallback when WebGL2 is unavailable, plus a static mode for reduced motion and data-saving contexts.
- Adaptive rendering quality based on input type, device memory, connection preferences, and frame timing.

## Stack

- [Next.js 15](https://nextjs.org/) with React 19 and TypeScript
- Custom WebGL2 shaders and fluid simulation (no 3D rendering dependency)
- CSS-first responsive design with `next/font`
- ESLint and TypeScript for static checks

## Local development

### Requirements

- Node.js 18.18 or later
- npm (bundled with Node.js)

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

## Rendering and accessibility

The liquid treatment is decorative; the portfolio content, heading structure, navigation, project routes, and contact paths remain usable without it. The renderer selects a lower-cost or static profile for coarse pointers, `prefers-reduced-motion`, `Save-Data`, and constrained devices. If WebGL2 initialization fails, the page retains its poster treatment instead of blocking the content.

## Project structure

```text
src/
  app/                         Next.js routes, metadata, and global styles
  components/portfolio/        Portfolio sections and reusable interface pieces
  features/kinetic-canvas/     WebGL2 renderer, shaders, fluid passes, quality profiles
  lib/portfolio/               Portfolio content and shared liquid interaction state
public/
  assets/                      Generated liquid fallback assets
  projects/                    Case-study imagery and diagrams
scripts/
  build-fluid-assets.mjs       Fluid-image asset generator
```

## Validation

Before publishing changes, run:

```bash
npm run lint
npm run typecheck
npm run build
```

## License

All rights reserved. The portfolio content and visual assets may not be reused without permission.
