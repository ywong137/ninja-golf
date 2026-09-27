"""Export the licensed, textured human roster. Run with Blender --background --python.

Use -- --preview to render the unmodified source bodies without writing game models.
"""
import argparse, importlib.util, json, pathlib, subprocess, sys
import bpy
from mathutils import Vector, Matrix
ROOT=pathlib.Path(__file__).resolve().parents[1]
ROSTER=[('ronin','Male_Adult_10'),('shinobi','Male_Adult_09'),('monk','Male_Adult_05'),('kaede','Female_Adult_03'),('ayame','Female_Adult_08'),('sora','Female_Adult_12')]
ENEMIES=[('ninja','Male_Adult_18'),('enemy-guard','Male_Adult_04'),('enemy-lancer','Male_Adult_11'),('enemy-skirmisher','Female_Adult_13')]
ENEMY_CLIPS={'Idle_Loop','Sword_Idle','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Jump_Start','Jump_Loop','Jump_Land','Hit_Chest','Golf_Address'}
ENEMY_ATTACKS=['Twin_Cut_Diagonal','Heavy_Cleave','Enemy_Thrust','Enemy_Throw']
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--preview',action='store_true');parser.add_argument('--enemies',action='store_true');parser.add_argument('--hero',choices=[r[0] for r in ROSTER+ENEMIES]);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
spec=importlib.util.spec_from_file_location('rocketbox_rig',ROOT/'tools/rocketbox-rig.py');bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
clip_spec=importlib.util.spec_from_file_location('character_clips',ROOT/'tools/filter-character-clips.py');clip_filter=importlib.util.module_from_spec(clip_spec);clip_spec.loader.exec_module(clip_filter)
def materials(folder):
 for mat in bpy.data.materials:
  color=folder/'Textures'/f'{mat.name}_color.tga'
  if not color.exists():raise FileNotFoundError(f'Missing diffuse texture: {color}')
  mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
  out=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Roughness'].default_value=.67;links.new(shader.outputs['BSDF'],out.inputs['Surface'])
  tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(color),check_existing=True);links.new(tex.outputs['Color'],shader.inputs['Base Color'])
  normal=folder/'Textures'/f'{mat.name}_normal.tga'
  if normal.exists():
   n=nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(normal),check_existing=True);n.image.colorspace_settings.name='Non-Color';mapping=nodes.new('ShaderNodeNormalMap');links.new(n.outputs['Color'],mapping.inputs['Color']);links.new(mapping.outputs['Normal'],shader.inputs['Normal'])
  if 'opacity' in mat.name:
   links.new(tex.outputs['Alpha'],shader.inputs['Alpha']);mat.surface_render_method='DITHERED';mat.use_backface_culling=False
 for image in bpy.data.images:
  if image.source=='FILE' and image.has_data:
   limit=1024 if '_normal' in image.name else 2048
   if max(image.size)>limit:image.scale(limit,limit)
   image.file_format='JPEG' if '_color' in image.name and 'opacity' not in image.name else 'PNG';image.pack()
def preview(hero):
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.22,.22,1)
 for loc,power,size in [((3,-4,4),500,3),((-3,-1,3),350,3),((0,3,4),600,2)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(1,-4,1.65));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.96))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.12;scene.camera=camera
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=f'/private/tmp/rocketbox-{hero}.png';bpy.ops.render.render(write_still=True)
for hero,source in ENEMIES if args.enemies else ROSTER:
 if args.hero and hero!=args.hero:continue
 bpy.ops.wm.read_factory_settings(use_empty=True);folder=ROOT/'assets/source/rocketbox'/source
 bpy.ops.import_scene.fbx(filepath=str(folder/'Export'/f'{source}.fbx'));materials(folder)
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data_clear();avatar_objects=list(bpy.context.scene.objects)
 if args.preview:preview(hero);continue
 bridge.prepare_rocketbox_rig(rig)
 clip_names=ENEMY_CLIPS|{ENEMY_ATTACKS[[e[0] for e in ENEMIES].index(hero)]} if args.enemies else clip_filter.clip_names(hero,set(json.loads((ROOT/'src/motion-data.json').read_text()))|clip_filter.COMMON)
 bridge.bake_rocketbox_actions(rig,clip_names=clip_names)
 for side in ['r','l']:
  bone=rig.pose.bones['hand_'+side];center=Vector(rig['palmGrip'+side.upper()]);axis=Vector(rig['shaftAxis'+side.upper()])
  for label,point in [('PalmGrip',center),('PalmShaft',center+axis*.1)]:
   marker=bpy.data.objects.new(label+'_'+side,None);bpy.context.scene.collection.objects.link(marker);marker.parent=rig;marker.parent_type='BONE';marker.parent_bone=bone.name
   bpy.context.view_layer.update();marker.matrix_world=rig.matrix_world@bone.matrix@Matrix.Translation(point);avatar_objects.append(marker)
 rig['sourceAvatar']=source;rig['license']='MIT';rig['sourceRepository']='https://github.com/microsoft/Microsoft-Rocketbox'
 bpy.ops.object.select_all(action='DESELECT')
 for obj in avatar_objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=rig
 output=ROOT/'public/models'/f'{hero}.glb';temporary=output.with_name(f'{hero}.building.glb')
 bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_extras=True,export_image_format='AUTO')
 subprocess.run(['python3',str(ROOT/'tools/compress-glb-textures.py'),'--max-size','1024' if args.enemies else '2048','--alpha-size','512' if args.enemies else '1024',str(temporary)],check=True)
 temporary.replace(output)
 print('EXPORTED',hero,flush=True)
