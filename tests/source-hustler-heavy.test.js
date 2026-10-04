import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Quaternion,Vector3,LoopOnce} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy} from '../src/wrist-anatomy.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {captureFootSoles,sampleFootSole} from '../src/foot-sole.js';
import {WARRIORS} from '../src/warriors.js';
import {attackDefinition} from '../src/combat.js';
import {withMotionTiming} from '../src/attack-timing.js';

const hero=WARRIORS.find(w=>w.model==='ayame'),name='Hustler_Power_Finish';
const record=JSON.parse(fs.readFileSync(process.env.NINJA_HUSTLER_RECORD||new URL('../src/motion-data.json',import.meta.url)))[name];

test('Hustler heavy cut preserves its complete preparation, strike, travel and recovery',()=>{
 if(!process.env.NINJA_HUSTLER_RECORD)assert.equal(hero.motionOverrides.Ring_Heavy_Cleave,name);
 assert.ok(record.nativeSourceMotion&&record.nativeAttachment&&!record.twoHanded);
 const attack=withMotionTiming(attackDefinition('heavy',0,hero.combatStyle),record);
 assert.equal(attack.hits.length,1);assert.ok(attack.hits[0]>.4&&attack.hits[0]<.5);
 assert.ok(record.duration-record.impacts[0]>1.5,'Preserve the source recovery.');
 assert.ok(record.planarRoot.rows.at(-1).z>1.4&&record.planarRoot.rows.at(-1).z<1.6,'Preserve the large advancing step.');
});

test('Hustler finishing cut uses the whole body without inverted joints or a twisted sword wrist',async t=>{
 const rig=await loadNativeSkin(process.env.NINJA_HUSTLER_MODEL||new URL('../public/models/ayame.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 const arms={},legs={};for(const side of ['r','l']){arms[side]=calibrateArmAnatomy(captureArmPose(bones,side));legs[side]=calibrateLegAnatomy(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);}
 const wrist=calibrateWristAnatomy(captureWristPose(bones,'r')),soles=captureFootSoles(rig.scene);
 const clip=rig.animations.find(c=>c.name===name);assert.ok(clip);const action=rig.mixer.clipAction(clip).setLoop(LoopOnce).play();action.clampWhenFinished=true;
 const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).ayame.sword.r;
 let minimumSole=Infinity,unsupported=0,maxWrist=0,maxJointStep=0,previous,firstChest,turn=0,minHip=Infinity,maxHip=-Infinity,maxLean=0;
 const chestUp=new Vector3(0,1,0).applyQuaternion(bones.spine_03.getWorldQuaternion(new Quaternion()).invert());
 for(let time=0;time<clip.duration;time+=1/240){
  action.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
  const chest=bones.spine_03.getWorldQuaternion(new Quaternion()).normalize(),hip=bones.pelvis.getWorldPosition(new Vector3()).y;
  firstChest??=chest.clone();turn=Math.max(turn,chest.angleTo(firstChest));minHip=Math.min(minHip,hip);maxHip=Math.max(maxHip,hip);
  maxLean=Math.max(maxLean,chestUp.clone().applyQuaternion(chest).angleTo(new Vector3(0,1,0)));
  const current={},gaps=[];
  for(const side of ['r','l']){
   const arm=measureArmAnatomy(arms[side],captureArmPose(bones,side)),leg=measureLegAnatomy(legs[side],bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<150&&arm.hingeDeviationDegrees<.1&&Math.abs(arm.forearmTwistDegrees)<90,JSON.stringify({time,side,arm}));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<135&&leg.kneeDeviation<.1&&Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify({time,side,leg}));
   const gap=Math.min(...sampleFootSole(soles[side]).map(p=>p.y));gaps.push(gap);minimumSole=Math.min(minimumSole,gap);
   for(const part of ['upperarm','lowerarm','hand']){const key=part+'_'+side;current[key]=bones[key].quaternion.clone().normalize();if(previous)maxJointStep=Math.max(maxJointStep,current[key].angleTo(previous[key])*180/Math.PI);}
  }
  unsupported=Math.max(unsupported,Math.min(...gaps));previous=current;
  maxWrist=Math.max(maxWrist,measureWristAnatomy(wrist,captureWristPose(bones,'r')).totalDegrees);
  for(const [finger,q]of Object.entries(grip.rotations))assert.ok(bones[finger].quaternion.clone().normalize().angleTo(new Quaternion().fromArray(q).normalize())<.001,'Keep the sword hand closed.');
 }
 t.diagnostic(JSON.stringify({minimumSole,unsupported,maxWrist,maxJointStep,turnDegrees:turn*180/Math.PI,hipTravel:maxHip-minHip,maxLeanDegrees:maxLean*180/Math.PI}));
 assert.ok(turn>.8&&maxHip-minHip>.2&&maxLean>.5,'Preserve the body turn, drop and lean.');
 assert.ok(minimumSole>-.003&&unsupported<.005,'Keep a supporting foot on the floor.');
 assert.ok(maxWrist<30&&maxJointStep<12,'No wrist overbend or abrupt arm flip.');
});
