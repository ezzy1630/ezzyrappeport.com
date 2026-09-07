import bpy, sys
from pathlib import Path

out = Path(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.open_mainfile(filepath=str(out / "round.blend"))
s = bpy.context.scene
m = bpy.data.materials["Optical clear cast glass"]
n = m.node_tree.nodes
g = n.new("ShaderNodeBsdfGlass")
g.inputs["Color"].default_value = (1, 1, 1, 1)
g.inputs["IOR"].default_value = 1.46
g.inputs["Roughness"].default_value = 0.012
m.node_tree.links.new(g.outputs[0], n.get("Material Output").inputs["Surface"])
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    texture = next(
        (node for node in m.node_tree.nodes if node.type == "TEX_IMAGE"), None
    )
    emission = next(
        (node for node in m.node_tree.nodes if node.type == "EMISSION"), None
    )
    if texture and emission:
        ramp = m.node_tree.nodes.new("ShaderNodeValToRGB")
        m.node_tree.links.new(texture.outputs[0], ramp.inputs[0])
        m.node_tree.links.new(ramp.outputs[0], emission.inputs[0])
    for n in m.node_tree.nodes:
        if n.type == "EMISSION":
            n.inputs["Strength"].default_value = 1.0
        if n.type == "TEX_IMAGE":
            n.extension = "REPEAT"
        if n.type == "MAPPING":
            n.inputs["Scale"].default_value = (8, 12, 1)
            n.inputs["Location"].default_value = (-3.5, -5.5, 0)
        if n.type == "VALTORGB":
            n.color_ramp.elements[0].position = 0.5
            n.color_ramp.elements[0].color = (0.035, 0.11, 0.25, 1)
            n.color_ramp.elements[1].position = 0.95
            n.color_ramp.elements[1].color = (1.1, 1.2, 1.4, 1)
s.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = 1.1
s.render.filepath = str(out / "last-optics.png")
bpy.ops.wm.save_as_mainfile(filepath=str(out / "last-optics.blend"))
