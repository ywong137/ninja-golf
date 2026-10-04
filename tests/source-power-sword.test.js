import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LoopOnce,Quaternion,Vector3} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy} from '../src/wrist-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {WARRIORS} from '../src/warriors.js';
import {withMotionTiming} from '../src/attack-timing.js';
import {attackDefinition} from '../src/combat.js';
import {samplePlanarRoot,validatePlanarRoot} from '../src/attack-root-motion.js';
import {gripFrame} from '../src/hand-grip.js';

const records=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const gripData=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
for(const [model,kind,name,count,wristLimit,jointLimit=8] of [['sora','heavy','Closer_Power_Finish',1,28],['sora','musou','Closer_Musou_Pursuit',4,28],['ronin','musou','Ronin_Musou_Advance',3,43],['ayame','musou','Hustler_Musou_Advance',4,28],['kaede','musou','Ace_Musou_Tempest',7,28,9]])test(name+' retains body motion, anatomical joints, closed grip, and edge-first impacts',async t=>{
 const hero=WARRIORS.find(w=>w.model===model),grip=gripData[model].sword.r;
 const rig=await loadNativeSkin(new URL(`../public/models/${model}.glb`,import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
 const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const wrists=Object.fromEntries(['r','l'].map(s=>[s,calibrateWristAnatomy(captureWristPose(bones,s))]));
 // Match the runtime's fixed palm frame from the native Ready presentation.
 const ready=rig.mixer.clipAction(rig.animations.find(c=>c.name===hero.readyClip)).play();rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
 const p=records[hero.readyClip].poses[0],up=new Vector3(0,1,0),shaft=new Vector3(p.tip[0]-p.grip[0],p.tip[2]-p.grip[2],p.grip[1]-p.tip[1]).normalize();
 const frame=bones.hand_r.getWorldQuaternion(new Quaternion()).invert().multiply(new Quaternion().setFromUnitVectors(up,shaft).multiply(new Quaternion().setFromAxisAngle(up,p.roll??0)));
 const profile=gripFrame(bones,grip,'r',frame);ready.stop();
 const record=records[name],clip=rig.animations.find(c=>c.name===name);assert.ok(clip);validatePlanarRoot(record.planarRoot);
 const attack=withMotionTiming(attackDefinition(kind,0,hero.combatStyle),record);assert.equal(attack.hits.length,count);
 assert.ok(record.entryBlend>=.1&&record.entryBlend<attack.hits[0]);
 const action=rig.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
 const sample=time=>{action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};
 let maxWrist=0,maxJointStep=0,previous,origin,minHip=Infinity,maxHip=-Infinity,firstChest,turn=0;
 for(let i=0;i<=Math.ceil(clip.duration*240);i++){
  const time=Math.min(i/240,clip.duration);sample(time);const current={};
  const p=bones.pelvis.getWorldPosition(new Vector3());origin??=p.clone();
  assert.ok(Math.hypot(p.x-origin.x,p.z-origin.z)<1e-6,'Travel was applied to both the model and actor.');minHip=Math.min(minHip,p.y);maxHip=Math.max(maxHip,p.y);
  const chest=bones.spine_03.getWorldQuaternion(new Quaternion());firstChest??=chest.clone();turn=Math.max(turn,chest.angleTo(firstChest));
  for(const s of ['r','l']){
   const arm=measureArmAnatomy(arms[s],captureArmPose(bones,s)),leg=measureLegAnatomy(legs[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<150&&arm.hingeDeviationDegrees<.1&&Math.abs(arm.forearmTwistDegrees)<70.01,JSON.stringify({time,arm}));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<125&&leg.kneeDeviation<.1&&Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify({time,leg}));
   for(const part of ['upperarm','lowerarm','hand']){const key=part+'_'+s;current[key]=bones[key].quaternion.clone().normalize();if(previous)maxJointStep=Math.max(maxJointStep,current[key].angleTo(previous[key])*180/Math.PI);}
  }
  previous=current;maxWrist=Math.max(maxWrist,...(record.twoHanded?['r','l']:['r']).map(s=>measureWristAnatomy(wrists[s],captureWristPose(bones,s)).totalDegrees));
  for(const side of record.twoHanded?['r','l']:['r'])for(const [finger,q] of Object.entries(gripData[model].sword[side].rotations))assert.ok(bones[finger].quaternion.clone().normalize().angleTo(new Quaternion().fromArray(q).normalize())<.001,'The sword grip opened.');
  if(record.twoHanded){
   const right=bones.hand_r.localToWorld(new Vector3().fromArray(grip.center)),left=bones.hand_l.localToWorld(new Vector3().fromArray(gripData[model].sword.l.center));
   const shaft=new Vector3(0,1,0).applyQuaternion(bones.hand_r.getWorldQuaternion(new Quaternion()).multiply(profile.frame));
   assert.ok(right.addScaledVector(shaft,-record.gripSpacing).distanceTo(left)<.001,'The hands separate from the shared handle.');
  }
 }
 assert.ok(maxWrist<wristLimit,'The wrist exceeds the reviewed fitted range: '+maxWrist);
 // The Ace opening uses the existing regular-combo continuity bound (9 degrees).
 assert.ok(maxJointStep<jointLimit,'The arm snaps between samples.');
 assert.ok(turn>1&&maxHip-minHip>.15&&samplePlanarRoot(record.planarRoot,record.duration).z>1.2,'The cut lost its full-body turn, level change, or step.');
 const blade=time=>{sample(time);const q=bones.hand_r.getWorldQuaternion(new Quaternion()).multiply(profile.frame).multiply(new Quaternion().setFromAxisAngle(up,record.weaponGripRoll??0));return {point:bones.hand_r.localToWorld(profile.center.clone()).addScaledVector(new Vector3(0,1,0).applyQuaternion(q),.5),edge:new Vector3(1,0,0).applyQuaternion(q)};};
 const edges=record.impacts.map(time=>{const velocity=blade(time+1/480).point.sub(blade(time-1/480).point).normalize();const edge=blade(time).edge.dot(velocity);return hero.weaponKind==='jian'?Math.abs(edge):edge;});
 assert.ok(edges.every(edge=>edge>.6),'The striking edge trails or hits flat: '+edges);
 t.diagnostic(JSON.stringify({maxWrist,maxJointStep,turnDegrees:turn*180/Math.PI,hipTravel:maxHip-minHip,edges}));
});
