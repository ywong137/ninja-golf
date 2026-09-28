#!/usr/bin/env node
// Replace combat arm channels. Retain all body/leg poses, golf, selection, and other clips.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy,armAuthoringViolations} from './native-arm-anatomy.mjs';
import {createWeapon} from '../src/weapons.js';
export async function authorNativeArmFamily({values,modelKey,clips,timing,arms,framesPath,weaponKind,extrasKey,clavicleYaw={r:.18,l:-.10},dualWield=false}) {
const durationKey=extrasKey.replace(/Version$/,'Duration');
if(!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --output and --record. See --help.');
if(path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Use a candidate path outside public/.');
const input=values.input??new URL('../public/models/'+modelKey+'.glb',import.meta.url),raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
const g=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b});g.scene.updateMatrixWorld(true);
const point=n=>bones[n].getWorldPosition(new T.Vector3()),rotation=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone().normalize(),s:b.scale.clone(),world:rotation(n)}]));
const anatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)))[modelKey].sword;
const frames=JSON.parse(fs.readFileSync(values.frames??framesPath));
const motion=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const UP=new T.Vector3(0,1,0),DEGREES=180/Math.PI,heldSides=dualWield?['r','l']:['r'];
// Calibrate each fixed blade plane from the bind forearm. Keep the fitted axis.
const mounts=Object.fromEntries(heldSides.map(side=>{
 const original=new T.Quaternion().fromArray(frames.sword[side].frame);
 const forearm=point('hand_'+side).sub(point('lowerarm_'+side)).normalize();
 const local=forearm.applyQuaternion(rest['hand_'+side].world.clone().multiply(original).invert());
 const roll=Math.atan2(-local.z,local.x);
 return[side,{frame:original.multiply(new T.Quaternion().setFromAxisAngle(UP,roll)),roll}];
}));
const mount=mounts.r.frame,mountingRoll=mounts.r.roll;
for(const side of ['r','l']){assert.ok(rest['hand_'+side].q.angleTo(new T.Quaternion().fromArray(frames.sword[side].neutralHandRotation))<.001,'Native neutral hand changed. Recapture fitted frames.');assert.ok(new T.Vector3().fromArray(frames.sword[side].center).distanceTo(new T.Vector3().fromArray(grip[side].center))<1e-6,'Fitted grip center changed. Recapture fitted frames.');}
const radialAxis=Object.fromEntries(['r','l'].map(side=>{const hand=bones['hand_'+side],forward=hand.worldToLocal(point('middle_01_'+side)).normalize(),thumb=hand.worldToLocal(point('thumb_01_'+side));thumb.addScaledVector(forward,-thumb.dot(forward)).normalize();return[side,forward.cross(thumb).normalize()]}));
const names=Object.keys(bones).filter(n=>/^(clavicle|upperarm|lowerarm|hand)_[rl]$/.test(n)||(/^(index|middle|ring|pinky|thumb)_\d+_[rl]$/.test(n)&&heldSides.includes(n.at(-1))));
const indexByName=Object.fromEntries(doc.nodes.map((n,i)=>[T.PropertyBinding.sanitizeNodeName(n.name??''),i]));
const affected=new Set(names.map(n=>indexByName[n]));
function setWorld(name,q){const bone=bones[name];bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();bone.updateWorldMatrix(false,true);}
function arm(side,p){
 const c=anatomy[side],chestDelta=rotation('spine_03').multiply(c.bindChestQuaternion.clone().invert()),transported=chestDelta.clone().multiply(c.bindUpperArmQuaternion),direction=new T.Vector3().fromArray(p.upper).normalize().applyQuaternion(chestDelta);
 const reference=c.upperAxisLocal.clone().applyQuaternion(transported),aim=new T.Quaternion().setFromUnitVectors(reference,direction),upper=new T.Quaternion().setFromAxisAngle(direction,p.roll/DEGREES).multiply(aim).multiply(transported);
 setWorld('upperarm_'+side,upper);
 const lower=bones['lowerarm_'+side],hinge=new T.Quaternion().setFromAxisAngle(c.hingeAxisLocal,p.flex/DEGREES-c.bindFlexionRadians);
 lower.quaternion.copy(hinge).multiply(rest['lowerarm_'+side].q).multiply(new T.Quaternion().setFromAxisAngle(c.forearmAxisLocal,p.twist/DEGREES));lower.updateWorldMatrix(false,true);
 bones['hand_'+side].quaternion.copy(rest['hand_'+side].q).multiply(new T.Quaternion().setFromAxisAngle(radialAxis[side],p.wrist/DEGREES));bones['hand_'+side].updateWorldMatrix(false,true);
 const measured=measureArmAnatomy(c,captureArmPose(bones,side)),violations=armAuthoringViolations(measured,{maxHingeDeviationDegrees:1});if(violations.length)throw Error(`${side}: ${JSON.stringify(violations)}`);return measured;
}
function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(bytes);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length});byteLength+=bytes.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)]}doc.accessors.push(a);return doc.accessors.length-1;}
function samplePose(rows,t){let i=0;while(i<rows.length-2&&t>rows[i+1].t)i++;const a=rows[i],b=rows[Math.min(i+1,rows.length-1)],u=T.MathUtils.clamp((t-a.t)/(b.t-a.t||1),0,1);return Object.fromEntries(Object.entries(a).map(([key,v])=>[key,Array.isArray(v)?v.map((x,k)=>T.MathUtils.lerp(x,b[key]?.[k]??x,u)):typeof v==='number'?T.MathUtils.lerp(v,b[key]??v,u):v]));}
const source=v=>[v.x,-v.z,v.y],weapon=createWeapon(weaponKind),offWeapon=dualWield?createWeapon(weaponKind):null,blade=weapon.getObjectByName('Flat steel blade'),verts=blade.geometry.attributes.position,records={},report={};
for(const name of clips){
 const original=doc.animations.find(a=>a.name===name),clip=g.animations.find(a=>a.name===name),spec=motion[name];if(!original||!clip||!spec)throw Error('Missing '+name);
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 if(original.extras?.[extrasKey]&&!original.extras[durationKey])throw Error(name+': this early candidate lacks its timing base. Use the untouched source model.');
 const sourceDuration=original.extras?.[durationKey]??timing[name]?.originalDuration??spec.duration;
 const duration=timing[name]?.duration??spec.duration,impacts=timing[name]?.impacts??spec.impacts??[],nativeTimeScale=duration/sourceDuration,metadataTimeScale=duration/spec.duration,times=Float32Array.from([...new Set([...Array.from({length:Math.ceil(duration*240)+1},(_,i)=>Math.min(i/240,duration)),...impacts].map(Math.fround))].sort((a,b)=>a-b));
 const tracks=Object.fromEntries(names.map(n=>[n,new Float32Array(times.length*4)])),poses=[],summary={originalDuration:sourceDuration,duration,originalImpacts:spec.impacts??[],impacts,nativeTimeScale,mountingRoll,mountedFrame:mount.toArray(),minBladeY:Infinity,maxWrist:0,arms:{r:[],l:[]},frames:[]};
 for(let i=0;i<times.length;i++){
  // Mixer only animates its existing tracks; reset all edited joints first.
  for(const n of names)bones[n].quaternion.copy(rest[n].q);
  action.time=Math.min(times[i]/nativeTimeScale,clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const p=arms(name,times[i],duration,impacts);
  for(const side of ['r','l']){
   const chestDelta=rotation('spine_03').multiply(anatomy[side].bindChestQuaternion.clone().invert());
   const lift=Math.max(0,p[side].upper[1])*.35;
   setWorld('clavicle_'+side,chestDelta.multiply(new T.Quaternion().setFromAxisAngle(UP,clavicleYaw[side])).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),side==='r'?-lift:lift)).multiply(rest['clavicle_'+side].world));
   summary.arms[side].push(arm(side,p[side]));
  }
  for(const side of heldSides)for(const[n,q]of Object.entries(grip[side].rotations))bones[n].quaternion.fromArray(q);g.scene.updateMatrixWorld(true);
  const primary=bones.hand_r.localToWorld(new T.Vector3().fromArray(grip.r.center)),q=rotation('hand_r').multiply(mount),shaft=UP.clone().applyQuaternion(q);
  weapon.quaternion.copy(q);weapon.position.copy(primary).addScaledVector(shaft,-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
  let minY=Infinity;for(let k=0;k<verts.count;k++)minY=Math.min(minY,new T.Vector3().fromBufferAttribute(verts,k).applyMatrix4(blade.matrixWorld).y);summary.minBladeY=Math.min(summary.minBladeY,minY);
  const legacy=new T.Quaternion().setFromUnitVectors(UP,shaft).invert().multiply(q),pose=samplePose(spec.poses,times[i]/duration);
  Object.assign(pose,{t:i===0?0:i===times.length-1?1:times[i]/duration,grip:source(primary),tip:source(primary.clone().addScaledVector(shaft,1)),roll:2*Math.atan2(legacy.y,legacy.w),elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l'))});
  let offFrame;
  if(offWeapon){
   const palm=bones.hand_l.localToWorld(new T.Vector3().fromArray(grip.l.center)),q=rotation('hand_l').multiply(mounts.l.frame),shaft=UP.clone().applyQuaternion(q);
   offWeapon.quaternion.copy(q);offWeapon.position.copy(palm).addScaledVector(shaft,-offWeapon.userData.primaryGrip);offWeapon.updateMatrixWorld(true);
   const roll=new T.Quaternion().setFromUnitVectors(UP,shaft).invert().multiply(q);
   Object.assign(pose,{offGrip:source(palm),offTip:source(palm.clone().addScaledVector(shaft,1)),offRoll:2*Math.atan2(roll.y,roll.w)});
   const blade=offWeapon.getObjectByName('Flat steel blade');let minY=Infinity;
   for(let k=0;k<verts.count;k++)minY=Math.min(minY,new T.Vector3().fromBufferAttribute(verts,k).applyMatrix4(blade.matrixWorld).y);
   summary.minBladeY=Math.min(summary.minBladeY,minY);
   offFrame={tip:offWeapon.localToWorld(new T.Vector3().fromArray(offWeapon.userData.tip)).toArray(),palm:palm.toArray(),edge:new T.Vector3(1,0,0).applyQuaternion(q).toArray(),face:new T.Vector3(0,0,1).applyQuaternion(q).toArray(),minY};
  }
  poses.push(pose);
  summary.frames.push({time:times[i],tip:weapon.localToWorld(new T.Vector3().fromArray(weapon.userData.tip)).toArray(),palm:primary.toArray(),edge:new T.Vector3(1,0,0).applyQuaternion(q).toArray(),face:new T.Vector3(0,0,1).applyQuaternion(q).toArray(),minY,...(offFrame?{offhand:offFrame}:{})});
  for(const side of ['r','l'])summary.maxWrist=Math.max(summary.maxWrist,bones['hand_'+side].quaternion.angleTo(rest['hand_'+side].q)*DEGREES);
  for(const n of names){const q=bones[n].quaternion.clone(),a=tracks[n];if(i&&q.dot(new T.Quaternion().fromArray(a,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);q.toArray(a,i*4);}
 }
 const time=accessor(times,'SCALAR'),animation=structuredClone(original);
 // Keep all original body values. Only the timeline changes for revised pacing.
 if(Math.abs(nativeTimeScale-1)>1e-7){
  const inputs=new Map();for(const sampler of animation.samplers){
   if(!inputs.has(sampler.input)){
    const a=doc.accessors[sampler.input],view=doc.bufferViews[a.bufferView],offset=(view.byteOffset??0)+(a.byteOffset??0);
    if(a.componentType!==5126||a.type!=='SCALAR')throw Error('Expected scalar float animation times.');
    const originalTimes=Array.from({length:a.count},(_,i)=>chunks[0].readFloatLE(offset+i*4));
    inputs.set(sampler.input,accessor(Float32Array.from(originalTimes,t=>t*nativeTimeScale),'SCALAR'));
   }sampler.input=inputs.get(sampler.input);
  }
 }
 animation.channels=animation.channels.filter(c=>!affected.has(c.target.node)||c.target.path!=='rotation');
 for(const[n,array]of Object.entries(tracks)){animation.channels.push({sampler:animation.samplers.length,target:{node:indexByName[n],path:'rotation'}});animation.samplers.push({input:time,output:accessor(array,'VEC4'),interpolation:'LINEAR'});}
 animation.extras={...animation.extras,[extrasKey]:1,[durationKey]:duration,kneeAlignmentVersion:1,reviewCandidate:true};doc.animations[doc.animations.indexOf(original)]=animation;
 records[name]={...spec,duration,...(timing[name]?.impactHands?{impactHands:timing[name].impactHands}:{}),...(impacts.length?{impacts}:{}),...Object.fromEntries(['footPlants','toePlants'].filter(key=>spec[key]).map(key=>[key,Object.fromEntries(Object.entries(spec[key]).map(([side,intervals])=>[side,intervals.map(pair=>pair.map(t=>t*metadataTimeScale))]))])),nativeAttachment:true,nativeStanceFeet:true,nativeSampleRate:240,[extrasKey]:1,...(name.endsWith('_Ready')?{nativeAttackReady:true}:{}),poses};report[name]=summary;
}
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let bin=Buffer.concat(chunks);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([header,json,bh,bin]));fs.writeFileSync(values.record.replace(/\.json$/,'.mount.json'),JSON.stringify({sword:{r:{frame:mount.toArray()},...(dualWield?{l:{frame:mounts.l.frame.toArray()}}:{})},golf:{r:{frame:frames.golf.r.frame},l:{frame:frames.golf.l.frame}},mountingRollDegrees:mountingRoll*DEGREES,...(dualWield?{offhandMountingRollDegrees:mounts.l.roll*DEGREES}:{})},null,2));fs.writeFileSync(values.record,JSON.stringify(records));fs.writeFileSync(values.record.replace(/\.json$/,'.report.json'),JSON.stringify(report));console.log(JSON.stringify({output:values.output,record:values.record,clips:Object.fromEntries(Object.entries(report).map(([n,r])=>[n,{minBladeY:r.minBladeY,maxWrist:r.maxWrist}]))},null,2));

}
