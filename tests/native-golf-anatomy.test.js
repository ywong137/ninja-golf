import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy} from '../tools/native-arm-anatomy.mjs';

const profiles=JSON.parse(fs.readFileSync(process.env.NINJA_GOLF_PROFILE_FILE??new URL('../src/grip-data.json',import.meta.url)));
const degrees=T.MathUtils.radToDeg;
const names=['Golf_Address','Golf_Swing','Golf_Putt'];
const peak=()=>({value:0});
function retain(metric,value,name,time,side){if(value>metric.value)Object.assign(metric,{value,name,time,side});}
// Float32 quaternion storage needs a small numerical tolerance, not a wider pose bound.
const ANGLE_EPS=1e-3;
function tracks(clip){return clip.tracks.map(t=>({name:t.name,type:t.ValueTypeName,interpolation:t.getInterpolation(),times:t.times,values:t.values}));}
function surfaces(scene){const out=[];scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;out.push({name:mesh.name,attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([n,a])=>[n,{array:a.array,itemSize:a.itemSize,normalized:a.normalized}])),index:mesh.geometry.index?.array,bindMatrix:mesh.bindMatrix.elements,bindMatrixInverse:mesh.bindMatrixInverse.elements,bones:mesh.skeleton.bones.map(b=>b.name),boneInverses:mesh.skeleton.boneInverses.map(m=>m.elements)});});return out;}
for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${hero}: dense native golf preserves the complete pair and calibrated arm bounds`,async t=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url);
 const profile=process.env.NINJA_GOLF_CANDIDATE_GRIPS?JSON.parse(fs.readFileSync(file+'.grip.json'))[hero].golf:profiles[hero].golf;
 assert.ok(Number.isFinite(profile.gripSpacing)&&profile.gripSpacing<0,'Supply the exact negative per-hero golf gripSpacing.');
 for(const side of ['r','l'])assert.equal(profile[side].frame?.length,4,'A full fitted hand frame is required.');
 const g=await loadNativeSkin(file),bones={};g.scene.traverse(b=>{if(b.isBone){assert.ok(!bones[b.name],`Duplicate bone ${b.name}`);bones[b.name]=b;}});
 if(process.env.NINJA_GOLF_MODEL_DIR){
  const original=await loadNativeSkin(new URL('../public/models/'+hero+'.glb',import.meta.url));
  for(const clip of original.animations.filter(c=>!names.includes(c.name))){
   const candidate=g.animations.find(c=>c.name===clip.name);assert.ok(candidate,`Removed ${clip.name}`);
   assert.equal(candidate.duration,clip.duration);assert.deepEqual(tracks(candidate),tracks(clip));
  }
  assert.deepEqual(surfaces(g.scene),surfaces(original.scene),'Changed geometry or skin bindings');
 }
 // Calibrate from the loaded native bind, before evaluating any animation.
 g.scene.updateMatrixWorld(true);
 const calibration=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
 const neutral=Object.fromEntries(['r','l'].map(s=>[s,bones['hand_'+s].quaternion.clone().normalize()]));
 const bind=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}]));
 const point=n=>bones[n].getWorldPosition(new T.Vector3());
 const world=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
 const measured=Object.fromEntries(['wrist','hingeDeviation','negativeFlexion','flexion','humeral','forearm','leadAddressFlexion','palmGap','completeFrameMismatch','armFrameStep120','authoredFrameRate'].map(n=>[n,peak()]));
 let referenceAddress=null,sampleCount=0;const puttEntryDifference={};
 for(const name of names){
  const clip=g.animations.find(c=>c.name===name);assert.ok(clip,`Missing ${name}`);
  const channels=clip.tracks.map(track=>{
   const at=track.name.lastIndexOf('.'),bone=bones[track.name.slice(0,at)],property=track.name.slice(at+1);
   assert.ok(bone&&['position','quaternion','scale'].includes(property),`Unexpected track ${track.name}`);
   return{bone,property,interpolant:track.createInterpolant()};
  });
  const sampleTimes=new Set([0,clip.duration]),keyTimes=new Set(clip.tracks.flatMap(track=>Array.from(track.times)));
  for(let i=0;i<=Math.ceil(clip.duration*480);i++)sampleTimes.add(Math.min(i/480,clip.duration));
  for(const track of clip.tracks)for(let i=0;i<track.times.length;i++){
   sampleTimes.add(track.times[i]);if(i)sampleTimes.add((track.times[i-1]+track.times[i])*.5);
  }
  let previous=null,previousTime=null,previousKey=null,previousKeyTime=null;
  for(const time of [...sampleTimes].sort((a,b)=>a-b)){
   // Direct track evaluation avoids stale AnimationMixer bindings at repeated times.
   for(const [n,pose]of Object.entries(bind))for(const property of ['position','quaternion','scale'])bones[n][property].copy(pose[property]);
   for(const {bone,property,interpolant}of channels){bone[property].fromArray(interpolant.evaluate(time));if(property==='quaternion')bone.quaternion.normalize();}
   g.scene.updateMatrixWorld(true);sampleCount++;
   const palms={},frames={},current={};
   for(const side of ['r','l']){
    const anatomy=measureArmAnatomy(calibration[side],captureArmPose(bones,side));
    retain(measured.hingeDeviation,anatomy.hingeDeviationDegrees,name,time,side);
    retain(measured.negativeFlexion,-anatomy.signedFlexionDegrees,name,time,side);
    retain(measured.flexion,anatomy.signedFlexionDegrees,name,time,side);
    retain(measured.humeral,Math.abs(anatomy.humeralRollDegrees),name,time,side);
    retain(measured.forearm,Math.abs(anatomy.forearmTwistDegrees),name,time,side);
    retain(measured.wrist,degrees(bones['hand_'+side].quaternion.angleTo(neutral[side])),name,time,side);
    if(side==='r'&&(name==='Golf_Address'||time===0))retain(measured.leadAddressFlexion,anatomy.signedFlexionDegrees,name,time,side);
    palms[side]=bones['hand_'+side].localToWorld(new T.Vector3().fromArray(profile[side].center));
    frames[side]=world('hand_'+side).multiply(new T.Quaternion().fromArray(profile[side].frame)).normalize();
    for(const part of ['upperarm','lowerarm'])current[part+'_'+side]=world(part+'_'+side);
   }
   const axis=new T.Vector3(0,1,0).applyQuaternion(frames.r);
   retain(measured.palmGap,palms.l.distanceTo(palms.r.clone().addScaledVector(axis,-profile.gripSpacing)),name,time);
   retain(measured.completeFrameMismatch,degrees(frames.r.angleTo(frames.l)),name,time);
   if(keyTimes.has(time)){
    if(previousKey&&time-previousKeyTime>1e-6)for(const [n,q]of Object.entries(current))retain(measured.authoredFrameRate,degrees(previousKey[n].angleTo(q))/(time-previousKeyTime),name,time,n);
    previousKey=current;previousKeyTime=time;
   }
   if(!previous){previous=current;previousTime=time;}
   else if(time-previousTime>=1/480-1e-7){
    for(const [n,q]of Object.entries(current))retain(measured.armFrameStep120,degrees(previous[n].angleTo(q))/(time-previousTime)/120,name,time,n);
    previous=current;previousTime=time;
   }
   if(time===0){
    const address=Object.fromEntries(['pelvis','spine_03','hand_r','hand_l'].map(n=>[n,{p:point(n),q:world(n)}]));
    if(name==='Golf_Address')referenceAddress=address;
    else for(const n of Object.keys(address)){
     if(name==='Golf_Putt'){puttEntryDifference[n]={metres:address[n].p.distanceTo(referenceAddress[n].p),degrees:degrees(address[n].q.angleTo(referenceAddress[n].q))};continue;}
     assert.ok(address[n].p.distanceTo(referenceAddress[n].p)<.001,`${n}: ${name} starts away from address`);
     assert.ok(address[n].q.angleTo(referenceAddress[n].q)<.005,`${n}: ${name} starts with a different frame`);
    }
   }
  }
 }
 t.diagnostic(JSON.stringify({sampleCount,puttEntryDifference,...measured}));
 for(const [name,limit]of Object.entries({wrist:31,hingeDeviation:.1,negativeFlexion:0,flexion:125,humeral:71,forearm:71,leadAddressFlexion:18.25}))assert.ok(measured[name].value<=limit+ANGLE_EPS,`${name}: ${JSON.stringify(measured[name])}`);
 assert.ok(measured.palmGap.value<=.0002,`Hands separate: ${JSON.stringify(measured.palmGap)}`);
 assert.ok(measured.completeFrameMismatch.value<=.1,`Full palm frames disagree: ${JSON.stringify(measured.completeFrameMismatch)}`);
 assert.ok(measured.armFrameStep120.value<=25,`Abrupt arm movement: ${JSON.stringify(measured.armFrameStep120)}`);
 assert.ok(measured.authoredFrameRate.value<=3000,`Abrupt authored interval: ${JSON.stringify(measured.authoredFrameRate)}`);
 // The authoring solver targets 30° wrists and 70° axial turns. These baked
 // animation bounds permit a 1° fitting margin; ANGLE_EPS covers storage only.
 // Finite face/ball/sole contact and actual finger surfaces remain in browser-golf-motion.mjs.
 // This test does not replace the independent arm/torso triangle checks.
});
