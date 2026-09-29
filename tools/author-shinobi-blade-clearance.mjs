#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';

const {values}=parseArgs({options:{input:{type:'string'},record:{type:'string'},output:{type:'string'},'output-record':{type:'string'},angle:{type:'string',default:'6'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-shinobi-blade-clearance.mjs --input BASE.glb --record MOTIONS.json --output /tmp/CANDIDATE.glb --output-record /tmp/CANDIDATE.json [--angle 6]\nOpens the left shoulder briefly during Twin_Heavy_Rising preparation. Preserves the wrist, grip, contact pose, legs, and all other clips.');process.exit(0);}
for(const k of ['input','record','output','output-record'])if(!values[k])throw Error('Supply --'+k+'. See --help.');
const angle=Number(values.angle);assert.ok(angle>0&&angle<=12,'Choose a positive opening of at most 12 degrees.');
for(const k of ['output','output-record']){
 assert.ok(!path.resolve(values[k]).startsWith(new URL('../public/',import.meta.url).pathname),'Write candidates outside public/.');
 assert.ok(!['input','record'].some(source=>path.resolve(values[k])===path.resolve(values[source])),'Do not overwrite a source file.');
}
assert.ok(values.output.endsWith('.glb')&&values['output-record'].endsWith('.json')&&path.resolve(values.output)!==path.resolve(values['output-record']),'Use separate .glb and .json output files.');
const name='Twin_Heavy_Rising',raw=fs.readFileSync(values.input),jsonSize=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonSize)),bin=raw.subarray(28+jsonSize),original=doc.animations.find(a=>a.name===name);
assert.ok(original&&!original.extras?.backsweptBladeClearance,'Supply the unmodified baseline clip.');
const records=JSON.parse(fs.readFileSync(values.record)),spec=records[name];assert.ok(spec?.nativeAttachment,'Supply the matching native motion record.');
const g=await loadNativeSkin(values.input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const clip=g.animations.find(c=>c.name===name),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).shinobi.sword.l,mount=new T.Quaternion().fromArray(grip.frame);
const poses=structuredClone(spec.poses),times=Float32Array.from(poses.map(p=>p.t*spec.duration)),rotations=new Float32Array(times.length*4),source=v=>[v.x,-v.z,v.y];
for(let i=0;i<times.length;i++){
 const t=times[i];action.time=Math.min(t,clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const upper=bones.upperarm_l,originalQ=upper.quaternion.clone(),weight=t<.16?Math.sin(Math.PI*t/.16)**2:0;
 const axis=new T.Vector3(0,0,1).applyQuaternion(bones.spine_03.getWorldQuaternion(new T.Quaternion()));
 const q=upper.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(axis,angle*Math.PI/180*weight));
 upper.quaternion.copy(upper.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();g.scene.updateMatrixWorld(true);
 const local=upper.quaternion.clone();if(i&&local.dot(new T.Quaternion().fromArray(rotations,(i-1)*4))<0)local.set(-local.x,-local.y,-local.z,-local.w);local.toArray(rotations,i*4);
 const palm=bones.hand_l.localToWorld(new T.Vector3().fromArray(grip.center)),frame=bones.hand_l.getWorldQuaternion(new T.Quaternion()).multiply(mount),shaft=new T.Vector3(0,1,0).applyQuaternion(frame),roll=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),shaft).invert().multiply(frame);
 Object.assign(poses[i],{offGrip:source(palm),offTip:source(palm.clone().add(shaft)),offRoll:2*Math.atan2(roll.y,roll.w),elbowL:source(bones.lowerarm_l.getWorldPosition(new T.Vector3()))});
 // Held source keys may skip mixer writes. Restore the source rotation so this
 // brief correction can never accumulate across samples.
 upper.quaternion.copy(originalQ);
}
const chunks=[bin];let length=bin.length;
function append(array,type,width){const padding=(4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length});chunks.push(data);length+=data.length;doc.accessors.push({bufferView:view,componentType:5126,count:array.length/width,type,...(width===1?{min:[array[0]],max:[array.at(-1)]}:{})});return doc.accessors.length-1;}
const animation=structuredClone(original),node=doc.nodes.findIndex(n=>n.name==='upperarm_l'),channel=animation.channels.find(c=>c.target.node===node&&c.target.path==='rotation');assert.ok(channel,'Missing native upper-arm channel.');
channel.sampler=animation.samplers.length;animation.samplers.push({input:append(times,'SCALAR',1),output:append(rotations,'VEC4',4),interpolation:'LINEAR'});animation.extras={...animation.extras,backsweptBladeClearance:1};doc.animations[doc.animations.indexOf(original)]=animation;doc.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let outputBin=Buffer.concat(chunks);outputBin=Buffer.concat([outputBin,Buffer.alloc((4-outputBin.length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+outputBin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(outputBin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([header,json,bh,outputBin]));fs.writeFileSync(values['output-record'],JSON.stringify({[name]:{...spec,backsweptBladeClearance:1,poses}}));
console.log(JSON.stringify({angle,samples:times.length,preservation:verifyAnimationReplacement(values.input,values.output,[[name,name]])}));
