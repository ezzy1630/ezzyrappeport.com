"""Blender 4.5: polish shared cast glyph meshes, preserve exact local bounds, author matched HDR studio.
Usage: blender -b --python polish_hero.py -- source.blend output_directory water_image
"""
import bpy, sys, json, math, numpy as np
from pathlib import Path
from mathutils import Vector
src,out,water=sys.argv[sys.argv.index('--')+1:];out=Path(out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=src)
scene=bpy.context.scene
for font in list(bpy.data.fonts):
    if font.name != 'Bfont':bpy.data.fonts.remove(font,do_unlink=True)
objects=sorted([o for o in scene.objects if o.type=='MESH' and o.name.startswith('line')],key=lambda o:int(o.name[-2:]))
for o in list(scene.objects):
    if o not in objects and o.type!='CAMERA':bpy.data.objects.remove(o,do_unlink=True)
seen={};checks=[]
for o in objects:
    if o.data.name in seen:continue
    name=o.data.name;old=o.data
    lo=np.min([v.co[:] for v in old.vertices],axis=0);hi=np.max([v.co[:] for v in old.vertices],axis=0)
    linked=[a for a in objects if a.data==old]
    o.data=old.copy();bpy.context.view_layer.objects.active=o
    # Relax triangulation-induced cap dents before adding the final interpolation layer.
    relax=o.modifiers.new('Optical surface relaxation','SMOOTH');relax.factor=.55;relax.iterations=14 if '_R_' in o.name or '_P_' in o.name or '_O_' in o.name else 5
    bpy.ops.object.modifier_apply(modifier=relax.name)
    sub=o.modifiers.new('Continuous polished shoulders','SUBSURF');sub.levels=1;sub.subdivision_type='CATMULL_CLARK'
    bpy.ops.object.modifier_apply(modifier=sub.name)
    dec=o.modifiers.new('Curvature budget','DECIMATE');dec.ratio=.22;dec.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=dec.name)
    # Match original rest bounds exactly; collision and responsive typography retain their proportions.
    nlo=np.min([v.co[:] for v in o.data.vertices],axis=0);nhi=np.max([v.co[:] for v in o.data.vertices],axis=0)
    for v in o.data.vertices:v.co=Vector(tuple(lo+(np.array(v.co[:])-nlo)*(hi-lo)/(nhi-nlo)))
    for p in o.data.polygons:p.use_smooth=True
    for a in linked:a.data=o.data
    seen[o.data.name]=True
# Equirectangular studio radiance authored analytically: broad white strips, pale rear fill, cobalt negative fill.
w,h=1024,512
u=(np.arange(w)+.5)/w;v=(np.arange(h)+.5)/h
lon=(u*2-1)*math.pi;lat=(v-.5)*math.pi
L,B=np.meshgrid(lon,lat)
base=np.zeros((h,w,3),dtype=np.float32);base[:]=(.12,.19,.3)
# Bright rear cyclorama transmitted through the glass (Blender environment -Z rear).
base+=np.exp(-((B+1.35)/.85)**4)[...,None]*np.array((.22,.28,.4))
def strip(x,y,sx,sy,power,tint):
    dx=np.arctan2(np.sin(L-x),np.cos(L-x));q=np.exp(-((dx/sx)**8+( (B-y)/sy)**8));return q[...,None]*np.array(tint)*power
base+=strip(.25,1.15,1.5,.13,5,(1,.98,.95))
base+=strip(-1.6,.18,.13,.68,3.5,(.8,.90,1))
base+=strip(1.85,.24,.16,.65,4,(1,1,1))
base+=strip(-.25,-.6,.85,.10,2.5,(.7,.82,1))
base+=strip(3,.55,.7,.16,2,(1,1,1))
rgba=np.concatenate([base,np.ones((h,w,1),dtype=np.float32)],axis=2)
env=bpy.data.images.new('Authored silver studio 1024',width=w,height=h,float_buffer=True);env.pixels.foreach_set(rgba.ravel());env.filepath_raw=str(out/'silver-studio.hdr');env.file_format='HDR';env.save();env.pack()
world=bpy.data.worlds.new('Matched silver studio');scene.world=world;world.use_nodes=True
nodes=world.node_tree.nodes;nodes.clear();t=nodes.new('ShaderNodeTexEnvironment');t.image=env;b=nodes.new('ShaderNodeBackground');b.inputs['Strength'].default_value=.8;o=nodes.new('ShaderNodeOutputWorld');world.node_tree.links.new(t.outputs[0],b.inputs[0]);world.node_tree.links.new(b.outputs[0],o.inputs[0])
for loc,power,size in [((-2,3,4),650,4),((4,1,2),450,3),((0,-3,3),450,2)]:
    d=bpy.data.lights.new('Optical white strip','AREA');d.energy=power;d.shape='RECTANGLE';d.size=size;d.size_y=.32
    ob=bpy.data.objects.new('Optical white strip',d);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(-ob.location).to_track_quat('-Z','Y').to_euler()
