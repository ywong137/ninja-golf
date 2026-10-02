#!/usr/bin/env node
// Inspect the baked candidate independently at twice its authoring sample rate.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,LoopOnce} from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';

const {values}=parseArgs({options:{before:{type:'string'},after:{type:'string'},report:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/check-locomotion-posture.mjs --before ORIGINAL.glb --after CANDIDATE.glb [--report FILE.json]\nCheck native reach, knees, stride clock, preserved body/grips, and untouched model bytes at 480 Hz. Numerical success does not approve visual quality.');process.exit(0);}
if(!values.before||!values.after)throw Error('Supply --before and --after. See --help.');
const old=await loadNativeSkin(values.before),fresh=await loadNativeSkin(values.after);
const bone=(g,n)=>g.scene.getObjectByName(n),p=(g,n)=>bone(g,n).getWorldPosition(new Vector3()),q=(g,n)=>bone(g,n).getWorldQuaternion(new Quaternion()).normalize();
fresh.scene.updateMatrixWorld(true);
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bone(fresh,'thigh_'+s),bone(fresh,'calf_'+s),bone(fresh,'foot_'+s))]));
const clips=fresh.animations.filter(c=>[2,3].includes(c.userData?.sharedPostureVersion));
assert.equal(clips.length,9,'Expected five running and four walking clips.');
const results=[];
for(const c of clips){
 old.mixer.stopAllAction();fresh.mixer.stopAllAction();
 const source=old.animations.find(x=>x.name===c.name),a=old.mixer.clipAction(source).reset().setLoop(LoopOnce).play(),z=fresh.mixer.clipAction(c).reset().setLoop(LoopOnce).play();a.clampWhenFinished=z.clampWhenFinished=true;
 assert.ok(Math.abs(source.duration-c.duration)<1e-6,'The distance clock needs the original duration.');
 const row={clip:c.name,scale:c.userData.nativeStrideScale,travelHeading:c.userData.nativeTravelHeading,maxLoadedVerticalError:0,maxStrideVelocityError:0,maxFootAngle:0,maxFootNonYawAngle:0,maxShoeYawError:0,maxCoreAngle:0,maxHinge:0,minFlex:180,maxHip:0,maxAnkle:0,maxLoadedKneeMedial:0,maxHandRelativeChange:0,maxLengthChange:0,maxKneeSpeed:0,meanLift:0};
 const n=Math.ceil(c.duration*480),dt=c.duration/n;
 let previous=null;
 for(let i=0;i<n;i++){
  const t=i/n*c.duration,phase=i/n;a.time=z.time=t;old.mixer.update(0);fresh.mixer.update(0);old.scene.updateMatrixWorld(true);fresh.scene.updateMatrixWorld(true);
  const state={feet:{},flexes:[]};row.meanLift+=(p(fresh,'pelvis').y-p(old,'pelvis').y)/n;
  for(const s of ['r','l']){
   const walking=c.name.includes('_Guard_Walk_'),fp=(phase+(s==='l'?.5:0)+(walking?.25:0))%1,loaded=fp<(walking?.5:.28);
   const oldFoot=p(old,'foot_'+s),newFoot=p(fresh,'foot_'+s),axis=/_(Left|Right)$/.test(c.name)?'x':'z';
   state.feet[s]={oldFoot,newFoot,loaded};
   if(loaded)row.maxLoadedVerticalError=Math.max(row.maxLoadedVerticalError,Math.abs(oldFoot.y-newFoot.y));
   if(loaded&&previous?.feet[s].loaded){
    const before=previous.feet[s];
    row.maxStrideVelocityError=Math.max(row.maxStrideVelocityError,Math.abs((newFoot[axis]-before.newFoot[axis])-row.scale*(oldFoot[axis]-before.oldFoot[axis]))/dt);
   }
   row.maxFootAngle=Math.max(row.maxFootAngle,q(old,'foot_'+s).angleTo(q(fresh,'foot_'+s)));
   const delta=q(fresh,'foot_'+s).multiply(q(old,'foot_'+s).invert());
   row.maxFootNonYawAngle=Math.max(row.maxFootNonYawAngle,new Vector3(0,1,0).applyQuaternion(delta).angleTo(new Vector3(0,1,0)));
   if(row.travelHeading!==undefined){const forward=p(fresh,'ball_'+s).sub(newFoot);row.maxShoeYawError=Math.max(row.maxShoeYawError,Math.abs(Math.atan2(forward.x,forward.z)-row.travelHeading));}
   const m=measureLegAnatomy(cal[s],bone(fresh,'thigh_'+s),bone(fresh,'calf_'+s),bone(fresh,'foot_'+s));
   row.maxHinge=Math.max(row.maxHinge,m.kneeDeviation);row.minFlex=Math.min(row.minFlex,m.kneeFlexion);row.maxHip=Math.max(row.maxHip,Math.abs(m.hipTwist));row.maxAnkle=Math.max(row.maxAnkle,Math.abs(m.ankleTwist));state.flexes.push(m.kneeFlexion);
   if(loaded){
    const hip=p(fresh,'thigh_'+s),knee=p(fresh,'calf_'+s),forward=p(fresh,'ball_'+s).sub(newFoot).setY(0).normalize();
    const outward=new Vector3(0,1,0).cross(forward).multiplyScalar(s==='l'?1:-1),shin=knee.clone().sub(newFoot);
    // Lateral travel tracks the hip-to-ankle line. Forward and backward
    // support tracks the shoe's plane, matching the existing roster audit.
    if(/^Run_(Left|Right)$|_Guard_Walk_(Left|Right)$/.test(c.name)){
     const axis=newFoot.clone().sub(hip),fraction=knee.clone().sub(hip).dot(axis)/axis.lengthSq();
     shin.sub(hip.addScaledVector(axis,fraction).sub(newFoot));
    }
    row.maxLoadedKneeMedial=Math.max(row.maxLoadedKneeMedial,-shin.dot(outward));
   }
   row.maxHandRelativeChange=Math.max(row.maxHandRelativeChange,p(old,'hand_'+s).sub(p(old,'spine_03')).distanceTo(p(fresh,'hand_'+s).sub(p(fresh,'spine_03'))));
   for(const [from,to] of [['thigh','calf'],['calf','foot']])row.maxLengthChange=Math.max(row.maxLengthChange,Math.abs(p(old,from+'_'+s).distanceTo(p(old,to+'_'+s))-p(fresh,from+'_'+s).distanceTo(p(fresh,to+'_'+s))));
  }
  row.maxCoreAngle=Math.max(row.maxCoreAngle,q(old,'spine_03').angleTo(q(fresh,'spine_03')));
  if(previous)row.maxKneeSpeed=Math.max(row.maxKneeSpeed,...state.flexes.map((v,j)=>Math.abs(v-previous.flexes[j])/dt));
  previous=state;
 }
 results.push(row);
}
const preservation=verifyAnimationReplacement(values.before,values.after,clips.map(c=>[c.name,c.name]));
const report={before:values.before,after:values.after,preservation,clips:results};
if(values.report)fs.writeFileSync(values.report,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
for(const row of results){
 assert.ok(row.scale>0&&row.scale<=1,JSON.stringify(row));
 assert.ok(row.maxLoadedVerticalError<.002,'Loaded foot height changed: '+JSON.stringify(row));
 assert.ok(row.maxStrideVelocityError<.06,'Baked stride differs from its distance clock: '+JSON.stringify(row));
 if(row.travelHeading!==undefined){
  assert.ok(row.maxFootNonYawAngle<.005&&row.maxShoeYawError<.003,'The shoe yaw correction changed pitch/roll or missed its heading: '+JSON.stringify(row));
 }else assert.ok(row.maxFootAngle<.005,'Shoe orientation changed: '+JSON.stringify(row));
 assert.ok(row.maxCoreAngle<1e-5&&row.maxHandRelativeChange<1e-5,'Upper-body pose or grip changed: '+JSON.stringify(row));
 assert.ok(row.maxLengthChange<.00005,'Native limb length changed: '+JSON.stringify(row));
 assert.ok(row.maxHinge<.01&&row.minFlex>0,'Invalid native knee: '+JSON.stringify(row));
 assert.ok(row.maxHip<45&&row.maxAnkle<20,'Invalid native joint twist: '+JSON.stringify(row));
 assert.ok(row.maxLoadedKneeMedial<=.02,'Loaded knee collapses inward: '+JSON.stringify(row));
}
