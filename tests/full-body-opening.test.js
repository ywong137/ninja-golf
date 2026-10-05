import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Quaternion,Vector3,LoopOnce} from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {attackDefinition} from '../src/combat.js';
import {withMotionTiming} from '../src/attack-timing.js';
import {WARRIORS} from '../src/warriors.js';
import {attackFootContacts} from '../src/foot-placement.js';
import {createWeapon} from '../src/weapons.js';
import {gripFrame} from '../src/hand-grip.js';

const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
// These timing, support, and grip fixtures describe the retained UAL1 cut.
// Active UAL2 combos use source-connected-combo and runtime blade checks.
const hero=WARRIORS.find(h=>h.model==='kaede'),name='Ace_Cut_Diagonal',record=motions[name];

test('the retained UAL1 opening cut has one damage contact on its gameplay clock',()=>{
 const attack=withMotionTiming(attackDefinition('light',0,hero.combatStyle),record);
 assert.equal(attack.hits.length,1);
 assert.ok(attack.hits[0]>.25&&attack.hits[0]<.5);
 assert.equal(attack.duration,record.combatDuration);
 assert.ok(record.nativeAttachment&&record.nativeStanceFeet);
 assert.equal(attack.hits[0]/attack.duration,record.impacts[0]/record.duration);
});

test('the retained UAL1 opening cut steps, turns, and keeps native hinges and a fitted sword hand',async t=>{
 const rig=await loadNativeSkin(new URL('../public/models/kaede.glb',import.meta.url)),bones={};
 rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
 const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const wrist=bones.hand_r.quaternion.clone().normalize(),skin=skinGroups(rig);
 const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).kaede.sword.r;
 const clip=rig.animations.find(c=>c.name===name);assert.ok(clip);
 assert.ok(Math.abs(clip.duration-record.duration)<1e-6);
 const action=rig.mixer.clipAction(clip).setLoop(LoopOnce).play();action.clampWhenFinished=true;
 const position=n=>bones[n].getWorldPosition(new Vector3());
 let firstFoot,firstChest,minHip=Infinity,maxHip=-Infinity,step=0,turn=0,maxWrist=0,previous=null,maxJointStep=0;
 const count=Math.ceil(clip.duration*120);
 for(let i=0;i<=count;i++){
  action.time=i/count*clip.duration;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
  const foot=position('foot_l'),chest=bones.spine_03.getWorldQuaternion(new Quaternion());
  firstFoot??=foot.clone();firstChest??=chest.clone();step=Math.max(step,foot.distanceTo(firstFoot));turn=Math.max(turn,chest.angleTo(firstChest));
  minHip=Math.min(minHip,position('pelvis').y);maxHip=Math.max(maxHip,position('pelvis').y);
  const current={};
  for(const s of ['r','l']){
   const arm=measureArmAnatomy(arms[s],captureArmPose(bones,s));
   assert.ok(arm.signedFlexionDegrees>=0&&arm.signedFlexionDegrees<150,JSON.stringify(arm));
   assert.ok(arm.hingeDeviationDegrees<.1,JSON.stringify(arm));
   assert.ok(Math.abs(arm.humeralRollDegrees)<70.5,JSON.stringify(arm));
   assert.ok(Math.abs(arm.forearmTwistDegrees)<85.1,JSON.stringify(arm));
   const leg=measureLegAnatomy(legs[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<130&&leg.kneeDeviation<.1,JSON.stringify(leg));
   for(const part of ['upperarm','lowerarm','hand']){
    const n=part+'_'+s;current[n]=bones[n].quaternion.clone().normalize();
    if(previous)maxJointStep=Math.max(maxJointStep,current[n].angleTo(previous[n])*180/Math.PI);
   }
  }
  previous=current;
  maxWrist=Math.max(maxWrist,wrist.angleTo(bones.hand_r.quaternion.clone().normalize())*180/Math.PI);
  for(const [finger,q]of Object.entries(grip.rotations))assert.ok(bones[finger].quaternion.angleTo(new Quaternion().fromArray(q))<.001,'The sword hand lost its fitted grip.');
 }
 assert.ok(step>.5,'The full-body cut must include the source step.');
 assert.ok(turn>.5,'The chest must turn with the cut.');
 assert.ok(maxHip-minHip>.15,'The body must load and recover through the legs.');
 assert.ok(maxWrist<30,'The sword wrist exceeds the reviewed fitting range.');
 assert.ok(maxJointStep<23,'The arms snap between 120 Hz samples.');
 // Inspect the deformed arms at preparation, contact, and recovery.
 for(const time of [.28,.43,.55,.85]){
  action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
  for(const s of ['r','l']){
   const m=measureArmSkin(rig,skin,s);
   assert.ok(m['fold_'+s].maxRadialPenetration<.003,JSON.stringify({time,side:s,fold:m['fold_'+s]}));
   assert.equal(m['forearmTorso_'+s].pairs,0,`The forearm intersects the torso at ${time}.`);
  }
 }
 t.diagnostic(JSON.stringify({samples:count+1,stepMetres:step,chestTurnDegrees:turn*180/Math.PI,hipTravel:maxHip-minHip,maxWrist,maxJointStep}));
});

