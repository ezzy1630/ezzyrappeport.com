"""Render full-bleed glass/water posters with Blender 4.5+.
blender -b --python render_playground_posters.py -- source.blend water.webp output_dir glyph_generator.py
Also repairs the Y's pinched bar join and reexports final geometry.
"""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
source,water,out,generator=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
objects=sorted([o for o in scene.objects if o.type=='MESH' and o.name.startswith('line')],key=lambda o:o.name)
# Raise and lengthen the original rounded stem so it genuinely overlaps both arms.
code=generator.read_text().replace('(0.0, -0.145, 0.0), (0.330, 0.155, 0.276)', '(0.0, -0.100, 0.0), (0.420, 0.155, 0.276)')
ns={'__name__':'glyph_authoring'};exec(compile(code,str(generator),'exec'),ns)
y=next(o for o in objects if '_Y_' in o.name); dimensions=y.dimensions.copy(); oldmin=min(v.co.y for v in y.data.vertices)*y.scale.y
mesh=ns['make_custom_rounded_bar_mesh']('Y');y.data=mesh
bpy.context.view_layer.update()
y.scale=Vector([dimensions[i]/max(1e-5,max(v.co[i] for v in mesh.vertices)-min(v.co[i] for v in mesh.vertices)) for i in range(3)])
y.location.y+=oldmin-min(v.co.y for v in mesh.vertices)*y.scale.y
# Generator leaves temporary object containing the returned mesh; remove it.
for o in list(scene.objects):
    if o.type=='MESH' and o not in objects:bpy.data.objects.remove(o,do_unlink=True)
mat=bpy.data.materials.get('Clear cast glass');bsdf=mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=(0.99,0.997,1,1);bsdf.inputs['Roughness'].default_value=.018;bsdf.inputs['IOR'].default_value=1.40
for o in objects:o.data.materials.clear();o.data.materials.append(mat)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'ezzy-rappeport.glb'),export_format='GLB',use_selection=True,export_yup=False,export_apply=True,export_normals=True,export_texcoords=False,export_materials='NONE',export_extras=False,export_cameras=False,export_lights=False)
# Refresh existing manifest while retaining bounding metadata.
p=out/'ezzy-rappeport.json';manifest=json.loads(p.read_text())
for item in manifest['glyphs']:
 o=next(o for o in objects if o.name==item['name']);item['position']=list(o.location);item['scale']=list(o.scale)
p.write_text(json.dumps(manifest,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'ezzy-rappeport.blend'))
# Emissive water plane produces readable refraction without noisy simulated caustics.
image=bpy.data.images.load(str(water));image.pack();aspect=image.size[0]/image.size[1]
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,-1));plane=bpy.context.object;plane.name='Water poster background'
material=bpy.data.materials.new('Luminous water');material.use_nodes=True;n=material.node_tree.nodes;n.clear();output=n.new('ShaderNodeOutputMaterial');emission=n.new('ShaderNodeEmission');tex=n.new('ShaderNodeTexImage');tex.image=image
material.node_tree.links.new(tex.outputs['Color'],emission.inputs['Color']);material.node_tree.links.new(emission.outputs[0],output.inputs[0]);plane.data.materials.append(material)
scene.render.film_transparent=False;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True;scene.cycles.transmission_bounces=10;scene.cycles.max_bounces=12
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
cam=scene.camera;cam.data.type='ORTHO';cam.location=(0,0,8);cam.rotation_euler=(0,0,0)
original={o.name:o.location.copy() for o in objects}
for name,width,height,offset in [('desktop',1672,941,.02),('mobile',390,780,.16)]:
 worldwidth=5.1;worldheight=worldwidth*height/width
 # Blender ortho scale is view width in landscape, height in portrait.
 cam.data.ortho_scale=max(worldwidth,worldheight)
 coverwidth=max(worldwidth,worldheight*aspect);plane.scale=(coverwidth/2,coverwidth/aspect/2,1)
 for o in objects:o.location=original[o.name]+Vector((0,worldheight*offset,0))
 scene.render.resolution_x=width;scene.render.resolution_y=height;scene.render.resolution_percentage=100
 scene.render.filepath=str(out/f'playground-{name}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'playground-posters.blend'))
