#!/usr/bin/env node
// Replace combat arm channels. Retain all body/leg poses, golf, selection, and other clips.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy,armAuthoringViolations} from './native-arm-anatomy.mjs';
import {HUSTLER_CLIPS,HUSTLER_TIMING,hustlerArms} from './native-hustler-profile.mjs';
import {createWeapon} from '../src/weapons.js';
const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},record:{type:'string'},frames:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-native-hustler.mjs --output /tmp/hustler.glb --record /tmp/hustler.json [--input MODEL.glb] [--frames FRAMES.json]\nRebuilds Ready, nine Ring attacks, and seven guard clips. Preserves original body and leg samplers, geometry, and unrelated animations. Never writes public assets.');process.exit(0);}
if(!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --output and --record. See --help.');
if(path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Use a candidate path outside public/.');
const input=values.input??new URL('../public/models/ayame.glb',import.meta.url),raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
const g=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b});g.scene.updateMatrixWorld(true);
const point=n=>bones[n].getWorldPosition(new T.Vector3()),rotation=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone().normalize(),s:b.scale.clone(),world:rotation(n)}]));
const anatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).ayame.sword;
const frames=JSON.parse(fs.readFileSync(values.frames??new URL('./native-hustler-frames.json',import.meta.url)));
const motion=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const originalMount=new T.Quaternion().fromArray(frames.sword.r.frame),UP=new T.Vector3(0,1,0),DEGREES=180/Math.PI;
// The cylinder fit has no edge direction. Calibrate that single fixed degree
// of freedom from the native forearm, without altering the shaft or palm.
const bindForearm=point('hand_r').sub(point('lowerarm_r')).normalize();
const forearmInWeapon=bindForearm.applyQuaternion(rest.hand_r.world.clone().multiply(originalMount).invert());
const mountingRoll=Math.atan2(-forearmInWeapon.z,forearmInWeapon.x);
const mount=originalMount.clone().multiply(new T.Quaternion().setFromAxisAngle(UP,mountingRoll));
for(const side of ['r','l']){assert.ok(rest['hand_'+side].q.angleTo(new T.Quaternion().fromArray(frames.sword[side].neutralHandRotation))<.001,'Native neutral hand changed. Recapture fitted frames.');assert.ok(new T.Vector3().fromArray(frames.sword[side].center).distanceTo(new T.Vector3().fromArray(grip[side].center))<1e-6,'Fitted grip center changed. Recapture fitted frames.');}
const radialAxis=Object.fromEntries(['r','l'].map(side=>{const hand=bones['hand_'+side],forward=hand.worldToLocal(point('middle_01_'+side)).normalize(),thumb=hand.worldToLocal(point('thumb_01_'+side));thumb.addScaledVector(forward,-thumb.dot(forward)).normalize();return[side,forward.cross(thumb).normalize()]}));
const names=Object.keys(bones).filter(n=>/^(clavicle|upperarm|lowerarm|hand)_[rl]$/.test(n)||/^(index|middle|ring|pinky|thumb)_\d+_r$/.test(n));
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
const source=v=>[v.x,-v.z,v.y],weapon=createWeapon('dao'),blade=weapon.getObjectByName('Flat steel blade'),verts=blade.geometry.attributes.position,records={},report={};
for(const name of HUSTLER_CLIPS){
 const original=doc.animations.find(a=>a.name===name),clip=g.animations.find(a=>a.name===name),spec=motion[name];if(!original||!clip||!spec)throw Error('Missing '+name);
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 if(original.extras?.nativeHustlerVersion&&!original.extras.nativeHustlerDuration)throw Error(name+': this early candidate lacks its timing base. Use the untouched source model.');
 const sourceDuration=original.extras?.nativeHustlerDuration??HUSTLER_TIMING[name]?.originalDuration??spec.duration;
 const duration=HUSTLER_TIMING[name]?.duration??spec.duration,impacts=HUSTLER_TIMING[name]?.impacts??spec.impacts??[],nativeTimeScale=duration/sourceDuration,metadataTimeScale=duration/spec.duration,times=Float32Array.from([...new Set([...Array.from({length:Math.ceil(duration*240)+1},(_,i)=>Math.min(i/240,duration)),...impacts].map(Math.fround))].sort((a,b)=>a-b));
 const tracks=Object.fromEntries(names.map(n=>[n,new Float32Array(times.length*4)])),poses=[],summary={originalDuration:sourceDuration,duration,originalImpacts:spec.impacts??[],impacts,nativeTimeScale,mountingRoll,mountedFrame:mount.toArray(),minBladeY:Infinity,maxWrist:0,arms:{r:[],l:[]},frames:[]};
 for(let i=0;i<times.length;i++){
  // Mixer only animates its existing tracks; reset all edited joints first.
  for(const n of names)bones[n].quaternion.copy(rest[n].q);
  action.time=Math.min(times[i]/nativeTimeScale,clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const p=hustlerArms(name,times[i],duration,impacts);
  for(const side of ['r','l']){
   const chestDelta=rotation('spine_03').multiply(anatomy[side].bindChestQuaternion.clone().invert());
   const lift=Math.max(0,p[side].upper[1])*.35;
   setWorld('clavicle_'+side,chestDelta.multiply(new T.Quaternion().setFromAxisAngle(UP,side==='r'?.18:-.10)).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),side==='r'?-lift:lift)).multiply(rest['clavicle_'+side].world));
   summary.arms[side].push(arm(side,p[side]));
  }
  for(const[n,q]of Object.entries(grip.r.rotations))bones[n].quaternion.fromArray(q);g.scene.updateMatrixWorld(true);
  const primary=bones.hand_r.localToWorld(new T.Vector3().fromArray(grip.r.center)),q=rotation('hand_r').multiply(mount),shaft=UP.clone().applyQuaternion(q);
  weapon.quaternion.copy(q);weapon.position.copy(primary).addScaledVector(shaft,-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
  let minY=Infinity;for(let k=0;k<verts.count;k++)minY=Math.min(minY,new T.Vector3().fromBufferAttribute(verts,k).applyMatrix4(blade.matrixWorld).y);summary.minBladeY=Math.min(summary.minBladeY,minY);
  const legacy=new T.Quaternion().setFromUnitVectors(UP,shaft).invert().multiply(q),pose=samplePose(spec.poses,times[i]/duration);
  Object.assign(pose,{t:i===0?0:i===times.length-1?1:times[i]/duration,grip:source(primary),tip:source(primary.clone().addScaledVector(shaft,1)),roll:2*Math.atan2(legacy.y,legacy.w),elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l'))});poses.push(pose);
  summary.frames.push({time:times[i],tip:weapon.localToWorld(new T.Vector3().fromArray(weapon.userData.tip)).toArray(),palm:primary.toArray(),edge:new T.Vector3(1,0,0).applyQuaternion(q).toArray(),face:new T.Vector3(0,0,1).applyQuaternion(q).toArray(),minY});
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
 animation.extras={...animation.extras,nativeHustlerVersion:1,nativeHustlerDuration:duration,kneeAlignmentVersion:1,reviewCandidate:true};doc.animations[doc.animations.indexOf(original)]=animation;
 records[name]={...spec,duration,...(impacts.length?{impacts}:{}),...Object.fromEntries(['footPlants','toePlants'].filter(key=>spec[key]).map(key=>[key,Object.fromEntries(Object.entries(spec[key]).map(([side,intervals])=>[side,intervals.map(pair=>pair.map(t=>t*metadataTimeScale))]))])),nativeAttachment:true,nativeStanceFeet:true,nativeSampleRate:240,nativeHustlerVersion:1,...(name==='Ring_Ready'?{nativeAttackReady:true}:{}),poses};report[name]=summary;
}
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let bin=Buffer.concat(chunks);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([header,json,bh,bin]));fs.writeFileSync(values.record.replace(/\.json$/,'.mount.json'),JSON.stringify({sword:{r:{frame:mount.toArray()}},golf:{r:{frame:frames.golf.r.frame},l:{frame:frames.golf.l.frame}},mountingRollDegrees:mountingRoll*DEGREES},null,2));fs.writeFileSync(values.record,JSON.stringify(records));fs.writeFileSync(values.record.replace(/\.json$/,'.report.json'),JSON.stringify(report));console.log(JSON.stringify({output:values.output,record:values.record,clips:Object.fromEntries(Object.entries(report).map(([n,r])=>[n,{minBladeY:r.minBladeY,maxWrist:r.maxWrist}]))},null,2));
