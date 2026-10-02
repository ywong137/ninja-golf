import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3,Quaternion} from 'three';
import {parseAcclaimSkeleton,parseAcclaimMotion} from '../tools/acclaim-motion.mjs';
import {createAcclaimGaitRig} from '../tools/acclaim-gait-rig.mjs';
import {createAcclaimGaitCycle} from '../tools/acclaim-gait-cycle.mjs';
import {createSourceGaitRetarget} from '../tools/source-gait-retarget.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {captureLegPole,transportLegPole} from '../src/leg-pole.js';
import {solveRecoveryLeg,recoveryWeight} from '../src/leg-recovery.js';
import {solveLeg} from '../src/foot-placement.js';
import {headingKnee} from '../src/knee-alignment.js';
import {alignLegHinge} from '../src/leg-hinge.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {WARRIORS} from '../src/warriors.js';
import {ENEMY_APPEARANCES} from '../src/enemy-appearances.js';

const skeleton=parseAcclaimSkeleton(fs.readFileSync(new URL('./fixtures/cmu-running/09.asf',import.meta.url),'utf8'));
const motion=parseAcclaimMotion(fs.readFileSync(new URL('./fixtures/cmu-running/09_01.amc',import.meta.url),'utf8'),skeleton);
const cycle=createAcclaimGaitCycle(skeleton,motion,{startFrame:2,endFrame:90,rate:120});
const position=b=>b.getWorldPosition(new Vector3());

for(const {model} of [...WARRIORS,...ENEMY_APPEARANCES])test(`${model}: recovering shoes cannot reverse a captured knee`,async()=>{
 const source=createAcclaimGaitRig(skeleton),target=await loadNativeSkin(new URL('../public/models/'+model+'.glb',import.meta.url));
 const retarget=createSourceGaitRetarget(source.root,target.scene,{footRotation:'bind-delta'});
 const legs=Object.fromEntries(['r','l'].map(side=>{
  const bones=['thigh','calf','foot'].map(part=>retarget.bones[part+'_'+side]);
  return [side,{bones,calibration:calibrateLegAnatomy(...bones)}];
 }));
 let backward=0,legacyFlips=0;
 for(let i=0;i<160;i++)for(const side of ['r','l']){
  source.apply(cycle.sample(i/160),{yaw:cycle.yaw});retarget.apply();
  const {bones,calibration}=legs[side],[thigh,calf,foot]=bones;
  const pole=captureLegPole(...bones,calibration.hinge),targetPoint=position(foot).add(new Vector3(.003,.006,-.004));
  const shoe=foot.getWorldQuaternion(new Quaternion()).normalize();
  const toe=retarget.bones['ball_'+side];
  if(position(toe).z<position(foot).z)backward++;
  const saved=bones.map(b=>b.quaternion.clone()),weight=recoveryWeight((i/160-42/88+(side==='l'?.5:0)+1)%1);
  // The original shoe-directed solve is a negative control for this defect.
  solveLeg(...bones,targetPoint,shoe,{maxReach:.999,kneeSolver:headingKnee});
  alignLegHinge(...bones,calibration.hinge);
  const old=captureLegPole(...bones,calibration.hinge);
  if(old.bend.dot(transportLegPole(pole,old.axis))<0)legacyFlips++;
  bones.forEach((b,j)=>b.quaternion.copy(saved[j]));target.scene.updateMatrixWorld(true);
  const error=solveRecoveryLeg(...bones,targetPoint,shoe,calibration,weight,{sourcePole:pole});
  const actual=captureLegPole(...bones,calibration.hinge),anatomy=measureLegAnatomy(calibration,...bones);
  assert.ok(error<.0001,`unreachable correction: ${error}`);
  assert.ok(actual.bend.dot(transportLegPole(pole,actual.axis))>.99999,'The correction reversed or twisted the recorded knee');
  assert.ok(anatomy.kneeDeviation<.001&&anatomy.kneeFlexion>0,'The correction broke the calibrated knee hinge');
 }
 assert.ok(backward>40,'Exercise recovering shoes that face backward');
 assert.ok(legacyFlips>20,'The negative control must reproduce the original knee reversal');
});

test('vanishing captured weights cannot switch the knee direction at a strafe boundary',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/ronin.glb',import.meta.url));
 const bones=['thigh_r','calf_r','foot_r'].map(n=>g.scene.getObjectByName(n));
 const cal=calibrateLegAnatomy(...bones),[thigh,calf,foot]=bones;
 const clip=g.animations.find(c=>c.name==='Run_Forward'),action=g.mixer.clipAction(clip).play();
 action.time=clip.duration*.6;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const p=position(foot),q=foot.getWorldQuaternion(new Quaternion()).normalize(),saved=bones.map(b=>b.quaternion.clone());
 const sourcePole=captureLegPole(...bones,cal.hinge);
 sourcePole.bend.applyAxisAngle(sourcePole.axis,.3);
 const solve=sourceWeight=>{
  bones.forEach((b,i)=>b.quaternion.copy(saved[i]));g.scene.updateMatrixWorld(true);
  solveRecoveryLeg(...bones,p,q,cal,.5,{sourcePole,sourceWeight});
  return captureLegPole(...bones,cal.hinge);
 };
 const zero=solve(0),epsilon=solve(Math.cos(Math.PI/2)),small=solve(1e-5);
 assert.ok(zero.bend.distanceTo(epsilon.bend)<1e-9,'Floating-point residue switched the solver branch');
 assert.ok(zero.bend.distanceTo(small.bend)<1e-4,'The capture influence does not vanish continuously');
 const before=captureLegPole(...bones,cal.hinge);
 bones.forEach((b,i)=>b.quaternion.copy(saved[i]));g.scene.updateMatrixWorld(true);
 solveRecoveryLeg(...bones,p,q,cal,.5,{entryPole:before,entryWeight:0});
 const first=captureLegPole(...bones,cal.hinge);
 assert.ok(first.bend.distanceTo(transportLegPole(before,first.axis))<1e-6,'Turn entry discarded the displayed knee direction');
});
