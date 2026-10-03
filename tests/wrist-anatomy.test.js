import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy,wristRotationFromAngles,wristAuthoringViolations} from '../src/wrist-anatomy.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {WARRIORS} from '../src/warriors.js';
import {ENEMY_APPEARANCES} from '../src/enemy-appearances.js';

const D=Math.PI/180,close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
const limits={minFlexionDegrees:-25,maxFlexionDegrees:35,minUlnarDeviationDegrees:-12,maxUlnarDeviationDegrees:20,maxAxialTwistDegrees:2};
const reference=side=>({side,wrist:new Vector3(),forearm:new Vector3(0,0,-.27),indexKnuckle:new Vector3(0,.045,.075),middleKnuckle:new Vector3(0,0,.08),pinkyKnuckle:new Vector3(0,-.035,.073),handQuaternion:new Quaternion(),forearmQuaternion:new Quaternion()});

test('positive flexion bends each mirrored hand toward its palm, not its back',()=>{
 for(const side of ['r','l']){
  const c=calibrateWristAnatomy(reference(side)),q=wristRotationFromAngles(c,{flexionDegrees:30});
  const longitudinal=new Vector3(0,0,1).applyQuaternion(q);
  close(longitudinal.x,side==='r'?.5:-.5);close(longitudinal.y,0);close(longitudinal.z,Math.cos(30*D));
 }
});

test('positive ulnar deviation moves both hands away from their thumb side',()=>{
 for(const side of ['r','l']){
  const c=calibrateWristAnatomy(reference(side)),q=wristRotationFromAngles(c,{ulnarDeviationDegrees:20});
  const longitudinal=new Vector3(0,0,1).applyQuaternion(q);
  close(longitudinal.x,0);close(longitudinal.y,-Math.sin(20*D));close(longitudinal.z,Math.cos(20*D));
 }
});

test('forearm pronation does not become wrist twist',()=>{
 const base=reference('r'),c=calibrateWristAnatomy(base),pronation=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),65*D);
 const m=measureWristAnatomy(c,{handQuaternion:pronation,forearmQuaternion:pronation});
 for(const value of Object.values(m))close(value,0);
 const actual=measureWristAnatomy(c,{handQuaternion:pronation,forearmQuaternion:new Quaternion()});
 close(actual.axialTwistDegrees,65);
 assert.equal(wristAuthoringViolations(actual,limits)[0].metric,'axialTwistDegrees');
});

test('imported bone-frame rotations are not physical wrist rotation',()=>{
 const base=reference('r'),handGauge=new Quaternion().setFromAxisAngle(new Vector3(.15,-.97,.15).normalize(),19*D);
 const lowerGauge=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),37*D);
 // Change the imported joint frames, while retaining the same physical
 // landmarks and motion. A local quaternion's angle is not a joint angle.
 base.handQuaternion.copy(handGauge);base.forearmQuaternion.copy(lowerGauge);
 const c=calibrateWristAnatomy(base),posedHand=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),30*D).multiply(handGauge);
 const measured=measureWristAnatomy(c,{handQuaternion:posedHand,forearmQuaternion:lowerGauge});
 close(measured.flexionDegrees,30);close(measured.ulnarDeviationDegrees,0);close(measured.axialTwistDegrees,0);
 close(c.referenceLongitudinalOffsetDegrees,0);
});

test('explicit asymmetric ranges distinguish flexion, extension, radial, and ulnar deviation',()=>{
 assert.deepEqual(wristAuthoringViolations({flexionDegrees:-25,ulnarDeviationDegrees:20,axialTwistDegrees:-2},limits),[]);
 const violations=wristAuthoringViolations({flexionDegrees:-26,ulnarDeviationDegrees:-13,axialTwistDegrees:3},limits);
 assert.deepEqual(violations.map(v=>v.comparison),['minimum','minimum','absolute maximum']);
 assert.throws(()=>wristAuthoringViolations({flexionDegrees:0,ulnarDeviationDegrees:0,axialTwistDegrees:0},{}),/Supply finite/);
 assert.throws(()=>wristAuthoringViolations({flexionDegrees:0,ulnarDeviationDegrees:0,axialTwistDegrees:0},{...limits,minFlexionDegrees:80}),/reversed/);
});

test('invalid landmarks and singular deviation fail with actionable messages',()=>{
 const p=reference('r');p.indexKnuckle.copy(p.pinkyKnuckle);
 assert.throws(()=>calibrateWristAnatomy(p),/radial axis is degenerate/);
 assert.throws(()=>captureWristPose({},'r'),/Missing native wrist landmark/);
 assert.throws(()=>wristRotationFromAngles(calibrateWristAnatomy(reference('r')),{ulnarDeviationDegrees:90}),/singular/);
 assert.throws(()=>wristRotationFromAngles(calibrateWristAnatomy(reference('r')),{flexionDegrees:360}),/principal range/);
});

for(const character of [...WARRIORS,...ENEMY_APPEARANCES])test(`${character.model}: wrist calibration follows the native hand through forearm and body rotation`,async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+character.model+'.glb',import.meta.url)),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o});g.scene.updateMatrixWorld(true);
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateWristAnatomy(captureWristPose(b,s))]));
 const original=new Map(['r','l'].map(s=>[s,b['lowerarm_'+s].quaternion.clone()]));
 for(const s of ['r','l']){
  const reference=measureWristAnatomy(cal[s],captureWristPose(b,s));
  for(const value of Object.values(reference))close(value,0,3e-6);
  assert.ok(cal[s].referenceLongitudinalOffsetDegrees<35,'Inspect the native hand alignment before calling this a neutral wrist.');
 }
 for(const [flexionDegrees,ulnarDeviationDegrees,axialTwistDegrees]of [[-20,-10,0],[30,15,0],[0,0,12]]){
  const wanted={flexionDegrees,ulnarDeviationDegrees,axialTwistDegrees};
  for(const s of ['r','l']){
   b['hand_'+s].quaternion.copy(wristRotationFromAngles(cal[s],wanted));
   b['lowerarm_'+s].quaternion.copy(original.get(s)).multiply(new Quaternion().setFromAxisAngle(b['hand_'+s].position.clone().normalize(),(s==='r'?45:-45)*D));
  }
  g.scene.rotation.set(.22,1.7,-.13);g.scene.position.set(4,2,-8);g.scene.updateMatrixWorld(true);
  for(const s of ['r','l']){
   const m=measureWristAnatomy(cal[s],captureWristPose(b,s));
   // Imported bone scales differ from unity by a few parts per million.
   // World-matrix decomposition therefore retains tiny angle residuals.
   for(const [key,value]of Object.entries(wanted))close(m[key],value,.0001);
   assert.deepEqual(wristAuthoringViolations(m,limits).map(v=>v.metric),axialTwistDegrees?['axialTwistDegrees']:[]);
   const pose=captureWristPose(b,s);pose.handQuaternion.set(...pose.handQuaternion.toArray().map(v=>-v));
   const signFlipped=measureWristAnatomy(cal[s],pose);
   for(const [key,value]of Object.entries(m))close(signFlipped[key],value,3e-6);
  }
 }
});
