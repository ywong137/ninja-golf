import bpy, json, pathlib
from mathutils import Vector
root=pathlib.Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/source/Superhero_Male_FullBody.gltf'))
for o in bpy.context.scene.objects:
 print('OBJECT',o.name,o.type,tuple(o.dimensions),tuple(o.location),len(o.data.vertices) if o.type=='MESH' else '')
 if o.type=='ARMATURE':
  for b in o.data.bones:
   if any(x in b.name for x in ['pelvis','spine','Head','neck','clavicle','upperarm','lowerarm','hand_','thigh','calf','foot','root']):print('BONE',b.name,tuple(b.head_local),tuple(b.tail_local))
world=bpy.context.scene.world or bpy.data.worlds.new('World');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.16,.19,1)
bpy.ops.object.camera_add(location=(3,-5,2.5));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.7;bpy.context.scene.camera=cam
for loc,power,size in [((3,-4,5),650,4),((-3,-2,3),350,3),((0,3,4),700,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath='/private/tmp/ninja-human-base.png';bpy.ops.render.render(write_still=True)
