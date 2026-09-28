#!/usr/bin/env node
// Remove a late body-rotation acceleration without counter-rotating the arms.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';

const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},output:{type:'string'},'output-record':{type:'string'},clip:{type:'string',multiple:true},window:{type:'string',default:'.12'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/smooth-native-recovery.mjs --model INPUT.glb --record RECORDS.json --output /tmp/OUTPUT.glb --output-record /tmp/OUTPUT.json --clip NAME [--clip NAME ...] [--window .12]\nSmooths final Shinobi body recovery, preserving actual foot targets and all arm/finger channels. Writes only the selected motion records.');process.exit(0);}
for(const key of ['model','record','output','output-record','clip'])if(!values[key])throw Error('Supply --'+key+'. See --help.');
if(path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Write a candidate outside public/.');
const window=Number(values.window);if(!(window>=.05&&window<=.25))throw Error('Choose --window from .05 through .25 seconds.');
const raw=fs.readFileSync(values.model),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),original=structuredClone(doc),chunks=[raw.subarray(28+size)];let length=chunks[0].length;
const records=JSON.parse(fs.readFileSync(values.record)),outputRecords={},g=await loadNativeSkin(values.model),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).shinobi.sword,UP=new T.Vector3(0,1,0),point=n=>bones[n].getWorldPosition(new T.Vector3()),rotation=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
const body=['pelvis','spine_01','spine_02','spine_03','neck_01','Head'],legs=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'],names=[...body,...legs],reports=[];
function append(a,type){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const bytes=Buffer.from(a.buffer,a.byteOffset,a.byteLength),view=doc.bufferViews.length;chunks.push(bytes);doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});length+=bytes.length;const x={bufferView:view,componentType:5126,count:a.length/(type==='VEC4'?4:1),type};if(type==='SCALAR'){x.min=[a[0]];x.max=[a.at(-1)];}doc.accessors.push(x);return doc.accessors.length-1;}
const source=v=>[v.x,-v.z,v.y];
function recordPose(spec,t){let i=0;while(i<spec.poses.length-2&&t>spec.poses[i+1].t)i++;const a=spec.poses[i],b=spec.poses[i+1],u=T.MathUtils.clamp((t-a.t)/(b.t-a.t||1),0,1);return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,Array.isArray(v)?v.map((x,j)=>T.MathUtils.lerp(x,b[k]?.[j]??x,u)):typeof v==='number'?T.MathUtils.lerp(v,b[k]??v,u):v]));}
for(const name of values.clip){
 const spec=records[name],animation=doc.animations.find(a=>a.name===name),clip=g.animations.find(c=>c.name===name);if(!spec?.nativeShinobiVersion||!animation||!clip)throw Error(name+': requires an accepted native Shinobi clip.');
 if(animation.extras?.nativeRecoveryVersion)throw Error(name+': already corrected. Rebuild from the pre-repair source.');
 const start=spec.duration-window;if(start<spec.impacts.at(-1)+.09)throw Error(name+': recovery window overlaps the hit follow-through.');
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 const sample=t=>{action.time=Math.min(t,clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);};sample(clip.duration);
 const end=Object.fromEntries(body.map(n=>[n,rotation(n)])),grid=[...Array.from({length:Math.ceil(spec.duration*240)+1},(_,i)=>Math.min(i/240,spec.duration)),start,...spec.impacts,...Object.values(spec.footPlants??{}).flat(2),...Object.values(spec.toePlants??{}).flat(2)];
 for(const s of animation.samplers){const a=doc.accessors[s.input],v=doc.bufferViews[a.bufferView];for(let i=0;i<a.count;i++)grid.push(chunks[0].readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*4));}
 const times=Float32Array.from([...new Set(grid.map(Math.fround))].sort((a,b)=>a-b)),tracks=Object.fromEntries(names.map(n=>[n,new Float32Array(times.length*4)])),poses=[],report={name,start,duration:spec.duration,samples:times.length,maxLegError:0,maxBodyCorrectionDegrees:0};
 for(let i=0;i<times.length;i++){
  const time=times[i];sample(time);const feet=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),q:rotation('foot_'+s)}])),before=Object.fromEntries(body.map(n=>[n,rotation(n)])),u=T.MathUtils.clamp((time-start)/window,0,1),weight=u*u*u*(10-15*u+6*u*u);
  if(weight>0){
   for(const n of body){const q=before[n].clone().slerp(end[n],weight),bone=bones[n];report.maxBodyCorrectionDegrees=Math.max(report.maxBodyCorrectionDegrees,before[n].angleTo(q)*180/Math.PI);bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();bone.updateWorldMatrix(false,true);}
   for(const s of ['r','l'])report.maxLegError=Math.max(report.maxLegError,solveLeg(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],feet[s].p,feet[s].q,{maxReach:.999999}));
  }
  for(const n of names){const q=bones[n].quaternion.clone(),a=tracks[n];if(i&&q.dot(new T.Quaternion().fromArray(a,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(a,i*4);}
  const pose=recordPose(spec,time/spec.duration);pose.t=i===0?0:i===times.length-1?1:time/spec.duration;
  for(const k of ['hip','chest','bend','pelvisBend'])if(Number.isFinite(pose[k]))pose[k]=T.MathUtils.lerp(pose[k],spec.poses.at(-1)[k],weight);
  Object.assign(pose,{elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l'))});
  for(const s of ['r','l']){const palm=bones['hand_'+s].localToWorld(new T.Vector3().fromArray(grip[s].center)),q=rotation('hand_'+s).multiply(new T.Quaternion().fromArray(grip[s].frame)),shaft=UP.clone().applyQuaternion(q),roll=new T.Quaternion().setFromUnitVectors(UP,shaft).invert().multiply(q);Object.assign(pose,s==='r'?{grip:source(palm),tip:source(palm.clone().add(shaft)),roll:2*Math.atan2(roll.y,roll.w)}:{offGrip:source(palm),offTip:source(palm.clone().add(shaft)),offRoll:2*Math.atan2(roll.y,roll.w)});}
  poses.push(pose);
 }
 if(report.maxLegError>.001)throw Error(name+': recovery makes the foot target unreachable: '+report.maxLegError);
 const input=append(times,'SCALAR');for(const n of names){const node=doc.nodes.findIndex(x=>x.name===n),channel=animation.channels.find(c=>c.target.node===node&&c.target.path==='rotation');assert.ok(channel,'Missing '+n);channel.sampler=animation.samplers.length;animation.samplers.push({input,output:append(tracks[n],'VEC4'),interpolation:'LINEAR'});}
 animation.extras={...animation.extras,nativeRecoveryVersion:1,kneeAlignmentVersion:1};outputRecords[name]={...spec,nativeRecoveryVersion:1,poses};reports.push(report);
}
doc.buffers[0].byteLength=length;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+binary.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([h,json,bh,binary]));fs.writeFileSync(values['output-record'],JSON.stringify(outputRecords));
let retainedChannels=0;for(const name of values.clip){const a=original.animations.find(a=>a.name===name),b=doc.animations.find(a=>a.name===name);for(const c of a.channels){if(c.target.path==='rotation'&&names.includes(doc.nodes[c.target.node].name))continue;const after=b.channels.find(x=>x.target.node===c.target.node&&x.target.path===c.target.path);assert.deepEqual(after,c);assert.deepEqual(b.samplers[after.sampler],a.samplers[c.sampler]);retainedChannels++;}}
const result={clips:reports,preservation:{...verifyAnimationReplacement(values.model,values.output,values.clip.map(n=>[n,n])),retainedChannels}};fs.writeFileSync(values['output-record'].replace(/\.json$/,'.report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