test('retained UAL1 source support windows retain contact through heel and toe roll',()=>{
 const raisedAnkles={footR:[0,0,1],footL:[0,0,1]};
 const impact=attackFootContacts(record,record.impacts[0],raisedAnkles);
 assert.equal(impact.stance.l,true);assert.equal(impact.stance.r,false);
 const recovery=attackFootContacts(record,.98,raisedAnkles);
 assert.equal(recovery.stance.r,true);assert.equal(recovery.stance.l,false);
});


test('the retained UAL1 opening cut leads with the cutting edge at the damage contact',async t=>{
 const rig=await loadNativeSkin(new URL('../public/models/kaede.glb',import.meta.url)),bones={};
 rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const rotation=name=>bones[name].getWorldQuaternion(new Quaternion());
 const play=name=>{
  rig.mixer.stopAllAction();const action=rig.mixer.clipAction(rig.animations.find(c=>c.name===name)).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
  return time=>{action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};
 };
 play('Ace_Ready')(0);
 const pose=motions.Ace_Ready.poses[0],up=new Vector3(0,1,0);
 const shaft=new Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize();
 const frame=rotation('hand_r').invert().multiply(new Quaternion().setFromUnitVectors(up,shaft).multiply(new Quaternion().setFromAxisAngle(up,pose.roll??0)));
 const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).kaede.sword.r;
 const weapon=createWeapon('jian'),sample=play(name);
 const bladePoint=time=>{
  sample(time);weapon.quaternion.copy(rotation('hand_r')).multiply(gripFrame(bones,grip,'r',frame).frame).multiply(new Quaternion().setFromAxisAngle(up,record.weaponGripRoll??0));
  weapon.position.copy(bones.hand_r.localToWorld(new Vector3().fromArray(grip.center))).addScaledVector(up.clone().applyQuaternion(weapon.quaternion),-weapon.userData.primaryGrip);
  weapon.updateMatrixWorld(true);return weapon.localToWorld(new Vector3(0,.7,0));
 };
 const impact=record.impacts[0],velocity=bladePoint(impact+1/480).sub(bladePoint(impact-1/480)).normalize();bladePoint(impact);
 const edge=Math.abs(velocity.dot(new Vector3(1,0,0).applyQuaternion(weapon.quaternion))),face=Math.abs(velocity.dot(new Vector3(0,0,1).applyQuaternion(weapon.quaternion)));
 assert.ok(edge>.75&&face<.35,`Blade contacts with its flat face: ${JSON.stringify({edge,face})}`);
 t.diagnostic(JSON.stringify({edge,face}));
});
