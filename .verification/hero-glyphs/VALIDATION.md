# Hero title glyph validation

- Blender: 5.1.2
- Font: `/Volumes/Neural/EzzyRappeport.com/assets/blender/hero-title/fonts/InterTight-Black-900.ttf` (Inter Tight weight 900 static instance)
- Source: Google Fonts `ofl/intertight/InterTight[wght].ttf`
- License: SIL Open Font License 1.1; vendored beside the font as `OFL.txt`
- Production nodes: 13
- Unique mesh datablocks: 8
- Visible triangle total: 55,100
- Unique/shared triangle payload: 34,100
- GLB size: 622,448 bytes
- Reimported nodes: 13
- Reimport name match: True
- Reimport bounds match: True

## Modeling choices

Exact Inter Tight 900 outlines with a -0.046 em source inset; 0.070 em core extrusion, 0.068 em shoulder, 14 shoulder segments, a 0.035 em planar contour bevel with 8 segments (except A), a 0.0024 em watertight reconciliation, a 0.054 em face dome over a 0.215 em run. The result keeps the face center calm while rolling both front and back into continuous sidewalls. Internal counter walls use the same curve profile as outer contours.

E, Z, Y, and T use custom rounded-bar constructions at the original Inter Tight bounds, producing true XY corner radii rather than relying on depth bevels. A is a custom three-bar rounded solid in Inter Tight proportions. R, P, and O use fine voxel reconciliation of the font silhouette. Every custom glyph is voxel-unioned before relaxation and remains clean and watertight.

Origins are projected-area centroids at mid-depth, calculated from front-facing mesh triangles after counter subtraction. Repeated E, Z, P, and R nodes reference shared mesh data but retain independent objects.

## Topology

- A: 6,000 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- E: 3,200 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- O: 5,500 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- P: 5,000 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- R: 5,000 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- T: 2,800 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- Y: 3,800 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0
- Z: 2,800 tris; watertight=True; non-manifold=0; loose verts=0; loose edges=0; zero-area faces=0; self-intersections=0

## Validation renders

`01_full-title.png`, `02_front-orthographic.png`, `03_three-quarter.png`, `04_side-angle.png`, `05_close-E.png` through `09_close-O.png`, `10_neutral-clay.png`, `11_clear-glass-acrylic.png`, and `12_reimport-front.png`.

## Validation commands

`/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python scripts/blender/build_hero_glyphs.py -- --font /Volumes/Neural/EzzyRappeport.com/assets/blender/hero-title/fonts/InterTight-Black-900.ttf --output /Volumes/Neural/EzzyRappeport.com`

`npm install --prefix /tmp/codex-gltf-validator gltf-validator@2.0.0-dev.3.10 --no-save` followed by the package `validateBytes` API against `public/assets/hero/ezzy-rappeport-glyphs.glb`; record the machine-readable result as `gltf-validator.json`.

## Known compromises

The clear material is a Blender Cycles preview only; the GLB intentionally exports no material because the portfolio will supply a custom runtime transmission shader. Optical absorption and caustics must be revalidated during renderer integration.
