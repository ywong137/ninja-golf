#!/usr/bin/env node
// Bake native knee frames, foot pivots, and supported recovery steps.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {WARRIORS} from '../src/warriors.js';
import {calibrateLegAnatomy,measureLegAnatomy} from './native-leg-anatomy.mjs';
import {alignLegHinge} from '../src/leg-hinge.js';
import {headingKnee} from '../src/knee-alignment.js';
import {solveLeg} from '../src/foot-placement.js';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {shinobiSweepPivot} from './native-shinobi-body-profile.mjs';
const sources={kaede:'c00299aa21b0fd537296bdb21d68d2ad44ebce5a8a0cb6f3053993f154d3d0f2',ayame:'4cb8834ad7275adec942c9b06c963ea1e5208086ab4504f3f7b7e699127831cc',sora:'3466b10b2f768ae7842b5de903f42478fd35a2b120d6c500f3cd94c47dbef5cd',monk:'7c63e474b49147f5c6b9a02ca3a447ede677875f6a75f6422d7ee496f6e6d6c4'};
sources.shinobi='459265f1553359ee8803ed8899e1fa618bb2a116eb21470ea796999ebf6a15ba';
const {values:o}=parseArgs({options:{model:{type:'string'},input:{type:'string'},motions:{type:'string'},output:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(o.help){console.log('node tools/author-combat-leg-frames.mjs --model kaede|ayame|sora|monk|shinobi --input BASE.glb --motions BASE.json --output CANDIDATE.glb --record RECORDS.json\nUse ad13342 for the three women, b606f83 for Ethan, or 1d1a981 for Shinobi. Rebuild Ready and standard attacks, preserving the corrected Ace rising cut. Ethan and Shinobi include musou and guards. Shinobi also includes guard walks and reduced Sweep foot pivots. Output stays outside public/.');process.exit(0);}
if(!sources[o.model]||!o.input||!o.motions||!o.output?.endsWith('.glb')||!o.record?.endsWith('.json'))throw Error('Supply all five options. See --help.');
for(const target of [o.output,o.record])if(path.resolve(target)===path.resolve(o.input)||path.resolve(target).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Write a separate candidate outside public/.');
const sourceCommit=o.model==='shinobi'?'1d1a981':o.model==='monk'?'b606f83':'ad13342';
const input=fs.readFileSync(o.input);if(createHash('sha256').update(input).digest('hex')!==sources[o.model])throw Error('Use the source '+o.model+' model from '+sourceCommit+'. Repeated or changed input requires a new review.');
const hero=WARRIORS.find(w=>w.model===o.model),motions=JSON.parse(fs.readFileSync(o.motions));
const names=[hero.readyClip,...['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'].map(n=>hero.motionOverrides?.[hero.motionPrefix+n]??hero.motionPrefix+n)].filter(n=>n!=='Fan_Heavy_Rising');
if(o.model==='monk')names.push('Ethan_Naginata_Musou_Flow','Naginata_Guard_Loop','Naginata_Guard_Impact','Naginata_Guard_Break');
if(o.model==='shinobi')names.push(...['Forward','Right','Backward','Left'].map(d=>'Twin_Guard_Walk_'+d),'Twin_Musou_Flow','Twin_Guard_Loop','Twin_Guard_Impact','Twin_Guard_Break');
// Ethan's rear shoe previously pointed against his 30-degree ready hip turn.
// Keep the ankle paths, but face the shoes along the staggered fighting stance.
const headingOffset=o.model==='monk'?{r:10*Math.PI/180,l:55*Math.PI/180}:{r:0,l:0};
const g=await loadNativeSkin(o.input),b={};g.scene.traverse(n=>{if(n.isBone)b[n.name]=n;});g.scene.updateMatrixWorld(true);
const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize(),changed=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'];
const pelvisBindInverse=q('pelvis').invert();
const musouClose=side=>side==='r'?[3,3.2]:[2.64,2.75];
const smooth=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
const musouBodyOffset=time=>new T.Vector3(.24,-.04,-.06).multiplyScalar(smooth((time-2.82)/.16)*(1-smooth((time-3.2)/.1)));
// Reduce the alternating cut's 80/-65 degree pivots to 50/-40.625 degrees.
// Rotate about the actual toe, so the supporting forefoot stays in place.
const footPose=(name,side,time)=>{
 const original=p('foot_'+side),target=original.clone(),footq=q('foot_'+side),up=new T.Vector3(0,1,0);
 let yaw=headingOffset[side];
 if(o.model==='shinobi'&&name==='Twin_Cut_Sweep'){
  yaw=shinobiSweepPivot(side,time).yaw*(.625-1)*Math.PI/180;
  const toe=p('ball_'+side);target.copy(toe).sub(toe.clone().sub(original).applyAxisAngle(up,yaw));
 }
 if(o.model==='shinobi'&&name==='Twin_Musou_Flow'){
  const plants=motions[name].footPlants[side],start=plants[0][1],end=plants[1][0],close=musouClose(side);
  // Step onto a wider turning circle. Change its radius only during a step.
  // The last left step lands at Ready width. The right foot follows after the cut.
  const opened=smooth((time-start)/(end-start)),closed=smooth((time-close[0])/(close[1]-close[0]));
  const scale=1+.35*opened*(1-closed);target.x*=scale;target.z*=scale;
  if(side==='r'&&time>close[0]&&time<close[1])target.y+=.06*Math.sin(Math.PI*(time-close[0])/(close[1]-close[0]))**2;
  for(let i=0;i<plants.length-1;i++){
   const from=plants[i][1],to=plants[i+1][0];if(time<=from||time>=to)continue;
   const weight=Math.sin(Math.PI*(time-from)/(to-from))**2;
   target.addScaledVector(original.clone().setY(0).normalize(),.08*weight);
   // An airborne shoe follows the pelvis before reaching its landing heading.
   const body=new T.Vector3(0,0,1).applyQuaternion(q('pelvis').multiply(pelvisBindInverse));
   const shoe=p('ball_'+side).sub(original),difference=Math.atan2(body.x,body.z)-Math.atan2(shoe.x,shoe.z);
   yaw+=Math.atan2(Math.sin(difference),Math.cos(difference))*.35*weight;
  }
 }
 footq.premultiply(new T.Quaternion().setFromAxisAngle(up,yaw));
 return{target,footq,delta:target.clone().sub(original),yaw};
};
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])])),entries=[],records={},reports=[];
for(const name of names){
 if(!motions[name]||motions[name].nativeKneeHinges)throw Error('Use source motion records from '+sourceCommit+': '+name);
 const clip=g.animations.find(c=>c.name===name);if(!clip)throw Error('Missing '+name);g.mixer.stopAllAction();const a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
 const musou=o.model==='shinobi'&&name==='Twin_Musou_Flow',translations=musou?{pelvis:[]}:{};
 const times=[],rotations=Object.fromEntries(changed.map(n=>[n,[]])),report={name,hip:0,ankle:0,hinge:0,pole:0,maxPoleStep:0,footError:0,footAngle:0},lastPole={};
 const count=Math.ceil(clip.duration*480);
 // Include every original key, so sharp source pivots keep their exact timing.
 const sampleTimes=[...new Set([...Array.from({length:count+1},(_,i)=>Math.fround(i/count*clip.duration)),...clip.tracks.flatMap(track=>Array.from(track.times))])].sort((a,b)=>a-b);
 for(let i=0;i<sampleTimes.length;i++){
  const time=sampleTimes[i];times.push(time);a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);const saved=changed.map(n=>[b[n],b[n].quaternion.clone()]);
  const feet=Object.fromEntries(['r','l'].map(side=>[side,footPose(name,side,time)])),pelvisPosition=b.pelvis.position.clone();
  if(musou){
   // Transfer weight before lifting the right foot. Both feet support the return.
   const position=p('pelvis').add(musouBodyOffset(time));
   b.pelvis.position.copy(b.pelvis.parent.worldToLocal(position));g.scene.updateMatrixWorld(true);
  }
  for(const side of ['r','l']){
   const {target,footq}=feet[side];
   const solve=angle=>{
    const kneeSolver=(h,f,upper,lower,forward)=>headingKnee(h,f,upper,lower,forward,angle*Math.PI/180);
    solveLeg(b['thigh_'+side],b['calf_'+side],b['foot_'+side],target,footq,{maxReach:.9999,kneeSolver});
    alignLegHinge(b['thigh_'+side],b['calf_'+side],b['foot_'+side],cal[side].hinge);
    return measureLegAnatomy(cal[side],b['thigh_'+side],b['calf_'+side],b['foot_'+side]);
   };
   // Distribute axial rotation within the existing leg lengths and foot pose.
   // This offline fit makes no additional runtime skeleton evaluations.
   const hipPreference=o.model==='shinobi'?(name==='Twin_Musou_Flow'?35:38):45;
   const cost=angle=>{const m=solve(angle);return (m.hipTwist/hipPreference)**4+(m.ankleTwist/15)**4+(angle/50)**2;};let lo=-35,hi=35;
   for(let n=0;n<20;n++){const l=lo+(hi-lo)/3,r=hi-(hi-lo)/3;if(cost(l)<cost(r))hi=r;else lo=l;}
   const angle=(lo+hi)/2,m=solve(angle);
   if(Math.abs(m.hipTwist)>report.hip)report.worstHip={time,side,angle,...m};
   if(Math.abs(m.ankleTwist)>report.ankle)report.worstAnkle={time,side,angle,...m};
   const previous=lastPole[side],step=previous?Math.abs(angle-previous.angle):0;
   if(step>report.maxPoleStep){report.maxPoleStep=step;report.worstPoleStep={time,previousTime:previous.time,side,angle,previousAngle:previous.angle};}lastPole[side]={time,angle};
   report.hip=Math.max(report.hip,Math.abs(m.hipTwist));report.ankle=Math.max(report.ankle,Math.abs(m.ankleTwist));report.hinge=Math.max(report.hinge,m.kneeDeviation);report.pole=Math.max(report.pole,Math.abs(angle));report.footError=Math.max(report.footError,p('foot_'+side).distanceTo(target));report.footAngle=Math.max(report.footAngle,q('foot_'+side).angleTo(footq));
  }
  for(const name of changed){const v=rotations[name],rotation=b[name].quaternion.clone().normalize();if(i&&rotation.dot(new T.Quaternion().fromArray(v,v.length-4))<0)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);v.push(...rotation.toArray());}
  if(musou)translations.pelvis.push(...b.pelvis.position.toArray());
  // Restore source rotations; the mixer skips writes for unchanged track values.
  for(const[bone,q]of saved)bone.quaternion.copy(q);b.pelvis.position.copy(pelvisPosition);g.scene.updateMatrixWorld(true);
 }
 // Native nonuniform scales introduce less than 0.05 mm of transform roundoff.
 if(report.hip>45||report.ankle>15||report.hinge>.01||report.footError>5e-5||report.footAngle>.001)throw Error('Leg-frame limits failed: '+JSON.stringify(report));
 entries.push({clip:name,times,rotations,translations,extras:{nativeLegFrames:1}});records[name]={...motions[name],nativeKneeHeading:true,nativeKneeHinges:true};
 if(o.model==='shinobi'&&['Twin_Cut_Sweep','Twin_Musou_Flow'].includes(name)){
  records[name].poses=motions[name].poses.map(pose=>{
   a.time=pose.t*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);const result={...pose};
   for(const side of ['r','l']){
    const {delta,yaw}=footPose(name,side,a.time),suffix=side.toUpperCase(),source=pose['foot'+suffix];
    result['foot'+suffix]=[source[0]+delta.x,source[1]-delta.z,source[2]+delta.y];
    result['yaw'+suffix]=pose['yaw'+suffix]+yaw;
   }
   if(musou){const delta=musouBodyOffset(a.time);for(const key of ['shift','grip','tip','offGrip','offTip','elbowR','elbowL'])if(pose[key])result[key]=[pose[key][0]+delta.x,pose[key][1]-delta.z,pose[key][2]+delta.y];}
   return result;
  });
 }
 if(o.model==='shinobi'&&name==='Twin_Musou_Flow'){
  records[name].footPlants=Object.fromEntries(['r','l'].map(side=>{
   const plants=structuredClone(motions[name].footPlants[side]),close=musouClose(side);
   if(side==='r'){plants.at(-1)[1]=close[0];plants.push([close[1],motions[name].duration]);}return[side,plants];
  }));
 }
 if(o.model==='monk'){
  records[name].poses=motions[name].poses.map(p=>({...p,yawR:p.yawR+headingOffset.r,yawL:p.yawL+headingOffset.l}));
  if(motions[name].athleticAttack&&!name.endsWith('Musou_Flow'))records[name].pelvisGaitWeight=.55;
 }
 reports.push(report);
}
fs.writeFileSync(o.output,patchAnimationTransforms(input,entries));fs.writeFileSync(o.record,JSON.stringify(records));fs.writeFileSync(o.record.replace(/\.json$/,'.anatomy.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
