#!/usr/bin/env node
/** Correct enemy knee planes without changing foot paths or upper-body animation. */
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {alignedKnee} from '../src/knee-alignment.js';
const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-enemy-locomotion.mjs --input ENEMY.glb --output CANDIDATE.glb\nReplace running/jump leg rotations only. Never overwrites the input.');process.exit(0);}
if(!values.input||!values.output||values.input===values.output)throw Error('Supply distinct --input and --output paths.');
const raw=fs.readFileSync(values.input),jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength)),binary=raw.subarray(28+jsonLength),chunks=[binary];let byteLength=binary.length;
const g=await loadNativeSkin(values.input),bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});g.scene.updateMatrixWorld(true);
const point=name=>bones[name].getWorldPosition(new T.Vector3()),rotation=name=>bones[name].getWorldQuaternion(new T.Quaternion());
function worldRotation(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
function accessor(array,type){const n=type==='VEC4'?4:1,index=doc.bufferViews.length;chunks.push(Buffer.from(array.buffer,array.byteOffset,array.byteLength));doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:array.byteLength});byteLength+=array.byteLength;doc.accessors.push({bufferView:index,componentType:5126,count:array.length/n,type,...(type==='SCALAR'?{min:[array[0]],max:[array.at(-1)]}:{})});return doc.accessors.length-1;}
const report=[];
for(const anim of doc.animations){
 if(!['Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land'].includes(anim.name))continue;
 if(anim.extras?.enemyKneePlaneVersion)throw Error(`${anim.name} is already corrected; use the original source.`);
 const clip=g.animations.find(c=>c.name===anim.name);g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 const names=['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'],times=Float32Array.from({length:Math.ceil(clip.duration*120)+1},(_,i)=>Math.min(i/120,clip.duration)),tracks=Object.fromEntries(names.map(n=>[n,new Float32Array(times.length*4)]));
 let maxFootError=0,minForwardBend=1,maxLengthError=0,maxKneeSpeed=0;const previous={};
 for(let i=0;i<times.length;i++){
  action.time=times[i];g.mixer.update(0);g.scene.updateMatrixWorld(true);const saved=names.map(n=>[bones[n],bones[n].quaternion.clone()]);
  for(const side of ['r','l']){
   const hip=point('thigh_'+side),knee=point('calf_'+side),ankle=point('foot_'+side),q=rotation('foot_'+side),upper=hip.distanceTo(knee),lower=knee.distanceTo(ankle);
   // Pitching a shoe past vertical must not reverse the anatomical knee plane.
   const axis=ankle.clone().sub(hip),distance=axis.length();axis.normalize();
   const along=(upper*upper-lower*lower+distance*distance)/(2*distance),center=hip.clone().addScaledVector(axis,along),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
   const aligned=alignedKnee(hip,ankle,upper,lower,new T.Vector3(0,0,1)).sub(center).normalize();
   const sagittal=new T.Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize();
   const t=T.MathUtils.clamp((ankle.y-.13)/.13,0,1),air=t*t*(3-2*t);
   const target=center.add(aligned.lerp(sagittal,air).normalize().multiplyScalar(radius));
   worldRotation(bones['thigh_'+side],new T.Quaternion().setFromUnitVectors(knee.clone().sub(hip).normalize(),target.clone().sub(hip).normalize()).multiply(rotation('thigh_'+side)));
   const newKnee=point('calf_'+side);worldRotation(bones['calf_'+side],new T.Quaternion().setFromUnitVectors(point('foot_'+side).sub(newKnee).normalize(),ankle.clone().sub(newKnee).normalize()).multiply(rotation('calf_'+side)));worldRotation(bones['foot_'+side],q);
   const k=point('calf_'+side),a=point('foot_'+side),legAxis=ankle.clone().sub(hip),bend=k.clone().sub(hip).addScaledVector(legAxis,-k.clone().sub(hip).dot(legAxis)/legAxis.lengthSq());minForwardBend=Math.min(minForwardBend,bend.z);maxFootError=Math.max(maxFootError,a.distanceTo(ankle));maxLengthError=Math.max(maxLengthError,Math.abs(k.distanceTo(hip)-upper),Math.abs(a.distanceTo(k)-lower));if(previous[side])maxKneeSpeed=Math.max(maxKneeSpeed,k.distanceTo(previous[side])*120);previous[side]=k;
  }
  for(const name of names){const q=bones[name].quaternion;if(i&&q.dot(new T.Quaternion().fromArray(tracks[name],(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(tracks[name],i*4);}
  for(const [bone,q]of saved)bone.quaternion.copy(q);
 }
 const time=accessor(times,'SCALAR');for(const name of names){const node=doc.nodes.findIndex(n=>n.name===name),channel=anim.channels.find(c=>c.target.node===node&&c.target.path==='rotation');if(!channel)throw Error(`Missing ${anim.name} ${name}`);channel.sampler=anim.samplers.length;anim.samplers.push({input:time,output:accessor(tracks[name],'VEC4'),interpolation:'LINEAR'});}
 anim.extras={...anim.extras,enemyKneePlaneVersion:1};report.push({clip:anim.name,maxFootError,minForwardBend,maxLengthError,maxKneeSpeed});
}
if(report.length!==5)throw Error('Expected five enemy running/jump clips.');doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),out=Buffer.alloc(28+json.length+bin.length);raw.copy(out,0,0,12);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);fs.writeFileSync(values.output,out);console.log(JSON.stringify(report,null,2));
