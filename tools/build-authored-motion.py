"""Bake study-based whole-body golf and blade motions with shared grip trajectories."""
import bpy,json,math,pathlib
from mathutils import Vector,Quaternion
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'src/motion-data.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/source/UAL1_Standard.glb'))
source=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for track in source.animation_data.nla_tracks:track.mute=True
source.animation_data.action=bpy.data.actions['Jog_Fwd_Loop'];bpy.context.scene.frame_set(8)
fingers={b.name:b.rotation_quaternion.copy() for b in source.pose.bones if b.name.split('_')[0] in ['index','middle','ring','pinky','thumb']}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for action in list(bpy.data.actions):bpy.data.actions.remove(action,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/source/Superhero_Male_FullBody.gltf'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data_create();scene=bpy.context.scene;scene.render.fps=60
hands={};feet={};foot_base={};foot_rotation={};poles={}
for side in ['r','l']:
 target=bpy.data.objects.new('palm_'+side,None);scene.collection.objects.link(target);hands[side]=target
 pole=bpy.data.objects.new('elbow_'+side,None);scene.collection.objects.link(pole);poles[side]=pole
 ik=rig.pose.bones['hand_'+side].constraints.new('IK');ik.target=target;ik.pole_target=pole;ik.chain_count=3;ik.pole_angle=math.pi/2 if side=='r' else -math.pi/2;ik.use_tail=True;ik.use_stretch=False
 target=bpy.data.objects.new('ankle_'+side,None);scene.collection.objects.link(target);feet[side]=target;foot_base[side]=rig.pose.bones['foot_'+side].head.copy()+Vector((-.075 if side=='r' else .075,0,0))
 ik=rig.pose.bones['calf_'+side].constraints.new('IK');ik.target=target;ik.chain_count=2;ik.use_tail=True;ik.use_stretch=False
 target.rotation_mode='QUATERNION';foot_rotation[side]=(rig.matrix_world@rig.pose.bones['foot_'+side].bone.matrix_local).to_quaternion()
 orient=rig.pose.bones['foot_'+side].constraints.new('COPY_ROTATION');orient.target=target;orient.owner_space='WORLD';orient.target_space='WORLD'
for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
def rotate(name,axis,angle):
 b=rig.pose.bones[name];local=b.bone.matrix_local.to_quaternion().inverted()@Vector(axis);b.rotation_quaternion=b.rotation_quaternion@Quaternion(local,angle)
def sample(clip,t):
 rows=clip['poses'];i=0
 while i<len(rows)-2 and t>rows[i+1]['t']:i+=1
 a,b=rows[i:i+2];p=rows[max(0,i-1)];n=rows[min(len(rows)-1,i+2)];span=b['t']-a['t'];u=(t-a['t'])/span
 def val(key,k=None):
  get=lambda row:row[key] if k is None else row[key][k]
  m0=0 if i==0 else (get(b)-get(p))/(b['t']-p['t']);m1=0 if i+1==len(rows)-1 else (get(n)-get(a))/(n['t']-a['t'])
  return (2*u**3-3*u*u+1)*get(a)+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*get(b)+(u**3-u*u)*span*m1
 return {k:([val(k,j) for j in range(len(a[k]))] if isinstance(a[k],list) else val(k)) for k in a if k!='t'}
for name,clip in DATA.items():
 action=bpy.data.actions.new(name);rig.animation_data.action=action;end=round(clip['duration']*60)+1;golf=name.startswith('Golf')
 for frame in range(1,end+1):
  scene.frame_set(frame);t=(frame-1)/(end-1);pose=sample(clip,t)
  for bone in rig.pose.bones:bone.rotation_quaternion=Quaternion();bone.location=(0,0,0);bone.scale=(1,1,1)
  hip=pose['hip'];chest=pose['chest'];bend=pose['bend'];shift=Vector(pose['shift'])
  pelvis=rig.pose.bones['pelvis'];pelvis.location=pelvis.bone.matrix_local.to_quaternion().inverted()@shift
  rotate('pelvis',(0,0,1),hip);rotate('pelvis',(1,0,0),bend*.5)
  for bn,f in [('spine_01',.35),('spine_02',.35),('spine_03',.30)]:
   rotate(bn,(0,0,1),(chest-hip)*f);rotate(bn,(1,0,0),bend*.5*f)
  rotate('neck_01',(0,0,1),-chest*(.65 if golf and t<.62 else .2));rotate('Head',(1,0,0),.18 if golf and t<.62 else -.04)
  grip=Vector(pose['grip']);direction=(Vector(pose['tip'])-grip).normalized()
  hands['r'].location=grip
  hands['l'].location=grip-direction*.09 if clip['twoHanded'] else Vector((-grip.x,-.43,1.15+.2*math.sin(t*math.tau)))
  for side in ['r','l']:
   sign=-1 if side=='r' else 1;poles[side].location=(sign*.6,-.22,1.05)
   hands[side].keyframe_insert(data_path='location',frame=frame);poles[side].keyframe_insert(data_path='location',frame=frame)
   feet[side].location=foot_base[side].copy();feet[side].location.y-=pose['step'] if side=='r' else 0
   heel=max(0,pose['heel']) if side==('l' if golf else 'r') else 0;feet[side].location.z+=heel*.09
   feet[side].rotation_quaternion=Quaternion((1,0,0),heel*.62)@foot_rotation[side]
   if golf and side=='r':feet[side].rotation_quaternion=Quaternion((0,0,1),.16)@feet[side].rotation_quaternion
   feet[side].keyframe_insert(data_path='location',frame=frame);feet[side].keyframe_insert(data_path='rotation_quaternion',frame=frame)
  for bn,q in fingers.items():rig.pose.bones[bn].rotation_quaternion=q
  for bone in rig.pose.bones:
   bone.keyframe_insert(data_path='rotation_quaternion',frame=frame);bone.keyframe_insert(data_path='location',frame=frame);bone.keyframe_insert(data_path='scale',frame=frame)
 scene.frame_start=1;scene.frame_end=end;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.nla.bake(frame_start=1,frame_end=end,step=1,only_selected=False,visual_keying=True,clear_constraints=False,use_current_action=True,bake_types={'POSE'})
 action=rig.animation_data.action;action.name=name;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True;rig.animation_data.action=None
 print('BAKED',name,flush=True)
for bone in rig.pose.bones:
 for c in list(bone.constraints):bone.constraints.remove(c)
for track in rig.animation_data.nla_tracks:track.mute=False
for o in list(scene.objects):
 if o!=rig:bpy.data.objects.remove(o,do_unlink=True)
mesh=bpy.data.meshes.new('RigCarrier');mesh.from_pydata([(0,0,0),(.001,0,0),(0,.001,0)],[],[(0,1,2)]);obj=bpy.data.objects.new('RigCarrier',mesh);scene.collection.objects.link(obj);obj.vertex_groups.new(name='pelvis').add([0,1,2],1,'REPLACE');mod=obj.modifiers.new('Rig','ARMATURE');mod.object=rig;obj.parent=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/golf-motion.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_skins=True)
