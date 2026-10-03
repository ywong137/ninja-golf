import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy,wristRotationFromAngles} from '../src/wrist-anatomy.js';
import {fitSourceSwordWrist,fitSourceSwordPalm} from '../tools/fit-source-sword-wrist.mjs';

test('wrist fitting preserves the arm path and treats q and -q identically',async()=>{
 const rig=await loadNativeSkin(new URL('../public/models/ayame.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const arm=calibrateArmAnatomy(captureArmPose(bones,'r')),wrist=calibrateWristAnatomy(captureWristPose(bones,'r'));
 const initial=Object.fromEntries(['upperarm_r','lowerarm_r','hand_r'].map(n=>[n,bones[n].quaternion.clone()]));
 const referencePoints=Object.fromEntries(Object.keys(initial).map(n=>[n,bones[n].getWorldPosition(new Vector3())]));
 const outcomes=[];
 for(const sign of [1,-1]){
  for(const [n,q]of Object.entries(initial))bones[n].quaternion.copy(q);
  const q=wristRotationFromAngles(wrist,{flexionDegrees:35,ulnarDeviationDegrees:30,axialTwistDegrees:-10});
  bones.hand_r.quaternion.set(q.x*sign,q.y*sign,q.z*sign,q.w*sign);rig.scene.updateMatrixWorld(true);
  const state={};fitSourceSwordWrist({bones,arm,wrist,state});
  const m=measureWristAnatomy(wrist,captureWristPose(bones,'r'));
  assert.ok(Math.abs(m.flexionDegrees)<=12.001&&Math.abs(m.ulnarDeviationDegrees)<=25.001);
  assert.ok(Math.abs(state.forearmTwist)<=70);
  for(const [n,p]of Object.entries(referencePoints))assert.ok(bones[n].getWorldPosition(new Vector3()).distanceTo(p)<1e-6,'The wrist fit moved '+n);
  assert.ok(bones.upperarm_r.quaternion.angleTo(initial.upperarm_r)<1e-6,'The fit swivelled the source elbow.');
  outcomes.push(['lowerarm_r','hand_r'].map(n=>bones[n].getWorldQuaternion(new Quaternion()).normalize()));
 }
 outcomes[0].forEach((q,i)=>assert.ok(q.angleTo(outcomes[1][i])<1e-6,'Equivalent quaternions changed the fitted pose: '+q.angleTo(outcomes[1][i])));
});

test('an adapted sword cut moves excess palm rotation into a bounded forearm without twisting the wrist',async()=>{
 const rig=await loadNativeSkin(new URL('../public/models/sora.glb',import.meta.url)),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const arm=calibrateArmAnatomy(captureArmPose(bones,'r')),wrist=calibrateWristAnatomy(captureWristPose(bones,'r'));
 const initial=Object.fromEntries(['upperarm_r','lowerarm_r','hand_r'].map(n=>[n,bones[n].quaternion.clone()]));
 const points=Object.fromEntries(Object.keys(initial).map(n=>[n,bones[n].getWorldPosition(new Vector3())]));
 for(const axial of [-140,-80,0,80,140]){
  for(const [n,q]of Object.entries(initial))bones[n].quaternion.copy(q);
  bones.hand_r.quaternion.copy(wristRotationFromAngles(wrist,{flexionDegrees:20,ulnarDeviationDegrees:30,axialTwistDegrees:axial}));rig.scene.updateMatrixWorld(true);
  const result=fitSourceSwordPalm({bones,arm,wrist,state:{}});
  const m=measureWristAnatomy(wrist,captureWristPose(bones,'r'));
  assert.ok(Math.abs(m.axialTwistDegrees)<1e-5,'Excess palm rotation remained in the wrist.');
  assert.ok(Math.abs(m.flexionDegrees)<=12.001&&Math.abs(m.ulnarDeviationDegrees)<=25.001);
  assert.ok(Math.abs(result.forearmTwist)<70);
  for(const [n,p]of Object.entries(points))assert.ok(bones[n].getWorldPosition(new Vector3()).distanceTo(p)<1e-6,'The wrist fit moved '+n);
 }
 const state={};let previous;
 for(const axial of [170,175,179,-179,-175,-170]){
  for(const [n,q]of Object.entries(initial))bones[n].quaternion.copy(q);
  bones.hand_r.quaternion.copy(wristRotationFromAngles(wrist,{axialTwistDegrees:axial}));rig.scene.updateMatrixWorld(true);
  const result=fitSourceSwordPalm({bones,arm,wrist,state});
  if(previous!==undefined)assert.ok(Math.abs(result.forearmTwist-previous)<2,'A principal-angle boundary flipped the forearm.');
  previous=result.forearmTwist;
 }
});
