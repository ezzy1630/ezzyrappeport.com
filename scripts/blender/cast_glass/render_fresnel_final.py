import bpy, sys
from pathlib import Path

out = Path(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.open_mainfile(filepath=str(out / "fresnel-poster.blend"))
s = bpy.context.scene
s.render.resolution_percentage = 100
s.cycles.samples = 192
s.render.filepath = str(out / "fresnel-title-final.png")
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out / "fresnel-poster.blend"))
