#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {solveLeg} from '../../src/foot-placement.js';
const {values}=parseArgs({options:{input:{type:'string',default:''},output:{type:'string'},record:{type:'string'},'guard-record':{type:'string'},'grip-profiles':{type:'string'},'break-body':{type:'boolean'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/author-guard-reactions.mjs --output /tmp/guards.glb --record /tmp/guards.json --input REVIEWED.glb [--break-body] [--guard-record GUARDS.json --grip-profiles ROSTER.json]\n--break-body adds a planted, backward/downward pelvis reaction to Break only. The optional files retain a newly fitted complete grip.\nAdd bounded impact and break recoil to the transferred native Ready upper body. Candidate files only.');process.exit(0);}
if(values.input&&values.output&&path.resolve(values.input)===path.resolve(values.output))throw Error('Input and output must differ.');
if(!values.input)throw Error('Supply --input. See --help.');
if(!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --output and --record.');
if(!!values['guard-record']!==!!values['grip-profiles'])throw Error('Supply both --guard-record and --grip-profiles for a fitted grip.');
const fitted=values['guard-record']?JSON.parse(fs.readFileSync(values['guard-record'])):null;
const profiles=values['grip-profiles']?JSON.parse(fs.readFileSync(values['grip-profiles'])).ronin?.sword:JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword;
if(!profiles?.r?.frame||!profiles?.l?.frame)throw Error('Both complete Ronin sword frames are required.');
for(const file of [values.output,values.record])if(path.resolve(file).startsWith(path.resolve(new URL('../../public/',import.meta.url).pathname)+path.sep))throw Error('Candidate outputs must remain outside public/.');
const raw=fs.readFileSync(values.input),jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength)),chunks=[raw.subarray(28+jsonLength)];let byteLength=chunks[0].length;
for(const clip of doc.animations.filter(a=>a.name.startsWith('Odachi_Guard_'))){
 if(clip.extras?.nativeRoninGuardVersion!==5)throw Error(clip.name+' requires the grounded version-5 guard transfer.');
 if(clip.extras?.nativeRoninGuardRecoilVersion!==undefined)throw Error(clip.name+' already contains recoil; rebuild from the guard transfer output.');
}
function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;}
const g=await loadNativeSkin(values.input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
// The input already contains the reviewed Ready upper body. Add only the recoil
// above the thigh branch, preserving the native guard feet and prior compensation.
for(const side of ['r','l'])if(bones.spine_02.getObjectById(bones['thigh_'+side].id))throw Error('The recoil bone must not parent either leg.');
const original=JSON.parse(fs.readFileSync(new URL('../../src/motion-data.json',import.meta.url))),records={};
const names=Object.keys(original).filter(n=>n.startsWith('Odachi_Guard_'));
for(const name of names){
 if(fitted&&(!fitted[name]?.fixedGripFrame||!(fitted[name].gripSpacing>0)))throw Error('Missing complete fixed-grip guard record: '+name);
 const animation=doc.animations.find(a=>a.name===name);if(!animation)throw Error('Missing '+name);
 const duration=original[name].duration;
 if(/_(Impact|Break)$/.test(name)){
  const node=doc.nodes.findIndex(n=>T.PropertyBinding.sanitizeNodeName(n.name??'')==='spine_02');
  if(node<0)throw Error('Missing native spine_02.');
  const times=Float32Array.from({length:Math.ceil(duration*240)+1},(_,i)=>Math.min(i/240,duration)),rotations=new Float32Array(times.length*4);
  const bodyBreak=values['break-body']&&name.endsWith('_Break');
  const bodyTracks=bodyBreak?[{name:'pelvis',path:'translation',type:'VEC3',values:new Float32Array(times.length*3)},...['r','l'].flatMap(side=>['thigh_','calf_','foot_'].map(prefix=>({name:prefix+side,path:'rotation',type:'VEC4',values:new Float32Array(times.length*4)})))]:[];
  const sourceClip=g.animations.find(c=>c.name===name),sample=g.mixer.clipAction(sourceClip).reset().setLoop(T.LoopOnce,1);sample.clampWhenFinished=true;sample.play();
  let sourcePelvisStart=null;
  if(bodyBreak){g.mixer.setTime(0);g.scene.updateMatrixWorld(true);sourcePelvisStart=bones.pelvis.getWorldPosition(new T.Vector3());}
  for(let i=0;i<times.length;i++){
   const t=times[i],isBreak=name.endsWith('_Break'),peak=isBreak?.10:.045,hold=isBreak?.16:.055;
   const weight=t<peak?T.MathUtils.smoothstep(t,0,peak):1-T.MathUtils.smoothstep(t,hold,duration);
   const back=(isBreak?12:5.5)*Math.PI/180*weight,yaw=(isBreak?10:-2)*Math.PI/180*weight,roll=(isBreak?3:0)*Math.PI/180*weight;
   g.mixer.setTime(t);g.scene.updateMatrixWorld(true);
   if(bodyBreak){
    // Capture the source feet before the body yields. Re-solving only the legs
    // keeps both soles and toe stations at their original world-space targets.
    const saved=bodyTracks.map(track=>({bone:bones[track.name],p:bones[track.name].position.clone(),q:bones[track.name].quaternion.clone()}));
    const feet=Object.fromEntries(['r','l'].map(side=>[side,{p:bones['foot_'+side].getWorldPosition(new T.Vector3()),q:bones['foot_'+side].getWorldQuaternion(new T.Quaternion())}]));
    const pelvis=bones.pelvis,position=pelvis.getWorldPosition(new T.Vector3());
    // Cancel the source clip's upward recoil before adding the actual compression.
    position.y=T.MathUtils.lerp(position.y,sourcePelvisStart.y-.040,weight);
    position.z=T.MathUtils.lerp(position.z,sourcePelvisStart.z-.045,weight);
    pelvis.position.copy(pelvis.parent.worldToLocal(position));g.scene.updateMatrixWorld(true);
    for(const side of ['r','l']){
     const error=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],feet[side].p,feet[side].q);
     if(error>1e-5)throw Error(name+' has an unreachable planted foot at '+t+' ('+side+').');
    }
    for(const track of bodyTracks){
     const value=track.path==='translation'?bones[track.name].position:bones[track.name].quaternion.clone().normalize();
     if(track.type==='VEC4'&&i&&value.dot(new T.Quaternion().fromArray(track.values,(i-1)*4))<0)value.set(-value.x,-value.y,-value.z,-value.w);
     value.toArray(track.values,i*(track.type==='VEC4'?4:3));
    }
    for(const item of saved){item.bone.position.copy(item.p);item.bone.quaternion.copy(item.q);}g.scene.updateMatrixWorld(true);
   }
   const parent=bones.spine_02.parent.getWorldQuaternion(new T.Quaternion()),base=bones.spine_02.getWorldQuaternion(new T.Quaternion());
   const delta=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw)
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),roll))
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-back));
   const local=parent.invert().multiply(delta.multiply(base)).normalize();
   if(i&&local.dot(new T.Quaternion().fromArray(rotations,(i-1)*4))<0)local.set(-local.x,-local.y,-local.z,-local.w);
   local.toArray(rotations,i*4);
  }
  sample.stop();
  animation.channels=animation.channels.filter(c=>!(c.target.node===node&&c.target.path==='rotation'));
  animation.channels.push({sampler:animation.samplers.length,target:{node,path:'rotation'}});
  animation.samplers.push({input:accessor(times,'SCALAR'),output:accessor(rotations,'VEC4'),interpolation:'LINEAR'});
  for(const track of bodyTracks){
   const bodyNode=doc.nodes.findIndex(n=>T.PropertyBinding.sanitizeNodeName(n.name??'')===track.name);
   if(bodyNode<0)throw Error('Missing native '+track.name+'.');
   animation.channels=animation.channels.filter(c=>!(c.target.node===bodyNode&&c.target.path===track.path));
   animation.channels.push({sampler:animation.samplers.length,target:{node:bodyNode,path:track.path}});
   animation.samplers.push({input:accessor(times,'SCALAR'),output:accessor(track.values,track.type),interpolation:'LINEAR'});
  }
  animation.extras={...animation.extras,nativeRoninGuardVersion:5,nativeRoninGuardRecoilVersion:1,...(bodyBreak?{nativeRoninGuardBodyVersion:6}:{}),reviewCandidate:true};
 }
 records[name]={...(fitted?.[name]??original[name]),twoHanded:true,gripSpacing:fitted?.[name].gripSpacing??.15,nativeAttachment:true,pairedGrip:true};
}
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));
const out=await loadNativeSkin(values.output),outBones={};out.scene.traverse(b=>{if(b.isBone)outBones[b.name]=b;});
const source=p=>[p.x,-p.z,p.y],point=n=>outBones[n].getWorldPosition(new T.Vector3()),q=n=>outBones[n].getWorldQuaternion(new T.Quaternion()),palm=side=>point('hand_'+side).add(new T.Vector3().fromArray(profiles[side].center).applyQuaternion(q('hand_'+side)));
for(const name of names){const clip=out.animations.find(a=>a.name===name),a=out.mixer.clipAction(clip).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();const record=records[name];
 record.poses=record.poses.map(p=>{out.mixer.setTime(Math.min(p.t*clip.duration,clip.duration-1e-7));out.scene.updateMatrixWorld(true);const primary=palm('r'),shaft=new T.Vector3().fromArray(profiles.r.axis).applyQuaternion(q('hand_r')),weaponQ=q('hand_r').multiply(new T.Quaternion().fromArray(profiles.r.frame)),legacy=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft).invert().multiply(weaponQ);return{...p,grip:source(primary),tip:source(primary.clone().addScaledVector(shaft,1.15)),secondaryGrip:source(palm('l')),elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l')),roll:2*Math.atan2(legacy.y,legacy.w)};});a.stop();
}
fs.writeFileSync(values.record,JSON.stringify(records));console.log(JSON.stringify({output:values.output,record:values.record,clips:names,recoilBone:"spine_02",preservedSpine01Channels:true,preservedPelvisAndLegChannels:!values['break-body'],breakBody:!!values['break-body']}));
