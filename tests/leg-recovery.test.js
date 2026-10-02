import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {solveRecoveryLeg} from '../src/leg-recovery.js';
import {captureLegPole} from '../src/leg-pole.js';

const position=bone=>bone.getWorldPosition(new T.Vector3());
const rotation=bone=>bone.getWorldQuaternion(new T.Quaternion()).normalize();

for(const model of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${model}: free-leg correction preserves stance, ankle paths, and rigid lengths`,async()=>{
 const g=await loadNativeSkin(new URL(`../public/models/${model}.glb`,import.meta.url)),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 g.scene.position.set(2,1,-3);g.scene.rotation.set(.05,.8,-.04);g.scene.scale.setScalar(1.1);g.scene.updateMatrixWorld(true);
 const calibrations=Object.fromEntries(['r','l'].map(side=>[side,calibrateLegAnatomy(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side])]));
 const clip=g.animations.find(c=>c.name==='Sprint_Forward'),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce);action.play();
 let sourcePitch=0;
 for(const sourceWeight of [0,1])for(const phase of [.44,.53,.60,.75,.82])for(const side of ['r','l']){
  action.time=((phase+(side==='r'?0:.5))%1)*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const thigh=bones['thigh_'+side],calf=bones['calf_'+side],foot=bones['foot_'+side],cal=calibrations[side];
  const target=position(foot),shoe=rotation(foot),upper=position(calf).distanceTo(position(thigh)),lower=target.distanceTo(position(calf));
  const pole=captureLegPole(thigh,calf,foot,cal.hinge);
  // Build the former 100-degree folded ankle explicitly. Released assets must
  // not retain a visible defect merely to keep this regression meaningful.
  const hinge=cal.hinge.hingeInThigh.clone().applyQuaternion(rotation(thigh));
  shoe.copy(new T.Quaternion().setFromAxisAngle(hinge,100*Math.PI/180).multiply(rotation(calf).multiply(cal.footInCalf)));
  foot.quaternion.copy(rotation(foot.parent).invert().multiply(shoe));g.scene.updateMatrixWorld(true);
  sourcePitch=Math.max(sourcePitch,Math.abs(measureLegAnatomy(cal,thigh,calf,foot).anklePitch));
  solveRecoveryLeg(thigh,calf,foot,target,shoe,cal,1,{sourcePole:pole,sourceWeight});
  const m=measureLegAnatomy(cal,thigh,calf,foot);
  assert.ok(position(foot).distanceTo(target)<.0001,'Free ankle path changed');
  assert.ok(Math.abs(position(calf).distanceTo(position(thigh))-upper)<.0001,'Upper leg stretched');
  assert.ok(Math.abs(position(foot).distanceTo(position(calf))-lower)<.0001,'Lower leg stretched');
  assert.ok(m.kneeDeviation<.01&&m.kneeFlexion>0&&m.kneeFlexion<150,JSON.stringify(m));
  assert.ok(Math.abs(m.hipTwist)<45&&Math.abs(m.ankleTwist)<15,JSON.stringify(m));
  assert.ok(m.anklePitch>=-25.01&&m.anklePitch<=35.01&&m.ankleOffPitch<=10.01,JSON.stringify(m));
 }
 assert.ok(sourcePitch>80,'Fixture must retain the folded source ankle');
 action.time=.15*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 for(const side of ['r','l']){
  const thigh=bones['thigh_'+side],calf=bones['calf_'+side],foot=bones['foot_'+side],target=position(foot),shoe=rotation(foot);
  solveRecoveryLeg(thigh,calf,foot,target,shoe,calibrations[side],0,{sourcePole:captureLegPole(thigh,calf,foot,calibrations[side].hinge)});
  assert.ok(position(foot).distanceTo(target)<.0001);
  assert.ok(rotation(foot).angleTo(shoe)<.0001,'Support shoe swiveled');
 }
});
