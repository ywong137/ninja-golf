#!/usr/bin/env node
// Dense checks for the review candidate; the public model remains untouched.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations} from '../native-arm-anatomy.mjs';
import {verifyAnimationReplacement} from '../verify-animation-replacement.mjs';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../../tests/native-skin-helper.mjs';
const {values}=parseArgs({options:{model:{type:'string'},before:{type:'string'},output:{type:'string'},hz:{type:'string',default:'480'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/check-diagonal.mjs --model CANDIDATE.glb --before ORIGINAL.glb [--output REPORT.json] [--hz 480]\nChecks anatomical hinges, grip continuity, skin clearance, source foot/toe paths, and preservation of unrelated assets.');process.exit(0);}
if(!values.model||!values.before)throw Error('Supply --model and --before. See --help.');
const profiles=JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword,frames=JSON.parse(fs.readFileSync(new URL('./heavy-cleave-frames.json',import.meta.url)));
const sampleRate=Number(values.hz);if(!Number.isInteger(sampleRate)||sampleRate<120||sampleRate>1920)throw Error('--hz must be an integer from 120 through 1920.');
const g=await loadNativeSkin(values.model),groups=skinGroups(g),clip=g.animations.find(c=>c.name==='Ronin_Cut_Diagonal');assert(clip,'Candidate must contain Ronin_Cut_Diagonal.');const action=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});const point=n=>bones[n].getWorldPosition(new T.Vector3());const calibration=Object.fromEntries(['r','l'].map(side=>[side,calibrateArmAnatomy(captureArmPose(bones,side))]));let previous={},lastHand=null,lastTime=0;
const report={sampleRate,jointStepUnit:'degrees per 120 Hz interval',maxJointStep:{},maxForearmTorso:{r:0,l:0},maxUpperArmTorso:{r:0,l:0},maxElbowFold:{r:0,l:0},maxHandSpeed:0,maxWrist:0,maxGripGap:0,frames:[]};
// This diagonal is a torso-only variation of the preserved cleave. Compare its
// real ankle/toe paths with that source; a heel pivot must not pin the ankle.
// In this imported rig, spine_01 also parents both thighs, so a torso edit there
// can move the complete lower body while its support metadata still looks valid.
const supportSource=await loadNativeSkin(values.model);
const sourceClip=supportSource.animations.find(c=>c.name==='Ronin_Heavy_Cleave');
assert(sourceClip,'Candidate must preserve Ronin_Heavy_Cleave for the foot-path comparison.');
const sourceAction=supportSource.mixer.clipAction(sourceClip).setLoop(T.LoopOnce,1);
sourceAction.clampWhenFinished=true;sourceAction.play();
const support={source:sourceClip.name,sampleRate,maxPositionError:0,maxFootRotationDegrees:0,worstPosition:null,worstRotation:null};
for(let i=0;i<=Math.ceil(clip.duration*sampleRate);i++){
 const time=Math.min(i/sampleRate,clip.duration),sourceTime=time/clip.duration*sourceClip.duration;
 g.mixer.setTime(time);supportSource.mixer.setTime(sourceTime);
 g.scene.updateMatrixWorld(true);supportSource.scene.updateMatrixWorld(true);
 for(const side of ['r','l']){
  for(const prefix of ['foot_','ball_']){
   const name=prefix+side,reference=supportSource.scene.getObjectByName(name);
   const error=point(name).distanceTo(reference.getWorldPosition(new T.Vector3()));
   if(error>support.maxPositionError){support.maxPositionError=error;support.worstPosition={name,time,sourceTime};}
  }
  const name='foot_'+side,reference=supportSource.scene.getObjectByName(name);
  const degrees=bones[name].getWorldQuaternion(new T.Quaternion()).normalize()
   .angleTo(reference.getWorldQuaternion(new T.Quaternion()).normalize())*180/Math.PI;
  if(degrees>support.maxFootRotationDegrees){support.maxFootRotationDegrees=degrees;support.worstRotation={name,time,sourceTime};}
 }
}
report.sourceFootPath=support;
if(values.output)fs.writeFileSync(values.output,JSON.stringify(report,null,2));
assert(support.maxPositionError<=.003,
 `Native ankle/toe path changed ${(support.maxPositionError*1000).toFixed(3)} mm at ${support.worstPosition?.time}s/${support.worstPosition?.name}; restore the cleave support targets after the torso edit.`);
assert(support.maxFootRotationDegrees<=1,
 `Native foot rotation changed ${support.maxFootRotationDegrees.toFixed(3)} degrees at ${support.worstRotation?.time}s/${support.worstRotation?.name}; preserve the source heel/toe pivot.`);

// The support pass reached the clamped endpoint. Re-enable the action before
// the independent anatomy pass so it evaluates every frame again.
action.reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;g.mixer.setTime(0);

for(let i=0;i<=Math.ceil(clip.duration*sampleRate);i++){
 const time=Math.min(i/sampleRate,clip.duration);g.mixer.setTime(time);g.scene.updateMatrixWorld(true);const frame={time};
 for(const side of ['r','l']){
  const shoulder=point('upperarm_'+side),elbow=point('lowerarm_'+side),wrist=point('hand_'+side),upper=elbow.clone().sub(shoulder).normalize(),forearm=wrist.clone().sub(elbow).normalize();
  const skin=measureArmSkin(g,groups,side);const anatomy=measureArmAnatomy(calibration[side],captureArmPose(bones,side));
  assert.deepEqual(armAuthoringViolations(anatomy,{maxHingeDeviationDegrees:.5}),[],`Arm bounds failed at ${time}/${side}.`);
  report.maxWrist=Math.max(report.maxWrist,bones['hand_'+side].quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(frames[side].neutralHandRotation).normalize())*180/Math.PI);
  frame[side]={anatomy,elbowFlexion:upper.angleTo(forearm)*180/Math.PI,metacarpalBend:forearm.angleTo(point('middle_01_'+side).sub(wrist).normalize())*180/Math.PI,skin};
  report.maxForearmTorso[side]=Math.max(report.maxForearmTorso[side],skin['forearmTorso_'+side].pairs);report.maxUpperArmTorso[side]=Math.max(report.maxUpperArmTorso[side],skin['upperarmTorso_'+side].pairs);report.maxElbowFold[side]=Math.max(report.maxElbowFold[side],skin['fold_'+side].maxRadialPenetration);
  for(const part of ['upperarm','lowerarm','hand']){
   const name=part+'_'+side,q=bones[name].quaternion.clone().normalize();if(previous[name]&&time-lastTime>1e-6){const degrees=q.angleTo(previous[name])*180/Math.PI/((time-lastTime)*120);if(degrees>(report.maxJointStep[name]?.degrees??0))report.maxJointStep[name]={degrees,time};}previous[name]=q;
  }
 }
 const palms=['r','l'].map(s=>bones['hand_'+s].localToWorld(new T.Vector3().fromArray(profiles[s].center))),shaft=new T.Vector3().fromArray(profiles.r.axis).applyQuaternion(bones.hand_r.getWorldQuaternion(new T.Quaternion()));report.maxGripGap=Math.max(report.maxGripGap,palms[0].clone().addScaledVector(shaft,-.15).distanceTo(palms[1]));
 if(lastHand&&time-lastTime>1e-6)report.maxHandSpeed=Math.max(report.maxHandSpeed,point('hand_r').distanceTo(lastHand)/(time-lastTime));lastHand=point('hand_r');lastTime=time;report.frames.push(frame);
}
Object.assign(report,verifyAnimationReplacement(values.before,values.model,[['Cut_Diagonal','Ronin_Cut_Diagonal']]));
if(values.output)fs.writeFileSync(values.output,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,frames:undefined},null,2));
for(const [name,step]of Object.entries(report.maxJointStep))assert(step.degrees<25,`${name} jumps ${step.degrees.toFixed(1)}° at ${step.time}s.`);
assert(report.maxForearmTorso.r===0&&report.maxForearmTorso.l===0,'Forearm intersects torso.');assert(report.maxElbowFold.r<.01&&report.maxElbowFold.l<.01,'Elbow skin folds into itself.');
assert(report.maxUpperArmTorso.r===0&&report.maxUpperArmTorso.l===0,'Upper arm intersects torso.');
assert(report.maxHandSpeed<12.5,`Hand speed ${report.maxHandSpeed.toFixed(2)}m/s exceeds the animation brief.`);

assert(report.maxWrist<14,'Wrist exceeds 14 degrees.');
assert(report.maxGripGap<.001,'Paired palms depart from the shaft by more than 1 mm.');
