import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {captureLegPole,solveLegWithPole} from '../src/leg-pole.js';
import {kneePlaneWindow,applyKneePlane} from '../tools/knee-plane-constraints.mjs';
import {WARRIORS} from '../src/warriors.js';
import {ENEMY_APPEARANCES} from '../src/enemy-appearances.js';

const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
for(const {model} of [...WARRIORS,...ENEMY_APPEARANCES])test(`${model}: one measured knee interval preserves the supporting shoe and hinge`,async()=>{
 const g=await loadNativeSkin(new URL(`../public/models/${model}.glb`,import.meta.url)),b={};g.scene.traverse(n=>{if(n.isBone)b[n.name]=n;});
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const clip=g.animations.find(c=>c.name==='Run_Forward')??g.animations.find(c=>c.name==='Jog_Fwd_Loop'),action=g.mixer.clipAction(clip).play();let corrected=0;
 for(const phase of [.1,.4,.7])for(const side of ['r','l']){
  action.time=phase*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const thigh=b['thigh_'+side],calf=b['calf_'+side],foot=b['foot_'+side],calibration=cal[side];
  const target=point(foot),shoe=rotation(foot),pole=captureLegPole(thigh,calf,foot,calibration.hinge);
  pole.bend.applyAxisAngle(pole.axis,-24*Math.PI/180);solveLegWithPole(thigh,calf,foot,target,shoe,calibration.hinge,pole);
  const original=[thigh,calf,foot].map(n=>n.quaternion.clone());
  const interval=kneePlaneWindow(thigh,calf,foot,calibration);
  [thigh,calf,foot].forEach((n,i)=>assert.ok(n.quaternion.angleTo(original[i])<1e-7,'Measuring the interval cannot alter the pose.'));
  const angle=Math.max(interval.lower,Math.min(interval.upper,0));corrected+=Math.abs(angle)>.001?1:0;
  applyKneePlane(thigh,calf,foot,calibration,angle);
  const measured=measureLegAnatomy(calibration,thigh,calf,foot);
  assert.ok(Math.abs(measured.hipTwist)<=27.001&&Math.abs(measured.ankleTwist)<=17.001,JSON.stringify({model,phase,side,measured}));
  assert.ok(measured.kneeDeviation<.01&&measured.kneeFlexion>0);
  assert.ok(point(foot).distanceTo(target)<5e-5&&rotation(foot).angleTo(shoe)<.0003);
 }
 assert.ok(corrected>0,'The measured window must exclude an excessive source twist.');
});

test('an imported rig retains precise contact and shoe rotation during knee correction',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/ayame.glb',import.meta.url)),b={};g.scene.traverse(n=>{if(n.isBone)b[n.name]=n;});
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const clip=g.animations.find(c=>c.name==='Run_Forward'),action=g.mixer.clipAction(clip).play();
 for(const phase of [.1,.4,.7])for(const side of ['r','l']){
  action.time=phase*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const thigh=b['thigh_'+side],calf=b['calf_'+side],foot=b['foot_'+side],target=point(foot),shoe=rotation(foot);
  applyKneePlane(thigh,calf,foot,cal[side],.2);
  assert.ok(point(foot).distanceTo(target)<2e-7,'A knee-plane turn cannot translate the ankle.');
  assert.ok(rotation(foot).angleTo(shoe)<1e-6,'The shoe orientation must remain fixed.');
  assert.ok(measureLegAnatomy(cal[side],thigh,calf,foot).kneeDeviation<.01,'The calibrated hinge must remain aligned.');
 }
});
