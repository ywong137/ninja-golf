#!/usr/bin/env node
// Rebuild only the reviewed Ronin leg rotations. Preserve native feet and the upper body.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from './native-leg-anatomy.mjs';
import {alignLegHinge} from '../src/leg-hinge.js';
import {headingKnee} from '../src/knee-alignment.js';
import {solveLeg} from '../src/foot-placement.js';
import {patchAnimationRotations} from './patch-animation-rotations.mjs';
const {values:options}=parseArgs({options:{input:{type:'string'},motions:{type:'string'},output:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(options.help){console.log('node tools/author-ronin-legs.mjs --input BASE.glb --motions BASE.json --output CANDIDATE.glb --record RECORDS.json\nUse the Ronin from commit f52c137. Rebuild Ready and eight standard attacks. Output stays outside public/.');process.exit(0);}
if(!options.input||!options.motions||!options.output?.endsWith('.glb')||!options.record?.endsWith('.json'))throw Error('Supply --input, --motions, --output and --record. See --help.');
for(const target of [options.output,options.record])if(path.resolve(target)===path.resolve(options.input)||path.resolve(target).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Write a separate candidate outside public/.');
const input=fs.readFileSync(options.input);
if(createHash('sha256').update(input).digest('hex')!=='53c1e8b44c62b543b10a66c20d9b3dc682ea401328a69f701ca6ce90ae968373')throw Error('Use the reviewed source Ronin from commit f52c137; do not apply this correction twice.');
const entries=[];
const g=await loadNativeSkin(options.input),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o});g.scene.updateMatrixWorld(true);
const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
const names=['Ronin_Ready','Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Ronin_Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'];
const changed=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'],motions=JSON.parse(fs.readFileSync(options.motions)),records={},reports=[];
for(const name of names){
 if(!motions[name]||motions[name].nativeKneeHeading)throw Error('Use source motion records from f52c137; do not add toe-out twice.');
 const clip=g.animations.find(c=>c.name===name);g.mixer.stopAllAction();const a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();const times=[],tracks=Object.fromEntries(changed.map(n=>[n,[]])),report={name,hip:0,ankle:0,hinge:0,error:0,pole:0};
 for(let i=0;i<=Math.ceil(clip.duration*240);i++){
 const t=Math.min(i/240,clip.duration);if(times.length&&Math.fround(t)===Math.fround(times.at(-1)))continue;times.push(t);a.time=t;g.mixer.update(0);g.scene.updateMatrixWorld(true);const saved=changed.map(n=>[b[n],b[n].quaternion.clone()]);
 for(const s of ['r','l']){
 const target=p('foot_'+s),footq=q('foot_'+s).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),(s==='l'?1:-1)*10*Math.PI/180));
 const solve=angle=>{const kneeSolver=(h,f,upper,lower,forward)=>{return headingKnee(h,f,upper,lower,forward,angle*Math.PI/180)};
 const error=solveLeg(b['thigh_'+s],b['calf_'+s],b['foot_'+s],target,footq,{maxReach:.9999,kneeSolver});alignLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s],cal[s].hinge);return{error,...measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s])};};
 let angle=0;
 // Distribute axial rotation between the hip and ankle. This offline search
 // preserves segment lengths and the complete foot target. No runtime search.
 if(['Heavy_Sweep','Heavy_Rising','Heavy_Slam'].includes(name)){
 const cost=angle=>{const m=solve(angle);return (m.hipTwist/45)**4+(m.ankleTwist/15)**4+(angle/50)**2};
 let lo=-25,hi=25;for(let j=0;j<20;j++){const l=lo+(hi-lo)/3,r=hi-(hi-lo)/3;if(cost(l)<cost(r))hi=r;else lo=l;}angle=(lo+hi)/2;
 }
 const m=solve(angle);report.hip=Math.max(report.hip,Math.abs(m.hipTwist));report.ankle=Math.max(report.ankle,Math.abs(m.ankleTwist));report.hinge=Math.max(report.hinge,m.kneeDeviation);report.error=Math.max(report.error,m.error);report.pole=Math.max(report.pole,Math.abs(angle));
 }
 for(const n of changed){const rotation=b[n].quaternion.clone().normalize(),v=tracks[n];if(i&&rotation.dot(new T.Quaternion().fromArray(v,v.length-4))<0)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);v.push(...rotation.toArray());}
 // Three.js skips unchanged property values. Restore the source between
 // samples, or a constant foot track accumulates the added toe-out.
 for(const [bone,q]of saved)bone.quaternion.copy(q);g.scene.updateMatrixWorld(true);
 }
 entries.push({clip:name,times,rotations:tracks,extras:{nativeLegFrames:1}});records[name]={...motions[name],nativeKneeHeading:true,nativeKneeHinges:true,poses:motions[name].poses.map(p=>({...p,yawL:p.yawL+10*Math.PI/180,yawR:p.yawR-10*Math.PI/180}))};reports.push(report);
}
fs.writeFileSync(options.output,patchAnimationRotations(input,entries));fs.writeFileSync(options.record,JSON.stringify(records));fs.writeFileSync(options.record.replace(/\.json$/,'.anatomy.json'),JSON.stringify(reports,null,2));console.log(reports);
