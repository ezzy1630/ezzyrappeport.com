import bpy, json, sys, numpy as np
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1 :]
src, out = args
out = Path(out)
bpy.ops.wm.open_mainfile(filepath=src)
s = bpy.context.scene
objects = sorted(
    [o for o in s.objects if o.type == "MESH" and o.name.startswith("line")],
    key=lambda o: int(o.name[-2:]),
)
points = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
lo = Vector([min(p[i] for p in points) for i in range(3)])
hi = Vector([max(p[i] for p in points) for i in range(3)])
manifest = {
    "coordinateSystem": "right-handed Y-up, frontal XY plane, positive Z toward camera",
    "dimensions": list(hi - lo),
    "bounds": {"min": list(lo), "max": list(hi)},
    "glyphs": [],
}
for o in objects:
    o.data.calc_loop_triangles()
    manifest["glyphs"].append(
        {
            "name": o.name,
            "character": o.name.split("_")[1],
            "position": list(o.location),
            "scale": list(o.scale),
            "dimensions": list(o.dimensions),
            "triangles": len(o.data.loop_triangles),
            "pivot": "projected-area centroid, mid-depth",
        }
    )
manifest["triangles"] = sum(g["triangles"] for g in manifest["glyphs"])
(out / "playground-glyphs.json").write_text(json.dumps(manifest, indent=2) + "\n")
bpy.ops.object.select_all(action="DESELECT")
for o in objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(out / "playground-glyphs.glb"),
    export_format="GLB",
    use_selection=True,
    export_yup=False,
    export_apply=True,
    export_normals=True,
    export_texcoords=False,
    export_materials="NONE",
    export_cameras=False,
    export_lights=False,
)
s.render.resolution_percentage = 100
s.cycles.samples = 96
s.render.filepath = str(out / "playground-title.png")
bpy.ops.wm.save_as_mainfile(filepath=str(out / "polished-glyphs.blend"))
print(
    json.dumps(
        {
            "glyphs": len(objects),
            "unique_meshes": len(set(o.data.name for o in objects)),
            "triangles": manifest["triangles"],
            "glb_bytes": (out / "playground-glyphs.glb").stat().st_size,
        }
    )
)
