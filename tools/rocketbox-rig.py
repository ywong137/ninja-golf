"""Map licensed Rocketbox Biped rigs to the game's anatomical bone vocabulary."""
import bpy,math,pathlib,importlib.util
from mathutils import Vector,Quaternion,Matrix
ROOT=pathlib.Path(__file__).resolve().parents[1]
_profile_spec=importlib.util.spec_from_file_location('native_locomotion_profile',ROOT/'tools/native-locomotion-profile.py')
locomotion_profile=importlib.util.module_from_spec(_profile_spec);_profile_spec.loader.exec_module(locomotion_profile)
MAP={'Bip01 Pelvis':'pelvis','Bip01 Spine':'spine_01','Bip01 Spine1':'spine_02','Bip01 Spine2':'spine_03','Bip01 Neck':'neck_01','Bip01 Head':'Head'}
for side,short in [('L','l'),('R','r')]:
 for original,name in [('Clavicle','clavicle'),('UpperArm','upperarm'),('Forearm','lowerarm'),('Hand','hand'),('Thigh','thigh'),('Calf','calf'),('Foot','foot'),('Toe0','ball')]:MAP[f'Bip01 {side} {original}']=f'{name}_{short}'
 for number,name in enumerate(['thumb','index','middle','ring','pinky']):
  for segment,suffix in enumerate(['','1','2'],1):MAP[f'Bip01 {side} Finger{number}{suffix}']=f'{name}_{segment:02d}_{short}'
CHILD={'pelvis':'spine_01','spine_01':'spine_02','spine_02':'spine_03','spine_03':'neck_01','neck_01':'Head'}
for side in ['l','r']:
 for parent,child in [('clavicle','upperarm'),('upperarm','lowerarm'),('lowerarm','hand'),('hand','middle_01'),('thigh','calf'),('calf','foot'),('foot','ball')]:CHILD[f'{parent}_{side}']=f'{child}_{side}'
 for finger in ['thumb','index','middle','ring','pinky']:
  for n in [1,2]:CHILD[f'{finger}_{n:02d}_{side}']=f'{finger}_{n+1:02d}_{side}'
def prepare_rocketbox_rig(rig):
 """Normalize units and axes without replacing skin weights or native proportions."""
 rig.animation_data_clear();bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 for old,new in MAP.items():
  if old in rig.data.bones:rig.data.bones[old].name=new
 bpy.ops.object.mode_set(mode='EDIT')
 for name,child in CHILD.items():
  if name in rig.data.edit_bones and child in rig.data.edit_bones:
   bone=rig.data.edit_bones[name];bone.tail=rig.data.edit_bones[child].head
 bpy.ops.object.mode_set(mode='OBJECT')
 for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
 rig['humanSource']='Microsoft Rocketbox';rig['nativeMotion']=True
 return rig

def import_motion_source(filename):
 previous=set(bpy.context.scene.objects);actions=set(bpy.data.actions)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/filename))
 objects=set(bpy.context.scene.objects)-previous;rig=next(o for o in objects if o.type=='ARMATURE')
 for o in objects:o.hide_render=True
 if rig.animation_data:
  for track in rig.animation_data.nla_tracks:track.mute=True
 return rig,list(set(bpy.data.actions)-actions),objects

def retarget_setup(target,source):
 corrections={};rest={}
 for name,bone in target.pose.bones.items():
  if name not in source.pose.bones:continue
  original=source.pose.bones[name];source_rest=source.matrix_world@original.bone.matrix_local;target_rest=target.matrix_world@bone.bone.matrix_local
  child=CHILD.get(name)
  if child and child in target.pose.bones and child in source.pose.bones:
   src_direction=source.matrix_world@source.data.bones[child].head_local-source_rest.translation
   dst_direction=target.matrix_world@target.data.bones[child].head_local-target_rest.translation
  elif name=='Head':
   src_direction=Vector((0,0,1));dst_direction=Vector((0,0,1))
  elif bone.parent and original.parent:
   src_direction=source_rest.translation-(source.matrix_world@original.parent.bone.matrix_local).translation
   dst_direction=target_rest.translation-(target.matrix_world@bone.parent.bone.matrix_local).translation
  else:
   src_direction=Vector((0,0,1));dst_direction=Vector((0,0,1))
  alignment=dst_direction.rotation_difference(src_direction)
  corrections[name]=source_rest.to_quaternion().inverted()@alignment@target_rest.to_quaternion();rest[name]=target_rest.to_quaternion()
 return corrections,rest

