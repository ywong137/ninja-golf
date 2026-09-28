"""Bake study-based whole-body golf and blade motions with shared grip trajectories."""
import bpy,json,math,pathlib,sys,argparse
from mathutils import Vector,Quaternion,Matrix
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--guards-only',action='store_true');parser.add_argument('--attacks-only',action='store_true')
parser.add_argument('--selection-only',action='store_true',help='Bake separate relaxed selection poses')
parser.add_argument('--motion-data',type=pathlib.Path);parser.add_argument('--output',type=pathlib.Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
DATA=json.loads((args.motion_data or ROOT/('src/selection-data.json' if args.selection_only else 'src/motion-data.json')).read_text())
GUARDS_ONLY=args.guards_only
ATTACKS_ONLY=args.attacks_only
if sum([GUARDS_ONLY,ATTACKS_ONLY,args.selection_only])>1:parser.error('Choose one source bake mode')
if args.selection_only:
 DATA={name:clip for name,clip in DATA.items() if clip.get('nativeSelectionIdle')}
 if not DATA:raise ValueError('No nativeSelectionIdle records found; run author-selection-motion.py first')
if ATTACKS_ONLY and GUARDS_ONLY:raise ValueError('Choose --attacks-only or --guards-only, not both')
if ATTACKS_ONLY:DATA={name:clip for name,clip in DATA.items() if clip.get('athleticAttack') or clip.get('nativeAttackReady')}
if GUARDS_ONLY:DATA={name:clip for name,clip in DATA.items() if '_Guard_' in name}
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
hands={};feet={};foot_base={};foot_rotation={};poles={};knees={};arm_ik={}
for side in ['r','l']:
 target=bpy.data.objects.new('palm_'+side,None);scene.collection.objects.link(target);hands[side]=target
 pole=bpy.data.objects.new('elbow_'+side,None);scene.collection.objects.link(pole);poles[side]=pole
 ik=rig.pose.bones['lowerarm_'+side].constraints.new('IK');arm_ik[side]=ik;ik.target=target;ik.pole_target=pole;ik.chain_count=3;ik.pole_angle=math.pi/2 if side=='r' else -math.pi/2;ik.use_tail=True;ik.use_stretch=False
 target.rotation_mode='QUATERNION'
 orient=rig.pose.bones['hand_'+side].constraints.new('COPY_ROTATION');orient.target=target;orient.owner_space='WORLD';orient.target_space='WORLD'
 target=bpy.data.objects.new('ankle_'+side,None);scene.collection.objects.link(target);feet[side]=target;foot_base[side]=rig.pose.bones['foot_'+side].head.copy()+Vector((-.075 if side=='r' else .075,0,0))
 knee=bpy.data.objects.new('knee_'+side,None);scene.collection.objects.link(knee);knees[side]=knee;knee.location=(-.25 if side=='r' else .25,-.8,.55)
 ik=rig.pose.bones['calf_'+side].constraints.new('IK');ik.target=target;ik.pole_target=knee;ik.chain_count=2;ik.use_tail=True;ik.use_stretch=False
 thigh=rig.pose.bones['thigh_'+side];calf=rig.pose.bones['calf_'+side]
 axis=thigh.tail-thigh.head;normal=(calf.tail-thigh.head).cross(knee.location-thigh.head);projected=normal.cross(axis)
 angle=thigh.x_axis.angle(projected);pole_angle=(-angle if thigh.x_axis.cross(projected).dot(axis)<0 else angle)+math.pi
 ik.pole_angle=math.atan2(math.sin(pole_angle),math.cos(pole_angle))
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
 action=bpy.data.actions.new(name);rig.animation_data.action=action;end=round(clip['duration']*60)+1;golf=name.startswith('Golf');max_palm_error=0
 for side in ['r','l']:arm_ik[side].chain_count=3 if golf else 2
 for frame in range(1,end+1):
  scene.frame_set(frame);t=(frame-1)/(end-1);pose=sample(clip,t)
  for bone in rig.pose.bones:bone.rotation_quaternion=Quaternion();bone.location=(0,0,0);bone.scale=(1,1,1)
  hip=pose['hip'];chest=pose['chest'];bend=pose['bend'];shift=Vector(pose['shift'])
  pelvis=rig.pose.bones['pelvis'];pelvis.location=pelvis.bone.matrix_local.to_quaternion().inverted()@shift
  rotate('pelvis',(0,0,1),hip);rotate('pelvis',(1,0,0),pose.get('pelvisBend',bend*.5))
  rotate('pelvis',(0,1,0),pose.get('pelvisSideBend',0))
  for bn,f in [('spine_01',.35),('spine_02',.35),('spine_03',.30)]:
   rotate(bn,(0,0,1),(chest-hip)*f);rotate(bn,(1,0,0),(bend-pose.get('pelvisBend',bend*.5))*f)
  if pose.get('torsoSideBend',0):
   # Keep lateral torso flex above the native rig's thigh attachment.
   for bn,f in [('spine_02',.60),('spine_03',.40)]:rotate(bn,(0,1,0),pose['torsoSideBend']*f)
  rotate('neck_01',(0,0,1),-chest*(.65 if t<.62 else .2) if golf else -(chest-hip)*.35);rotate('Head',(1,0,0),pose.get('headBend',.18 if golf and t<.62 else -.04))
  if not golf and not clip.get('nativeSelectionIdle'):
   rotate('clavicle_r',(0,0,1),-.10);rotate('clavicle_l',(0,0,1),.10)
  grip=Vector(pose['grip']);direction=(Vector(pose['tip'])-grip).normalized()
  for side in ['r','l']:
   center=grip if side=='r' else (grip-direction*clip.get('gripSpacing',.09) if clip['twoHanded'] else Vector(pose['offGrip']))
   shaft=direction if side=='r' or clip['twoHanded'] else (Vector(pose['offTip'])-center).normalized()
   # The closed palm runs across the handle; its local Z follows the shaft.
   forward=Quaternion((0,0,1),chest)@Vector((0,-1,0))
   knuckles=forward-shaft*forward.dot(shaft)
   if knuckles.length<.1:knuckles=Vector((1,0,0))-shaft*shaft.x
   knuckles.normalize();across=knuckles.cross(shaft).normalized()
   q=Quaternion(shaft,pose.get('roll' if side=='r' else 'offRoll',0))@Matrix((across,knuckles,shaft)).transposed().to_quaternion()
   hands[side].rotation_quaternion=q
   hands[side].location=center-q@Vector((-.028 if side=='r' else .028,.096,0))
  if not golf:
   # Keep the shoulder girdle intact. Project the shared handle into both reach spheres.
   bpy.context.view_layer.update()
   reach={side:sum(rig.pose.bones[bn+'_'+side].length for bn in ['upperarm','lowerarm'])*.97 for side in ['r','l']}
   shoulder={side:(rig.matrix_world@rig.pose.bones['upperarm_'+side].head) for side in ['r','l']}
   if clip['twoHanded']:
    correction=Vector()
    for iteration in range(12):
     for side in ['r','l']:
      delta=hands[side].location+correction-shoulder[side]
      if delta.length>reach[side]:correction+=delta.normalized()*(reach[side]-delta.length)
    for side in ['r','l']:hands[side].location+=correction
   else:
    for side in ['r','l']:
     delta=hands[side].location-shoulder[side]
     if delta.length>reach[side]:hands[side].location=shoulder[side]+delta.normalized()*reach[side]
  for side in ['r','l']:
   sign=-1 if side=='r' else 1;poles[side].location=pose.get('elbow'+side.upper(),(sign*.6,-.22,1.05))
   hands[side].keyframe_insert(data_path='location',frame=frame);hands[side].keyframe_insert(data_path='rotation_quaternion',frame=frame);poles[side].keyframe_insert(data_path='location',frame=frame)
   feet[side].location=foot_base[side].copy()
   if 'foot'+side.upper() in pose:
    fp=pose['foot'+side.upper()];feet[side].location.x=fp[0];feet[side].location.y=fp[1];feet[side].location.z+=max(0,fp[2])
   else:feet[side].location.y-=pose['step'] if side=='r' else 0
   heel=max(0,pose['heel']) if side==('l' if golf else 'r') else 0;feet[side].location.z+=heel*.09
   feet[side].rotation_quaternion=Quaternion((0,0,1),pose.get('yaw'+side.upper(),0))@Quaternion((1,0,0),heel*.62)@foot_rotation[side]
   if golf and side=='r':feet[side].rotation_quaternion=Quaternion((0,0,1),.16)@feet[side].rotation_quaternion
   knee_yaw=0 if golf else (pose.get('yaw'+side.upper(),hip)+hip)*.5
   knees[side].location=Quaternion((0,0,1),knee_yaw)@Vector((sign*.25,-.8,.5))
   knees[side].keyframe_insert(data_path='location',frame=frame)
   feet[side].keyframe_insert(data_path='location',frame=frame);feet[side].keyframe_insert(data_path='rotation_quaternion',frame=frame)
  bpy.context.view_layer.update()
  if not golf:
   for side in ['r','l']:
    hip_point=rig.pose.bones['thigh_'+side].head;knee_point=rig.pose.bones['calf_'+side].head;ankle=rig.pose.bones['foot_'+side].head
    chord=ankle-hip_point;bend_point=knee_point-hip_point-chord*((knee_point-hip_point).dot(chord)/chord.length_squared)
    forward=Quaternion((0,0,1),pose.get('yaw'+side.upper(),hip))@Vector((0,-1,0))
    if bend_point.dot(forward)<-.01:raise ValueError(f'{name} frame {frame}: {side} knee bends backward')
  for side in ['r','l']:
   actual=rig.matrix_world@rig.pose.bones['hand_'+side].matrix@Vector((-.028 if side=='r' else .028,.096,0))
   intended=hands[side].location+hands[side].rotation_quaternion@Vector((-.028 if side=='r' else .028,.096,0))
   max_palm_error=max(max_palm_error,(actual-intended).length)
  for bn,q in fingers.items():rig.pose.bones[bn].rotation_quaternion=q.slerp(Quaternion(),pose.get('freeHand',0)) if bn.endswith('_l') else q
  for bone in rig.pose.bones:
   bone.keyframe_insert(data_path='rotation_quaternion',frame=frame);bone.keyframe_insert(data_path='location',frame=frame);bone.keyframe_insert(data_path='scale',frame=frame)
 scene.frame_start=1;scene.frame_end=end;bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.nla.bake(frame_start=1,frame_end=end,step=1,only_selected=False,visual_keying=True,clear_constraints=False,use_current_action=True,bake_types={'POSE'})
 action=rig.animation_data.action;action.name=name;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True;rig.animation_data.action=None
 print('BAKED',name,'max palm error',round(max_palm_error,4),flush=True)
for bone in rig.pose.bones:
 for c in list(bone.constraints):bone.constraints.remove(c)
for track in rig.animation_data.nla_tracks:track.mute=False
for o in list(scene.objects):
 if o!=rig:bpy.data.objects.remove(o,do_unlink=True)
mesh=bpy.data.meshes.new('RigCarrier');mesh.from_pydata([(0,0,0),(.001,0,0),(0,.001,0)],[],[(0,1,2)]);obj=bpy.data.objects.new('RigCarrier',mesh);scene.collection.objects.link(obj);obj.vertex_groups.new(name='pelvis').add([0,1,2],1,'REPLACE');mod=obj.modifiers.new('Rig','ARMATURE');mod.object=rig;obj.parent=rig
output=args.output or ROOT/'public/models'/('selection-motion.glb' if args.selection_only else 'attack-motion.glb' if ATTACKS_ONLY else 'guard-motion.glb' if GUARDS_ONLY else 'golf-motion.glb')
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_skins=True)
