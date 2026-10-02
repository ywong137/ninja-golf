#!/usr/bin/env node
// Experimental native gait bake. Both contact endpoints determine the stride.
// One contact interval owns stance, pelvis reach, and the flight handoff.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {spawnSync} from 'node:child_process';
import {Vector3,Quaternion,LoopOnce,MathUtils} from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {FootPlacement,solveLeg,AUTHORED_LEG_REACH} from '../src/foot-placement.js';
import {headingKnee} from '../src/knee-alignment.js';
import {alignLegHinge} from '../src/leg-hinge.js';
import {nativeRunSpec} from '../src/native-stride.js';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';
import {RUN_CONTACT_SCHEDULE as contact,createRunningStance,quinticVector,sampleDerivatives} from './run-contact-trajectory.mjs';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},clip:{type:'string',default:'Sprint_Forward'},python:{type:'string',default:'python3'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-run-push-off.mjs --input HERO.glb --output CANDIDATE.glb [--clip Sprint_Forward|Run_Forward|all] [--python python3]\nCreate an experimental gait candidate. Landing and release determine stride distance. One contact schedule separates stance from flight. Preserve meshes, upper-body rotations, grips, and other clips. Require independent motion and roster review before publication. Output must be new and outside public/.');process.exit(0);}
if(!values.input||!values.output)throw Error('Supply --input and --output. See --help.');
if(!['all','Run_Forward','Sprint_Forward'].includes(values.clip))throw Error('Choose --clip all, Run_Forward, or Sprint_Forward.');
const input=path.resolve(values.input),output=path.resolve(values.output),publicRoot=path.resolve('public');
if(input===output||output===publicRoot||output.startsWith(publicRoot+path.sep)||fs.existsSync(output))throw Error('Choose a new candidate path outside public/.');
const g=await loadNativeSkin(input),source=await loadNativeSkin('tests/fixtures/source-gaits.glb'),bones={};
g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);source.scene.updateMatrixWorld(true);
const p=b=>b.getWorldPosition(new Vector3()),q=b=>b.getWorldQuaternion(new Quaternion()).normalize(),UP=new Vector3(0,1,0);
const placement=new FootPlacement(g.scene,bones);
const legs=Object.fromEntries(['r','l'].map(s=>[s,{upper:p(bones['thigh_'+s]).distanceTo(p(bones['calf_'+s])),lower:p(bones['calf_'+s]).distanceTo(p(bones['foot_'+s]))}]));
const legLength=(legs.r.upper+legs.r.lower+legs.l.upper+legs.l.lower)/2;
const sourcePoint=name=>p(source.scene.getObjectByName(name)),sourceLeg=sourcePoint('thigh_r').distanceTo(sourcePoint('calf_r'))+sourcePoint('calf_r').distanceTo(sourcePoint('foot_r'));
const wrap=u=>MathUtils.euclideanModulo(u,1),phase=(u,s)=>wrap(u+(s==='l'?.5:0));
const periodicHeight=(values,u)=>{
 const n=values.length,at=wrap(u)*n,i=Math.floor(at),t=at-i,h=j=>values[(j+n)%n];
 const a=h(i),b=h(i+1),m0=(b-h(i-1))/2,m1=(h(i+2)-a)/2;
 return (2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b+(t**3-t*t)*m1;
};
const fitCurve=data=>{
 const result=spawnSync(values.python,[new URL('./fit-locomotion-posture.py',import.meta.url).pathname],{input:JSON.stringify(data),encoding:'utf8',env:{...process.env,OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'}});
 if(result.status!==0){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output+'.failed-fit.json',JSON.stringify(data));throw Error('Periodic trajectory fit failed: '+result.stderr);}
 return JSON.parse(result.stdout);
};
const entries=[],reports=[];
for(const [name,referenceName,landing,liftoff,peak,amplitude]of [
 ['Run_Forward','Jog_Fwd_Loop',.52,.685,.82,.10],
 ['Sprint_Forward','Sprint_Loop',.50,.733,.80,.08],
]){
 if(values.clip!=='all'&&values.clip!==name)continue;
 const clip=g.animations.find(c=>c.name===name),ref=source.animations.find(c=>c.name===referenceName);
 if(!clip||!ref||clip.userData.sharedPostureVersion!==3||clip.userData.pushOffVersion)throw Error('Use a reviewed native posture model with unchanged forward clips: '+name);
 source.mixer.stopAllAction();const ra=source.mixer.clipAction(ref).reset().setLoop(LoopOnce).play();ra.clampWhenFinished=true;
 ra.time=liftoff*ref.duration;source.mixer.update(0);source.scene.updateMatrixWorld(true);
 const referenceRelease=sourcePoint('ball_r').sub(sourcePoint('thigh_r')).z/sourceLeg;
 const sourcePhase=u=>{
  const h=wrap(u)%.5,flightPeak=(contact.release+.5)/2;
  if(h<contact.release)return landing+(liftoff-landing)*h/contact.release;
  if(h<flightPeak)return liftoff+(peak-liftoff)*(h-contact.release)/(flightPeak-contact.release);
  return peak+(landing+.5-peak)*(h-flightPeak)/(.5-flightPeak);
 };
 const n=200,reference=[];
 for(let i=0;i<n;i++){
  let y=0;for(const half of [0,.5]){ra.time=wrap(sourcePhase(i/n)+half)*ref.duration;source.mixer.update(0);source.scene.updateMatrixWorld(true);y+=sourcePoint('pelvis').y/2;}reference.push(y);
 }
 const radius=4,filtered=reference.map((_,i)=>{
  let sum=0,weight=0;for(let j=-radius;j<=radius;j++){const w=radius+1-Math.abs(j);sum+=reference[(i+j+n)%n]*w;weight+=w;}return sum/weight;
 });
 const range=Math.max(...filtered)-Math.min(...filtered),mean=filtered.reduce((a,b)=>a+b,0)/n;
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
 const evaluate=u=>{action.time=wrap(u)*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);};
 const native=(side,u)=>{
  const global=phase(u,side);evaluate(global);
  return {p:p(bones['foot_'+side]),q:q(bones['foot_'+side]),hip:p(bones['thigh_'+side]),pelvis:p(bones.pelvis).y};
 };
 const parameters={};
 for(const side of ['r','l']){
  const start=native(side,0),flat=native(side,contact.flat),end=native(side,contact.release),flatQ=flat.q;
  flatQ.premultiply(new Quaternion().setFromUnitVectors(placement.feet[side].soleUp.clone().applyQuaternion(flatQ),UP));
  parameters[side]={landingPosition:start.p,landingRotation:start.q,flatRotation:flatQ,contacts:placement.feet[side].contacts,releaseToeZ:end.hip.z+referenceRelease*legLength};
 }
 const travelPerPhase=['r','l'].reduce((sum,s)=>sum+createRunningStance(parameters[s]).travelPerPhase,0)/2;
 const stance=Object.fromEntries(['r','l'].map(s=>[s,createRunningStance({...parameters[s],travelPerPhase})]));
 const oldSpec=nativeRunSpec(clip),strideScale=(clip.userData.nativeStrideScale??1)*travelPerPhase/(2*oldSpec.amplitude/oldSpec.support);
 const releaseKnee=(name==='Sprint_Forward'?25:30)*Math.PI/180;
 let releaseHeight=0;
 for(const side of ['r','l']){
  const original=native(side,contact.release),foot=stance[side].sample(contact.release),leg=legs[side];
  const distance2=leg.upper**2+leg.lower**2+2*leg.upper*leg.lower*Math.cos(releaseKnee),horizontal=foot.p.clone().sub(original.hip).setY(0).lengthSq();
  if(horizontal>=distance2)throw Error('The reference release exceeds native leg reach.');
  releaseHeight+=(foot.p.y+Math.sqrt(distance2-horizontal)-original.hip.y+original.pelvis)/2;
 }
 const at=contact.release*n,releaseReference=MathUtils.lerp(filtered[Math.floor(at)],filtered[(Math.floor(at)+1)%n],at%1);
 const center=releaseHeight-(releaseReference-mean)/range*amplitude*legLength,samples=[];
 for(let i=0;i<n;i++){
  evaluate(i/n);const original=p(bones.pelvis).y,target=center+(filtered[i]-mean)/range*amplitude*legLength;
  let ceiling=target+.03;
  for(const side of ['r','l']){
   const u=phase(i/n,side);if(u>contact.release)continue;
   const foot=stance[side].sample(u),hip=p(bones['thigh_'+side]),leg=legs[side],reach=(leg.upper+leg.lower)*AUTHORED_LEG_REACH;
   const horizontal=foot.p.clone().sub(hip).setY(0).lengthSq();
   if(horizontal>=reach**2)throw Error('The contact path exceeds native leg reach.');
   ceiling=Math.min(ceiling,original+foot.p.y+Math.sqrt(reach**2-horizontal)-hip.y);
  }
  samples.push({source:original,target,ceiling});
 }
 const fitInput={duration:clip.duration,target:center,rows:samples};
 const fitted=fitCurve(fitInput),height=u=>periodicHeight(fitted.heights,u);
 const flights={};
 for(const side of ['r','l']){
  const base=u=>{const original=native(side,u);original.p.y+=height(phase(u,side))-original.pelvis;return original.p;};
  const tangent=new Vector3(0,0,-travelPerPhase);
  flights[side]=[
   {t:contact.release,p:stance[side].sample(contact.release).p,v:tangent.clone(),a:new Vector3()},
   // Preserve the complete airborne path. Broad derivative samples avoid
   // amplifying sub-millimetre GLB quantization into large spline curvature.
   ...[.34,.4,.5,.65,.8,.9,.96].map(t=>({t,...sampleDerivatives(base,t,.015)})),
   {t:1,p:stance[side].sample(0).p,v:tangent.clone(),a:new Vector3()},
  ];
 }
 const sourceFootAt=(side,u)=>{
  if(u<=contact.release)return stance[side].sample(u);
  const rows=flights[side];let i=0;while(i<rows.length-2&&u>rows[i+1].t)i++;
  const a=rows[i],b=rows[i+1],position=quinticVector(a,b,u-a.t,b.t-a.t),original=native(side,u);
  const orientation=stance[side].sample(contact.release).q.slerp(original.q,MathUtils.smootherstep(u,contact.release,.5));
  orientation.slerp(stance[side].sample(0).q,MathUtils.smootherstep(u,.82,1));
  return {p:position,q:orientation,contact:null};
 };
 const footHeights={},footFits={};
 for(const side of ['r','l']){
  const rows=[];
  for(let i=0;i<n;i++){
   const u=i/n,f=sourceFootAt(side,u),original=native(side,u),hip=original.hip.clone();
   hip.y+=height(phase(u,side))-original.pelvis;
   const reach=(legs[side].upper+legs[side].lower)*AUTHORED_LEG_REACH,horizontal=f.p.clone().sub(hip).setY(0).lengthSq();
   if(horizontal>=reach**2)throw Error('Airborne foot exceeds horizontal leg reach: '+side+' '+u);
   const minimum=Math.max(-Math.min(...placement.feet[side].contacts.map(c=>c.clone().applyQuaternion(f.q).y)),hip.y-Math.sqrt(reach**2-horizontal));
   const loaded=u<=contact.release,desired=-f.p.y;
   rows.push({source:desired,target:desired,ceiling:(loaded?desired:-(minimum+.0005))+.001,...(loaded?{floor:desired}:{})});
  }
  const result=fitCurve({duration:clip.duration,target:0,speedLimit:10,rows});
  footHeights[side]=result.heights.map(v=>-v);
  const {heights,...diagnostics}=result;footFits[side]=diagnostics;
 }
 const footAt=(side,u)=>{
  const foot=sourceFootAt(side,u);
  if(u>contact.release)foot.p.y=periodicHeight(footHeights[side],u);
  return foot;
 };
 const names=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'],rotations=Object.fromEntries(names.map(n=>[n,[]])),translations={pelvis:[]};
 const count=Math.round(clip.duration*480),times=[...new Set([...Array.from({length:count+1},(_,i)=>Math.fround(i/count*clip.duration)),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
 let maxError=0,minimumSole=Infinity,worst=null;
 for(const t of times){
  const u=t/clip.duration,feet=Object.fromEntries(['r','l'].map(s=>[s,footAt(s,phase(u,s))]));
  evaluate(u);const original=['pelvis',...names].map(name=>[bones[name],bones[name].position.clone(),bones[name].quaternion.clone()]);
  const pelvis=p(bones.pelvis);pelvis.y=height(u);bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));g.scene.updateMatrixWorld(true);
  for(const side of ['r','l']){
   const f=feet[side],error=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],f.p,f.q,{maxReach:.999,kneeSolver:headingKnee});
   if(error>maxError){maxError=error;worst={phase:u,side,error,target:f.p.toArray(),hip:p(bones['thigh_'+side]).toArray()};}
   alignLegHinge(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],placement.hinges[side]);
   for(const point of placement.feet[side].contacts)minimumSole=Math.min(minimumSole,point.clone().applyQuaternion(q(bones['foot_'+side])).add(p(bones['foot_'+side])).y);
  }
  for(const name of names){const orientation=bones[name].quaternion.clone().normalize(),track=rotations[name];if(track.length&&orientation.dot(new Quaternion().fromArray(track,track.length-4))<0)orientation.set(-orientation.x,-orientation.y,-orientation.z,-orientation.w);track.push(...orientation.toArray());}
  translations.pelvis.push(...bones.pelvis.position.toArray());
  for(const [bone,position,rotation]of original){bone.position.copy(position);bone.quaternion.copy(rotation);}g.scene.updateMatrixWorld(true);
 }
 const {heights,...diagnostics}=fitted;
 const report={name,center,releaseHeight,referenceRelease,travelPerPhase,strideScale,maxError,minimumSole,worst,footFits,...diagnostics,rows:samples.map((r,i)=>({phase:i/n,...r,height:heights[i]}))};
 if(maxError>1e-5||minimumSole<-.003){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output+'.rejected.json',JSON.stringify(report,null,2));throw Error('Review candidate has unreachable or penetrating feet: '+JSON.stringify({maxError,minimumSole,worst}));}
 entries.push({clip:name,times,rotations,translations,extras:{pushOffVersion:7,nativeStrideScale:strideScale,nativeSupportPivot:{phase:contact.flat,contact:0},nativeContactSchedule:contact,pushOffReference:{clip:referenceName,landing,liftoff,peak,amplitude,referenceRelease},reviewCandidate:true}});
 reports.push(report);
}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,patchAnimationTransforms(fs.readFileSync(input),entries));
const report={input,output,legLength,clips:reports,preservation:verifyAnimationReplacement(input,output,entries.map(e=>[e.clip,e.clip]))};
fs.writeFileSync(output+'.push-off.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,clips:reports.map(({rows,...r})=>r),preservation:report.preservation},null,2));
