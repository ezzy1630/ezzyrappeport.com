"""After render_playground_posters.py: blender -b --python render_refracted_title.py -- output_dir"""
import bpy,sys,json
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1]);bpy.ops.wm.open_mainfile(filepath=str(out/'playground-posters.blend'));scene=bpy.context.scene
manifest=json.loads((out/'ezzy-rappeport.json').read_text())
for item in manifest['glyphs']:bpy.data.objects[item['name']].location=item['position']
plane=bpy.data.objects['Water poster background'];plane.visible_camera=False;plane.visible_glossy=False
bsdf=bpy.data.materials['Clear cast glass'].node_tree.nodes.get('Principled BSDF');bsdf.inputs['IOR'].default_value=1.5;bsdf.inputs['Metallic'].default_value=.26;bsdf.inputs['Base Color'].default_value=(.72,.85,1,1)
ramp=next(n for n in scene.world.node_tree.nodes if n.type=='VALTORGB');ramp.color_ramp.elements[0].position=.48;ramp.color_ramp.elements[0].color=(.008,.022,.06,1);ramp.color_ramp.elements[1].position=.58
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.7
image=next(n.image for n in plane.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE');aspect=image.size[0]/image.size[1]
coverwidth=max(5.1,5.1*780/1600*aspect);plane.scale=(coverwidth/2,coverwidth/aspect/2,1)
scene.camera.data.ortho_scale=5.1;scene.render.resolution_x=1600;scene.render.resolution_y=780;scene.render.film_transparent=True
scene.cycles.samples=32
scene.render.filepath=str(out/'glass-title-refracted.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'refracted-title.blend'))
