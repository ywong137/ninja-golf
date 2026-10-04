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

const {values}=parseArgs({options:{release:{type:'string',default:'/Users/yishan/.codex/worktrees/shared-pose-transitions/ninja-golf'},base:{type:'string'},hero:{type:'string',default:'sora'},prefix:{type:'string',default:'Closer'},'opening-model':{type:'string'},'opening-clip':{type:'string'},template:{type:'string'},'grip-roll':{type:'string',default:'0'},study:{type:'string',default:'artifacts/reviews/connected-sword-combo'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/assemble-connected-sword-combo.mjs [--release DIR] [--study DIR] [--base MODEL.glb] [--hero sora] [--prefix Closer] [--opening-model FILE] [--opening-clip CLIP] [--template CLIP] [--grip-roll RADIANS]\nAssemble three source cuts, with matching recovery branches and extracted travel. Reads full/HERO.glb and recovery/HERO.glb. Source clips must use PREFIX_Combo_Source and PREFIX_Return_Source. Writes candidate/HERO.glb and combo-motion.json. Defaults reproduce the Closer. --base selects the model before these clips were appended. No production assets change.');process.exit(0);}
const hero=values.hero,prefix=values.prefix,openingClip=values['opening-clip']??prefix+'_Rising_Cut',template=values.template??openingClip;
if(!/^[a-z-]+$/.test(hero)||!/^[A-Za-z_]+$/.test(prefix)||!Number.isFinite(Number(values['grip-roll'])))throw Error('Use a model identifier, an animation prefix, and a finite grip roll.');
const output=path.join(values.study,'candidate');
if(path.resolve(output).split(path.sep).includes('public'))throw Error('Choose a review directory outside public/.');fs.mkdirSync(output,{recursive:true});
const baseFile=values.base??path.join(values.release,'public/models',hero+'.glb'),base=await loadNativeSkin(baseFile);
const nativeNames=new Map(parseGlb(fs.readFileSync(baseFile)).doc.nodes.filter(n=>n.name).map(n=>[PropertyBinding.sanitizeNodeName(n.name),n.name]));
const full=(await loadNativeSkin(path.join(values.study,'full',hero+'.glb'))).animations.find(c=>c.name===prefix+'_Combo_Source');
const returning=(await loadNativeSkin(path.join(values.study,'recovery',hero+'.glb'))).animations.find(c=>c.name===prefix+'_Return_Source');
const opening=values['opening-model']?await loadNativeSkin(values['opening-model']):base;
const first=opening.animations.find(c=>c.name===openingClip);
if(!base.animations.some(c=>c.name===template))throw Error('The base model must contain template '+template);
if(path.resolve(baseFile)===path.resolve(output,hero+'.glb'))throw Error('The base model and output must be separate.');
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
 {name:prefix+'_Combo_Opening',clip:joinSourceMotions(sliceSourceMotion(full,0,branchA),sliceSourceMotion(first,branchA,first.duration)),branch:branchA},
 {name:prefix+'_Combo_Return',clip:joinSourceMotions(sliceSourceMotion(full,branchA,branchB),sliceSourceMotion(returning,16/30,returning.duration)),branch:branchB-branchA},
 {name:prefix+'_Combo_Finish',clip:sliceSourceMotion(full,branchB,full.duration)},
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
 entries.push({clip:name,template,times,rotations,translations,scales,extras:{source:'Quaternius UAL2 Sword_Regular_Combo (CC0)',reviewCandidate:true}});
 report.push({name,duration:clip.duration,branch:branch??null,planarRoot:extracted.path});
}
// The source spin lands abruptly on the longer target legs. Add 60 ms during
// that passing step; preserve the cut and recovery speeds outside the window.
const landingClock=extendMotionPhases(2,[{start:.34,end:.56,extra:.06}]);
const binary=retimeAnimation(patchAnimationTransforms(fs.readFileSync(baseFile),entries),prefix+'_Combo_Finish',landingClock);
report[2].duration=landingClock(report[2].duration);
report[2].planarRoot.duration=report[2].duration;
for(const row of report[2].planarRoot.rows)row.time=landingClock(row.time);
fs.writeFileSync(path.join(output,hero+'.glb'),binary);
fs.writeFileSync(path.join(output,'assembly.json'),JSON.stringify(report));
const records={};
for(const [i,row]of report.entries()){
 const file=path.join(output,row.name+'-motion.json');
 execFileSync(process.execPath,[fileURLToPath(new URL('./sample-source-cut-record.mjs',import.meta.url)),
  '--input',path.join(output,hero+'.glb'),'--grips',path.join(values.release,'src/grip-data.json'),
  '--hero',hero,'--grip-roll',values['grip-roll'],'--clip',row.name,'--output',file,'--combat-duration',String(row.duration/1.2),
  '--impact',String([.255,.288333,landingClock(.58)][i]),'--source-credit','Quaternius UAL2 Sword_Regular_Combo and matching A/B recoveries (CC0)'],{stdio:'pipe'});
 const record=JSON.parse(fs.readFileSync(file))[row.name];record.planarRoot=row.planarRoot;
 record.combatDuration=record.duration/1.2;
 if(row.branch!==null)record.continuations={light:{at:row.branch,clip:report[i+1].name,step:i+1}};
 records[row.name]=record;
}
fs.writeFileSync(path.join(output,'combo-motion.json'),JSON.stringify(records));
console.log(JSON.stringify(report.map(({planarRoot,...row})=>({...row,travel:planarRoot.rows.at(-1)})),null,2));
