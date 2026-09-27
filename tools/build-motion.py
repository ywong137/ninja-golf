"""Prepare authored CC0 motion clips and bake a two-hand IK golf swing."""
import bpy, pathlib, math
from mathutils import Vector, Quaternion
ROOT=pathlib.Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/source/UAL1_Standard.glb'))
keep={'Idle_Loop','Sword_Idle','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Roll','Death01','Hit_Chest'}
for o in bpy.context.scene.objects:
 if o.animation_data:
  for t in list(o.animation_data.nla_tracks):
   if not any(s.action and s.action.name in keep for s in t.strips):o.animation_data.nla_tracks.remove(t)
for a in list(bpy.data.actions):
 if a.name not in keep:bpy.data.actions.remove(a,do_unlink=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/warrior-motion.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False)
# Reuse the library's closed-finger pose for a natural two-hand club grip.
source_rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for track in source_rig.animation_data.nla_tracks:track.mute=True
source_rig.animation_data.action=bpy.data.actions['Jog_Fwd_Loop'];bpy.context.scene.frame_set(8)
finger_pose={b.name:b.rotation_quaternion.copy() for b in source_rig.pose.bones if b.name.split('_')[0] in ['index','middle','ring','pinky','thumb']}
# Create golf clips on the same skeleton as the human asset.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for a in list(bpy.data.actions):bpy.data.actions.remove(a,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/source/Superhero_Male_FullBody.gltf'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data_create();scene=bpy.context.scene;scene.render.fps=30
# The lower arm IK chains coordinate shoulder and elbow motion around a shared grip.
targets={};poles={}
for side in ['l','r']:
 for kind in ['target','pole']:
  ob=bpy.data.objects.new('golf_'+kind+'_'+side,None);scene.collection.objects.link(ob)
  (targets if kind=='target' else poles)[side]=ob
 poles[side].location=(.44 if side=='l' else -.44,-.5,1.2)
 c=rig.pose.bones['lowerarm_'+side].constraints.new('IK');c.target=targets[side];c.pole_target=poles[side];c.chain_count=2;c.pole_angle=-math.pi/2 if side=='l' else math.pi/2;c.use_tail=True
# Keep both feet planted at shoulder width while the upper body turns.
for side in ['l','r']:
 ob=bpy.data.objects.new('golf_foot_'+side,None);scene.collection.objects.link(ob)
 ob.location=rig.pose.bones['foot_'+side].head+Vector((.075 if side=='l' else -.075,-.015,0))
 c=rig.pose.bones['calf_'+side].constraints.new('IK');c.target=ob;c.chain_count=2;c.use_tail=True
for b in rig.pose.bones:b.rotation_mode='QUATERNION'
base_pos={b.name:b.location.copy() for b in rig.pose.bones}

def authored(name,poses,end):
 rig.animation_data.action=bpy.data.actions.new(name)
 for frame,grip,turn,bend,shaft in poses:
  scene.frame_set(frame)
  for b in rig.pose.bones:b.rotation_quaternion=Quaternion();b.location=base_pos[b.name]
  # Weight shift, hip rotation, and shoulder rotation precede the arms.
  rig.pose.bones['pelvis'].rotation_quaternion=Quaternion((0,1,0),turn*.35)
  rig.pose.bones['spine_01'].rotation_quaternion=Quaternion((1,0,0),bend*.55)
  rig.pose.bones['spine_02'].rotation_quaternion=Quaternion((0,1,0),turn*.4)
  rig.pose.bones['spine_03'].rotation_quaternion=Quaternion((0,1,0),turn*.6)@Quaternion((1,0,0),bend*.45)
  for side in ['l','r']:
   targets[side].location=Vector(grip)+Vector((.02 if side=='r' else -.02,0,-.025 if side=='r' else .045))
   targets[side].keyframe_insert(data_path='location',frame=frame)
   rig.pose.bones['thigh_'+side].rotation_quaternion=Quaternion((1,0,0),-.10)
   rig.pose.bones['calf_'+side].rotation_quaternion=Quaternion((1,0,0),.15)
   for finger_name,rotation in finger_pose.items():
    if finger_name in rig.pose.bones:rig.pose.bones[finger_name].rotation_quaternion=rotation
   rig.pose.bones['hand_'+side].rotation_quaternion=Quaternion((1,0,0),shaft)
  for b in rig.pose.bones:
   b.keyframe_insert(data_path='rotation_quaternion',frame=frame);b.keyframe_insert(data_path='location',frame=frame)
 # Bake evaluated IK, then put the action in an NLA strip for a named glTF clip.
 scene.frame_start=1;scene.frame_end=end
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.nla.bake(frame_start=1,frame_end=end,step=1,only_selected=False,visual_keying=True,clear_constraints=False,use_current_action=True,bake_types={'POSE'})
 action=rig.animation_data.action;action.name=name;track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);rig.animation_data.action=None;track.mute=True

a=(0,-.40,1.01)
authored('Golf_Address',[(1,a,0,.2,-.2),(31,(0,-.402,1.015),0,.20,-.2),(61,a,0,.2,-.2)],61)
authored('Golf_Swing',[(1,a,0,.2,-.2),(10,(.30,-.27,1.33),-.48,.17,-.5),(20,(.44,.02,1.69),-.95,.12,-.95),(26,(.40,-.11,1.58),-.6,.16,-.75),(32,(.15,-.39,1.14),.12,.22,-.35),(35,a,.30,.19,-.2),(40,(-.36,-.30,1.39),.83,.14,.6),(50,(-.45,.02,1.68),1.15,.06,1.1),(66,(-.37,.03,1.70),1.1,.03,1.0)],66)
authored('Golf_Putt',[(1,a,0,.22,-.2),(12,(.14,-.4,1.01),-.1,.22,-.2),(23,a,0,.22,-.2),(33,(-.18,-.4,1.03),.13,.22,-.2),(46,a,0,.22,-.2)],46)
for b in rig.pose.bones:
 for c in list(b.constraints):b.constraints.remove(c)
for track in rig.animation_data.nla_tracks:track.mute=False
for o in list(scene.objects):
 if o!=rig:bpy.data.objects.remove(o,do_unlink=True)
# A tiny skin keeps the full joint hierarchy in the motion-only glTF.
mesh=bpy.data.meshes.new('RigCarrier');mesh.from_pydata([(0,0,0),(.001,0,0),(0,.001,0)],[],[(0,1,2)]);o=bpy.data.objects.new('RigCarrier',mesh);scene.collection.objects.link(o);o.vertex_groups.new(name='pelvis').add([0,1,2],1,'REPLACE');m=o.modifiers.new('Rig','ARMATURE');m.object=rig;o.parent=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/golf-motion.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_skins=True)
print('Motion exports finished')
