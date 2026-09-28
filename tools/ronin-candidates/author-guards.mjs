import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/author-guards.mjs --output /tmp/guards.glb --record /tmp/guards.json [--input /tmp/ronin-diagonal-v63.glb]\nTransfer accepted Ready arms and upper trunk onto the existing guard pelvis and leg paths. Candidate files only.');process.exit(0);}
if(!values.input?.endsWith('.glb'))throw Error('Supply --input containing accepted Ronin_Ready.');
if(!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --output and --record.');
if(path.resolve(values.output).startsWith(new URL('../../public/',import.meta.url).pathname))throw Error('Output must remain outside public/.');
const raw=fs.readFileSync(values.input),jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength)),chunks=[raw.subarray(28+jsonLength)];let byteLength=chunks[0].length;
function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;}
const g=await loadNativeSkin(values.input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});const ready=g.animations.find(c=>c.name==='Ronin_Ready');if(!ready)throw Error('Accepted Ronin_Ready is required.');const action=g.mixer.clipAction(ready).play();g.mixer.setTime(0);g.scene.updateMatrixWorld(true);
const transferredNames=new Set();for(const side of ['r','l'])bones['clavicle_'+side].traverse(b=>{if(b.isBone)transferredNames.add(b.name);});
for(const name of ['spine_01','spine_02','spine_03','neck_01','Head'])transferredNames.add(name);
const transferredPose=Object.fromEntries([...transferredNames].map(name=>[name,{translation:bones[name].position.toArray(),rotation:bones[name].quaternion.toArray(),scale:bones[name].scale.toArray()}]));
action.stop();
const original=JSON.parse(fs.readFileSync(new URL('../../src/motion-data.json',import.meta.url))),records={};
const names=Object.keys(original).filter(n=>n.startsWith('Odachi_Guard_'));
for(const name of names){
 const animation=doc.animations.find(a=>a.name===name);if(!animation)throw Error('Missing '+name);
 const duration=original[name].duration,time=accessor(new Float32Array([0,duration]),'SCALAR');
 animation.channels=animation.channels.filter(c=>!transferredNames.has(T.PropertyBinding.sanitizeNodeName(doc.nodes[c.target.node].name??'')));
 for(const [bone,pose]of Object.entries(transferredPose))for(const [property,vector]of Object.entries(pose)){
  const node=doc.nodes.findIndex(n=>T.PropertyBinding.sanitizeNodeName(n.name??'')===bone);if(node<0)throw Error('Missing native node '+bone);
  animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});
  animation.samplers.push({input:time,output:accessor(Float32Array.from([...vector,...vector]),property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
 }
 animation.extras={...animation.extras,nativeRoninGuardVersion:1,reviewCandidate:true};
 records[name]={...original[name],twoHanded:true,gripSpacing:.15,nativeAttachment:true,pairedGrip:true};
}
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));
const out=await loadNativeSkin(values.output),outBones={};out.scene.traverse(b=>{if(b.isBone)outBones[b.name]=b;});const profiles=JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword;
const source=p=>[p.x,-p.z,p.y],point=n=>outBones[n].getWorldPosition(new T.Vector3()),q=n=>outBones[n].getWorldQuaternion(new T.Quaternion()),palm=side=>point('hand_'+side).add(new T.Vector3().fromArray(profiles[side].center).applyQuaternion(q('hand_'+side)));
for(const name of names){const clip=out.animations.find(a=>a.name===name),a=out.mixer.clipAction(clip).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();const record=records[name];
 record.poses=record.poses.map(p=>{out.mixer.setTime(Math.min(p.t*clip.duration,clip.duration-1e-7));out.scene.updateMatrixWorld(true);const primary=palm('r'),shaft=new T.Vector3().fromArray(profiles.r.axis).applyQuaternion(q('hand_r')),weaponQ=q('hand_r').multiply(new T.Quaternion().fromArray(profiles.r.frame)),legacy=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft).invert().multiply(weaponQ);return{...p,grip:source(primary),tip:source(primary.clone().addScaledVector(shaft,1.15)),secondaryGrip:source(palm('l')),elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l')),roll:2*Math.atan2(legacy.y,legacy.w)};});a.stop();
}
fs.writeFileSync(values.record,JSON.stringify(records));console.log(JSON.stringify({output:values.output,record:values.record,clips:names,transferredBones:transferredNames.size,preservedPelvisAndLegChannels:true}));
