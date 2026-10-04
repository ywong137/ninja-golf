import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LoopOnce,Quaternion,Vector3} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {matchesAnimationEntry} from '../src/animation-entry.js';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy} from '../src/wrist-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {validatePlanarRoot,samplePlanarRoot} from '../src/attack-root-motion.js';
import {WARRIORS} from '../src/warriors.js';
import {gripFrame} from '../src/hand-grip.js';
import {createWeapon} from '../src/weapons.js';
const gripData=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
const records=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
for(const {model,prefix,finishStep}of [{model:'sora',prefix:'Closer',finishStep:12},{model:'kaede',prefix:'Ace',finishStep:8.1},{model:'ayame',prefix:'Hustler',finishStep:8.1}]){
const names=['Opening','Return','Finish'].map(suffix=>prefix+'_Combo_'+suffix);
const rig=await loadNativeSkin(new URL('../public/models/'+model+'.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const wrist=calibrateWristAnatomy(captureWristPose(bones,'r'));
// Runtime preserves the Ready weapon presentation as its axial reference.
const hero=WARRIORS.find(w=>w.model===model),ready=records[hero.readyClip].poses[0];
play(hero.readyClip)(0);
const shaft=new Vector3(ready.tip[0]-ready.grip[0],ready.tip[2]-ready.grip[2],ready.grip[1]-ready.tip[1]).normalize();
const reference=bones.hand_r.getWorldQuaternion(new Quaternion()).invert().multiply(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),shaft).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),ready.roll??0)));
const palm=gripFrame(bones,gripData[model].sword.r,'r',reference);
function play(name){rig.mixer.stopAllAction();const a=rig.mixer.clipAction(rig.animations.find(c=>c.name===name)).reset().setLoop(LoopOnce).play();a.clampWhenFinished=true;return t=>{a.time=t;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};}

test(model+': every declared combo boundary has the same incoming pose, including scale',()=>{
 for(const name of names.slice(0,2)){
  const {light:b}=records[name].continuations;play(name)(b.at);
  assert.equal(matchesAnimationEntry(bones,rig.animations.find(c=>c.name===name),rig.animations.find(c=>c.name===b.clip)),true,name);
 }
 assert.equal(WARRIORS.find(w=>w.model===model).lightComboLength,3);
});
for(const name of names)test(name+' keeps natural hinges and separates game travel from the local pelvis',t=>{
 const record=records[name],sample=play(name),count=Math.ceil(record.duration*240);validatePlanarRoot(record.planarRoot);
 let previous,maxJointStep=0,maxWrist=0,minKnee=Infinity,maxKnee=0,origin;
 for(let i=0;i<=count;i++){
  const time=i/count*record.duration;sample(time);const position=bones.pelvis.getWorldPosition(new Vector3());origin??=position.clone();
  assert.ok(Math.hypot(position.x-origin.x,position.z-origin.z)<1e-6,'Horizontal root travel was applied twice.');
  const current={};
  for(const side of ['r','l']){
   const arm=measureArmAnatomy(arms[side],captureArmPose(bones,side)),leg=measureLegAnatomy(legs[side],bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<150&&arm.hingeDeviationDegrees<.1&&Math.abs(arm.forearmTwistDegrees)<70.01,JSON.stringify({name,time,arm}));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<125&&leg.kneeDeviation<.1&&Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify({name,time,leg}));
   minKnee=Math.min(minKnee,leg.kneeFlexion);maxKnee=Math.max(maxKnee,leg.kneeFlexion);
   for(const part of ['upperarm','lowerarm','hand']){const key=part+'_'+side;current[key]=bones[key].quaternion.clone().normalize();if(previous)maxJointStep=Math.max(maxJointStep,current[key].angleTo(previous[key])*180/Math.PI);}
  }
  previous=current;maxWrist=Math.max(maxWrist,measureWristAnatomy(wrist,captureWristPose(bones,'r')).totalDegrees);
 }
 assert.ok(maxWrist<28,'Wrist bend exceeds the source fit.');assert.ok(maxJointStep<(name.endsWith('_Combo_Finish')?finishStep:9),'A retargeted arm jumps beyond the reviewed source cut.');
 assert.ok(samplePlanarRoot(record.planarRoot,record.duration).z>.3,'The source step lost its travel.');
 t.diagnostic(JSON.stringify({maxWrist,maxJointStep,minKnee,maxKnee}));
});

test(model+': connected strikes lead with a cutting edge in the direction of travel',t=>{
 const hero=WARRIORS.find(w=>w.model===model),weapon=createWeapon(hero.weaponKind),up=new Vector3(0,1,0),edge=new Vector3(1,0,0),flat=new Vector3(0,0,1),rows=[];
 for(const name of names){
  const record=records[name],sample=play(name),grip=record.primaryGrip??weapon.userData.primaryGrip;
  const frame=palm.frame.clone().multiply(new Quaternion().setFromAxisAngle(up,record.weaponGripRoll??0));
  const at=time=>{
   sample(time);const q=bones.hand_r.getWorldQuaternion(new Quaternion()).multiply(frame);
   const point=bones.hand_r.localToWorld(palm.center.clone());
   const travel=samplePlanarRoot(record.planarRoot,time);
   point.add(new Vector3(travel.x,0,travel.z));
   const tip=new Vector3().fromArray(weapon.userData.tip).lerp(new Vector3(0,grip,0),.2);
   point.add(tip.addScaledVector(up,-grip).applyQuaternion(q));
   return {point,shaft:up.clone().applyQuaternion(q),edge:edge.clone().applyQuaternion(q),flat:flat.clone().applyQuaternion(q)};
  };
  const span=.045*record.duration/record.combatDuration;let total=0,leading=0,slapping=0;
  for(let i=0;i<=12;i++){
   const time=record.impacts[0]-span+2*span*i/12,dt=.002;
   const before=at(time-dt),now=at(time),after=at(time+dt);
   const across=after.point.sub(before.point).divideScalar(2*dt);
   across.addScaledVector(now.shaft,-across.dot(now.shaft));const weight=across.length();
   if(weight<.08)continue;across.normalize();
   const alignment=across.dot(now.edge);
   leading+=(hero.weaponKind==='jian'?Math.abs(alignment):alignment)*weight;
   slapping+=Math.abs(across.dot(now.flat))*weight;total+=weight;
  }
  assert.ok(total>1,'The strike must move its blade.');
  const row={name,edge:leading/total,flat:slapping/total};rows.push(row);
  assert.ok(row.edge>.8&&row.flat<.5,JSON.stringify(row));
 }
 t.diagnostic(JSON.stringify(rows));
});

}
