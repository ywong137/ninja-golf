#!/usr/bin/env node
// Offline Ronin finisher. Preserve native grips and change supported timing/body depth.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {createWeapon} from '../../src/weapons.js';
import {alignWeaponShaft} from '../../src/weapon-frame.js';
import {solveLeg} from '../../src/foot-placement.js';
import {verifyAnimationReplacement} from '../verify-animation-replacement.mjs';
const {values}=parseArgs({options:{input:{type:'string'},'cleave-record':{type:'string'},output:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/author-slam.mjs --input FAMILY.glb --cleave-record CLEAVE.json --output /tmp/slam.glb --record /tmp/slam.json\nRequires the reviewed native Ronin_Ready and Ronin_Heavy_Cleave. Appends one replacement finisher. Candidate outputs only.');process.exit(0);}
for(const key of ['input','cleave-record','output','record'])if(!values[key])throw Error('Supply --'+key+'. See --help.');
const input=values.input,output=values.output,recordFile=values.record;
if(!input.endsWith('.glb')||!output.endsWith('.glb')||!recordFile.endsWith('.json'))throw Error('Use .glb models and a .json motion record.');
for(const file of [output,recordFile]){if(path.resolve(file)===path.resolve(input))throw Error('Do not overwrite the source model.');if(path.resolve(file).startsWith(path.resolve(new URL('../../public/',import.meta.url).pathname)+path.sep))throw Error('Candidate files must remain outside public/.');}

const source=await loadNativeSkin(input),g=await loadNativeSkin(input),bones={},sourceBones={};
g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});source.scene.traverse(b=>{if(b.isBone)sourceBones[b.name]=b;});
const clip=source.animations.find(c=>c.name==='Ronin_Heavy_Cleave');
if(!clip)throw Error('The reviewed native cleave is required.');
const action=source.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const duration=1.06,impact=.50,rate=240,name='Ronin_Heavy_Slam';
const compression=sourceTime=>.126*T.MathUtils.smoothstep(sourceTime,.175,.46)*(1-T.MathUtils.smoothstep(sourceTime,.5,.76));
const profiles=JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword;
const weapon=createWeapon('odachi'),arc=[];let arcLength=0,lastTip=null;
for(let i=0;i<=1200;i++){
 const at=.175+(.46-.175)*i/1200;source.mixer.setTime(at);source.scene.updateMatrixWorld(true);
 const palm=side=>sourceBones['hand_'+side].localToWorld(new T.Vector3().fromArray(profiles[side].center)),P=palm('r'),L=palm('l'),rot=sourceBones.hand_r.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().fromArray(profiles.r.frame)),axis=P.clone().sub(L).normalize();
 alignWeaponShaft(rot,axis);weapon.quaternion.copy(rot);weapon.position.copy(P).add(L).multiplyScalar(.5).addScaledVector(new T.Vector3(0,1,0).applyQuaternion(rot),-(weapon.userData.primaryGrip-.075));weapon.position.y-=compression(at);weapon.updateMatrixWorld(true);
 const tip=weapon.localToWorld(new T.Vector3().fromArray(weapon.userData.tip));if(lastTip)arcLength+=tip.distanceTo(lastTip);arc.push({sourceTime:at,distance:arcLength});lastTip=tip;
}
function arcTime(fraction){const target=T.MathUtils.clamp(fraction,0,1)*arcLength;let lo=0,hi=arc.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(arc[mid].distance<target)lo=mid;else hi=mid;}return T.MathUtils.lerp(arc[lo].sourceTime,arc[hi].sourceTime,(target-arc[lo].distance)/(arc[hi].distance-arc[lo].distance));}
function sourceTime(t){
 if(t<=.24)return .16*T.MathUtils.smoothstep(t,0,.24);
 if(t<=.34)return T.MathUtils.lerp(.16,.175,T.MathUtils.smoothstep(t,.24,.34));
 if(t<=.60)return arcTime(T.MathUtils.smoothstep(t,.34,.60));
 if(t<=.66)return T.MathUtils.lerp(.46,.50,T.MathUtils.smoothstep(t,.60,.66));
 return T.MathUtils.lerp(.50,.76,T.MathUtils.smoothstep(t,.66,duration));
}
fs.writeFileSync(recordFile.replace(/\.json$/,'.arc.json'),JSON.stringify({length:arcLength,arc}));
const count=Math.ceil(rate*duration)+1,times=Float32Array.from({length:count},(_,i)=>duration*i/(count-1)),tracks=Object.fromEntries(Object.keys(bones).map(n=>[n,{translation:new Float32Array(count*3),rotation:new Float32Array(count*4),scale:new Float32Array(count*3)}]));
const sourceRecord=JSON.parse(fs.readFileSync(values['cleave-record'])).Ronin_Heavy_Cleave;
if(!sourceRecord?.nativeAttachment||!sourceRecord?.pairedGrip||Math.abs(sourceRecord.duration-.76)>1e-6)throw Error('The cleave record must describe the reviewed 0.76-second native paired clip.');
const p=n=>bones[n].getWorldPosition(new T.Vector3()),q=n=>bones[n].getWorldQuaternion(new T.Quaternion()),src=v=>[v.x,-v.z,v.y];
const poses=[],sourceSamples=[];
for(let i=0;i<count;i++){
 const time=times[i],at=sourceTime(time);source.mixer.setTime(Math.min(at,clip.duration));source.scene.updateMatrixWorld(true);
 for(const[n,b]of Object.entries(bones)){b.position.copy(sourceBones[n].position);b.quaternion.copy(sourceBones[n].quaternion);b.scale.copy(sourceBones[n].scale);}g.scene.updateMatrixWorld(true);
 const feet=Object.fromEntries(['r','l'].map(side=>[side,{p:p('foot_'+side),q:q('foot_'+side)}]));
 const drop=compression(at);
 if(drop>1e-10){
  bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(p('pelvis').add(new T.Vector3(0,-drop,0))));g.scene.updateMatrixWorld(true);
  for(const side of ['r','l']){const error=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],feet[side].p,feet[side].q);if(error>.00001)throw Error('Unreachable '+side+' foot at '+time);}
 }
 g.scene.updateMatrixWorld(true);
 const palm=side=>p('hand_'+side).add(new T.Vector3().fromArray(profiles[side].center).applyQuaternion(q('hand_'+side))),primary=palm('r'),shaft=new T.Vector3().fromArray(profiles.r.axis).applyQuaternion(q('hand_r')),weapon=q('hand_r').multiply(new T.Quaternion().fromArray(profiles.r.frame)),roll=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft).invert().multiply(weapon);
 const list=sourceRecord.poses;let j=0;while(j<list.length-2&&at/clip.duration>list[j+1].t)j++;const a=list[j],b=list[j+1],u=(at/clip.duration-a.t)/(b.t-a.t),base=Object.fromEntries(Object.keys(a).map(key=>[key,Array.isArray(a[key])?a[key].map((v,k)=>T.MathUtils.lerp(v,b[key][k],u)):T.MathUtils.lerp(a[key],b[key],u)]));
 poses.push({...base,t:i===count-1?1:time/duration,grip:src(primary),tip:src(primary.clone().addScaledVector(shaft,1.15)),secondaryGrip:src(palm('l')),elbowR:src(p('lowerarm_r')),elbowL:src(p('lowerarm_l')),roll:2*Math.atan2(roll.y,roll.w)});
 sourceSamples.push({time,sourceTime:at,compression:drop});
 for(const[n,bone]of Object.entries(bones)){
  const out=tracks[n],rotation=bone.quaternion.clone();if(i&&rotation.dot(new T.Quaternion().fromArray(out.rotation,(i-1)*4))<0)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);
  bone.position.toArray(out.translation,i*3);rotation.toArray(out.rotation,i*4);bone.scale.toArray(out.scale,i*3);
 }
}
const raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
if(doc.animations.filter(a=>a.name==='Heavy_Slam').length!==1)throw Error('Expected exactly one original Heavy_Slam.');
function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;}
const timeAccessor=accessor(times,'SCALAR'),constantTime=accessor(new Float32Array([0,duration]),'SCALAR'),animation={name,channels:[],samplers:[],extras:{reviewCandidate:true,nativeSlamVersion:2,kneeAlignmentVersion:1}};
for(const[n,track]of Object.entries(tracks))for(const[property,array]of Object.entries(track)){
 const stride=property==='rotation'?4:3,constant=array.every((v,i)=>Math.abs(v-array[i%stride])<1e-7),node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);
 if(node<0)throw Error('Missing node '+n);
 animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});animation.samplers.push({input:constant?constantTime:timeAccessor,output:accessor(constant?Float32Array.from([...array.subarray(0,stride),...array.subarray(0,stride)]):array,property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
}
doc.animations=doc.animations.map(a=>a.name==='Heavy_Slam'?animation:a);doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);fs.writeFileSync(output,Buffer.concat([header,json,binHeader,binary]));
function inverse(source){
 if(source<=0)return 0;if(source>=.76-1e-8)return duration;
 let low=0,high=duration;for(let i=0;i<45;i++){const mid=(low+high)/2;if(sourceTime(mid)<source)low=mid;else high=mid;}return(low+high)/2;
}
const remap=plants=>Object.fromEntries(Object.entries(plants).map(([side,ranges])=>[side,ranges.map(([start,end])=>[inverse(start),inverse(end)])]));
fs.writeFileSync(recordFile,JSON.stringify({[name]:{...sourceRecord,duration,impacts:[impact],groundCue:.60,pairedGrip:true,nativeSlamVersion:2,footPlants:remap(sourceRecord.footPlants),toePlants:remap(sourceRecord.toePlants),poses}}));
fs.writeFileSync(recordFile.replace(/\.json$/,'.samples.json'),JSON.stringify(sourceSamples));
console.log(JSON.stringify({output,recordFile,duration,impact,frames:count,preservation:verifyAnimationReplacement(input,output,[['Heavy_Slam',name]])}));