def retarget_frame(target,source,corrections,rest):
 desired={name:(source.matrix_world@source.pose.bones[name].matrix).to_quaternion()@correction for name,correction in corrections.items()}
 for name,bone in target.pose.bones.items():
  bone.location=(0,0,0);bone.scale=(1,1,1)
  if name not in desired:bone.rotation_quaternion=Quaternion();continue
  parent=bone.parent
  parent_pose=desired.get(parent.name,rest.get(parent.name)) if parent else None
  base=parent_pose@rest[parent.name].inverted()@rest[name] if parent and parent.name in rest else rest[name]
  bone.rotation_quaternion=base.inverted()@desired[name]
 source_rest=(source.matrix_world@source.data.bones['pelvis'].matrix_local).translation
 source_pose=(source.matrix_world@source.pose.bones['pelvis'].matrix).translation
 target_rest=(target.matrix_world@target.data.bones['pelvis'].matrix_local).translation
 delta=(source_pose-source_rest)*(target_rest.z/max(source_rest.z,.01))
 target.pose.bones['pelvis'].location=rest['pelvis'].inverted()@delta
 bpy.context.view_layer.update()

def measure_grips(rig):
 """Measure the handle center and across-palm axis from the closed finger joints."""
 result={}
 for side in ['r','l']:
  hand=rig.pose.bones['hand_'+side];inverse=hand.matrix.inverted()
  knuckle=inverse@rig.pose.bones['middle_01_'+side].head;distal=inverse@rig.pose.bones['middle_03_'+side].head
  center=(knuckle+distal)*.5
  axis=(inverse@rig.pose.bones['index_01_'+side].head)-(inverse@rig.pose.bones['pinky_01_'+side].head);axis.normalize()
  forward=knuckle-axis*knuckle.dot(axis);forward.normalize();across=forward.cross(axis).normalized()
  basis=Matrix((across,forward,axis)).transposed().to_quaternion()
  result[side]={'center':center,'axis':axis,'basis':basis}
  rig['closedFingers'+side.upper()]={b.name:[b.rotation_quaternion.x,b.rotation_quaternion.y,b.rotation_quaternion.z,b.rotation_quaternion.w] for b in rig.pose.bones if any(b.name.startswith(f+'_') for f in ['thumb','index','middle','ring','pinky']) and b.name.endswith('_'+side)}
  rig['palmGrip'+side.upper()]=list(center);rig['shaftAxis'+side.upper()]=list(axis)
 return result

