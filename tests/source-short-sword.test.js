import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {LoopOnce,Quaternion,Vector3} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy} from '../src/wrist-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {attackDefinition} from '../src/combat.js';
import {withMotionTiming} from '../src/attack-timing.js';
import {WARRIORS} from '../src/warriors.js';
import {attackFootContacts} from '../src/foot-placement.js';
import {createWeapon} from '../src/weapons.js';

const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const hero=WARRIORS.find(h=>h.model==='sora'),name=hero.motionOverrides.Sickle_Cut_Diagonal,record=motions[name];
const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).sora.sword.r;
async function load(){
 const rig=await loadNativeSkin(new URL('../public/models/sora.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 return {rig,bones};
}
function play(rig,clipName){
 rig.mixer.stopAllAction();const clip=rig.animations.find(c=>c.name===clipName);assert.ok(clip);
 const action=rig.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
 return time=>{action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};
}

test('the Closer opening cut connects during its supported rising sweep and retains recovery',()=>{
 assert.equal(name,'Closer_Combo_Opening');assert.ok(record.nativeSourceMotion&&record.nativeAttachment);
 const attack=withMotionTiming(attackDefinition('light',0,hero.combatStyle),record);
 assert.equal(attack.hits.length,1);assert.ok(attack.hits[0]>.2&&attack.hits[0]<.24);
 assert.equal(attack.duration,record.combatDuration);assert.ok(record.duration-record.impacts[0]>1);
 assert.ok(attackFootContacts(record,record.impacts[0],{footR:[0,0,1],footL:[0,0,1]}).stance.r);
});

test('the Closer steps and turns with forward knee hinges, a stable wrist, and closed fingers',async t=>{
 const {rig,bones}=await load();
 const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
 const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const wrist=calibrateWristAnatomy(captureWristPose(bones,'r')),sample=play(rig,name),count=Math.ceil(record.duration*240);
 let initialFoot,initialChest,step=0,turn=0,minHip=Infinity,maxHip=-Infinity,maxWrist=0,maxJointStep=0,previous;
 for(let i=0;i<=count;i++){
  sample(i/count*record.duration);
  const foot=bones.foot_l.getWorldPosition(new Vector3()),chest=bones.spine_03.getWorldQuaternion(new Quaternion()).normalize();initialFoot??=foot.clone();initialChest??=chest.clone();
  step=Math.max(step,foot.distanceTo(initialFoot));turn=Math.max(turn,chest.angleTo(initialChest));
  const hip=bones.pelvis.getWorldPosition(new Vector3()).y;minHip=Math.min(minHip,hip);maxHip=Math.max(maxHip,hip);
  const current={};
  for(const s of ['r','l']){
   const arm=measureArmAnatomy(arms[s],captureArmPose(bones,s)),leg=measureLegAnatomy(legs[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<150&&arm.hingeDeviationDegrees<.1,JSON.stringify(arm));
   assert.ok(Math.abs(arm.forearmTwistDegrees)<70.01,JSON.stringify(arm));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<120&&leg.kneeDeviation<.1&&Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify(leg));
   for(const part of ['upperarm','lowerarm','hand']){const key=part+'_'+s;current[key]=bones[key].quaternion.clone().normalize();if(previous)maxJointStep=Math.max(maxJointStep,current[key].angleTo(previous[key])*180/Math.PI);}
  }
  previous=current;maxWrist=Math.max(maxWrist,measureWristAnatomy(wrist,captureWristPose(bones,'r')).totalDegrees);
  for(const [finger,q]of Object.entries(grip.rotations))assert.ok(bones[finger].quaternion.clone().normalize().angleTo(new Quaternion().fromArray(q).normalize())<.001,'The sword grip opened.');
 }
 assert.ok(step>.3&&turn>.7&&maxHip-minHip>.1,'The attack lost its step, torso turn, or weight transfer.');
 assert.ok(maxWrist<15);assert.ok(maxJointStep<8,'The arm snaps between samples.');
 t.diagnostic(JSON.stringify({step,turnDegrees:turn*180/Math.PI,hipTravel:maxHip-minHip,maxWrist,maxJointStep}));
});

test('the short sword leads with its cutting edge at contact',async t=>{
 const {rig,bones}=await load(),rotation=n=>bones[n].getWorldQuaternion(new Quaternion()).normalize(),up=new Vector3(0,1,0);
 play(rig,hero.readyClip)(0);const p=motions[hero.readyClip].poses[0],shaft=new Vector3(p.tip[0]-p.grip[0],p.tip[2]-p.grip[2],p.grip[1]-p.tip[1]).normalize();
 const frame=rotation('hand_r').invert().multiply(new Quaternion().setFromUnitVectors(up,shaft).multiply(new Quaternion().setFromAxisAngle(up,p.roll??0)));
 const weapon=createWeapon(hero.weaponKind),sample=play(rig,name);
 const bladePoint=time=>{sample(time);weapon.quaternion.copy(rotation('hand_r')).multiply(frame);weapon.position.copy(bones.hand_r.localToWorld(new Vector3().fromArray(grip.center))).addScaledVector(up.clone().applyQuaternion(weapon.quaternion),-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);return weapon.localToWorld(new Vector3(0,.5,0));};
 let minimum=1;
 for(const time of [.25,record.impacts[0],.26,.267]){
  const velocity=bladePoint(time+1/480).sub(bladePoint(time-1/480)).normalize();bladePoint(time);
  const edge=velocity.dot(new Vector3(1,0,0).applyQuaternion(weapon.quaternion));minimum=Math.min(minimum,edge);
  assert.ok(edge>.65,'The sword strikes with its flat face or blunt edge: '+edge);
 }
 t.diagnostic(JSON.stringify({minimumLeadingEdge:minimum}));
});
