#!/usr/bin/env node
// Preserve authored body motion while preventing sparse leg interpolation
// from lifting a foot before its declared support interval ends.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';

export async function bakeNativeFootSupport({model,output,record,clips,rate=240}){
 if(!model||!output||!record||!clips?.length)throw Error('Supply model, output, record, and explicit clip names.');
 if(path.resolve(output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Write a candidate outside public/.');
 const raw=fs.readFileSync(model),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),original=structuredClone(doc),chunks=[raw.subarray(28+size)];let length=chunks[0].length;
 const records=JSON.parse(fs.readFileSync(record)),g=await loadNativeSkin(model),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const point=n=>bones[n].getWorldPosition(new T.Vector3()),rotation=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
 const names=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'],reports=[];
 const append=(array,type)=>{
  const padding=(4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}
  const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(bytes);doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});length+=bytes.length;
  const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;
 };
 const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
 for(const name of clips){
  const spec=records[name],animation=doc.animations.find(a=>a.name===name),clip=g.animations.find(a=>a.name===name);
  if(!spec?.footPlants||!animation||!clip)throw Error(name+': missing native clip or explicit support intervals.');
  if(Math.abs(clip.duration-spec.duration)>1e-5)throw Error(name+': model and support record durations differ.');
  g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  const sample=t=>{action.time=Math.min(t,clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);};
  // The interval midpoint is clear of the source's sparse touchdown/lift keys.
  // At clip boundaries, retain the exact matching Ready foot position.
  const supports=Object.fromEntries(['r','l'].map(side=>[side,spec.footPlants[side].map(([start,end])=>{
   const anchor=start===0?0:Math.abs(end-spec.duration)<1e-7?spec.duration:(start+end)/2;sample(anchor);
   return{start,end,ankle:point('foot_'+side),rotation:rotation('foot_'+side)};
  })]));
  const grid=[...Array.from({length:Math.ceil(spec.duration*rate)+1},(_,i)=>Math.min(i/rate,spec.duration)),...Object.values(spec.footPlants).flat(2)];
  // Original body key times avoid blending a corrected leg across a pelvis key.
  for(const sampler of animation.samplers){const a=doc.accessors[sampler.input],v=doc.bufferViews[a.bufferView];if(a.componentType!==5126||a.type!=='SCALAR')throw Error('Expected float time keys.');for(let i=0;i<a.count;i++)grid.push(chunks[0].readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*4));}
  const times=Float32Array.from([...new Set(grid.map(Math.fround))].sort((a,b)=>a-b)),tracks=Object.fromEntries(names.map(n=>[n,new Float32Array(times.length*4)]));
  const report={name,samples:times.length,maxCorrection:0,maxReachError:0};
  for(let i=0;i<times.length;i++){
   sample(times[i]);
   for(const side of ['r','l']){
    const ankle=point('foot_'+side),q=rotation('foot_'+side),target=ankle.clone();let best=0,support=null;
    for(const row of supports[side]){
     const distance=times[i]<row.start?row.start-times[i]:times[i]>row.end?times[i]-row.end:0;
     const weight=1-smooth(distance/.025);if(weight>best){best=weight;support=row;}
    }
    if(support){
     target.lerp(support.ankle,best);q.slerp(support.rotation,best);
     report.maxCorrection=Math.max(report.maxCorrection,ankle.distanceTo(target));
     report.maxReachError=Math.max(report.maxReachError,solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],target,q,{maxReach:.999999}));
    }
   }
   for(const n of names){const q=bones[n].quaternion.clone(),track=tracks[n];if(i&&q.dot(new T.Quaternion().fromArray(track,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(track,i*4);}
  }
  if(report.maxReachError>1e-4)throw Error(name+': support target is unreachable: '+report.maxReachError);
  const time=append(times,'SCALAR');
  for(const n of names){const node=doc.nodes.findIndex(row=>row.name===n),channel=animation.channels.find(c=>c.target.node===node&&c.target.path==='rotation');if(!channel)throw Error(name+': missing '+n+' rotation.');channel.sampler=animation.samplers.length;animation.samplers.push({input:time,output:append(tracks[n],'VEC4'),interpolation:'LINEAR'});}
  animation.extras={...animation.extras,nativeFootSupportVersion:1};reports.push(report);
 }
 doc.buffers[0].byteLength=length;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(output,Buffer.concat([header,json,bh,binary]));
 let preservedChannels=0;
 for(const name of clips){
  const before=original.animations.find(a=>a.name===name),after=doc.animations.find(a=>a.name===name);
  for(const channel of before.channels){
   if(channel.target.path==='rotation'&&names.includes(doc.nodes[channel.target.node].name))continue;
   const retained=after.channels.find(c=>c.target.node===channel.target.node&&c.target.path===channel.target.path);
   assert.deepEqual(retained,channel,name+': unrelated channel changed.');
   assert.deepEqual(after.samplers[retained.sampler],before.samplers[channel.sampler],name+': unrelated sampler changed.');preservedChannels++;
  }
 }
 return{model,output,clips:reports,preservation:{...verifyAnimationReplacement(model,output,clips.map(n=>[n,n])),preservedChannels}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{model:{type:'string'},output:{type:'string'},record:{type:'string'},clip:{type:'string',multiple:true},report:{type:'string'},help:{type:'boolean'}}});
 if(values.help)console.log('node tools/bake-native-foot-support.mjs --model INPUT.glb --output /tmp/CANDIDATE.glb --record RECORDS.json --clip NAME [--clip NAME ...] [--report REPORT.json]\nBakes declared full-foot support at 240 Hz and exact boundaries. Preserves body, arm, geometry, and unrelated animation data.');
 else{const result=await bakeNativeFootSupport({...values,clips:values.clip});if(values.report)fs.writeFileSync(values.report,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
}