def create_native_ik(rig):
 hands={};feet={};poles={};knees={};constraints=[]
 def empty(name):
  obj=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(obj);return obj
 def chain(end,target,pole):
  c=rig.pose.bones[end].constraints.new('IK');c.target=target;c.pole_target=pole;c.chain_count=2;c.use_tail=True;c.use_stretch=False;constraints.append(c);return c
 for side in ['r','l']:
  sign=-1 if side=='r' else 1
  hands[side]=empty('native_palm_'+side);hands[side].location=(sign*.12,-.39,1.18);hands[side].rotation_mode='QUATERNION'
  poles[side]=empty('native_elbow_'+side);poles[side].location=(sign*.58,-.25,1.00)
  feet[side]=empty('native_ankle_'+side);feet[side].location=rig.pose.bones['foot_'+side].head.copy();feet[side].rotation_mode='QUATERNION';feet[side].rotation_quaternion=rig.pose.bones['foot_'+side].matrix.to_quaternion()
  knees[side]=empty('native_knee_'+side);knees[side].location=(sign*.24,-.8,.5)
  for parent,middle,end,target,pole in [('upperarm','lowerarm','lowerarm',hands[side],poles[side]),('thigh','calf','calf',feet[side],knees[side])]:
   c=chain(end+'_'+side,target,pole);best=(-2,0)
   # Calibrate pole roll from actual anatomy, rather than assuming either source rig's axes.
   for n in range(48):
    angle=-math.pi+n*math.tau/48;c.pole_angle=angle;bpy.context.view_layer.update()
    a=rig.pose.bones[parent+'_'+side].head;b=rig.pose.bones[middle+'_'+side].head;line=target.location-a
    bend=b-a-line*((b-a).dot(line)/max(line.length_squared,.0001));aim=pole.location-a-line*((pole.location-a).dot(line)/max(line.length_squared,.0001))
    score=bend.normalized().dot(aim.normalized())
    if score>best[0]:best=(score,angle)
   c.pole_angle=best[1]
  for name,target in [('hand',hands[side]),('foot',feet[side])]:
   c=rig.pose.bones[name+'_'+side].constraints.new('COPY_ROTATION');c.target=target;c.owner_space='WORLD';c.target_space='WORLD';constraints.append(c)
 return {'hands':hands,'feet':feet,'poles':poles,'knees':knees,'constraints':constraints,'footBase':{s:o.location.copy() for s,o in feet.items()},'footRot':{s:o.rotation_quaternion.copy() for s,o in feet.items()}}

def sample_authored(clip,t):
 rows=clip['poses'];i=0
 while i<len(rows)-2 and t>rows[i+1]['t']:i+=1
 a,b=rows[i:i+2];prev=rows[max(0,i-1)];nxt=rows[min(len(rows)-1,i+2)];span=b['t']-a['t'];u=(t-a['t'])/span
 def val(key,k=None):
  get=lambda row:row[key] if k is None else row[key][k]
  m0=0 if i==0 else (get(b)-get(prev))/(b['t']-prev['t']);m1=0 if i+1==len(rows)-1 else (get(nxt)-get(a))/(nxt['t']-a['t'])
  return (2*u**3-3*u*u+1)*get(a)+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*get(b)+(u**3-u*u)*span*m1
 return {k:([val(k,j) for j in range(len(a[k]))] if isinstance(a[k],list) else val(k)) for k in a if k!='t'}

def palm_target(pose,clip,grips,side):
 primary=Vector(pose['grip']);shaft=(Vector(pose['tip'])-primary).normalized()
 center=primary if side=='r' else primary-shaft*clip.get('gripSpacing',.09) if clip['twoHanded'] else Vector(pose['offGrip'])
 direction=shaft if side=='r' or clip['twoHanded'] else (Vector(pose['offTip'])-center).normalized()
 forward=Quaternion((0,0,1),pose['chest'])@Vector((0,-1,0));forward-=direction*forward.dot(direction)
 if forward.length<.1:forward=Vector((1,0,0))-direction*direction.x
 forward.normalize();across=forward.cross(direction).normalized();roll=pose.get('roll' if side=='r' else 'offRoll',0)
 rotation=Quaternion(direction,roll)@Matrix((across,forward,direction)).transposed().to_quaternion()@grips[side]['basis'].inverted()
 return center,direction,rotation,roll

def plan_palm_recovery(clip,grips,count,sample_rate):
 """Transport the grip, then return its twist over a fixed time interval.

 The uncorrected transported frame remains separate from the recovery output.
 This avoids recursive frame-count-dependent easing and a forced endpoint turn.
 """
 tracks={side:[] for side in ['r','l']};previous={}
 for frame in range(count+1):
  pose=sample_authored(clip,min(frame/sample_rate,clip['duration'])/clip['duration'])
  for side in tracks:
   _,direction,desired,roll=palm_target(pose,clip,grips,side);old=previous.get(side)
   rotation=desired.copy() if old is None else Quaternion(direction,roll-old[2])@old[0].rotation_difference(direction)@old[1]
   rotation.normalize();tracks[side].append((direction,rotation,desired));previous[side]=(direction,rotation,roll)
 duration=clip['duration'];last_contact=max(clip.get('impacts') or [0])
 # Begin after the final cut follows through, while the body also returns.
 start=min(duration-.025,last_contact+.075)
 result=[];twists={}
 for side,track in tracks.items():
  axis,rotation,desired=track[-1];delta=desired@rotation.inverted()
  angle=2*math.atan2(Vector((delta.x,delta.y,delta.z)).dot(axis),delta.w)
  twists[side]=math.atan2(math.sin(angle),math.cos(angle))
 for frame in range(count+1):
  u=max(0,min(1,(frame/sample_rate-start)/(duration-start)));weight=u*u*(3-2*u)
  result.append({side:Quaternion(track[frame][0],twists[side]*weight)@track[frame][1] for side,track in tracks.items()})
 return result

