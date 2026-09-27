"""Inspect a licensed source avatar without changing the playable roster."""
import bpy,pathlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1];folder=ROOT/'assets/source/rocketbox/Female_Adult_01'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(folder/'Export/Female_Adult_01.fbx'))
for image in list(bpy.data.images):
 name=pathlib.Path(image.filepath).name;path=folder/'Textures'/name
 if path.exists():image.filepath=str(path);image.reload()
for material in bpy.data.materials:
 material.use_nodes=True;nodes=material.node_tree.nodes;links=material.node_tree.links;nodes.clear()
 output=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeBsdfPrincipled');shader.inputs['Roughness'].default_value=.64;links.new(shader.outputs['BSDF'],output.inputs['Surface'])
 name=material.name;tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(folder/'Textures'/f'{name}_color.tga'),check_existing=True);links.new(tex.outputs['Color'],shader.inputs['Base Color'])
 normal_path=folder/'Textures'/f'{name}_normal.tga'
 if normal_path.exists():
  image=nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(normal_path),check_existing=True);image.image.colorspace_settings.name='Non-Color';normal=nodes.new('ShaderNodeNormalMap');links.new(image.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
 if 'opacity' in name:links.new(tex.outputs['Alpha'],shader.inputs['Alpha']);material.surface_render_method='DITHERED'
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data_clear()
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.25,.25,1)
for loc,power,size in [((3,-4,4),500,3),((-3,-1,3),350,3),((0,3,4),600,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.5,-4,1.7));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.2;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath='/private/tmp/rocketbox-local.png';bpy.ops.render.render(write_still=True)
for o in list(scene.objects):
 if o.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(o,do_unlink=True)
for image in bpy.data.images:
 if image.source=='FILE' and image.has_data:
  image.file_format='PNG';image.pack()
bpy.ops.export_scene.gltf(filepath=str(folder/'candidate.glb'),export_format='GLB',export_animations=False,export_image_format='AUTO')
print('CANDIDATE',folder/'candidate.glb',flush=True)
