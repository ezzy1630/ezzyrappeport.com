import bpy, sys
from pathlib import Path

out = Path(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.open_mainfile(filepath=str(out / "last-optics.blend"))
s = bpy.context.scene
m = bpy.data.materials["Optical clear cast glass"]
n = m.node_tree.nodes
l = m.node_tree.links
g = next(x for x in n if x.type == "BSDF_GLASS")
tr = n.new("ShaderNodeBsdfTransparent")
f = n.new("ShaderNodeFresnel")
f.inputs["IOR"].default_value = 1.46
mul = n.new("ShaderNodeMath")
mul.operation = "MULTIPLY_ADD"
mul.inputs[1].default_value = 0.65
mul.inputs[2].default_value = 0.35
mix = n.new("ShaderNodeMixShader")
l.new(f.outputs[0], mul.inputs[0])
l.new(mul.outputs[0], mix.inputs[0])
l.new(tr.outputs[0], mix.inputs[1])
l.new(g.outputs[0], mix.inputs[2])
l.new(mix.outputs[0], n.get("Material Output").inputs["Surface"])
s.render.filepath = str(out / "fresnel-poster.png")
bpy.ops.wm.save_as_mainfile(filepath=str(out / "fresnel-poster.blend"))
