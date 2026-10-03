#!/usr/bin/env node
// Transfer an accepted guard arm pose without replacing the legs or body motion.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {patchAnimationRotations} from './patch-animation-rotations.mjs';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy} from './native-arm-anatomy.mjs';
import {PairedGripClosure} from '../src/paired-grip-closure.js';

const {values}=parseArgs({options:{input:{type:'string'},record:{type:'string'},frames:{type:'string'},source:{type:'string'},prefix:{type:'string'},output:{type:'string'},'output-record':{type:'string'},'walk-only':{type:'boolean'},help:{type:'boolean'}}});
if(values.help){
 console.log('node tools/author-native-guard-arms.mjs --input MODEL.glb --record MOTION.json --frames FRAMES.json --source READY_CLIP --prefix GUARD_PREFIX --output CANDIDATE.glb --output-record CANDIDATE.json [--walk-only]\nTransfer eight arm rotations from the accepted source pose. Preserve geometry, legs, body, and unrelated clips. Outputs must remain outside public/.');
 process.exit(0);
}
for(const name of ['input','record','frames','source','prefix','output','output-record'])if(!values[name])throw Error('Supply --'+name+'. Use --help for the full command.');
for(const name of ['output','output-record']){
 const file=path.resolve(values[name]);
 if(file===path.resolve(values.input)||file===path.resolve(values.record))throw Error('Write candidates to separate output files.');
 if(file.includes(path.sep+'public'+path.sep))throw Error('Review candidate outputs outside public/ before integration.');
}
const raw=fs.readFileSync(values.input),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
const records=JSON.parse(fs.readFileSync(values.record)),frames=JSON.parse(fs.readFileSync(values.frames));
const rig=await loadNativeSkin(values.input),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b});
const names=['r','l'].flatMap(side=>['clavicle','upperarm','lowerarm','hand'].map(part=>part+'_'+side));
const calibration=Object.fromEntries(['r','l'].map(side=>[side,calibrateArmAnatomy(captureArmPose(bones,side))]));
const closure=new PairedGripClosure(bones);
const sourceClip=rig.animations.find(a=>a.name===values.source),sourceRecord=records[values.source];
if(!sourceClip||!sourceRecord?.nativeAttachment||!sourceRecord.twoHanded||!(sourceRecord.gripSpacing>0))throw Error('The source must be an accepted native two-hand pose with positive grip spacing.');
for(const side of ['r','l'])if(!frames[side]?.frame||!frames[side]?.center||!frames[side]?.neutralHandRotation)throw Error('Supply complete fitted palm frames and neutral wrists for both hands.');
const sourceAction=rig.mixer.clipAction(sourceClip).reset().play();rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
const armPose=Object.fromEntries(names.map(name=>[name,bones[name].quaternion.clone().normalize()]));
const weaponFrame=bones.hand_r.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().fromArray(frames.r.frame));
// Each accepted pose defines both complete hand frames. Do not assume that a
// legacy support palm has the same roll as its generic attachment profile.
const profiles=Object.fromEntries(['r','l'].map(side=>[side,{
 center:new T.Vector3().fromArray(frames[side].center),
 frame:bones['hand_'+side].getWorldQuaternion(new T.Quaternion()).invert().multiply(weaponFrame),
}]));
const sourceMeasurements=Object.fromEntries(['r','l'].map(side=>[side,{
 ...measureArmAnatomy(calibration[side],captureArmPose(bones,side)),
 wrist:bones['hand_'+side].quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(frames[side].neutralHandRotation).normalize())*180/Math.PI,
}]));
const wristLimit=Math.max(...Object.values(sourceMeasurements).map(m=>m.wrist))+.05;
const forearmLimit=Math.max(70,...Object.values(sourceMeasurements).map(m=>Math.abs(m.forearmTwistDegrees)))+.05;
if(wristLimit>25.1)throw Error('The source guard needs a new wrist pose before transfer: '+JSON.stringify(sourceMeasurements));
const ready=sourceRecord.poses[0],tipLength=Math.hypot(...ready.tip.map((v,i)=>v-ready.grip[i]));
sourceAction.stop();
const suffixes=values['walk-only']?['Walk_Forward','Walk_Right','Walk_Backward','Walk_Left']:['Loop','Impact','Break','Walk_Forward','Walk_Right','Walk_Backward','Walk_Left'];
const entries=[],report={source:values.source,sourceMeasurements,clips:{},preserved:'Geometry, all non-arm channels, and unrelated animation clips'};
const point=name=>bones[name].getWorldPosition(new T.Vector3());
const sourcePoint=p=>[p.x,-p.z,p.y];
for(const suffix of suffixes){
 const name=values.prefix+'_Guard_'+suffix,clip=rig.animations.find(c=>c.name===name),spec=records[name];
 const original=doc.animations.find(a=>a.name===name);
 if(!clip||!spec||!original)throw Error('Missing guard clip or metadata: '+name);
 if(original.extras?.sharedGuardArms)throw Error(name+' already has the shared transfer. Start with the original input.');
 const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 const recoilDegrees=suffix==='Impact'?3:suffix==='Break'?5:0;
 const rotations={},newRotations={};
 for(const bone of names){
  const channels=original.channels.filter(c=>doc.nodes[c.target.node].name===bone&&c.target.path==='rotation');
  if(channels.length>1)throw Error('Duplicate rotation channels: '+name+'/'+bone);
  (channels.length?rotations:newRotations)[bone]=[];
 }
 const row=report.clips[name]={samples:0,recoilDegrees,maxHiltTranslation:0,palmGap:0,wrist:0,hinge:0,shoulder:0,forearm:0,minFlexion:180,maxFlexion:0};
 const times=[...new Set([0,clip.duration,...spec.poses.map(p=>p.t*spec.duration),...Array.from({length:Math.ceil(clip.duration*240)},(_,i)=>i/240)].map(Math.fround))].sort((a,b)=>a-b);
 const poseTimes=new Map(spec.poses.map(p=>[Math.fround(p.t*spec.duration),p]));
 let recoilPeak=0;
 if(recoilDegrees){
  let initial=null,largest=0;
  for(const time of times){
   action.time=Math.min(time,clip.duration);rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
   const chest=bones.pelvis.getWorldQuaternion(new T.Quaternion()).invert().multiply(bones.spine_03.getWorldQuaternion(new T.Quaternion())).normalize();
   initial??=chest.clone();const angle=initial.angleTo(chest);
   if(angle>largest){largest=angle;recoilPeak=time;}
  }
  if(!(recoilPeak>0&&recoilPeak<clip.duration))throw Error(name+' has no measurable body recoil. Author its body response first.');
  row.recoilPeak=recoilPeak;
 }
 for(const time of times){
  action.time=Math.min(time,clip.duration);rig.mixer.update(0);
  const before=Object.fromEntries(names.map(n=>[n,bones[n].quaternion.clone()]));
  for(const n of names)bones[n].quaternion.copy(armPose[n]);rig.scene.updateMatrixWorld(true);
  if(recoilDegrees){
   const pulse=time<=recoilPeak?T.MathUtils.smootherstep(time,0,recoilPeak):1-T.MathUtils.smootherstep(time,recoilPeak,clip.duration);
   // Bone-local X is not anatomical right. Use the actual shoulder line for
   // pitch, independent of the imported rig's bone-axis convention.
   const axis=point('upperarm_l').sub(point('upperarm_r')).normalize();
   if(time===0)row.recoilAxis=axis.toArray();
   const delta=new T.Quaternion().setFromAxisAngle(axis,recoilDegrees*Math.PI/180*pulse);
   for(const side of ['r','l']){
    const lower=bones['lowerarm_'+side];
    const wanted=lower.getWorldQuaternion(new T.Quaternion()).premultiply(delta);
    lower.quaternion.copy(lower.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(wanted));lower.updateWorldMatrix(false,true);
   }
   const solved=closure.apply(profiles,sourceRecord.gripSpacing,1);
   if(!solved.feasible)throw Error(name+'/'+time+': '+solved.reason);
   row.maxHiltTranslation=Math.max(row.maxHiltTranslation,solved.translation);
  }
  const palm=side=>bones['hand_'+side].localToWorld(new T.Vector3().fromArray(frames[side].center));
  const primary=palm('r'),secondary=palm('l'),weapon=bones.hand_r.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().fromArray(frames.r.frame));
  const shaft=new T.Vector3(0,1,0).applyQuaternion(weapon);
  row.samples++;row.palmGap=Math.max(row.palmGap,secondary.distanceTo(primary.clone().addScaledVector(shaft,-sourceRecord.gripSpacing)));
  for(const side of ['r','l']){
   const m=measureArmAnatomy(calibration[side],captureArmPose(bones,side));
   row.wrist=Math.max(row.wrist,bones['hand_'+side].quaternion.angleTo(new T.Quaternion().fromArray(frames[side].neutralHandRotation).normalize())*180/Math.PI);
   row.hinge=Math.max(row.hinge,m.hingeDeviationDegrees);row.shoulder=Math.max(row.shoulder,Math.abs(m.humeralRollDegrees));
   row.forearm=Math.max(row.forearm,Math.abs(m.forearmTwistDegrees));row.minFlexion=Math.min(row.minFlexion,m.signedFlexionDegrees);row.maxFlexion=Math.max(row.maxFlexion,m.signedFlexionDegrees);
  }
  const pose=poseTimes.get(time);
  if(pose){
   const roll=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft).invert().multiply(weapon);
   Object.assign(pose,{grip:sourcePoint(primary),tip:sourcePoint(primary.clone().addScaledVector(shaft,tipLength)),secondaryGrip:sourcePoint(secondary),roll:2*Math.atan2(roll.y,roll.w),elbowR:sourcePoint(point('lowerarm_r')),elbowL:sourcePoint(point('lowerarm_l'))});
  }
  for(const n of names){
   const track=rotations[n]??newRotations[n],q=bones[n].quaternion.clone().normalize();
   if(track.length&&q.dot(new T.Quaternion().fromArray(track,track.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);
   track.push(...q.toArray());
  }
  // Restore the source sample. AnimationMixer can skip unchanged channels.
  for(const n of names)bones[n].quaternion.copy(before[n]);
 }
 if(row.palmGap>.001||row.hinge>.01||row.wrist>wristLimit||row.shoulder>70||row.forearm>forearmLimit||row.minFlexion<0||row.maxFlexion>130)throw Error(name+': arm transfer failed: '+JSON.stringify(row));
 Object.assign(spec,{nativeAttachment:true,pairedGrip:true,gripSpacing:sourceRecord.gripSpacing,sharedGuardArms:values.source});
 if(sourceRecord.primaryGrip!==undefined)spec.primaryGrip=sourceRecord.primaryGrip;
 else delete spec.primaryGrip;
 if(!recoilDegrees)for(const tracks of [rotations,newRotations])for(const [bone,values]of Object.entries(tracks))tracks[bone]=[...values.slice(0,4),...values.slice(-4)];
 entries.push({clip:name,times:recoilDegrees?times:[0,clip.duration],rotations,newRotations,extras:{sharedGuardArms:values.source,guardRecoilDegrees:recoilDegrees}});action.stop();
}
fs.writeFileSync(values.output,patchAnimationRotations(raw,entries));
fs.writeFileSync(values['output-record'],JSON.stringify(records));
fs.writeFileSync(values.output+'.report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
