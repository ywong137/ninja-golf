#!/usr/bin/env node
// Fit shared joint corrections into the captured animation, before playback.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {spawnSync} from 'node:child_process';
import {Quaternion,Vector3,LoopOnce} from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {kneePlaneWindow,applyKneePlane,samplePeriodicAngle} from './knee-plane-constraints.mjs';
import {patchAnimationRotations} from './patch-animation-rotations.mjs';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-run-joints.mjs --input CAPTURED.glb --output NEW.glb\nFit periodic knee-plane corrections into both captured forward runs. Preserve body motion, shoe targets, and all other animation channels. Output must be new and outside public/. Requires python3 with NumPy and SciPy.');process.exit(0);}
if(!values.input||!values.output)throw Error('Supply --input and --output. See --help.');
const input=path.resolve(values.input),output=path.resolve(values.output),publicRoot=path.resolve('public');
if(output===input||output===publicRoot||output.startsWith(publicRoot+path.sep)||fs.existsSync(output))throw Error('Choose a new output outside public/.');
const g=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const sides=['r','l'],names=sides.flatMap(s=>['thigh','calf','foot'].map(n=>n+'_'+s));
const anatomy=Object.fromEntries(sides.map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const point=b=>b.getWorldPosition(new Vector3()),rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const entries=[],reports=[],bounds=[];
fs.mkdirSync(path.dirname(output),{recursive:true});
for(const name of ['Run_Forward','Sprint_Forward']){
 const clip=g.animations.find(c=>c.name===name);
 if(!clip?.userData?.capturedBodyVersion||clip.userData.capturedJointFitVersion)throw Error('Use a captured run without an existing joint fit: '+name);
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
 const pose=phase=>{action.time=phase*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);};
 const count=480,windows=Object.fromEntries(sides.map(s=>[s,[]])),fits={};
 for(let i=0;i<count;i++){
  pose(i/count);
  for(const s of sides){
   const phase=(i/count+(s==='l'?.5:0))%1;
   const outward=phase<(clip.userData.nativeContactSchedule?.release??.28)
    ?new Vector3(0,1,0).cross(point(bones['ball_'+s]).sub(point(bones['foot_'+s])).setY(0).normalize()).multiplyScalar(s==='l'?1:-1):null;
   try{windows[s].push(kneePlaneWindow(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],anatomy[s],{outward,offPitchLimit:phase>=.4&&phase<=.86?14:180}));}
   catch(error){throw Error(`${name} ${s} phase ${i/count}: ${error.message}`);}
  }
 }
 bounds.push({clip:name,windows});
 fs.writeFileSync(output+'.bounds.json',JSON.stringify(bounds,null,2));
 for(const s of sides){
  const result=spawnSync(process.env.NINJA_PYTHON??'python3',[new URL('./fit-periodic-angle.py',import.meta.url).pathname],{
   input:JSON.stringify({duration:clip.duration,speedLimit:2,rows:windows[s]}),encoding:'utf8',
   env:{...process.env,OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'},
  });
  if(result.status!==0)throw Error(`${name} ${s} angle fit: ${result.stderr}`);
  fits[s]=JSON.parse(result.stdout);
 }
 const samples=Math.ceil(clip.duration*480),times=[...new Set([...Array.from({length:samples+1},(_,i)=>Math.fround(i/samples*clip.duration)),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
 const rotations=Object.fromEntries(names.map(n=>[n,[]])),report={clip:name,fit:fits,maxContactError:0,maxShoeError:0,maxHip:0,maxAnkle:0,maxHinge:0,maxLoadedMedial:0};
 for(const time of times){
  const phase=time/clip.duration;pose(phase);
  for(const s of sides){
   const thigh=bones['thigh_'+s],calf=bones['calf_'+s],foot=bones['foot_'+s],p=point(foot),q=rotation(foot);
   applyKneePlane(thigh,calf,foot,anatomy[s],samplePeriodicAngle(fits[s].controls,phase));
   const a=measureLegAnatomy(anatomy[s],thigh,calf,foot);
   if((phase+(s==='l'?.5:0))%1<(clip.userData.nativeContactSchedule?.release??.28)){
    const outward=new Vector3(0,1,0).cross(point(bones['ball_'+s]).sub(point(foot)).setY(0).normalize()).multiplyScalar(s==='l'?1:-1);
    report.maxLoadedMedial=Math.max(report.maxLoadedMedial,-point(calf).sub(point(foot)).dot(outward));
   }
   report.maxContactError=Math.max(report.maxContactError,p.distanceTo(point(foot)));
   report.maxShoeError=Math.max(report.maxShoeError,q.angleTo(rotation(foot)));
   report.maxHip=Math.max(report.maxHip,Math.abs(a.hipTwist));report.maxAnkle=Math.max(report.maxAnkle,Math.abs(a.ankleTwist));report.maxHinge=Math.max(report.maxHinge,a.kneeDeviation);
  }
  for(const n of names){const q=bones[n].quaternion.clone().normalize(),track=rotations[n];if(track.length&&q.dot(new Quaternion().fromArray(track,track.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);track.push(...q.toArray());}
 }
 reports.push(report);fs.writeFileSync(output+'.joints.json',JSON.stringify(reports,null,2));
 if(report.maxContactError>1e-5||report.maxShoeError>1e-4||report.maxHip>27.2||report.maxAnkle>14.7||report.maxHinge>.01||report.maxLoadedMedial>.02)throw Error('Authored joint fit failed its dense validation: '+JSON.stringify({...report,fit:undefined}));
 entries.push({clip:name,times,rotations,extras:{capturedJointFitVersion:2,reviewCandidate:true}});
}
fs.writeFileSync(output,patchAnimationRotations(fs.readFileSync(input),entries));
const preservation=verifyAnimationReplacement(input,output,entries.map(e=>[e.clip,e.clip]));
console.log(JSON.stringify({output,preservation,reports:reports.map(({fit,...report})=>({...report,fit:Object.fromEntries(Object.entries(fit).map(([side,{controls,angles,...summary}])=>[side,summary]))}))},null,2));
