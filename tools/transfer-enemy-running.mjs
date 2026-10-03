import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {createSourceGaitRetarget} from './source-gait-retarget.mjs';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';

const {values}=parseArgs({options:{input:{type:'string'},source:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('Usage: node tools/transfer-enemy-running.mjs --input HERO.glb --source ENEMY.glb --output CANDIDATE.glb\nTransfer the existing enemy jog and sprint into the hero forward clips. Preserve other clips and geometry. Measure stride and support from the transferred motion. Output must be outside public/.');process.exit(0);}
for(const key of ['input','source','output'])if(!values[key])throw Error(`Supply --${key}. See --help.`);
if(!values.output.endsWith('.glb')||path.resolve(values.output)===path.resolve(values.input)||path.resolve(values.output).startsWith(path.resolve('public')+path.sep))throw Error('Write a separate candidate GLB outside public/.');
const source=await loadNativeSkin(values.source),target=await loadNativeSkin(values.input);
const retarget=createSourceGaitRetarget(source.scene,target.scene),bones=retarget.bones;
const names=retarget.names.filter(n=>/^(pelvis|spine_0[123]|neck_01|Head|(thigh|calf|foot|ball|clavicle|upperarm|lowerarm|hand)_[rl])$/.test(n));
const calibration=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const original=fs.readFileSync(values.input),fallbackName='Run_Directional_Forward';
if(target.animations.some(c=>c.name===fallbackName))throw Error('Use the released model before the enemy gait transfer.');
// Retain the compatible short forward cycle for diagonal/strafe blends.
// A long forward capture cannot share the old directional contact clock.
const baseline=patchAnimationTransforms(original,[{clip:fallbackName,template:'Run_Forward',times:[0,target.animations.find(c=>c.name==='Run_Forward').duration],extras:{legacyLocomotion:'Run_Forward'}}]);
const entries=[],reports=[];
for(const [from,to]of [['Jog_Fwd_Loop','Run_Forward'],['Sprint_Loop','Sprint_Forward']]){
 const clip=source.animations.find(c=>c.name===from),dest=target.animations.find(c=>c.name===to);
 if(!clip||!dest)throw Error('Missing source or destination running clip.');
 source.mixer.stopAllAction();const action=source.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);action.clampWhenFinished=true;action.play();
 const count=480,times=Array.from({length:count+1},(_,i)=>i/count*dest.duration);
 const rotations={},newRotations={},translations={pelvis:[]},points={r:[],l:[]};
 const existing=new Set(dest.tracks.filter(t=>t.name.endsWith('.quaternion')).map(t=>t.name.slice(0,-11)));
 for(const n of names)(existing.has(n)?rotations:newRotations)[n]=[];
 const report={from,to,hip:0,ankle:0,hinge:0,minFlex:180,maxFlex:0};
 for(let i=0;i<=count;i++){
  action.time=i/count*clip.duration;source.mixer.update(0);retarget.apply();
  for(const n of names){const values=(rotations[n]??newRotations[n]),q=bones[n].quaternion.clone();if(i&&q.dot(new T.Quaternion().fromArray(values,values.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);values.push(...q.toArray());}
  translations.pelvis.push(...bones.pelvis.position.toArray());
  for(const s of ['r','l']){
   points[s].push(bones['ball_'+s].getWorldPosition(new T.Vector3()));
   const m=measureLegAnatomy(calibration[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);
   report.hip=Math.max(report.hip,Math.abs(m.hipTwist));report.ankle=Math.max(report.ankle,Math.abs(m.ankleTwist));report.hinge=Math.max(report.hinge,m.kneeDeviation);report.minFlex=Math.min(report.minFlex,m.kneeFlexion);report.maxFlex=Math.max(report.maxFlex,m.kneeFlexion);
  }
 }
 const velocities=[],feet={};
 for(const s of ['r','l']){
  const p=points[s],floor=Math.min(...p.map(v=>v.y)),contact=p.slice(0,count).map((v,i)=>{
   const speed=-(p[i+1].z-v.z)*count/dest.duration;
   const low=v.y<=floor+.03&&p[i+1].y<=floor+.03;
   if(low&&speed>.05)velocities.push(speed);
   return low&&speed>.05;
  });
  const intervals=[];
  for(let i=0;i<count;i++)if(contact[i]&&!contact[(i+count-1)%count]){
   let length=0;while(length<count&&contact[(i+length)%count])length++;
   intervals.push([i/count,(i+length)/count]);
  }
  const interval=intervals.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];
  if(!interval||interval[1]-interval[0]<.08||interval[1]-interval[0]>.45)throw Error('No clear running support interval: '+JSON.stringify({s,interval}));
  feet[s]={supportInterval:interval};
 }
 if(velocities.length<80)throw Error('Not enough planted-foot samples to measure stride.');
 velocities.sort((a,b)=>a-b);const stride=velocities[Math.floor(velocities.length/2)]*dest.duration;
 report.sourceGait={stride,feet};reports.push(report);
 if(report.hinge>.1||report.minFlex<-.1||report.maxFlex>150||report.hip>45||report.ankle>30)throw Error('Transferred leg frame requires review: '+JSON.stringify(report));
 entries.push({clip:to,times,rotations,newRotations,translations,extras:{sourceGaitClockVersion:1,sourceGait:{stride,feet},sourceGaitFrom:from,sourceGaitSource:'existing enemy running',nativeLegFrames:1,capturedTorsoVersion:1,...(to==='Run_Forward'?{directionalFallback:fallbackName}:{})}});
}
fs.mkdirSync(path.dirname(values.output),{recursive:true});fs.writeFileSync(values.output,patchAnimationTransforms(baseline,entries));
const baselinePath=values.output+'.baseline.glb';fs.writeFileSync(baselinePath,baseline);
let preservation;try{preservation=verifyAnimationReplacement(baselinePath,values.output,entries.map(e=>[e.clip,e.clip]));}finally{fs.unlinkSync(baselinePath);}
fs.writeFileSync(values.output+'.json',JSON.stringify({reports,preservation},null,2));console.log(JSON.stringify({output:values.output,reports,preservation}));
