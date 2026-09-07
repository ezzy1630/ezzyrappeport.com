import bpy, numpy as np, bmesh, sys
from pathlib import Path
from mathutils import Vector

out = Path(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.open_mainfile(filepath=str(out / "clean.blend"))
s = bpy.context.scene
objects = [o for o in s.objects if o.type == "MESH" and o.name.startswith("line")]
seen = {}
for o in objects:
    char = o.name.split("_")[1]
    if char in seen:
        o.data = seen[char]
        continue
    p = np.load(out / (char + "-round.npz"))
    mesh = bpy.data.meshes.new("Smooth cast " + char)
    mesh.from_pydata(p["vertices"].tolist(), [], p["faces"].tolist())
    mesh.update()
    o.data = mesh
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new("Continuous casting", "SMOOTH")
    mod.factor = 0.45
    mod.iterations = 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = o.modifiers.new("Optical contour budget", "DECIMATE")
    mod.ratio = 4800 / len(mesh.polygons)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    v = np.array([v.co[:] for v in o.data.vertices])
    lo = v.min(0)
    hi = v.max(0)
    for vert in o.data.vertices:
        vert.co = Vector(
            p["lo"] + (np.array(vert.co[:]) - lo) * (p["hi"] - p["lo"]) / (hi - lo)
        )
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    assert bm.calc_volume(signed=True) > 0
    assert all(e.is_manifold for e in bm.edges)
    bm.to_mesh(o.data)
    bm.free()
    for face in o.data.polygons:
        face.use_smooth = True
    o.data.update()
    # Preserve the true normal at tiny acute concave creases instead of interpolating through the solid.
    for face in o.data.polygons:
        average = sum(
            (o.data.vertices[i].normal for i in face.vertices), start=face.normal * 0
        ) / len(face.vertices)
        if average.dot(face.normal) <= 0:
            face.use_smooth = False
    o.data.materials.append(bpy.data.materials["Optical clear cast glass"])
    seen[char] = o.data
s.render.filepath = str(out / "round.png")
s.cycles.samples = 40
bpy.ops.wm.save_as_mainfile(filepath=str(out / "round.blend"))
