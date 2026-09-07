"""Normalize existing authored title for Three.js. Blender 4.5+.
blender -b --python prepare_glyphs.py -- /path/to/original.blend /output/directory
Preserves proven rounded cast geometry and independently centered origins.
"""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]); out=Path(args[1]); out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
objects=sorted([o for o in scene.objects if o.type=='MESH' and o.name.startswith('line')],key=lambda o:int(o.name[-2:]))
# Match cap heights: custom rounded bars have different raw font extents.
for line in ('line2','line1'):
    row=[o for o in objects if o.name.startswith(line)]
    cap=next(o.dimensions.y for o in row if '_E_' in o.name)
    for o in row:o.scale.y*=cap/o.dimensions.y
bpy.context.view_layer.update()
# Optical baseline alignment: centroid origins must not make Y/T hang below peers.
for line in ('line2', 'line1'):
    row=[o for o in objects if o.name.startswith(line)]
    baseline=0 if line=='line2' else max(o.dimensions.y for o in objects if o.name.startswith('line2'))+0.105
    for o in row:
        bottom=min(v.co.y for v in o.data.vertices)*o.scale.y
        o.location.y=baseline-bottom
bpy.context.view_layer.update()
points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
lo=Vector([min(v[i] for v in points) for i in range(3)]); hi=Vector([max(v[i] for v in points) for i in range(3)])
center=(lo+hi)/2
for o in objects: o.location-=center; o.hide_render=False; o.hide_set(False)
bpy.context.view_layer.update()
manifest={'coordinateSystem':'right-handed Y-up, frontal XY plane, positive Z toward camera','dimensions':list(hi-lo),'bounds':{'min':list((lo-hi)/2),'max':list((hi-lo)/2)},'glyphs':[]}
for o in objects:
    o.data.calc_loop_triangles()
    manifest['glyphs'].append({'name':o.name,'character':o.get('character',o.name.split('_')[1]),'position':list(o.location),'scale':list(o.scale),'dimensions':list(o.dimensions),'triangles':len(o.data.loop_triangles),'pivot':'projected-area centroid, mid-depth'})
manifest['triangles']=sum(g['triangles'] for g in manifest['glyphs'])
# glTF uses the same desired XY coordinates: intentionally disable Blender Z-up conversion.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'ezzy-rappeport.glb'),export_format='GLB',use_selection=True,export_yup=False,export_apply=True,export_normals=True,export_texcoords=False,export_materials='NONE',export_extras=False,export_cameras=False,export_lights=False)
(out/'ezzy-rappeport.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Clear optical glass, with broad reflective studio strips in the world.
mat=bpy.data.materials.new('Clear cast glass'); mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=(0.95,0.98,1,1)
bsdf.inputs['Roughness'].default_value=0.025
bsdf.inputs['IOR'].default_value=1.46
bsdf.inputs['Transmission Weight'].default_value=1
for o in objects:o.data.materials.clear(); o.data.materials.append(mat)
world=bpy.data.worlds.new('Silver blue studio'); scene.world=world; world.use_nodes=True
nodes=world.node_tree.nodes; links=world.node_tree.links
bg=nodes.get('Background'); bg.inputs['Strength'].default_value=0.8
tex=nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=2.8; tex.inputs['Detail'].default_value=2
coord=nodes.new('ShaderNodeTexCoord'); links.new(coord.outputs['Normal'],tex.inputs['Vector'])
ramp=nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position=0.35; ramp.color_ramp.elements[0].color=(0.10,0.16,0.25,1); ramp.color_ramp.elements[1].position=0.62; ramp.color_ramp.elements[1].color=(1,1,1,1)
links.new(tex.outputs['Fac'],ramp.inputs[0]); links.new(ramp.outputs[0],bg.inputs['Color'])
for o in list(scene.objects):
    if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
for loc,power,size in [((-2,3,4),400,4),((4,1,2),300,3),((0,-3,3),300,2)]:
    d=bpy.data.lights.new('Studio softbox','AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=.6
    ob=bpy.data.objects.new('Studio softbox',d);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(-ob.location).to_track_quat('-Z','Y').to_euler()
cam=scene.camera;cam.location=(0,0,8);cam.rotation_euler=(0,0,0);cam.data.type='ORTHO';cam.data.ortho_scale=(hi.x-lo.x)*1.12
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.cycles.max_bounces=10;scene.cycles.transmission_bounces=8
scene.render.resolution_x=1600;scene.render.resolution_y=780;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'ezzy-rappeport.blend'))
scene.render.filepath=str(out/'glass-title-transparent.png');bpy.ops.render.render(write_still=True)
scene.render.film_transparent=False;scene.render.filepath=str(out/'glass-title-studio.png');bpy.ops.render.render(write_still=True)
print(json.dumps(manifest))
