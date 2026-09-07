import bpy, json, numpy as np, sys
from pathlib import Path

src, destination = sys.argv[sys.argv.index("--") + 1 :]
out = Path(destination)
bpy.ops.wm.open_mainfile(filepath=src)
seen = set()
for o in bpy.context.scene.objects:
    if o.type != "MESH" or not o.name.startswith("line") or o.data.name in seen:
        continue
    seen.add(o.data.name)
    o.data.calc_loop_triangles()
    np.savez(
        out / (o.name.split("_")[1] + ".npz"),
        vertices=np.array([v.co[:] for v in o.data.vertices]),
        faces=np.array([t.vertices[:] for t in o.data.loop_triangles]),
    )
