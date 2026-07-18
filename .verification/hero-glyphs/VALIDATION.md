# Hero title glyph validation

- Blender: 5.1.2
- Font: `/Volumes/Neural/EzzyRappeport.com/assets/blender/hero-title/fonts/InterTight-Black-900.ttf` (Inter Tight weight 900 static instance)
- Source: Google Fonts `ofl/intertight/InterTight[wght].ttf`
- License: SIL Open Font License 1.1; vendored beside the font as `OFL.txt`
- Production nodes: 13
- Unique mesh datablocks: 8
- Visible triangle total: 38,480
- Unique/shared triangle payload: 23,944
- GLB size: 439,564 bytes
- Reimported nodes: 13
- Reimport name match: True
- Reimport bounds match: True

## Modeling choices

Exact Inter Tight 900 outlines with a -0.025 em source inset; 0.050 em core extrusion, 0.045 em shoulder, 8 bevel segments, a 0.0035 em watertight reconciliation, a 0.022 em countered-glyph dome, and a 0.008 em simple-glyph dome over a 0.110 em run. The result keeps the face center calm while rolling both front and back into continuous sidewalls. Internal counter walls use the same curve profile as outer contours.

A, P, R, O, and Y use fine voxel reconciliation at cap junctions. A receives a 0.002 em local outward separation after decimation to keep its triangular counter and crossbar strictly non-self-intersecting.

Origins are projected-area centroids at mid-depth, calculated from front-facing mesh triangles after counter subtraction. Repeated E, Z, P, and R nodes reference shared mesh data but retain independent objects.

## Topology

- A: 5,000 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- E: 1,388 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- O: 4,500 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- P: 4,000 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- R: 4,000 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- T: 908 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- Y: 3,000 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- Z: 1,148 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0

## Validation renders

`01_full-title.png`, `02_front-orthographic.png`, `03_three-quarter.png`, `04_side-angle.png`, `05_close-E.png` through `09_close-O.png`, `10_neutral-clay.png`, `11_clear-glass-acrylic.png`, and `12_reimport-front.png`.

## Validation commands

`/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python scripts/blender/build_hero_glyphs.py -- --font /Volumes/Neural/EzzyRappeport.com/assets/blender/hero-title/fonts/InterTight-Black-900.ttf --output /Volumes/Neural/EzzyRappeport.com`

`npm install --prefix /tmp/codex-gltf-validator gltf-validator@2.0.0-dev.3.10 --no-save` followed by the package `validateBytes` API against `public/assets/hero/ezzy-rappeport-glyphs.glb`; record the machine-readable result as `gltf-validator.json`.

- Khronos glTF Validator 2.0.0-dev.3.10: 0 errors, 0 warnings, 0 infos, 0 hints.

## Known compromises

The clear material is a Blender Cycles preview only; the GLB intentionally exports no material because the portfolio will supply a custom runtime transmission shader. Optical absorption and caustics must be revalidated during renderer integration.
