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

for(const clipName of ['Shinobi_Stepping_Cut','Shinobi_Left_Stepping_Cut'])test(clipName+' retains the step, torso turn and body drop with anatomical limbs',async t=>{
 const record=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)))[clipName];
 const rig=await loadNativeSkin(new URL('../public/models/shinobi.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 const arms={},legs={},wrists={};for(const s of ['r','l']){arms[s]=calibrateArmAnatomy(captureArmPose(bones,s));wrists[s]=calibrateWristAnatomy(captureWristPose(bones,s));legs[s]=calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);}
 const clip=rig.animations.find(c=>c.name===clipName);assert.ok(clip);
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

test('Shinobi heavy attack retains a full-body leap and lands with anatomical legs and grounded soles',async t=>{
 const {captureFootSoles,sampleFootSole}=await import('../src/foot-sole.js');
 const motion=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url))).Shinobi_Airborne_Cut;
 assert.equal(hero.motionOverrides.Twin_Heavy_Cleave,'Shinobi_Airborne_Cut');
 assert.deepEqual(motion.impactHands,['r']);assert.ok(motion.nativeSourceMotion&&motion.nativeAttachment&&!motion.twoHanded);
 assert.ok(motion.planarRoot.rows.at(-1).z>.8&&motion.planarRoot.rows.at(-1).z<1);
 const attack=withMotionTiming(attackDefinition('heavy',0,hero.combatStyle),motion);assert.ok(attack.hits[0]>.8&&attack.hits[0]<.95);
 const rig=await loadNativeSkin(new URL('../public/models/shinobi.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 const legs={},arms={},wrists={};for(const side of ['r','l']){legs[side]=calibrateLegAnatomy(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);arms[side]=calibrateArmAnatomy(captureArmPose(bones,side));wrists[side]=calibrateWristAnatomy(captureWristPose(bones,side));}
 const soles=captureFootSoles(rig.scene),clip=rig.animations.find(c=>c.name==='Shinobi_Airborne_Cut'),action=rig.mixer.clipAction(clip).setLoop(LoopOnce).play();action.clampWhenFinished=true;
 let lowest=Infinity,apex=0,landingError=0,maxWrist=0,minHip=Infinity,maxHip=-Infinity,firstChest,turn=0;
 for(let time=0;time<clip.duration;time+=1/240){
  action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
  const height=bones.pelvis.getWorldPosition(new Vector3()).y;minHip=Math.min(minHip,height);maxHip=Math.max(maxHip,height);
  const chest=bones.spine_03.getWorldQuaternion(new Quaternion()).normalize();firstChest??=chest.clone();turn=Math.max(turn,chest.angleTo(firstChest));
  const gaps=[];
  for(const side of ['r','l']){
   const leg=measureLegAnatomy(legs[side],bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]),arm=measureArmAnatomy(arms[side],captureArmPose(bones,side));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<125&&leg.kneeDeviation<.1&&Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify(leg));
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<135&&arm.hingeDeviationDegrees<.1&&Math.abs(arm.forearmTwistDegrees)<70,JSON.stringify(arm));
   maxWrist=Math.max(maxWrist,measureWristAnatomy(wrists[side],captureWristPose(bones,side)).totalDegrees);
   const gap=Math.min(...sampleFootSole(soles[side]).map(p=>p.y));gaps.push(gap);lowest=Math.min(lowest,gap);
   if(time>=1.35&&time<=1.99)landingError=Math.max(landingError,Math.abs(gap));
   if(time>=1.35&&time<=1.99)assert.ok(bones['calf_'+side].getWorldPosition(new Vector3()).y>.03,'The landing knee crosses the floor.');
  }
  apex=Math.max(apex,Math.min(...gaps));
 }
 for(const row of motion.poses)for(const key of ['grip','tip','offGrip','offTip'])assert.ok(row[key]?.length===3&&row[key].every(Number.isFinite),'Both weapon paths must be exported.');
 assert.ok(apex>.3&&apex<.5&&maxHip-minHip>.7&&turn>1.5,'Preserve the source jump, body drop and turn.');
 assert.ok(lowest>-.003&&landingError<.005,'The foot fit lost its floor contact.');assert.ok(maxWrist<30,'The wrist is overbent.');
 t.diagnostic(JSON.stringify({apex,lowest,landingError,maxWrist,hipTravel:maxHip-minHip,turnDegrees:turn*180/Math.PI}));
});

test('Shinobi return cut uses the complete mirrored performance and the left strike trail',()=>{
 const name=hero.motionOverrides.Twin_Cut_Return;
 assert.equal(name,'Shinobi_Left_Stepping_Cut');
 const r=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)))[name];
 assert.ok(r.nativeSourceMotion&&r.nativeAttachment&&!r.twoHanded);
 assert.deepEqual(r.impactHands,['l']);assert.equal(r.duration,record.duration);
 const attack=withMotionTiming(attackDefinition('light',1,hero.combatStyle),r);
 assert.equal(attack.hits.length,1);
 assert.deepEqual(activeBladeTrailHands({...attack,impactHands:r.impactHands,time:attack.hits[0]},true),['l']);
 assert.ok(r.weaponGripRoll< -1.1&&r.weaponGripRoll> -1.2);
 assert.ok(r.duration-r.impacts[0]>.8,'Keep the complete source recovery.');
});

test('mirrored Shinobi motion preserves the source body trajectory with opposite limbs',async t=>{
 const rig=await loadNativeSkin(new URL('../public/models/shinobi.glb',import.meta.url));
 const names=['pelvis','spine_03','Head',...['upperarm','lowerarm','hand','thigh','calf','foot'].flatMap(n=>['r','l'].map(s=>n+'_'+s))];
 rig.scene.updateMatrixWorld(true);const center=rig.scene.getObjectByName('pelvis').getWorldPosition(new Vector3()).x;
 const frame=(name,time)=>{rig.mixer.stopAllAction();const action=rig.mixer.clipAction(rig.animations.find(c=>c.name===name)).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);return Object.fromEntries(names.map(n=>[n,rig.scene.getObjectByName(n).getWorldPosition(new Vector3())]));};
 let error=0;
 for(const time of [0,.15,.3,.425,.6,.85,1.15,1.53]){
  const original=frame('Shinobi_Stepping_Cut',time),mirrored=frame('Shinobi_Left_Stepping_Cut',time);
  for(const name of names){const opposite=name.endsWith('_r')?name.slice(0,-2)+'_l':name.endsWith('_l')?name.slice(0,-2)+'_r':name;const expected=original[opposite].clone();expected.x=2*center-expected.x;error=Math.max(error,expected.distanceTo(mirrored[name]));}
 }
 assert.ok(error<.01,'Mirroring changes the whole-body source trajectory by more than one centimetre: '+error);
 t.diagnostic(JSON.stringify({maximumJointPositionError:error}));
});
