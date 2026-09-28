#!/usr/bin/env node
// Replace only leg rotations in native clips. Preserve skins, grips, and all
// unrelated animation accessors; a character rebuild must run this final pass.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import * as THREE from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {footForward} from '../src/knee-alignment.js';
import {balanceStance} from './native-stance-balance.mjs';

const {values,positionals}=parseArgs({allowPositionals:true,options:{output:{type:'string'},clip:{type:'string',multiple:true},help:{type:'boolean'}}});
if(values.help){console.log('Usage: node tools/align-native-knees.mjs INPUT.glb [--output OUTPUT.glb] [--clip NAME ...]\nAlign native knees with toes; preserve planted feet and upper-body tracks.');process.exit(0);}
if(positionals.length!==1)throw Error('Supply one native character GLB. Use --help for usage.');
const input=positionals[0],output=values.output??input,raw=fs.readFileSync(input),jsonLength=raw.readUInt32LE(12);
const doc=JSON.parse(raw.subarray(20,20+jsonLength)),originalBin=raw.subarray(28+jsonLength),chunks=[originalBin];let byteLength=originalBin.length;
const g=await loadNativeSkin(input),bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
const changed=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'];
const point=name=>bones[name].getWorldPosition(new THREE.Vector3());
const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const gaits=JSON.parse(fs.readFileSync(new URL('../src/locomotion-data.json',import.meta.url)));
function sampleFeet(spec,seconds){
 const rows=spec.poses,t=seconds/spec.duration;let i=0;while(i<rows.length-2&&t>rows[i+1].t)i++;
 const a=rows[i],b=rows[i+1],prev=rows[Math.max(0,i-1)],next=rows[Math.min(rows.length-1,i+2)],span=b.t-a.t,u=(t-a.t)/span;
 return Object.fromEntries(['r','l'].map(side=>[side,[0,1,2].map(k=>{
  const key='foot'+side.toUpperCase(),v=row=>row[key][k],m0=i===0?0:(v(b)-v(prev))/(b.t-prev.t),m1=i+1===rows.length-1?0:(v(next)-v(a))/(next.t-a.t);
  return (2*u**3-3*u*u+1)*v(a)+(u**3-2*u*u+u)*span*m0+(-2*u**3+3*u*u)*v(b)+(u**3-u*u)*span*m1;
 })]));
}
function accessor(array,type){
 const padding=(4-byteLength%4)%4;if(padding){chunks.push(Buffer.alloc(padding));byteLength+=padding;}
 const view=doc.bufferViews.length,buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength);chunks.push(buffer);
 doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:buffer.length});byteLength+=buffer.length;
 const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};
 if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}
 doc.accessors.push(a);return doc.accessors.length-1;
}
const reports=[];
for(const animation of doc.animations){
 if(values.clip&&!values.clip.includes(animation.name))continue;
 if(/^(Death01|Roll|Jump_|Hit_Chest)/.test(animation.name))continue;
 if(animation.extras?.kneeAlignmentVersion===1)continue;
 const clip=g.animations.find(c=>c.name===animation.name);if(!clip)throw Error(`Missing parsed animation ${animation.name}`);
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
 const count=Math.ceil(clip.duration*120),times=Float32Array.from({length:count+1},(_,i)=>Math.min(i/120,clip.duration));
 const tracks=Object.fromEntries(changed.map(name=>[name,new Float32Array(times.length*4)]));
 const pelvisTrack=new Float32Array(times.length*3),spec=motions[clip.name];
 const canBalance=!/Selection|^Golf_|^Idle_Loop$/.test(clip.name);
 const targetsAt=seconds=>{
  const authored=spec?.poses?.[0]?.footR?sampleFeet(spec,seconds):null,gait=gaits[clip.name];
  return ['r','l'].map(side=>{
   const hip=point('thigh_'+side),knee=point('calf_'+side),foot=bones['foot_'+side],ankle=point('foot_'+side),upper=knee.distanceTo(hip),lower=knee.distanceTo(ankle),rotation=foot.getWorldQuaternion(new THREE.Quaternion());
   if(spec?.nativeStanceFeet){ankle.x=authored[side][0];ankle.z=-authored[side][1];}
   const forward=footForward(foot,rotation),outward=new THREE.Vector3(0,1,0).cross(forward).multiplyScalar(side==='r'?-1:1);
   const phase=gait?(seconds/gait.duration+(side==='l'?.5:0))%1:0;
   // Prepare alignment before a foot loads; a hard support switch would snap
   // the pelvis at touchdown and undo the correction during interpolation.
   const loaded=spec?.footPlants?spec.footPlants[side].some(([a,b])=>seconds>=a-.03&&seconds<=b+.03):gait?phase<gait.support+.04||phase>.96:authored?authored[side][2]<=.015:ankle.y<.14;
   return{side,hip,ankle,upper,lower,rotation,forward,outward,loaded,posture:!!spec?.athleticAttack};
  });
 };
 const offsets=[];
 for(const seconds of times){action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);offsets.push(canBalance?balanceStance(targetsAt(seconds)):new THREE.Vector3());}
 const report={clip:clip.name,samples:times.length,maxFootError:0,maxPelvisShift:0};
 for(let i=0;i<times.length;i++){
  action.time=times[i];g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const saved=changed.map(name=>[bones[name],bones[name].quaternion.clone()]);
  const targets=targetsAt(times[i]),pelvis=bones.pelvis,originalPelvis=pelvis.position.clone();
  const shift=new THREE.Vector3();let total=0;
  const periodic=/_Walk_|^Run_|^Sprint_Forward$/.test(clip.name),end=times.length-1;
  for(const [j,weight]of [-2,-1,0,1,2].map((j,k)=>[periodic?((i+j)%end+end)%end:Math.max(0,Math.min(end,i+j)),[1,4,6,4,1][k]])){shift.addScaledVector(offsets[j],weight);total+=weight;}
  shift.multiplyScalar(1/total);report.maxPelvisShift=Math.max(report.maxPelvisShift,shift.length());
  pelvis.position.copy(pelvis.parent.worldToLocal(point('pelvis').add(shift)));g.scene.updateMatrixWorld(true);
  for(const {side,ankle,rotation}of targets){
   const error=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],ankle,rotation,{maxReach:.999999});
   report.maxFootError=Math.max(report.maxFootError,error);
  }
  for(const name of changed){
   const q=bones[name].quaternion;
   if(i>0&&q.dot(new THREE.Quaternion().fromArray(tracks[name],(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);
   q.toArray(tracks[name],i*4);
  }
  pelvis.position.toArray(pelvisTrack,i*3);pelvis.position.copy(originalPelvis);
  for(const [bone,q]of saved)bone.quaternion.copy(q);
 }
 const timeAccessor=accessor(times,'SCALAR');
 if(report.maxPelvisShift>1e-8){
  const node=doc.nodes.findIndex(n=>n.name==='pelvis'),channel=animation.channels.find(c=>c.target.node===node&&c.target.path==='translation');
  if(!channel)throw Error(`${clip.name}: missing pelvis translation channel`);
  channel.sampler=animation.samplers.length;animation.samplers.push({input:timeAccessor,output:accessor(pelvisTrack,'VEC3'),interpolation:'LINEAR'});
 }
 for(const name of changed){
  const node=doc.nodes.findIndex(n=>n.name===name),channel=animation.channels.find(c=>c.target.node===node&&c.target.path==='rotation');
  if(!channel)throw Error(`${clip.name}: missing ${name} rotation channel`);
  channel.sampler=animation.samplers.length;animation.samplers.push({input:timeAccessor,output:accessor(tracks[name],'VEC4'),interpolation:'LINEAR'});
 }
 animation.extras={...animation.extras,kneeAlignmentVersion:1};reports.push(report);
}
if(values.clip)for(const name of values.clip)if(!doc.animations.some(a=>a.name===name))throw Error(`No clip named ${name}`);
doc.buffers[0].byteLength=byteLength;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(output,Buffer.concat([header,json,binHeader,binary]));
console.log(JSON.stringify({input,output,clips:reports},null,2));
