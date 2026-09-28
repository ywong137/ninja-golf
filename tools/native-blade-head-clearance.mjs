#!/usr/bin/env node
// Measure actual blade triangles against the skinned head, eyes, and hair.
// Rigid attachments, such as glasses, are outside this scanner's scope.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {createWeapon} from '../src/weapons.js';

import {headSurfaceMetadata,measureBladeHeadClearance} from './blade-head-surface.mjs';
export {headSurfaceMetadata,measureBladeHeadClearance} from './blade-head-surface.mjs';

const UP=new T.Vector3(0,1,0);
export async function inspectNativeBladeHeadClearance({model,modelKey,weaponKind,frames,record,clips,dualWield=false,rate=480,distanceCap=.03}={}){
 if(!model||!modelKey||!weaponKind||!frames||!clips?.length)throw Error('Supply model, modelKey, weaponKind, frames, and explicit clips.');
 if(!Number.isInteger(rate)||rate<60||rate>960)throw Error('Choose a sample rate from 60 through 960 Hz.');
 const g=await loadNativeSkin(model),surfaces=headSurfaceMetadata(g),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)))[modelKey].sword,mount=typeof frames==='string'?JSON.parse(fs.readFileSync(frames)):frames;
 const records=record?JSON.parse(fs.readFileSync(record)):{},sides=dualWield?['r','l']:['r'],weapons=Object.fromEntries(sides.map(s=>[s,createWeapon(weaponKind)]));
 const report={model,rate,distanceCap,headTriangles:surfaces.reduce((n,s)=>n+s.triangles.length,0),passed:true,clips:{}};
 for(const name of clips){
  const clip=g.animations.find(c=>c.name===name);if(!clip)throw Error('Missing clip '+name);
  const spec=records[name]??{};g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  const times=[...new Set([...Array.from({length:Math.ceil(clip.duration*rate)+1},(_,i)=>Math.min(i/rate,clip.duration)),...(spec.impacts??[])])].sort((a,b)=>a-b);
  const row={samples:times.length,minimumClearance:distanceCap,crossingSamples:0,crossings:0,closest:null};
  for(const time of times){
   action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   for(const side of sides){
    const hand=bones['hand_'+side],weapon=weapons[side],palm=hand.localToWorld(new T.Vector3().fromArray(grip[side].center));
    const frame=mount.sword?.[side]?.frame??mount[side]?.frame;if(!frame)throw Error('Missing fixed '+side+' weapon frame.');
    const q=hand.getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(frame));
    if(side==='r'&&spec.pairedGrip){const other=bones.hand_l.localToWorld(new T.Vector3().fromArray(grip.l.center)),shaft=palm.clone().sub(other).normalize();q.premultiply(new T.Quaternion().setFromUnitVectors(UP.clone().applyQuaternion(q),shaft));}
    weapon.quaternion.copy(q);weapon.position.copy(palm).addScaledVector(UP.clone().applyQuaternion(q),-(side==='r'?(spec.primaryGrip??weapon.userData.primaryGrip):weapon.userData.primaryGrip));weapon.updateMatrixWorld(true);
   }
   const hit=measureBladeHeadClearance(surfaces,weapons,{distanceCap});
   if(hit.minimumClearance<row.minimumClearance){row.minimumClearance=hit.minimumClearance;row.closest={time,...hit.closest};}
   row.crossings+=hit.crossings;if(hit.crossings)row.crossingSamples++;
  }
  if(row.minimumClearance<.005)report.passed=false;
  report.clips[name]=row;
 }
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{model:{type:'string'},'model-key':{type:'string'},weapon:{type:'string'},frames:{type:'string'},record:{type:'string'},clip:{type:'string',multiple:true},dual:{type:'boolean'},rate:{type:'string',default:'480'},output:{type:'string'},help:{type:'boolean'}}});
 if(values.help)console.log('node tools/native-blade-head-clearance.mjs --model MODEL.glb --model-key shinobi --weapon twin --frames MOUNTS.json --clip CLIP [--clip CLIP ...] [--dual] [--record MOTIONS.json] [--rate 480] [--output REPORT.json]\nChecks actual blade triangles against the skinned head, eyes, and hair. Excludes rigid attachments such as glasses. Requires 5 mm clearance; reports distances capped at 30 mm. Supply the exact fixed weapon frames used by the candidate/runtime.');
 else{const result=await inspectNativeBladeHeadClearance({model:values.model,modelKey:values['model-key'],weaponKind:values.weapon,frames:values.frames,record:values.record,clips:values.clip,dualWield:values.dual,rate:Number(values.rate)});if(values.output)fs.writeFileSync(values.output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}
}
