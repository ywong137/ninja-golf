import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Quaternion,Vector3,LoopOnce} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy} from '../src/wrist-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {WARRIORS} from '../src/warriors.js';
import {attackDefinition} from '../src/combat.js';
import {withMotionTiming} from '../src/attack-timing.js';
import {activeBladeTrailHands} from '../src/effects.js';

const hero=WARRIORS.find(w=>w.model==='shinobi'),name=hero.motionOverrides.Twin_Cut_Diagonal;
const record=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)))[name];
const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).shinobi.sword;

test('Shinobi opening uses a complete source cut and only its attacking blade emits a strike trail',()=>{
 assert.equal(name,'Shinobi_Stepping_Cut');assert.ok(record.nativeSourceMotion&&record.nativeAttachment&&!record.twoHanded);
 assert.deepEqual(record.impactHands,['r']);
 const attack=withMotionTiming(attackDefinition('light',0,hero.combatStyle),record);
 assert.equal(attack.hits.length,1);assert.ok(attack.hits[0]>.2&&attack.hits[0]<.34);
 assert.ok(record.duration-record.impacts[0]>.8,'Retain the complete source recovery.');
 assert.deepEqual(activeBladeTrailHands({...attack,impactHands:record.impactHands,time:attack.hits[0]},true),['r']);
 assert.ok(record.weaponGripRoll>1&&record.weaponGripRoll<1.1,'Retain the reviewed cutting-edge mount.');
});

test('Shinobi source cut retains the step, torso turn and body drop with anatomical limbs',async t=>{
 const rig=await loadNativeSkin(new URL('../public/models/shinobi.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 const arms={},legs={},wrists={};for(const s of ['r','l']){arms[s]=calibrateArmAnatomy(captureArmPose(bones,s));wrists[s]=calibrateWristAnatomy(captureWristPose(bones,s));legs[s]=calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);}
 const clip=rig.animations.find(c=>c.name===name);assert.ok(clip);
 const action=rig.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
 const point=n=>bones[n].getWorldPosition(new Vector3());let firstFeet,firstChest,step=0,turn=0,minHip=Infinity,maxHip=-Infinity,maxWrist=0,maxJointStep=0,previous;
 for(let i=0;i<=Math.ceil(record.duration*240);i++){
  action.time=Math.min(i/240,record.duration);rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
  const chest=bones.spine_03.getWorldQuaternion(new Quaternion()).normalize();firstChest??=chest.clone();firstFeet??=['r','l'].map(s=>point('foot_'+s));
  turn=Math.max(turn,chest.angleTo(firstChest));minHip=Math.min(minHip,point('pelvis').y);maxHip=Math.max(maxHip,point('pelvis').y);const current={};
  for(const [j,s]of ['r','l'].entries()){
   step=Math.max(step,point('foot_'+s).distanceTo(firstFeet[j]));
   const arm=measureArmAnatomy(arms[s],captureArmPose(bones,s)),leg=measureLegAnatomy(legs[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<150&&arm.hingeDeviationDegrees<.1,JSON.stringify(arm));
   assert.ok(Math.abs(arm.forearmTwistDegrees)<70,JSON.stringify(arm));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<125&&leg.kneeDeviation<.1&&Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify(leg));
   maxWrist=Math.max(maxWrist,measureWristAnatomy(wrists[s],captureWristPose(bones,s)).totalDegrees);
   for(const part of ['upperarm','lowerarm','hand']){const key=part+'_'+s;current[key]=bones[key].quaternion.clone().normalize();if(previous)maxJointStep=Math.max(maxJointStep,current[key].angleTo(previous[key])*180/Math.PI);}
   for(const [finger,q]of Object.entries(grip[s].rotations))assert.ok(bones[finger].quaternion.clone().normalize().angleTo(new Quaternion().fromArray(q).normalize())<.001,'Preserve both closed sword grips.');
  }previous=current;
 }
 t.diagnostic(JSON.stringify({step,turnDegrees:turn*180/Math.PI,hipTravel:maxHip-minHip,maxWrist,maxJointStep}));
 assert.ok(step>.3&&turn>.7&&maxHip-minHip>.1,'The attack lost its step, turn or body drop.');
 assert.ok(maxWrist<30,'The sword wrist exceeds the reviewed range.');assert.ok(maxJointStep<12,'The arm snaps between 240 Hz samples.');
});

test('source record export retains an explicit single-handed blade mount',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ninja-source-mount-'));
 try{
  const output=path.join(dir,'record.json');
  execFileSync(process.execPath,['tools/sample-source-cut-record.mjs','--input','public/models/shinobi.glb','--grips','src/grip-data.json','--hero','shinobi','--dual-wield','--clip',name,'--combat-duration',String(record.combatDuration),'--impact',String(record.impacts[0]),'--grip-roll',String(record.weaponGripRoll),'--output',output],{stdio:'pipe'});
  const result=JSON.parse(fs.readFileSync(output))[name];assert.equal(result.twoHanded,false);assert.equal(result.weaponGripRoll,record.weaponGripRoll);
  for(const pose of result.poses){assert.equal(pose.offGrip.length,3);assert.equal(pose.offTip.length,3);assert.ok(Number.isFinite(pose.offRoll));}
  assert.deepEqual(result.poses.map(p=>p.offGrip),record.poses.map(p=>p.offGrip),'Preserve the exported left-hand path.');
  assert.deepEqual(result.poses.map(p=>p.offTip),record.poses.map(p=>p.offTip),'Preserve the exported left-blade direction.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
