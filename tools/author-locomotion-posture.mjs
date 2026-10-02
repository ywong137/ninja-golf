#!/usr/bin/env node
// Fit all shared travelling clips to native proportions. Keep original model
// bytes and unrelated clips. Candidates require visual review before release.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {spawnSync} from 'node:child_process';
import {Vector3,Quaternion,LoopOnce} from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {footForward,headingKnee} from '../src/knee-alignment.js';
import {calibrateLegHinge,alignLegHinge} from '../src/leg-hinge.js';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';
import {parseGlb} from './bake-native-golf.mjs';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},source:{type:'string',default:'tests/fixtures/source-gaits.glb'},python:{type:'string',default:'python3'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-locomotion-posture.mjs --input HERO.glb --output CANDIDATE.glb [--source SOURCE.glb] [--python python3]\nFit shared running and guarded walking stride and posture to native leg reach. Preserve support timing, native limb lengths, body rotations, grips, and unrelated assets. Write the fitted stride ratio into animation metadata for the matching runtime clock. Refuse public output and repeated bakes.');process.exit(0);}
if(!values.input||!values.output)throw Error('Supply --input and a separate --output. See --help.');
const input=path.resolve(values.input),output=path.resolve(values.output),publicPath=path.resolve('public');
if(input===output||output===publicPath||output.startsWith(publicPath+path.sep))throw Error('Use a separate candidate outside public/. Review it before promotion.');
const bytes=fs.readFileSync(input),{doc}=parseGlb(bytes);
const chosen=doc.animations.filter(c=>/^(Run_(Forward|Backward|Left|Right)|Sprint_Forward)$|_Guard_Walk_/.test(c.name));
if(!chosen.length)throw Error('No native travelling clips were found.');
if(chosen.some(c=>c.extras?.sharedPostureVersion))throw Error('This model already has a posture fit. Use the unchanged source.');
const g=await loadNativeSkin(input),source=await loadNativeSkin(values.source);
const point=b=>b.getWorldPosition(new Vector3()),rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);source.scene.updateMatrixWorld(true);
const bindHeight=point(bones.pelvis).y;
const legs=Object.fromEntries(['r','l'].map(s=>[s,{upper:point(bones['thigh_'+s]).distanceTo(point(bones['calf_'+s])),lower:point(bones['calf_'+s]).distanceTo(point(bones['foot_'+s])),hinge:calibrateLegHinge(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])}]));
const legLength=(legs.r.upper+legs.r.lower+legs.l.upper+legs.l.lower)/2;
const sp=n=>point(source.scene.getObjectByName(n)),sourceBind=sp('pelvis').y,sourceLeg=sp('thigh_r').distanceTo(sp('calf_r'))+sp('calf_r').distanceTo(sp('foot_r'));
const reference={};
for(const name of ['Jog_Fwd_Loop','Sprint_Loop']){
 const clip=source.animations.find(c=>c.name===name);if(!clip)throw Error('Missing reference '+name);
 source.mixer.stopAllAction();const a=source.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();a.clampWhenFinished=true;
 let drop=0,lateralOffset=0;
 for(let i=0;i<240;i++){
  a.time=i/240*clip.duration;source.mixer.update(0);source.scene.updateMatrixWorld(true);drop+=sourceBind-sp('pelvis').y;
  const lateral=sp('thigh_l').sub(sp('thigh_r')).setY(0).normalize();
  for(const side of ['r','l'])lateralOffset+=sp('foot_'+side).sub(sp('thigh_'+side)).dot(lateral)*(side==='l'?1:-1);
 }
 reference[name]={meanDropPerLeg:drop/240/sourceLeg,meanLateralOffsetPerLeg:lateralOffset/480/sourceLeg};
}
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function footHeightAnchorWeight(name,phase,side){
 const walking=name.includes('_Guard_Walk_'),support=walking?.5:.28,offset=(side==='r'?0:.5)+(walking?.25:0),p=(phase+offset)%1;
 if(p<support)return 1;
 const u=(p-support)/(1-support);
 // This is a height-preservation blend, not a contact probability.
 // Contact phases come from rocketbox-rig.py and author-guard-motion.py.
 // A free foot follows body height through mid-flight. Release and landing
 // retain zero first derivatives, so raising the body cannot pop a loaded foot.
 return 1-smooth(u/.28)*smooth((1-u)/.28);
}
const entries=[],reports=[];
for(const selected of chosen){
 const clip=g.animations.find(c=>c.name===selected.name),count=Math.round(clip.duration*240),samples=[];
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
 const sample=t=>{action.time=t;g.mixer.update(0);g.scene.updateMatrixWorld(true);};
 const ref=reference[clip.name==='Sprint_Forward'?'Sprint_Loop':'Jog_Fwd_Loop'];
 const target=bindHeight-ref.meanDropPerLeg*legLength;
 for(let i=0;i<count;i++){
  sample(i/count*clip.duration);const pelvis=point(bones.pelvis),feet={};
  for(const side of ['r','l']){
   const hip=point(bones['thigh_'+side]),p=point(bones['foot_'+side]),weight=footHeightAnchorWeight(clip.name,i/count,side);
   feet[side]={p,hip,q:rotation(bones['foot_'+side]),weight};
  }
  samples.push({source:pelvis.y,feet});
 }
 const direction=clip.name.endsWith('_Left')?new Vector3(-1,0,0):clip.name.endsWith('_Right')?new Vector3(1,0,0):clip.name.endsWith('_Backward')?new Vector3(0,0,-1):new Vector3(0,0,1);
 const center=Object.fromEntries(['r','l'].map(side=>[side,samples.reduce((sum,r)=>sum.add(r.feet[side].p),new Vector3()).divideScalar(count).setY(0)]));
 const hipCenter=Object.fromEntries(['r','l'].map(side=>[side,samples.reduce((sum,r)=>sum.add(r.feet[side].hip),new Vector3()).divideScalar(count)]));
 const lateral=hipCenter.l.clone().sub(hipCenter.r).setY(0).normalize();
 // A guarded walk keeps extra room for clothing and the braced upper body.
 // Ordinary running follows the measured reference width instead.
 const lateralOffset=clip.name.includes('_Guard_Walk_')?.04:ref.meanLateralOffsetPerLeg;
 const neutral=Object.fromEntries(['r','l'].map(side=>[side,hipCenter[side].clone().addScaledVector(lateral,(side==='r'?-1:1)*legLength*lateralOffset).setY(0)]));
 // A lateral guard retains enough width for its alternating steps. Moving
 // both paths under the hips without shortening their sweep crosses the feet.
 if(/_Guard_Walk_(Left|Right)$/.test(clip.name))for(const side of ['r','l'])neutral[side].copy(center[side]);
 // Centre straight travel beneath the hips. Lateral guarded movement retains
 // its authored stagger and step width above to avoid crossing the feet.
 const footAt=(f,side,scale)=>{
  const p=f.p.clone().add(neutral[side]).sub(center[side]).addScaledVector(direction,(f.p.dot(direction)-center[side].dot(direction))*(scale-1));
  // The recovering guarded step passes around the supporting leg. Keep the
  // footprint unchanged during support; use the existing smooth flight blend.
  if(/_Guard_Walk_(Forward|Backward)$/.test(clip.name))p.addScaledVector(lateral,(side==='r'?-1:1)*legLength*.06*(1-f.weight));
  return p;
 };
 const ceilingAt=(row,scale,witness=null)=>{
  let ceiling=target+.02;
  for(const side of ['r','l']){
   const f=row.feet[side],p=footAt(f,side,scale),leg=legs[side],reach=(leg.upper+leg.lower)*.985;
   const horizontal=f.hip.clone().sub(p).setY(0).lengthSq(),budget=p.y+Math.sqrt(Math.max(0,reach*reach-horizontal))-f.hip.y;
   if(f.weight>1e-6&&row.source+budget/f.weight<ceiling){
    ceiling=row.source+budget/f.weight;
    if(witness)Object.assign(witness,{side,pressure:f.weight,hip:f.hip.toArray(),foot:p.toArray(),ceiling});
   }
  }
  return ceiling;
 };
 // Retain the longest feasible stride. A small compression reserve permits
 // loading; it must not restore the previous permanent crouch. One ratio for
 // both legs preserves speed and phase relationships through the whole clip.
 const minimumHeight=target-.03*legLength;
 const feasible=scale=>samples.every(row=>ceilingAt(row,scale)>=minimumHeight+.001);
 if(!feasible(0))throw Error(`${clip.name}: neutral foot placement prevents the reference posture; inspect stance width and hip alignment.`);
 let lo=0,hi=1;
 for(let n=0;n<30;n++){const mid=(lo+hi)/2;if(feasible(mid))lo=mid;else hi=mid;}
 const strideScale=feasible(1)?1:lo;
 if(strideScale<.35)throw Error(`${clip.name}: required stride ratio ${strideScale.toFixed(3)} would create shuffling. Rebuild its source foot path.`);
 let limiting={ceiling:Infinity};
 for(const [i,row]of samples.entries()){
  const witness={phase:i/count};row.ceiling=ceilingAt(row,strideScale,witness);witness.ceiling=row.ceiling;
  if(row.ceiling<limiting.ceiling)limiting=witness;
 }
 const fit=spawnSync(values.python,[new URL('./fit-locomotion-posture.py',import.meta.url).pathname],{input:JSON.stringify({duration:clip.duration,target,rows:samples.map(({source,ceiling})=>({source,ceiling}))}),encoding:'utf8',env:{...process.env,OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'}});
 if(fit.status!==0)throw Error(`${clip.name}: posture fit failed\n${fit.stderr}`);
 const fitted=JSON.parse(fit.stdout),names=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'];
 // Retain every original interpolation boundary. Extra dense samples avoid
 // a changed IK curve smearing an original contact key into adjacent frames.
 const bakeCount=Math.round(clip.duration*480);
 const times=[...new Set([...Array.from({length:bakeCount+1},(_,i)=>Math.fround(i/bakeCount*clip.duration)),...clip.tracks.flatMap(track=>Array.from(track.times))])].sort((a,b)=>a-b);
 const heightAt=phase=>{
  const at=phase*count,index=Math.floor(at),u=at-index,h=j=>fitted.heights[(j+count)%count];
  const a=h(index),b=h(index+1),m0=(b-h(index-1))/2,m1=(h(index+2)-a)/2;
  return (2*u**3-3*u*u+1)*a+(u**3-2*u*u+u)*m0+(-2*u**3+3*u*u)*b+(u**3-u*u)*m1;
 };
 const rotations=Object.fromEntries(names.map(n=>[n,[]])),translations={pelvis:[]};let maxError=0,minKnee=180,maxKnee=0;
 for(let i=0;i<times.length;i++){
  const phase=times[i]/clip.duration;sample(times[i]);
  const height=heightAt(phase),pelvis=point(bones.pelvis),offset=height-pelvis.y;
  const feet=Object.fromEntries(['r','l'].map(side=>[side,{p:point(bones['foot_'+side]),q:rotation(bones['foot_'+side]),weight:footHeightAnchorWeight(clip.name,phase,side)}]));
  const original=['pelvis',...names].map(name=>[bones[name],bones[name].position.clone(),bones[name].quaternion.clone()]);
  pelvis.y=height;bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));g.scene.updateMatrixWorld(true);
  for(const side of ['r','l']){
   const f=feet[side],target=footAt(f,side,strideScale);target.y+=offset*(1-f.weight);
   // Forward and backward travel need shoes aligned with the stepping plane.
   // The old static toe-out remained in these clips while the hip moved behind
   // the shoe. Correct yaw only; retain the original pitch and sole height.
   if(/^(Run_(Forward|Backward)|Sprint_Forward)$|_Guard_Walk_(Forward|Backward)$/.test(clip.name)){
    const forward=footForward(bones['foot_'+side],f.q),yaw=Math.atan2(forward.x,forward.z);
    f.q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-yaw));
   }
   // A guarded step keeps a small outward thigh rotation. A purely forward
   // knee plane compresses the inner upper-thigh surfaces of wider clothing.
   // Rotate the rigid knee plane, then restore the calibrated native hinge.
   const bendOffset=/_Guard_Walk_(Forward|Backward)$/.test(clip.name)?(side==='r'?.10:-.10):0;
   const kneeSolver=(hip,ankle,upper,lower,forward)=>headingKnee(hip,ankle,upper,lower,forward,bendOffset);
   maxError=Math.max(maxError,solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],target,f.q,{maxReach:.999,kneeSolver}));
   alignLegHinge(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],legs[side].hinge);
   const h=point(bones['thigh_'+side]),k=point(bones['calf_'+side]),a=point(bones['foot_'+side]);
   const flex=k.clone().sub(h).angleTo(a.clone().sub(k))*180/Math.PI;minKnee=Math.min(minKnee,flex);maxKnee=Math.max(maxKnee,flex);
  }
  for(const name of names){const q=bones[name].quaternion.clone().normalize(),track=rotations[name];if(track.length&&q.dot(new Quaternion().fromArray(track,track.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);track.push(...q.toArray());}
  translations.pelvis.push(...bones.pelvis.position.toArray());
  // AnimationMixer skips writes when an input value stays unchanged. Restore
  // the evaluated source before the next sample, including near-duplicate
  // original keys; otherwise a fitted position can leak into the next pose.
  for(const [bone,p,q]of original){bone.position.copy(p);bone.quaternion.copy(q);}
  g.scene.updateMatrixWorld(true);
 }
 if(maxError>1e-5)throw Error(`${clip.name}: native foot target is unreachable by ${maxError}m.`);
 const straightTravel=/^(Run_(Forward|Backward)|Sprint_Forward)$|_Guard_Walk_(Forward|Backward)$/.test(clip.name);
 entries.push({clip:clip.name,times,rotations,translations,extras:{sharedPostureVersion:3,nativeLegFrames:1,postureReference:ref.meanDropPerLeg,nativeStrideScale:strideScale,...(straightTravel?{nativeTravelHeading:0}:{})}});
 const {heights,...diagnostics}=fitted;reports.push({clip:clip.name,...diagnostics,strideScale,centering:{r:neutral.r.clone().sub(center.r).toArray(),l:neutral.l.clone().sub(center.l).toArray()},limiting,minKnee,maxKnee,maxError});
}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,patchAnimationTransforms(bytes,entries));
const preservation=verifyAnimationReplacement(input,output,entries.map(e=>[e.clip,e.clip]));
const result={input,output,bindHeight,legLength,reference,clips:reports,preservation};
fs.writeFileSync(output+'.posture.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
