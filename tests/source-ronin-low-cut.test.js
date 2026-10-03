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
const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const grips=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));

test('Ronin returning cut preserves the full recovery, rigid grip, and whole-body source movement',async t=>{
 const hero=WARRIORS.find(h=>h.model==='ronin'),name=hero.motionOverrides.Cut_Return,record=motions[name];
 assert.equal(name,'Ronin_Low_Cut');assert.ok(record.nativeSourceMotion&&record.fixedGripFrame&&record.pairedGrip);
 assert.ok(record.duration>1.81&&record.duration<1.82,'Keep the complete source recovery.');assert.equal(record.combatDuration,.98);
 const definition=attackDefinition('light',1,hero.combatStyle),attack=withMotionTiming(definition,record);
 assert.equal(attack.damage,definition.damage);assert.deepEqual(attack.headings,[1.01]);assert.equal(attack.hits.length,1);
 const rig=await loadNativeSkin(new URL('../public/models/ronin.glb',import.meta.url)),b={};rig.scene.traverse(o=>{if(o.isBone)b[o.name]=o;});rig.scene.updateMatrixWorld(true);
 const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(b,s))]));
 const wrists=Object.fromEntries(['r','l'].map(s=>[s,calibrateWristAnatomy(captureWristPose(b,s))]));
 const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const q=n=>b[n].getWorldQuaternion(new Quaternion()),p=n=>b[n].getWorldPosition(new Vector3()),up=new Vector3(0,1,0);
 const play=n=>{rig.mixer.stopAllAction();const clip=rig.animations.find(c=>c.name===n),a=rig.mixer.clipAction(clip).reset().setLoop(LoopOnce,1).play();a.clampWhenFinished=true;return time=>{a.time=time;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};};
 play(hero.readyClip)(0);const pose=motions[hero.readyClip].poses[0],shaft=new Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize();
 const mount=q('hand_r').invert().multiply(new Quaternion().setFromUnitVectors(up,shaft).multiply(new Quaternion().setFromAxisAngle(up,pose.roll??0))).multiply(new Quaternion().setFromAxisAngle(up,record.weaponGripRoll));
 const sample=play(name),profile=grips.ronin.sword;let maxGap=0,maxWrist=0,maxAxial=0,maxChestTurn=0,firstChest,minHip=Infinity,maxHip=-Infinity;
 for(let i=0;i<=600;i++){
  sample(i/600*record.duration);const palms=['r','l'].map(s=>b['hand_'+s].localToWorld(new Vector3().fromArray(profile[s].center))),axis=up.clone().applyQuaternion(q('hand_r').multiply(mount));
  maxGap=Math.max(maxGap,palms[0].clone().addScaledVector(axis,-record.gripSpacing).distanceTo(palms[1]));
  const chest=q('spine_03');firstChest??=chest.clone();maxChestTurn=Math.max(maxChestTurn,chest.angleTo(firstChest));minHip=Math.min(minHip,p('pelvis').y);maxHip=Math.max(maxHip,p('pelvis').y);
  for(const s of ['r','l']){
   const arm=measureArmAnatomy(arms[s],captureArmPose(b,s)),wrist=measureWristAnatomy(wrists[s],captureWristPose(b,s)),leg=measureLegAnatomy(legs[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);
   assert.ok(arm.signedFlexionDegrees>0&&arm.signedFlexionDegrees<150&&arm.hingeDeviationDegrees<.1,JSON.stringify({time:i/600*record.duration,s,arm}));
   assert.ok(Math.abs(arm.humeralRollDegrees)<75&&Math.abs(arm.forearmTwistDegrees)<70.1,JSON.stringify(arm));
   assert.ok(leg.kneeFlexion>0&&leg.kneeFlexion<130&&leg.kneeDeviation<.1,JSON.stringify(leg));
   assert.ok(Math.abs(leg.hipTwist)<45&&Math.abs(leg.ankleTwist)<22,JSON.stringify(leg));
   maxWrist=Math.max(maxWrist,wrist.totalDegrees);maxAxial=Math.max(maxAxial,Math.abs(wrist.axialTwistDegrees));
   for(const [finger,rotation]of Object.entries(profile[s].rotations))assert.ok(b[finger].quaternion.angleTo(new Quaternion().fromArray(rotation))<.001,'A fitted finger opens.');
  }
 }
 assert.ok(maxGap<.001&&maxWrist<40&&maxAxial<5,JSON.stringify({maxGap,maxWrist,maxAxial}));
 assert.ok(maxChestTurn>.8&&maxHip-minHip>.05,'The torso and hips must drive the cut.');
 const point=time=>{sample(time);return b.hand_r.localToWorld(new Vector3().fromArray(profile.r.center)).addScaledVector(up.clone().applyQuaternion(q('hand_r').multiply(mount)),.8);};
 const time=record.impacts[0],velocity=point(time+1/480).sub(point(time-1/480)).normalize();sample(time);
 assert.ok(velocity.dot(new Vector3(1,0,0).applyQuaternion(q('hand_r').multiply(mount)))>.6,'The cutting edge must lead.');
 t.diagnostic(JSON.stringify({maxGap,maxWrist,maxAxial,maxChestTurn,hipTravel:maxHip-minHip}));
});