def apply_native_arm_clearance(rig,ik,grips,pose,clip,seconds):
 # Solve clearance on this human's actual anatomy. A radial minimum alone can
 # push the forearm into the chest when the hand passes close to the shoulder.
 if clip.get('twoHanded') or not clip.get('athleticAttack'):
  raise ValueError('nativeArmClearance supports single-weapon athletic attacks only')
 config=clip['nativeArmClearance'];duration=clip['duration']
 def smooth(value):
  value=max(0,min(1,value));return value*value*(3-2*value)
 weight=smooth(seconds/min(.06,duration*.14))*smooth((duration-seconds)/min(.10,duration*.20))
 if weight<1e-12:return
 shoulder=rig.pose.bones['upperarm_r'].head.copy();elbow=rig.pose.bones['lowerarm_r'].head.copy()
 bone=rig.pose.bones['hand_r'];wrist=bone.head.copy();palm=bone.matrix@grips['r']['center']
 turn=Quaternion((0,0,1),pose['chest']);forward=turn@Vector((0,-1,0));lateral=turn@Vector((1,0,0))
 target=wrist+Vector((0,0,(pose['shift'][2]+config.get('referenceDrop',.07))*weight))-lateral*config['outward']*weight
 deficit=config['forward']-(target-shoulder).dot(forward)
 target+=forward*(.5*(deficit+math.sqrt(deficit*deficit+.0004))*weight)
 reach=((elbow-shoulder).length+(wrist-elbow).length)*clip['nativeReachLimit']
 chord=target-shoulder
 if chord.length>reach:target=shoulder+chord.normalized()*reach
 center=Vector(pose['grip']).lerp(palm,weight)+target-wrist
 hand=ik['hands']['r'];hand.location=center-hand.rotation_quaternion@grips['r']['center']
 chord=hand.location-shoulder
 if chord.length>reach:hand.location=shoulder+chord.normalized()*reach
 guide=turn@Vector(config['guide']);guide.x+=pose['shift'][0];guide.y+=pose['shift'][1];guide.z+=pose['shift'][2]*.4
 ik['poles']['r'].location=ik['poles']['r'].location.lerp(guide,weight)
 bpy.context.view_layer.update()