mat=bpy.data.materials.new('Optical clear cast glass');mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.95,.985,1,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.018;p.inputs['IOR'].default_value=1.46;p.inputs['Transmission Weight'].default_value=1
for o in objects:o.data.materials.clear();o.data.materials.append(mat);o.hide_render=False;o.hide_set(False)
bpy.context.view_layer.update()
pts=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)])
manifest={'coordinateSystem':'right-handed Y-up, frontal XY plane, positive Z toward camera','dimensions':list(hi-lo),'bounds':{'min':list(lo),'max':list(hi)},'glyphs':[]}
for o in objects:
    o.data.calc_loop_triangles();manifest['glyphs'].append({'name':o.name,'character':o.get('character',o.name.split('_')[1]),'position':list(o.location),'scale':list(o.scale),'dimensions':list(o.dimensions),'triangles':len(o.data.loop_triangles),'pivot':'projected-area centroid, mid-depth'})
manifest['triangles']=sum(g['triangles'] for g in manifest['glyphs'])
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'ezzy-rappeport.glb'),export_format='GLB',use_selection=True,export_yup=False,export_apply=True,export_normals=True,export_texcoords=False,export_materials='NONE',export_cameras=False,export_lights=False)
(out/'ezzy-rappeport.json').write_text(json.dumps(manifest,indent=2)+'\n')
cam=scene.camera;cam.location=(0,0,8);cam.rotation_euler=(0,0,0);cam.data.type='ORTHO';cam.data.ortho_scale=5.1
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True;scene.cycles.max_bounces=12;scene.cycles.transmission_bounces=10
scene.render.resolution_x=1600;scene.render.resolution_y=780;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'

s=scene
img=bpy.data.images.load(water);img.pack();width=5.1;height=width*img.size[1]/img.size[0]
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,-.48));plane=bpy.context.object;plane.name='Wide transmitted water catcher';plane.scale=(12,12,1);plane.visible_camera=False;plane.visible_glossy=True
m=bpy.data.materials.new('Graded refracted water');m.use_nodes=True;n=m.node_tree.nodes;n.clear()
c=n.new('ShaderNodeTexCoord');mp=n.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(24/width,24/height,1);mp.inputs['Location'].default_value=(.5-12/width,.5-12/height-.22,0)
t=n.new('ShaderNodeTexImage');t.image=img;t.extension='EXTEND';r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].position=.64;r.color_ramp.elements[0].color=(.15,.22,.32,1);r.color_ramp.elements[1].position=.97;r.color_ramp.elements[1].color=(1.1,1.15,1.25,1)
e=n.new('ShaderNodeEmission');e.inputs['Strength'].default_value=1.2;o=n.new('ShaderNodeOutputMaterial')
for a,b in [(c.outputs['UV'],mp.inputs[0]),(mp.outputs[0],t.inputs[0]),(t.outputs[0],r.inputs[0]),(r.outputs[0],e.inputs[0]),(e.outputs[0],o.inputs[0])]:m.node_tree.links.new(a,b)
plane.data.materials.append(m)
mat=bpy.data.materials['Optical clear cast glass'];n=mat.node_tree.nodes;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,1,1,1);bs.inputs['Metallic'].default_value=0;bs.inputs['Transmission Weight'].default_value=1;bs.inputs['IOR'].default_value=1.46;bs.inputs['Roughness'].default_value=.006
c=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3;noise.inputs['Detail'].default_value=1;noise.inputs['Roughness'].default_value=.35
b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=.25;b.inputs['Distance'].default_value=.045
for a,z in [(c.outputs['Generated'],noise.inputs[0]),(noise.outputs['Fac'],b.inputs['Height']),(b.outputs[0],bs.inputs['Normal'])]:mat.node_tree.links.new(a,z)
s.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.4
s.render.resolution_percentage=100;s.render.resolution_x=1600;s.render.resolution_y=780;s.cycles.samples=64;s.render.filepath=str(out/'glass-title-final.png');bpy.ops.render.render(write_still=True);bpy.ops.wm.save_as_mainfile(filepath=str(out/'polished-glyphs.blend'))
