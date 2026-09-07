import bpy, sys
from pathlib import Path

args = sys.argv[sys.argv.index("--") + 1 :]
src, out, water = args
out = Path(out)
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=src)
s = bpy.context.scene
water_image = bpy.data.images.load(water)
water_image.pack()
mat = bpy.data.materials["Optical clear cast glass"]
n = mat.node_tree.nodes
bs = n.get("Principled BSDF")
for link in list(mat.node_tree.links):
    if link.to_socket == bs.inputs["Normal"]:
        mat.node_tree.links.remove(link)
bs.inputs["Roughness"].default_value = 0.012
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    t = next((n for n in m.node_tree.nodes if n.type == "TEX_IMAGE"), None)
    e = next((n for n in m.node_tree.nodes if n.type == "EMISSION"), None)
    if t and e:
        t.image = water_image
        m.node_tree.links.new(t.outputs[0], e.inputs[0])
        e.inputs["Strength"].default_value = 1.15
s.view_settings.look = "AgX - Medium High Contrast"
s.cycles.samples = 32
s.render.resolution_percentage = 65
s.render.filepath = str(out / "clean.png")
bpy.ops.wm.save_as_mainfile(filepath=str(out / "clean.blend"))