def apply_native_targets(rig,ik,grips,pose,clip,golf=False,palm_rotations=None,seconds=0):
 if clip.get('nativeSelectionIdle') and clip.get('selectionStandingKneeDegrees'):
  # Solve height from both native legs and their fixed ankle targets. The more
  # extended leg sets the bound; never straighten it to raise the other knee.
  lateral=clip.get('selectionPelvisLateralCorrection',0)
  angle=math.radians(clip['selectionStandingKneeDegrees']);lifts=[]
  for side in ['r','l']:
   upper=rig.pose.bones['thigh_'+side];lower=rig.pose.bones['calf_'+side]
   ankle=ik['footBase'][side].copy();pos=pose['foot'+side.upper()]
   ankle.x=pos[0];ankle.y=pos[1];ankle.z+=max(0,pos[2])
   delta=upper.head-ankle;delta.x+=lateral
   a,b=upper.bone.length,lower.bone.length
   reach_squared=a*a+b*b+2*a*b*math.cos(angle)
   vertical_squared=reach_squared-delta.x*delta.x-delta.y*delta.y
   if vertical_squared<=0:raise ValueError('Selection stance exceeds native leg reach')
   lifts.append(math.sqrt(vertical_squared)-delta.z)
  lift=min(lifts)
  if abs(lift)>.05:raise ValueError('Selection pelvis correction exceeds 5 cm; inspect stance')
  pelvis=rig.pose.bones['pelvis'];matrix=pelvis.matrix.copy()
  matrix.translation+=Vector((lateral,0,lift));pelvis.matrix=matrix
  bpy.context.view_layer.update()
 for side in ['r','l']:
  sign=-1 if side=='r' else 1;center,_,q,_=palm_target(pose,clip,grips,side)
  if palm_rotations:q=palm_rotations[side]
  ik['hands'][side].rotation_quaternion=q;ik['hands'][side].location=center-q@grips[side]['center']
  ik['poles'][side].location=pose.get('elbow'+side.upper(),(sign*.6,-.22,1.05))
  if clip.get('nativeSelectionIdle'):
   # Direct native wrist targets keep the forearm forward when the authored
   # shaft changes palm orientation. Guides below each shoulder keep elbows low.
   upper=rig.pose.bones['upperarm_'+side];lower=rig.pose.bones['lowerarm_'+side]
   length=upper.bone.length+lower.bone.length;turn=Quaternion((0,0,1),pose['chest'])
   ik['hands'][side].location=upper.head+turn@Vector(clip['selectionWristOffsets'][side])*length
   ik['poles'][side].location=upper.head+turn@Vector(clip['selectionElbowOffsets'][side])*length
  foot=ik['feet'][side];foot.location=ik['footBase'][side].copy()
  if 'foot'+side.upper() in pose:
   pos=pose['foot'+side.upper()];foot.location.x=pos[0];foot.location.y=pos[1];foot.location.z+=max(0,pos[2])
  heel=max(0,pose['heel']) if side==('l' if golf else 'r') else 0;foot.location.z+=heel*.09
  foot.rotation_quaternion=Quaternion((0,0,1),pose.get('yaw'+side.upper(),.16 if golf and side=='r' else 0))@Quaternion((1,0,0),heel*.62)@ik['footRot'][side]
  knee_yaw=0 if golf else (pose.get('yaw'+side.upper(),pose['hip'])+pose['hip'])*.5
  ik['knees'][side].location=Quaternion((0,0,1),knee_yaw)@Vector((sign*.25,-.8,.5))
 if clip['twoHanded'] and not golf:
  # Keep one shared handle inside both native arms' reach, preserving shaft spacing.
  translation=Vector((0,0,0))
  for _ in range(24):
   for side in ['r','l']:
    upper=rig.pose.bones['upperarm_'+side];lower=rig.pose.bones['lowerarm_'+side]
    radius=(upper.bone.length+lower.bone.length)*clip.get('nativeReachLimit',.985)
    offset=ik['hands'][side].location+translation-upper.head
    if offset.length>radius:translation+=offset.normalized()*(radius-offset.length)
  for hand in ik['hands'].values():hand.location+=translation
 if clip.get('nativeReachLimit') and not clip['twoHanded']:
  # Keep each native arm flexed without translating the clavicle or stretching the limb.
  bpy.context.view_layer.update()
  for side in ['r','l']:
   upper=rig.pose.bones['upperarm_'+side];lower=rig.pose.bones['lowerarm_'+side]
   radius=(upper.bone.length+lower.bone.length)*clip['nativeReachLimit']
   offset=ik['hands'][side].location-upper.head
   if offset.length>radius:ik['hands'][side].location=upper.head+offset.normalized()*radius
 bpy.context.view_layer.update()
 if pose.get('freeHand',0)>0 and not clip['twoHanded']:
  # An empty guarding hand follows the forearm instead of an imaginary weapon shaft.
  relative=rig.data.bones['lowerarm_l'].matrix_local.to_quaternion().inverted()@rig.data.bones['hand_l'].matrix_local.to_quaternion()
  ik['hands']['l'].rotation_quaternion=rig.pose.bones['lowerarm_l'].matrix.to_quaternion()@relative
  bpy.context.view_layer.update()
 if clip.get('nativeArmClearance'):apply_native_arm_clearance(rig,ik,grips,pose,clip,seconds)

