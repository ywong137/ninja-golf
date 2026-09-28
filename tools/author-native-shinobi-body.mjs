#!/usr/bin/env node
// Isolated full-body Sweep pilot. The reviewed local arm tracks stay unchanged.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';
import {shinobiSweepBody,shinobiSweepBodyTimes,shinobiSweepPivot} from './native-shinobi-body-profile.mjs';

const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},frames:{type:'string'},output:{type:'string'},'output-record':{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-native-shinobi-body.mjs --model BASELINE.glb --record BASELINE.json --frames MOUNTS.json --output /tmp/PILOT.glb --output-record /tmp/PILOT.json\nReplaces only Twin_Cut_Sweep body and legs. Preserves its local arm channels and all other clips. Requires a supported Shinobi arm baseline.');process.exit(0);}
for(const key of ['model','record','frames','output','output-record'])if(!values[key])throw Error('Supply --'+key+'. See --help.');
if(path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Write a candidate outside public/.');
const name='Twin_Cut_Sweep',raw=fs.readFileSync(values.model),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),original=structuredClone(doc),chunks=[raw.subarray(28+size)];let length=chunks[0].length;
const records=JSON.parse(fs.readFileSync(values.record)),spec=records[name],frames=JSON.parse(fs.readFileSync(values.frames)),grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).shinobi.sword;
const g=await loadNativeSkin(values.model),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const point=n=>bones[n].getWorldPosition(new T.Vector3()),rotation=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize(),UP=new T.Vector3(0,1,0),RIGHT=new T.Vector3(1,0,0),D=Math.PI/180;
const names=['pelvis','spine_01','spine_02','spine_03','neck_01','Head','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'];
const indexByName=Object.fromEntries(doc.nodes.map((n,i)=>[n.name,i]));
for(const n of names)assert.ok(bones[n]&&indexByName[n]!==undefined,'Missing '+n);
const ready=g.mixer.clipAction(g.animations.find(c=>c.name==='Twin_Ready')).reset().play();ready.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
const readyRotation=Object.fromEntries(names.map(n=>[n,rotation(n)])),readyPelvis=point('pelvis'),readyFootMid=point('foot_r').add(point('foot_l')).multiplyScalar(.5),pelvisOffset=readyPelvis.clone().sub(readyFootMid),readyPose=records.Twin_Ready.poses[0],readyFeet=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),forward:point('ball_'+s).sub(point('foot_'+s)).setY(0).normalize()}]));
g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
const animation=doc.animations.find(a=>a.name===name),grid=[...Array.from({length:Math.ceil(spec.duration*240)+1},(_,i)=>Math.min(i/240,spec.duration)),...shinobiSweepBodyTimes,...spec.impacts,...Object.values(spec.footPlants).flat(2)];
for(const s of animation.samplers){const a=doc.accessors[s.input],v=doc.bufferViews[a.bufferView];for(let i=0;i<a.count;i++)grid.push(chunks[0].readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*4));}
const times=Float32Array.from([...new Set(grid.map(Math.fround))].sort((a,b)=>a-b)),tracks=Object.fromEntries(names.map(n=>[n,new Float32Array(times.length*4)])),positions=new Float32Array(times.length*3),poses=[],report={model:values.model,clip:name,samples:times.length,maxLegError:0,body:[]};
function setWorld(n,q){const b=bones[n];b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
function bodyRotation(n,yaw,bend){return new T.Quaternion().setFromAxisAngle(UP,yaw*D).multiply(new T.Quaternion().setFromAxisAngle(RIGHT,bend*D)).multiply(readyRotation[n]);}
function sampleRecord(t){let i=0;while(i<spec.poses.length-2&&t>spec.poses[i+1].t)i++;const a=spec.poses[i],b=spec.poses[i+1],u=T.MathUtils.clamp((t-a.t)/(b.t-a.t||1),0,1);return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,Array.isArray(v)?v.map((x,j)=>T.MathUtils.lerp(x,b[k]?.[j]??x,u)):typeof v==='number'?T.MathUtils.lerp(v,b[k]??v,u):v]));}
const source=v=>[v.x,-v.z,v.y];
for(let i=0;i<times.length;i++){
 action.time=Math.min(times[i],clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const feet=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),q:rotation('foot_'+s),toe:point('ball_'+s)}])),p=shinobiSweepBody(times[i]);
 const pelvis=feet.r.p.clone().lerp(feet.l.p,p.leftWeight).add(pelvisOffset);pelvis.y=readyPelvis.y+p.height;pelvis.z+=p.advance;
 bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));g.scene.updateMatrixWorld(true);
 setWorld('pelvis',bodyRotation('pelvis',p.hip,p.pelvisBend));
 for(const [n,f]of [['spine_01',.32],['spine_02',.66],['spine_03',1]])setWorld(n,bodyRotation(n,T.MathUtils.lerp(p.hip,p.chest,f),T.MathUtils.lerp(p.pelvisBend,p.bend,f)));
 setWorld('neck_01',bodyRotation('neck_01',p.chest*.3,p.bend*.3));setWorld('Head',bodyRotation('Head',p.chest*.12,p.bend*.12));
 for(const s of ['r','l']){const pivot=shinobiSweepPivot(s,times[i]);feet[s].q.premultiply(new T.Quaternion().setFromAxisAngle(RIGHT,pivot.heel*D)).premultiply(new T.Quaternion().setFromAxisAngle(UP,pivot.yaw*D));feet[s].p.copy(feet[s].toe).sub(bones['ball_'+s].position.clone().applyQuaternion(feet[s].q));const error=solveLeg(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],feet[s].p,feet[s].q,{maxReach:.999999});if(error>report.maxLegError){report.maxLegError=error;report.worstLeg={time:times[i],side:s,pelvis:pelvis.toArray()};}}
 g.scene.updateMatrixWorld(true);
 for(const n of names){const q=bones[n].quaternion.clone(),a=tracks[n];if(i&&q.dot(new T.Quaternion().fromArray(a,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(a,i*4);}bones.pelvis.position.toArray(positions,i*3);
 const pose=sampleRecord(times[i]/spec.duration);pose.t=i===0?0:i===times.length-1?1:times[i]/spec.duration;
 Object.assign(pose,{hip:readyPose.hip+p.hip*D,chest:readyPose.chest+p.chest*D,bend:readyPose.bend+p.bend*D,pelvisBend:readyPose.pelvisBend+p.pelvisBend*D,shift:source(pelvis.clone().sub(readyPelvis)).map((x,j)=>x+readyPose.shift[j]),elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l'))});
 for(const s of ['r','l']){const palm=bones['hand_'+s].localToWorld(new T.Vector3().fromArray(grip[s].center)),q=rotation('hand_'+s).multiply(new T.Quaternion().fromArray(frames.sword[s].frame)),shaft=UP.clone().applyQuaternion(q),roll=new T.Quaternion().setFromUnitVectors(UP,shaft).invert().multiply(q);Object.assign(pose,s==='r'?{grip:source(palm),tip:source(palm.clone().add(shaft)),roll:2*Math.atan2(roll.y,roll.w)}:{offGrip:source(palm),offTip:source(palm.clone().add(shaft)),offRoll:2*Math.atan2(roll.y,roll.w)});}
 for(const s of ['r','l']){const key=s==='r'?'footR':'footL',q=s==='r'?'yawR':'yawL',delta=source(point('foot_'+s).sub(readyFeet[s].p)),f=point('ball_'+s).sub(point('foot_'+s)).setY(0).normalize();pose[key]=delta.map((x,j)=>x+readyPose[key][j]);pose[q]=readyPose[q]+Math.atan2(f.x,f.z)-Math.atan2(readyFeet[s].forward.x,readyFeet[s].forward.z);}
 poses.push(pose);report.body.push({time:times[i],...p,pelvis:pelvis.toArray()});
}
if(report.maxLegError>.001)throw Error('Body shift makes the foot target unreachable: '+JSON.stringify(report.worstLeg)+' error '+report.maxLegError);
function append(a,type){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const bytes=Buffer.from(a.buffer,a.byteOffset,a.byteLength),view=doc.bufferViews.length;chunks.push(bytes);doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});length+=bytes.length;const x={bufferView:view,componentType:5126,count:a.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){x.min=[a[0]];x.max=[a.at(-1)];}doc.accessors.push(x);return doc.accessors.length-1;}
const input=append(times,'SCALAR');
for(const [n,type,a,field]of [...names.map(n=>[n,'VEC4',tracks[n],'rotation']),['pelvis','VEC3',positions,'translation']]){const channel=animation.channels.find(c=>c.target.node===indexByName[n]&&c.target.path===field);assert.ok(channel,'Missing '+n+' '+field);channel.sampler=animation.samplers.length;animation.samplers.push({input,output:append(a,type),interpolation:'LINEAR'});}
animation.extras={...animation.extras,nativeShinobiBodyPilotVersion:1,kneeAlignmentVersion:1};records[name]={...spec,footPlants:{r:[[0,.12],[.50,spec.duration]],l:[[0,.0168],[.224,.43],[.798,spec.duration]]},toePlants:{r:[[.12,.50]],l:[[.43,.616]]},nativeShinobiBodyPilotVersion:1,poses};
doc.buffers[0].byteLength=length;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+binary.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([h,json,bh,binary]));fs.writeFileSync(values['output-record'],JSON.stringify(records));
let retained=0;for(const channel of original.animations.find(a=>a.name===name).channels){if(names.includes(doc.nodes[channel.target.node].name)&&(channel.target.path==='rotation'||(doc.nodes[channel.target.node].name==='pelvis'&&channel.target.path==='translation')))continue;const after=animation.channels.find(c=>c.target.node===channel.target.node&&c.target.path===channel.target.path);assert.deepEqual(after,channel);assert.deepEqual(animation.samplers[after.sampler],original.animations.find(a=>a.name===name).samplers[channel.sampler]);retained++;}
report.preservation={...verifyAnimationReplacement(values.model,values.output,[[name,name]]),retainedChannels:retained};fs.writeFileSync(values['output-record'].replace(/\.json$/,'.body-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output:values.output,samples:report.samples,maxLegError:report.maxLegError,preservation:report.preservation},null,2));
