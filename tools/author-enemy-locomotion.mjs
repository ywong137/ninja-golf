#!/usr/bin/env node
/** Rebuild native enemy knee frames while retaining source foot paths and upper-body motion. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {headingKnee} from '../src/knee-alignment.js';
import {solveLeg} from '../src/foot-placement.js';
import {alignLegHinge} from '../src/leg-hinge.js';
import {calibrateLegAnatomy,measureLegAnatomy} from './native-leg-anatomy.mjs';
import {patchAnimationRotations} from './patch-animation-rotations.mjs';
import {parseGlb} from './bake-native-golf.mjs';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},report:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-enemy-locomotion.mjs --input ENEMY.glb --output CANDIDATE.glb [--report FILE.json]\nReplace seven standing/running/jump leg-frame tracks. Preserve foot paths, ground contacts, geometry, and upper-body animation. Input may be original or knee-plane version 1. Version 2 is rejected. Output must stay outside public/.');process.exit(0);}
if(!values.input||!values.output?.endsWith('.glb'))throw Error('Supply --input and --output CANDIDATE.glb. See --help.');
for(const target of [values.output,values.report].filter(Boolean))if(path.resolve(target)===path.resolve(values.input)||path.resolve(target).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Write a separate candidate outside public/.');
const raw=fs.readFileSync(values.input),{doc}=parseGlb(raw),g=await loadNativeSkin(values.input),bones={};
g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});g.scene.updateMatrixWorld(true);
const point=name=>bones[name].getWorldPosition(new T.Vector3()),rotation=name=>bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
const sides=['r','l'],names=sides.flatMap(s=>['thigh_','calf_','foot_'].map(n=>n+s));
const calibration=Object.fromEntries(sides.map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const entries=[],reports=[];
for(const name of ['Idle_Loop','Sword_Idle','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land']){
 const animation=doc.animations.find(a=>a.name===name),clip=g.animations.find(c=>c.name===name);
 if(!clip||!animation)throw Error('Missing enemy motion: '+name);
 if(animation.extras?.enemyKneePlaneVersion>=2)throw Error(name+' already has native leg frames. Use the original source.');
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);action.clampWhenFinished=true;action.play();
 const count=Math.ceil(clip.duration*480),times=[...new Set([...Array.from({length:count+1},(_,i)=>Math.fround(i/count*clip.duration)),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
 const rotations=Object.fromEntries(names.map(n=>[n,[]])),report={clip:name,samples:times.length,hip:0,ankle:0,hinge:0,minFlex:180,maxFlex:0,footError:0,footAngle:0,maxKneeSpeed:0,groundFootAngle:0},previous={};
 for(let i=0;i<times.length;i++){
  const time=times[i];action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const saved=names.map(n=>[bones[n],bones[n].quaternion.clone()]);
  for(const s of sides){
   const thigh=bones['thigh_'+s],calf=bones['calf_'+s],foot=bones['foot_'+s],target=point(foot.name),shoe=rotation(foot.name);
   const air=name==='Jump_Start'?T.MathUtils.smoothstep(Math.min(target.y,point('ball_'+s).y),.10,.20):0;
   const solve=angle=>{
    // These source clips face +Z. Do not reverse the knee plane when the
    // recovering shoe pitches through vertical behind the character.
    solveLeg(thigh,calf,foot,target,shoe,{maxReach:.9999999,kneeSolver:(h,a,u,l)=>headingKnee(h,a,u,l,new T.Vector3(0,0,1),angle*Math.PI/180)});
    alignLegHinge(thigh,calf,foot,calibration[s].hinge);
    let m=measureLegAnatomy(calibration[s],thigh,calf,foot);
    if(air>0){
     // An airborne shoe can turn with the tucked shin. Ground contacts retain
     // their source rotation; do not transfer this extra rotation into the hip.
     const turn=(T.MathUtils.clamp(m.ankleTwist,-8,8)-m.ankleTwist)*air*Math.PI/180,axis=point(foot.name).sub(point(calf.name)).normalize();
     const wanted=new T.Quaternion().setFromAxisAngle(axis,turn).multiply(shoe);
     foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(wanted));foot.updateWorldMatrix(false,true);
     m=measureLegAnatomy(calibration[s],thigh,calf,foot);
    }return m;
   };
   const clearance=/^Jog_|^Sprint_/.test(name)?1:air,bias=(s==='r'?8:-8)*clearance;
   const cost=angle=>{const m=solve(angle);return (m.hipTwist/40)**4+(m.ankleTwist/15)**4+((angle-bias)*(clearance/12+(1-clearance)/50))**2;};
   let lo=-40,hi=40;for(let n=0;n<20;n++){const l=lo+(hi-lo)/3,r=hi-(hi-lo)/3;if(cost(l)<cost(r))hi=r;else lo=l;}
   const m=solve((lo+hi)/2),knee=point(calf.name);
   for(const[key,value]of [['hip',Math.abs(m.hipTwist)],['ankle',Math.abs(m.ankleTwist)],['hinge',m.kneeDeviation]])if(value>report[key]){report[key]=value;report['worst'+key]={time,side:s,...m};}
   report.minFlex=Math.min(report.minFlex,m.kneeFlexion);report.maxFlex=Math.max(report.maxFlex,m.kneeFlexion);
   report.footError=Math.max(report.footError,point(foot.name).distanceTo(target));const footTurn=rotation(foot.name).angleTo(shoe);report.footAngle=Math.max(report.footAngle,footTurn);if(air===0)report.groundFootAngle=Math.max(report.groundFootAngle,footTurn);
   if(previous[s]&&time-previous[s].time>1e-5)report.maxKneeSpeed=Math.max(report.maxKneeSpeed,knee.distanceTo(previous[s].point)/(time-previous[s].time));
   previous[s]={time,point:knee};
  }
  for(const name of names){const values=rotations[name],q=bones[name].quaternion.clone().normalize();if(i&&q.dot(new T.Quaternion().fromArray(values,values.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);values.push(...q.toArray());}
  // Restore the source: the mixer skips assignments when a value is constant.
  for(const[bone,q]of saved)bone.quaternion.copy(q);g.scene.updateMatrixWorld(true);
 }
 if(report.hip>45||report.ankle>15||report.hinge>.01||report.minFlex<-.01||report.maxFlex>150||report.footError>.00005||report.groundFootAngle>.001||report.footAngle>Math.PI/4||report.maxKneeSpeed>12)throw Error('Enemy leg limits failed: '+JSON.stringify(report));
 reports.push(report);entries.push({clip:name,times,rotations,extras:{enemyKneePlaneVersion:2,nativeLegFrames:1}});
}
fs.writeFileSync(values.output,patchAnimationRotations(raw,entries));
const result={units:{hip:'degrees',ankle:'degrees',hinge:'degrees',minFlex:'degrees',maxFlex:'degrees',footAngle:'radians',groundFootAngle:'radians',footError:'metres',maxKneeSpeed:'metres/second'},source:values.input,sourceSha256:createHash('sha256').update(raw).digest('hex'),clips:reports};
if(values.report)fs.writeFileSync(values.report,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