def apply_native_locomotion(rig,ik,spec,phase):
 """Keep licensed upper-body motion and solve native stance contacts explicitly."""
 angle=spec['angle'];support=spec['support'];amplitude=spec['amplitude']
 # The low pelvis leaves room for knee flexion at both ends of the support stride.
 pelvis=rig.pose.bones['pelvis'];rest=pelvis.bone.matrix_local
 bounce=.022*math.cos(phase*math.tau*2)
 displacement=Vector((.025*math.sin(phase*math.tau),0,(-.24 if spec['source']=='Sprint_Loop' else -.21)+bounce))
 pelvis.location=rest.to_quaternion().inverted()@displacement
 lean=Quaternion(Vector((math.cos(angle),math.sin(angle),0)),.10 if spec['source']=='Sprint_Loop' else .055)
 world=pelvis.matrix.copy();world.translation=rest.translation+displacement
 world=Matrix.Translation(world.translation)@lean.to_matrix().to_4x4()@Matrix.Translation(-world.translation)@world
 pelvis.matrix=world;bpy.context.view_layer.update()
 for side,offset in [('r',0),('l',.5)]:
  p=(phase+offset)%1
  if p<support:travel=amplitude*(1-2*p/support);lift=0
  else:
   u=(p-support)/(1-support);slope=-2*amplitude*(1-support)/support
   travel=(2*u**3-3*u*u+1)*(-amplitude)+(u**3-2*u*u+u)*slope+(-2*u**3+3*u*u)*amplitude+(u**3-u*u)*slope
   # A running foot folds upward during recovery, then returns before loading.
   lift=locomotion_profile.recovery_lift(u,spec['lift'])
  target=ik['feet'][side];base=ik['footBase'][side]
  target.location=Vector(((-1 if side=='r' else 1)*spec['width']+math.sin(angle)*travel,-math.cos(angle)*travel,base.z+lift))
  # Roll from heel contact to toe-off; the middle support interval stays flat.
  if p<.04:pitch=-.15*(1-p/.04)
  elif p>support-.04 and p<support:pitch=.25*(p-support+.04)/.04
  elif p>=support:pitch=.25-.40*(p-support)/(1-support)
  else:pitch=0
  target.rotation_quaternion=Quaternion(Vector((1,0,0)),pitch)@ik['footRot'][side]
  if p<support:target.location.z+=max(0,math.sin(pitch))*.12
  ik['knees'][side].location=Vector(((-1 if side=='r' else 1)*spec['width'], -.9, .45))
 bpy.context.view_layer.update()
 # Move part of the turn into the hips while retaining the source chest/arm rotations.
 # Native thighs attach to spine_01; compensate above that branch.
 spine=rig.pose.bones['spine_02'];source_chest_rotation=spine.matrix.to_quaternion()
 yaw=Quaternion(Vector((0,0,1)),locomotion_profile.pelvis_yaw(phase,angle))
 position=pelvis.matrix.translation.copy();rotation=yaw@pelvis.matrix.to_quaternion()
 pelvis.matrix=Matrix.Translation(position)@rotation.to_matrix().to_4x4()
 bpy.context.view_layer.update()
 chest=spine.matrix.copy();spine.matrix=Matrix.Translation(chest.translation)@source_chest_rotation.to_matrix().to_4x4()
 bpy.context.view_layer.update()
 # Preserve support targets; both leg reaches limit the pelvis lift.
 budgets=[]
 for side in ['r','l']:
  hip=rig.pose.bones['thigh_'+side].head;ankle=ik['feet'][side].location
  upper=rig.data.bones['calf_'+side].head_local-rig.data.bones['thigh_'+side].head_local
  lower=rig.data.bones['foot_'+side].head_local-rig.data.bones['calf_'+side].head_local
  reach=(upper.length+lower.length)*.985;horizontal=(ankle.xy-hip.xy).length
  budgets.append(ankle.z+math.sqrt(max(0.,reach*reach-horizontal*horizontal))-hip.z)
 lift=locomotion_profile.posture_lift(phase,budgets)
 world=pelvis.matrix.copy();world.translation.z+=lift;pelvis.matrix=world
 bpy.context.view_layer.update()

