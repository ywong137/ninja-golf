"""Blend an image-generated nose correction into the original baked face atlas.

Use the unmodified native Monk GLB. Keep the base image separate from output.
The mask leaves the eye atlas and all other facial features unchanged.
"""
import argparse, pathlib, sys
import bpy, bmesh
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--native-model', type=pathlib.Path, required=True)
p.add_argument('--base-texture', type=pathlib.Path, required=True)
p.add_argument('--repair-texture', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[1] / 'assets/characters/vice-president-nose-repair.png')
p.add_argument('--output', type=pathlib.Path, required=True)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if a.base_texture.resolve() == a.output.resolve():
    p.error('Keep --base-texture separate from --output to avoid repeated correction')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(a.native_model))
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and o.vertex_groups)
for m in mesh.modifiers:m.show_render=False;m.show_viewport=False
base=bpy.data.images.load(str(a.base_texture))
repair=bpy.data.images.load(str(a.repair_texture))
result=bpy.data.images.new('Ethan repaired nose albedo',2048,2048,alpha=False)
for mat in mesh.data.materials:
 nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
 out=nodes.new('ShaderNodeOutputMaterial');emit=nodes.new('ShaderNodeEmission');links.new(emit.outputs[0],out.inputs['Surface'])
 uv=nodes.new('ShaderNodeUVMap');uv.uv_map=mesh.data.uv_layers.active.name
 old=nodes.new('ShaderNodeTexImage');old.image=base;links.new(uv.outputs['UV'],old.inputs['Vector'])
 new=nodes.new('ShaderNodeTexImage');new.image=repair;links.new(uv.outputs['UV'],new.inputs['Vector'])
 delta=nodes.new('ShaderNodeVectorMath');delta.operation='SUBTRACT';delta.inputs[1].default_value=(.5,.637,0);links.new(uv.outputs['UV'],delta.inputs[0])
 scale=nodes.new('ShaderNodeVectorMath');scale.operation='DIVIDE';scale.inputs[1].default_value=(.033,.015,1);links.new(delta.outputs['Vector'],scale.inputs[0])
 length=nodes.new('ShaderNodeVectorMath');length.operation='LENGTH';links.new(scale.outputs[0],length.inputs[0])
 weight=nodes.new('ShaderNodeMapRange');weight.interpolation_type='SMOOTHERSTEP';weight.inputs['From Min'].default_value=.3;weight.inputs['From Max'].default_value=1;weight.inputs['To Min'].default_value=1;weight.inputs['To Max'].default_value=0;links.new(length.outputs['Value'],weight.inputs[0])
 mix=nodes.new('ShaderNodeMixRGB');links.new(weight.outputs[0],mix.inputs[0]);links.new(old.outputs['Color'],mix.inputs[1]);links.new(new.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],emit.inputs[0])
 target=nodes.new('ShaderNodeTexImage');target.image=result;nodes.active=target
bm=bmesh.new();bm.from_mesh(mesh.data);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index!=1],context='FACES');bm.to_mesh(mesh.data);bm.free()
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.render.bake.margin=12
bpy.ops.object.bake(type='EMIT',use_clear=True)
a.output.parent.mkdir(parents=True, exist_ok=True)
result.filepath_raw=str(a.output);result.file_format='JPEG' if a.output.suffix.lower() in ['.jpg','.jpeg'] else 'PNG';scene.render.image_settings.quality=93;result.save()
print('REPAIRED_TEXTURE',result.filepath_raw)
