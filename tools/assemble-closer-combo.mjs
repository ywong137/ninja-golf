import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Vector3,InterpolateLinear,PropertyBinding} from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {sliceSourceMotion} from './slice-source-motion.mjs';
import {joinSourceMotions} from './join-source-motions.mjs';
import {extractPlanarRoot} from './extract-planar-root.mjs';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {parseGlb} from './bake-native-golf.mjs';
import {extendMotionPhases,retimeAnimation} from './retime-motion.mjs';

const {values}=parseArgs({options:{release:{type:'string',default:'/Users/yishan/.codex/worktrees/shared-pose-transitions/ninja-golf'},base:{type:'string'},study:{type:'string',default:'artifacts/reviews/connected-sword-combo'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/assemble-closer-combo.mjs [--release DIR] [--study DIR] [--base MODEL.glb]\nAssemble three source cuts, with matching recovery branches and extracted travel. Reads full/sora.glb and recovery/sora.glb. Writes candidate/sora.glb and combo-motion.json. --base selects the model before these clips were appended. No production assets change.');process.exit(0);}
const output=path.join(values.study,'candidate');fs.mkdirSync(output,{recursive:true});
const baseFile=values.base??path.join(values.release,'public/models/sora.glb'),base=await loadNativeSkin(baseFile);
const nativeNames=new Map(parseGlb(fs.readFileSync(baseFile)).doc.nodes.filter(n=>n.name).map(n=>[PropertyBinding.sanitizeNodeName(n.name),n.name]));
const full=(await loadNativeSkin(path.join(values.study,'full/sora.glb'))).animations.find(c=>c.name==='Closer_Combo_Source');
const returning=(await loadNativeSkin(path.join(values.study,'recovery/sora.glb'))).animations.find(c=>c.name==='Closer_Return_Source');
const first=base.animations.find(c=>c.name==='Closer_Rising_Cut');
if(!full||!returning||!first)throw Error('Bake the continuous source and return recovery first.');
const fixedScales=first.tracks.filter(t=>t.name.endsWith('.scale')).map(t=>[t.name.slice(0,-6),Array.from(t.createInterpolant().evaluate(0))]);
for(const clip of [full,returning,first]){
 for(const track of clip.tracks.filter(t=>t.name.endsWith('.scale')))if(Array.from(track.values).some(v=>Math.abs(v-1)>1e-4))throw Error('Source changes bone scale: '+track.name);
 // The target template keeps its original unit-scale channels.
 for(const track of clip.tracks.filter(t=>t.name.endsWith('.position')&&t.name!=='pelvis.position'))if(Array.from(track.values).some((v,i)=>Math.abs(v-track.values[i%3])>1e-6))throw Error('Source changes limb length: '+track.name);
 clip.tracks=clip.tracks.filter(t=>t.name.endsWith('.quaternion')||t.name==='pelvis.position');
 for(const track of clip.tracks.filter(t=>t.getInterpolation()!==InterpolateLinear))if(Array.from(track.values).some((v,i)=>Math.abs(v-track.values[i%track.getValueSize()])>1e-6))throw Error('Unsupported animated channel: '+track.name);
 clip.tracks=clip.tracks.filter(t=>t.getInterpolation()===InterpolateLinear);
}
const branchA=13/30,branchB=1;
const cuts=[
 {name:'Closer_Combo_Opening',clip:joinSourceMotions(sliceSourceMotion(full,0,branchA),sliceSourceMotion(first,branchA,first.duration)),branch:branchA},
 {name:'Closer_Combo_Return',clip:joinSourceMotions(sliceSourceMotion(full,branchA,branchB),sliceSourceMotion(returning,16/30,returning.duration)),branch:branchB-branchA},
 {name:'Closer_Combo_Finish',clip:sliceSourceMotion(full,branchB,full.duration)},
];
const pelvis=base.scene.getObjectByName('pelvis');base.scene.updateMatrixWorld(true);
const parent=pelvis.parent.matrixWorld.clone(),inverse=parent.clone().invert();
const anchor=new Vector3().fromArray(full.tracks.find(t=>t.name==='pelvis.position').values).applyMatrix4(parent);
const entries=[],report=[];
for(const {name,clip,branch}of cuts){
 const extracted=extractPlanarRoot(base.scene,clip),track=extracted.clip.tracks.find(t=>t.name==='pelvis.position');
 // Every branch uses one local pelvis origin. World travel belongs to the actor.
 for(let i=0;i<track.values.length;i+=3){
  const p=new Vector3().fromArray(track.values,i).applyMatrix4(parent);p.x=anchor.x;p.z=anchor.z;p.applyMatrix4(inverse).toArray(track.values,i);
 }
 const times=Array.from(new Set([0,clip.duration,...extracted.clip.tracks.flatMap(t=>Array.from(t.times)),...(branch?[branch]:[])].map(Math.fround))).sort((a,b)=>a-b);
 const rotations={},translations={};
 for(const channel of extracted.clip.tracks){
  const dot=channel.name.lastIndexOf('.'),bone=channel.name.slice(0,dot),property=channel.name.slice(dot+1),sampler=channel.createInterpolant();
  if(property==='quaternion')rotations[bone]=times.flatMap(t=>Array.from(sampler.evaluate(t)));
  else if(property==='position')translations[bone]=times.flatMap(t=>Array.from(sampler.evaluate(t)));
  else if(property!=='scale')throw Error('Unsupported native channel '+channel.name);
 }
 const scales=Object.fromEntries(fixedScales.map(([bone,scale])=>[nativeNames.get(bone),times.flatMap(()=>scale)]));
 entries.push({clip:name,template:'Closer_Rising_Cut',times,rotations,translations,scales,extras:{source:'Quaternius UAL2 Sword_Regular_Combo (CC0)',reviewCandidate:true}});
 report.push({name,duration:clip.duration,branch:branch??null,planarRoot:extracted.path});
}
// The source spin lands abruptly on the longer target legs. Add 60 ms during
// that passing step; preserve the cut and recovery speeds outside the window.
const landingClock=extendMotionPhases(2,[{start:.34,end:.56,extra:.06}]);
const binary=retimeAnimation(patchAnimationTransforms(fs.readFileSync(baseFile),entries),'Closer_Combo_Finish',landingClock);
report[2].duration=landingClock(report[2].duration);
report[2].planarRoot.duration=report[2].duration;
for(const row of report[2].planarRoot.rows)row.time=landingClock(row.time);
fs.writeFileSync(path.join(output,'sora.glb'),binary);
fs.writeFileSync(path.join(output,'assembly.json'),JSON.stringify(report));
const records={};
for(const [i,row]of report.entries()){
 const file=path.join(output,row.name+'-motion.json');
 execFileSync(process.execPath,[fileURLToPath(new URL('./sample-source-cut-record.mjs',import.meta.url)),
  '--input',path.join(output,'sora.glb'),'--grips',path.join(values.release,'src/grip-data.json'),
  '--hero','sora','--clip',row.name,'--output',file,'--combat-duration',String(row.duration/1.2),
  '--impact',String([.255,.288333,landingClock(.58)][i]),'--source-credit','Quaternius UAL2 Sword_Regular_Combo and matching A/B recoveries (CC0)'],{stdio:'pipe'});
 const record=JSON.parse(fs.readFileSync(file))[row.name];record.planarRoot=row.planarRoot;
 record.combatDuration=record.duration/1.2;
 if(row.branch!==null)record.continuations={light:{at:row.branch,clip:report[i+1].name,step:i+1}};
 records[row.name]=record;
}
fs.writeFileSync(path.join(output,'combo-motion.json'),JSON.stringify(records));
console.log(JSON.stringify(report.map(({planarRoot,...row})=>({...row,travel:planarRoot.rows.at(-1)})),null,2));