def bake_rocketbox_actions(rig,clip_names=None,clip_overrides=None):
 """Bake native anatomical poses into named NLA clips for per-avatar export."""
 import json
 data=json.loads((ROOT/'src/motion-data.json').read_text());locomotion=json.loads((ROOT/'src/locomotion-data.json').read_text());scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=0
 selection_path=ROOT/'src/selection-data.json'
 selection=json.loads(selection_path.read_text()) if selection_path.exists() else {}
 if set(selection)&set(data):raise ValueError('Selection clip names must be separate from combat/golf names')
 data.update(selection)
 for name,values in (clip_overrides or {}).items():
  if name not in data:raise ValueError(f'Unknown authored clip override: {name}')
  data[name]={**data[name],**values}
 filenames=['warrior-motion.glb','golf-motion.glb']
 if (ROOT/'public/models/guard-motion.glb').exists():filenames.append('guard-motion.glb')
 sources=[import_motion_source(filename) for filename in filenames]
 attack_source_names={name for name,clip in data.items() if clip.get('athleticAttack') or clip.get('nativeAttackReady')}
 attack_source=import_motion_source('attack-motion.glb') if attack_source_names and (clip_names is None or attack_source_names&set(clip_names)) else None
 if attack_source:
  for _,actions,_ in sources:
   for original in actions:
    if original.name.split('.')[0] in attack_source_names:original.name='superseded_'+original.name
  sources.append(attack_source)
 selection_names={name for name,clip in selection.items() if clip.get('nativeSelectionIdle')}
 if selection_names and (clip_names is None or selection_names&set(clip_names)):
  sources.append(import_motion_source('selection-motion.glb'))
 authored_source_names=attack_source_names|selection_names
 if clip_names and set(clip_names)<=set(locomotion)|authored_source_names:scene.render.fps=max(60,max((data.get(name,{}).get('nativeSampleRate',60) for name in clip_names),default=60))
 # Preserve explicit dense clips during a later full-character export as well.
 scene.render.fps=max(scene.render.fps,max((data.get(name,{}).get('nativeSampleRate',30) for name in (clip_names or data)),default=30))
 authored=sources[1];source=authored[0];mapping=retarget_setup(rig,source)
 address=next(a for a in authored[1] if a.name.split('.')[0]=='Golf_Address')
 source.animation_data.action=address;scene.frame_set(round(address.frame_range[0]));retarget_frame(rig,source,*mapping);grips=measure_grips(rig)
 for bone in rig.pose.bones:bone.rotation_quaternion=Quaternion();bone.location=(0,0,0)
 bpy.context.view_layer.update();ik=create_native_ik(rig);rig.animation_data_create();outputs=[]
 for source,actions,objects in sources:
  mapping=retarget_setup(rig,source)
  jobs=[(a,a.name.split('.')[0]) for a in sorted(actions,key=lambda a:a.name)]
  jobs.extend((a,name) for a in actions for name,spec in locomotion.items() if a.name.split('.')[0]==spec['source'])
  for original,name in jobs:
   if name in attack_source_names and attack_source and source!=attack_source[0]:continue
   if clip_names is not None and name not in clip_names:continue
   if name in {a.name for a in outputs}:continue
   start,end=original.frame_range;duration=(end-start)/30;clip=data.get(name);gait=locomotion.get(name)
   if gait:duration=gait['duration']
   if clip:duration=clip['duration']
   original.name='source_'+name;action=bpy.data.actions.new(name);rig.animation_data.action=action
   source.animation_data.action=original;sample_rate=clip.get('nativeSampleRate',60 if gait or name in attack_source_names else 30) if clip else 60 if gait else 30
   # Include the exact end of authored clips, even when duration is not an
   # integer number of samples. Rounding down left the .72 s cut in mid-return.
   authored_attack=name in authored_source_names
   count=max(1,math.ceil(duration*sample_rate-1e-9) if authored_attack else round(duration*sample_rate));max_error=0
   for constraint in ik['constraints']:
    constraint.influence=1 if clip or (gait and constraint.target.name.startswith(('native_ankle_','native_knee_'))) else 0
    if constraint.type=='IK' and constraint.target.name.startswith('native_palm_'):constraint.chain_count=2
   palm_frames=plan_palm_recovery(clip,grips,count,sample_rate) if clip and clip.get('athleticAttack') else None
   previous_rotations={}
   for frame in range(count+1):
    source_phase=min(frame/sample_rate,duration)/duration if name in authored_source_names else frame/count
    if gait:source_phase=(source_phase+(0 if name=='Run_Backward' else .5))%1
    source_frame=start+(end-start)*source_phase;scene.frame_set(int(source_frame),subframe=source_frame%1)
    retarget_frame(rig,source,*mapping)
    if gait:apply_native_locomotion(rig,ik,gait,frame/count)
    if clip:
     pose=sample_authored(clip,source_phase)
     apply_native_targets(rig,ik,grips,pose,clip,name.startswith('Golf_'),palm_frames[frame] if palm_frames else None,min(frame/sample_rate,clip['duration']))
    if clip:max_error=max(max_error,*[(rig.pose.bones['hand_'+side].head-ik['hands'][side].location).length for side in ['r','l']])
    matrices={b.name:b.matrix.copy() for b in rig.pose.bones}
    for bone in rig.pose.bones:
     kwargs={'parent_matrix':matrices[bone.parent.name],'parent_matrix_local':bone.parent.bone.matrix_local} if bone.parent else {}
     local=bone.bone.convert_local_to_pose(matrices[bone.name],bone.bone.matrix_local,invert=True,**kwargs)
     bone.location,bone.rotation_quaternion,bone.scale=local.decompose()
     # q and -q encode the same rotation. Blender interpolates their components
     # before glTF export, so alternating signs can turn a valid wrist upside down.
     previous=previous_rotations.get(bone.name)
     if previous is not None and bone.rotation_quaternion.dot(previous)<0:bone.rotation_quaternion.negate()
     previous_rotations[bone.name]=bone.rotation_quaternion.copy()
     # NLA export truncates fractional end frames. Put the exact endpoint pose
     # on the next whole sample, then restore its time during GLB append.
     for path in ['location','rotation_quaternion','scale']:bone.keyframe_insert(data_path=path,frame=frame*scene.render.fps/sample_rate,group=bone.name)
   # These keys already sample the solved motion. Automatic Bezier handles add
   # unrequested overshoot between solved support and wrist positions.
   for layer in action.layers:
    for strip in layer.strips:
     for bag in strip.channelbags:
      for curve in bag.fcurves:
       for key in curve.keyframe_points:key.interpolation='LINEAR'
   rig.animation_data.action=None;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True;outputs.append(action)
   print('NATIVE_CLIP',name,count+1,'max_wrist_error',round(max_error,4),flush=True)
 if clip_names is not None:
  missing=set(clip_names)-{a.name for a in outputs}
  if missing:raise ValueError('Missing requested native clips: '+', '.join(sorted(missing)))
 for bone in rig.pose.bones:
  for constraint in list(bone.constraints):bone.constraints.remove(constraint)
  bone.location=(0,0,0);bone.rotation_quaternion=Quaternion();bone.scale=(1,1,1)
 for key in ['hands','feet','poles','knees']:
  for obj in ik[key].values():bpy.data.objects.remove(obj,do_unlink=True)
 for source,actions,objects in sources:
  for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
  for action in actions:
   if action.users==0:bpy.data.actions.remove(action)
 for track in rig.animation_data.nla_tracks:track.mute=False
 scene.frame_set(0);bpy.context.view_layer.update()
 return outputs
