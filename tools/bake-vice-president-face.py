"""Project the generated, glasses-free Ethan reference onto the preserved head UVs.
Run after build-vice-president.py writes /tmp/vice-president.blend.
Uses Blender's surface bake; no raw user photo is copied into the project.
"""
import bpy,bmesh,pathlib,argparse,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--blend',type=pathlib.Path,default=pathlib.Path('/tmp/vice-president.blend'));args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if not args.blend.exists():raise FileNotFoundError('Run build-vice-president.py with --blend '+str(args.blend)+' before baking the face')
bpy.ops.wm.open_mainfile(filepath=str(args.blend))
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and o.vertex_groups)
for modifier in mesh.modifiers:modifier.show_render=False;modifier.show_viewport=False
old_uv=mesh.data.uv_layers.active;projection=mesh.data.uv_layers.new(name='EthanFrontProjection');mask=mesh.data.color_attributes.new(name='EthanFaceProjectionWeight',type='FLOAT_COLOR',domain='CORNER')
# Visible face landmarks align the portrait to the sculpted eye, nose and lip loops.
# The vertical values are the reference image's fractional distance from its top.
knots=[(1.54,.88),(1.562,.804),(1.582,.765),(1.600,.699),(1.620,.634),(1.638,.567),(1.650,.538),(1.668,.492),(1.686,.432),(1.702,.383),(1.724,.281),(1.749,.186),(1.78,.075),(1.804,.026),(1.815,.01)]
def ordinate(z):
 for (z0,v0),(z1,v1) in zip(knots,knots[1:]):
  if z<=z1:return v0+(v1-v0)*(z-z0)/(z1-z0)
 return knots[-1][1]
outline=[(0,.53,.63),(.03,.46,.70),(.075,.35,.74),(.14,.25,.79),(.20,.20,.82),(.3,.17,.84),(.4,.15,.86),(.5,.17,.85),(.6,.235,.785),(.7,.245,.775),(.76,.267,.735),(.8,.29,.70),(.85,.28,.71),(1,.20,.80)]
def bounds(v):
 for (v0,l0,r0),(v1,l1,r1) in zip(outline,outline[1:]):
  if v<=v1:
   t=max(0,min(1,(v-v0)/(v1-v0)));return l0+(l1-l0)*t,r0+(r1-r0)*t
 return outline[-1][1:]
def smooth(lo,hi,v):
 t=max(0,min(1,(v-lo)/(hi-lo)));return t*t*(3-2*t)
def reference_height(z):
 if z>=1.700:return z+.012*smooth(1.700,1.748,z)
 if z<1.685:return z+(z-1.685)*.075*smooth(1.53,1.56,z)
 return z
knots=[(reference_height(z-(.003 if z==1.638 else .002 if z==1.650 else 0)),v) for z,v in knots]
for poly in mesh.data.polygons:
 for loop_index in poly.loop_indices:
  loop=mesh.data.loops[loop_index];v=mesh.data.vertices[loop.vertex_index];x,y,z=v.co
  u=.470+x*4.22;v=ordinate(z);projection.data[loop_index].uv=(u,1-v)
  width=.041+.013*smooth(1.57,1.62,z)
  hair=smooth(1.738,1.760,z);front=1-smooth(-.080+.04*hair,-.051+.056*hair,y)
  factor=(1-smooth(width,width+.009,abs(x)))*front*smooth(1.541,1.565,z)*(1-smooth(1.788,1.810,z))
  lo,hi=bounds(v);factor*=smooth(lo+.008,lo+.04,u)*(1-smooth(hi-.04,hi-.008,u))
  source_uv=old_uv.data[loop_index].uv
  if source_uv.y<.30 or source_uv.x<.25 or source_uv.x>.75 or poly.material_index!=1:factor=0
  mask.data[loop_index].color=(factor,factor,factor,1)
mesh.data.uv_layers.active=old_uv;old_uv.active_render=True
base=bpy.data.images.load(str(ROOT/'assets/characters/vice-president-albedo.png'),check_existing=True);photo=bpy.data.images.load(str(ROOT/'assets/characters/vice-president-front-reference.png'),check_existing=True)
result=bpy.data.images.new('Vice President aligned face albedo',2048,2048,alpha=False)
for material in mesh.data.materials:
 material.use_nodes=True;nodes=material.node_tree.nodes;links=material.node_tree.links;nodes.clear()
 output=nodes.new('ShaderNodeOutputMaterial');emit=nodes.new('ShaderNodeEmission');links.new(emit.outputs[0],output.inputs['Surface'])
 uv=nodes.new('ShaderNodeUVMap');uv.uv_map=old_uv.name;basetex=nodes.new('ShaderNodeTexImage');basetex.image=base;links.new(uv.outputs['UV'],basetex.inputs['Vector'])
 p_uv=nodes.new('ShaderNodeUVMap');p_uv.uv_map=projection.name;p_tex=nodes.new('ShaderNodeTexImage');p_tex.image=photo;links.new(p_uv.outputs['UV'],p_tex.inputs['Vector'])
 weight=nodes.new('ShaderNodeVertexColor');weight.layer_name=mask.name;mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';links.new(weight.outputs['Color'],mix.inputs[0]);links.new(basetex.outputs['Color'],mix.inputs[1]);links.new(p_tex.outputs['Color'],mix.inputs[2]);
 # Muted grey-blue irises retain the native eye texture and pupil detail.
 distance=nodes.new('ShaderNodeVectorMath');distance.operation='DISTANCE';links.new(uv.outputs['UV'],distance.inputs[0]);distance.inputs[1].default_value=(.266,.067,0)
 iris=nodes.new('ShaderNodeMath');iris.operation='LESS_THAN';links.new(distance.outputs['Value'],iris.inputs[0]);iris.inputs[1].default_value=.034
 muted=nodes.new('ShaderNodeHueSaturation');muted.inputs['Saturation'].default_value=.13;links.new(mix.outputs[0],muted.inputs['Color'])
 tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=.3;tint.inputs[2].default_value=(.78,.88,1,1);links.new(muted.outputs[0],tint.inputs[1])
 eye_mix=nodes.new('ShaderNodeMixRGB');links.new(iris.outputs[0],eye_mix.inputs[0]);links.new(mix.outputs[0],eye_mix.inputs[1]);links.new(tint.outputs[0],eye_mix.inputs[2]);links.new(eye_mix.outputs[0],emit.inputs['Color'])
 target=nodes.new('ShaderNodeTexImage');target.image=result;nodes.active=target
bm=bmesh.new();bm.from_mesh(mesh.data);bm.faces.ensure_lookup_table();bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[f for f in bm.faces if any(v.index<2837 or v.index>=4550 for v in f.verts)],context='FACES');bm.to_mesh(mesh.data);bm.free()
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.render.bake.margin=12
bpy.ops.object.bake(type='EMIT',use_clear=True)
lossless=ROOT/'artifacts/vice-president/face-baked.png';lossless.parent.mkdir(parents=True,exist_ok=True)
result.filepath_raw=str(lossless);result.file_format='PNG';result.save()
print('BAKED',result.filepath_raw)
result.filepath_raw=str(ROOT/'assets/characters/vice-president-face-baked.jpg');result.file_format='JPEG';scene.render.image_settings.quality=93;result.save()
print('RUNTIME_TEXTURE',result.filepath_raw)
