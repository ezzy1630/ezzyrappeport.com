# Ezzy Rappeport — portfolio

Next.js 15, React 19, TypeScript, Three.js. Source for [ezzyrappeport.com](https://ezzyrappeport.com).

## Develop

```sh
npm ci
npm run dev
```

`npm run dev` runs Next normally and also accepts the supervised preview's `--host`, `--port`, and `--strictPort` flags through a small adapter. Existing production hosting remains unchanged.

## Current experience

The current experience is documented in [the living-water review](docs/qa/2026-09-07-living-water.md).

A continuous procedural water scene sits behind the homepage and case studies. The homepage descends into softer blue light through four alternating project stages, then returns to brighter water at contact. Smaller hero lettering and a brief opening light transition leave more breathing room; reduced motion removes the entrance animations. Sunlight refracts through a moving heightfield onto a mineral floor, producing additive caustics, depth absorption, and Fresnel reflections. The live renderer uses no water photograph. Thirteen glass letters respond to buoyancy, mass-dependent springs, contact impulses, keyboard input, and sampled throw velocity. Their exposed faces render directly; submerged surfaces refract with a moving wet edge. Releases create a brief bob and an expanding ripple. Pointer strokes, clicks, scrolling, and moving project panels disturb the same water field.

`src/components/playground/Portfolio.tsx` and `src/app/project/[slug]/ProjectDetail.tsx` use `src/components/water-study/WaterHero.tsx`. It loads `scene.ts`, `optics.ts`, and `environment.ts`; case studies omit the title geometry. The solver lives in `src/components/playground/water-field.ts`. `journey.ts` maps document landmarks to atmospheric depth and project emphasis. `interaction.ts` handles continuous wakes and gesture momentum; `world-motion.ts` couples DOM panels to the scene clock. The retained glass-scene, kinetic-canvas, and ocean-experience implementations are historical renderers.

The renderer targets 60 presentations per second for both interaction and ambient water, using fractional deadlines across display refresh rates. It stops in hidden tabs. A shared half-float surface cache avoids repeated wave evaluation; internal glass transmission renders at half resolution, and the final fullscreen context avoids redundant MSAA. The drawing buffer remains capped at 3.2 million pixels and DPR 2. Adaptive quality primarily reduces internal transmission and caustic resolution; its effect on main output is limited to 5.25% per axis and never drops below CSS pixel density unless required by the global pixel cap. These are budgets, not measured guarantees. Glass passes stop when the title leaves the viewport; water continues behind the document.

Scene settings provide pause, reset, ripple, and touch-play controls. Normal touch scrolling is the default. Project copy sits directly in the scene with lighter image framing. Media tilts separately from flat reading text. Desktop project stages respond quickly to dragging, resist long pulls, emit a brief wake on release, and settle without persistent 3D text transforms; ordinary clicks still open their destinations. Focus the title scene and use arrow keys to move a letter, with `[` and `]` selecting another letter. Reduced motion renders a resting frame. Save-Data, initialization failure, and context loss retain the homepage poster or the case page's readable static background. Content and navigation remain server-rendered.

## Validate

```sh
npm run typecheck
npm run lint
npm run test:playground
npm run test:water
npm run build
```

With a production server running, `python3 scripts/check-portfolio-server.py http://127.0.0.1:3000` checks page headings, anchors, routes, images, scripts, and downloads. This is HTTP evidence, not browser verification.

`npm run test:portfolio` still fails its pre-existing em-dash assertion against `src/lib/portfolio/content.ts:766`; the same text exists in HEAD. The separate retained-renderer runtime audit passes. Current visual and interaction evidence is in [the living-water review](docs/qa/2026-09-07-living-water.md). No deployment or physical-phone verification is implied.

## Blender asset workflow

Blender 4.5 LTS runs through its background CLI; no MCP server is needed. The current glyphs reconstruct the existing silhouettes with continuous rounded caps and counter walls, preserving all 13 rest transforms and exact bounds. Eight meshes share 62,400 visible triangles. Export validation checks closed surfaces, positive signed volume, outward normals, byte size and layout.

Install the geometry preparation dependencies in a Python environment:

```sh
python3 -m pip install numpy scipy pillow scikit-image
python3 scripts/blender/cast_glass/rebuild.py --blender /path/to/blender --source assets/blender/playground/optical-source.blend --output /tmp/portfolio-cast-glass --water public/assets/water/shallow-desktop-v1.webp --baseline assets/blender/playground/optical-source.json
```

The pipeline extracts the source silhouettes, reconstructs and simplifies the curved surfaces, fixes outward normals, exports and validates the GLB, and renders one final 1600×780 poster at 192 Cycles samples. Intermediate geometry stays in the chosen output directory. The source scene is preserved; the selected final scene is `assets/blender/playground/polished-glyphs.blend`.

Copy output `playground-glyphs.glb` and `playground-glyphs.json` into `public/assets/hero/`. Preserve the Blender scenes and `silver-studio.hdr` as editable source assets. The browser now builds its studio reflections procedurally; it does not download that HDR.

### Matching browser posters

Open `/?capture=1` in a WebGL browser. At a 1440×810 desktop viewport, open **Scene settings**, pause, reset, and capture the scene. Repeat at 390×844 for mobile and 768×1024 for tablet. Use DPR 2 for sharp loading images. Download all three PNGs, then run:

```sh
node scripts/encode-water-hero-posters.mjs /absolute/path/to/desktop.png /absolute/path/to/mobile.png /absolute/path/to/tablet.png
npm run test:water
```

The encoder preserves the captured resolution, writes desktop/mobile/tablet WebPs, and records source hashes in `public/assets/hero/water-hero-poster.json`. The optical tests reject stale posters after shader, scene, geometry, or simulation changes. `?capture=1` also exposes timing data in the canvas `data-hero-diagnostics` attribute. Ordinary visits do not collect those samples.

The retained `public/assets/hero/reference-water-v1.webp` belongs to the earlier photographic iteration and is not loaded by the live renderer.

## Local browser review

See [the living-water review](docs/qa/2026-09-07-living-water.md) for the current result. Earlier reviews describe historical iterations. `/water-study` now presents the same portfolio as `/` so the existing preview URL shows the integrated result; it remains noindex.
