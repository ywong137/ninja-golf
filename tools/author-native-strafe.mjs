#!/usr/bin/env node
// Replace only the two lateral run clips. Keep geometry, textures and every
// unrelated animation intact. Feed an original model, never a previous bake.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {STRAFE_PROFILE,STRAFE_CLIPS,STRAFE_VERSION} from './strafe-profile.mjs';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {headingKnee} from '../src/knee-alignment.js';
import {solveLeg} from '../src/foot-placement.js';
import {calibrateLegHinge,alignLegHinge} from '../src/leg-hinge.js';
import {parseGlb} from './bake-native-golf.mjs';
const {values,positionals}=parseArgs({allowPositionals:true,options:{output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('Usage: node tools/author-native-strafe.mjs ORIGINAL.glb --output CANDIDATE.glb\nReplace Run_Right and Run_Left with coordinated hips, knees, feet and free-arm swing.');process.exit(0);}
if(positionals.length!==1||!values.output)throw Error('Supply one source GLB and --output. See --help.');
const input=positionals[0],output=values.output,profile=STRAFE_PROFILE;
if(path.resolve(input)===path.resolve(output))throw Error('Write a separate output so the original source remains reproducible.');
const source=fs.readFileSync(input),{doc,bin,chunks}=parseGlb(source);
for(const name of Object.keys(STRAFE_CLIPS)){
 const clip=doc.animations.find(a=>a.name===name);
 if(!clip)throw Error(`Missing native ${name}.`);
 if(clip.extras?.nativeStrafeVersion)throw Error(`${name} already has a strafe bake. Use the original model.`);
}

const g=await loadNativeSkin(input),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o});g.scene.updateMatrixWorld(true);
const point=n=>b[n].getWorldPosition(new T.Vector3()),rotation=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
const bindPelvis=point('pelvis'),bindCore=Object.fromEntries(['spine_02','spine_03','Head'].map(n=>[n,rotation(n)]));
const armRest={upper:point('lowerarm_l').sub(point('upperarm_l')).normalize(),lower:point('hand_l').sub(point('lowerarm_l')).normalize(),upperQ:rotation('upperarm_l'),lowerQ:b.lowerarm_l.quaternion.clone(),handQ:b.hand_l.quaternion.clone(),chestQ:rotation('spine_03')};
armRest.normal=armRest.upper.clone().cross(armRest.lower).normalize();
const Y=new T.Vector3(0,1,0),cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
const bind=Object.fromEntries(['r','l'].map(s=>[s,{q:rotation('foot_'+s),ankle:point('foot_'+s),toe:point('ball_'+s).sub(point('foot_'+s)),upper:point('thigh_'+s).distanceTo(point('calf_'+s)),lower:point('calf_'+s).distanceTo(point('foot_'+s))}]));
const parts=[bin];let length=bin.length;
function accessor(values,width){const array=Float32Array.from(values),bytes=Buffer.from(array.buffer);const padding=(4-length%4)%4;if(padding){parts.push(Buffer.alloc(padding));length+=padding}doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});parts.push(bytes);length+=bytes.length;doc.accessors.push({bufferView:doc.bufferViews.length-1,componentType:5126,count:values.length/width,type:width===1?'SCALAR':width===3?'VEC3':'VEC4',...(width===1?{min:[values[0]],max:[values.at(-1)]}:{})});return doc.accessors.length-1;}
function setWorld(name,q){b[name].quaternion.copy(b[name].parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();g.scene.updateMatrixWorld(true)}
// Retain source pitch and lean without adding its full counter-twist to the
// lateral look direction. Spread the remaining turn over both trunk joints.
function turnCore(name,source,turn){
 const delta=source.clone().multiply(bindCore[name].clone().invert()),forward=new T.Vector3(0,0,1).applyQuaternion(delta);
 const yaw=Math.atan2(forward.x,forward.z);
 setWorld(name,new T.Quaternion().setFromAxisAngle(Y,turn-(1-profile.sourceChestYaw)*yaw).multiply(source));
}
const rows=[];
for(const [name,direction]of Object.entries(STRAFE_CLIPS)){
 const clip=g.animations.find(c=>c.name===name);
 if(Math.abs(clip.duration-profile.duration)>1e-5)throw Error(`${name} duration differs from the shared gait clock.`);
 const a=g.mixer.clipAction(clip);g.mixer.stopAllAction();a.reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
 const names=['pelvis','spine_02','spine_03','Head','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l','upperarm_l','lowerarm_l','hand_l'],tracks=Object.fromEntries(names.map(n=>[n,[]])),pelvis=[],times=[];let maxError=0,maxReachLowering=0,maxWidth=0,minPelvis=Infinity,maxPelvis=-Infinity;
 for(let i=0;i<=Math.round(profile.duration*240);i++){
  const time=i/240,phase=time/profile.duration;times.push(time);a.time=Math.min(time,clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const lowerChest=rotation('spine_02'),chest=rotation('spine_03'),head=rotation('Head');
  setWorld('pelvis',new T.Quaternion().setFromAxisAngle(Y,direction*profile.hipTurn*Math.PI/180).multiply(rotation('pelvis')));
  turnCore('spine_02',lowerChest,direction*(profile.hipTurn+profile.chestTurn)/2*Math.PI/180);
  turnCore('spine_03',chest,direction*profile.chestTurn*Math.PI/180);
  turnCore('Head',head,direction*profile.headTurn*Math.PI/180);
  const targets={};
  for(const [side,offset]of [['r',0],['l',.5]]){
   const p=((phase+offset)%1+1)%1,support=profile.support,amp=profile.amplitude,sign=side==='r'?-1:1;let travel,lift,pitch;
   if(p<support){travel=amp*(1-2*p/support);lift=0;pitch=p<.08?-.15*(1-p/.08):p>support-.08?.25*(p-support+.08)/.08:0;}
   else{const u=(p-support)/(1-support),slope=-2*amp*(1-support)/support;travel=(2*u**3-3*u*u+1)*(-amp)+(u**3-2*u*u+u)*slope+(-2*u**3+3*u*u)*amp+(u**3-u*u)*slope;lift=profile.lift;pitch=.25-.4*u;}
   const hipYaw=direction*profile.hipTurn*Math.PI/180,footYaw=hipYaw+sign*profile.toeOut*Math.PI/180,heading=Math.atan2(bind[side].toe.x,bind[side].toe.z),yawQ=new T.Quaternion().setFromAxisAngle(Y,footYaw-heading),axis=new T.Vector3(Math.cos(footYaw),0,-Math.sin(footYaw));
   const q=new T.Quaternion().setFromAxisAngle(axis,pitch).multiply(yawQ).multiply(bind[side].q);
   const t=new T.Vector3(sign*profile.width*Math.cos(hipYaw)+direction*travel,bind[side].ankle.y+lift,-sign*profile.width*Math.sin(hipYaw));
   const heel=new T.Vector3(-Math.sin(footYaw)*.065,-bind[side].ankle.y,-Math.cos(footYaw)*.065);
   const levelToe=bind[side].toe.clone().applyQuaternion(bind[side].q.clone().invert()).applyQuaternion(yawQ.clone().multiply(bind[side].q));
   const supportLift=pitch=>Math.max(-levelToe.clone().applyAxisAngle(axis,pitch).y,-heel.clone().applyAxisAngle(axis,pitch).y)-bind[side].ankle.y+.0024;
   if(p<support)t.y=bind[side].ankle.y+supportLift(pitch);
   else{const u=(p-support)/(1-support),h0=supportLift(.25),h1=supportLift(-.15),eps=1e-5,derivative=angle=>(supportLift(angle+eps)-supportLift(angle-eps))/(2*eps),m0=derivative(.25)*(.25/.08)*(1-support),m1=derivative(-.15)*(.15/.08)*(1-support);t.y=bind[side].ankle.y+(2*u**3-3*u*u+1)*h0+(u**3-2*u*u+u)*m0+(-2*u**3+3*u*u)*h1+(u**3-u*u)*m1+16*u*u*(1-u)**2*profile.lift;}
   targets[side]={p:t,q};
  }
  const hipYaw=direction*profile.hipTurn*Math.PI/180,sway=-profile.pelvisSway*Math.cos((phase-.14)*Math.PI*2);
  const wanted=new T.Vector3(sway*Math.cos(hipYaw),bindPelvis.y-profile.pelvisDrop-profile.pelvisBounce*Math.cos((phase-.14)*Math.PI*4),-sway*Math.sin(hipYaw)),pelvisDelta=wanted.clone().sub(point('pelvis'));
  let limit=0;
  for(const side of ['r','l']){const hip=point('thigh_'+side).add(pelvisDelta),target=targets[side].p,leg=bind[side],reach=(leg.upper+leg.lower)*.98,horizontal=Math.hypot(target.x-hip.x,target.z-hip.z),maxY=target.y+Math.sqrt(Math.max(.01,reach*reach-horizontal*horizontal));limit=Math.min(limit,maxY-hip.y)}
  maxReachLowering=Math.min(maxReachLowering,limit);wanted.y+=limit;b.pelvis.position.copy(b.pelvis.parent.worldToLocal(wanted));g.scene.updateMatrixWorld(true);
  for(const side of ['r','l']){const target=targets[side];maxError=Math.max(maxError,solveLeg(b['thigh_'+side],b['calf_'+side],b['foot_'+side],target.p,target.q,{maxReach:.999,kneeSolver:headingKnee}));alignLegHinge(b['thigh_'+side],b['calf_'+side],b['foot_'+side],cal[side]);}
  const chestDelta=rotation('spine_03').multiply(armRest.chestQ.clone().invert()),swing=Math.cos((phase+.04)*Math.PI*2);
  const upperDirection=new T.Vector3(.16,-.95,.30*swing).normalize().applyQuaternion(chestDelta);
  const upperSwing=new T.Quaternion().setFromUnitVectors(armRest.upper.clone().applyQuaternion(chestDelta),upperDirection);
  setWorld('upperarm_l',upperSwing.multiply(chestDelta).multiply(armRest.upperQ));
  const hinge=armRest.normal.clone().applyQuaternion(armRest.upperQ.clone().invert()),flex=(80+10*swing)*Math.PI/180;
  b.lowerarm_l.quaternion.copy(new T.Quaternion().setFromAxisAngle(hinge,flex-armRest.upper.angleTo(armRest.lower))).multiply(armRest.lowerQ);b.hand_l.quaternion.copy(armRest.handQ);g.scene.updateMatrixWorld(true);
  const height=point('pelvis').y;minPelvis=Math.min(minPelvis,height);maxPelvis=Math.max(maxPelvis,height);maxWidth=Math.max(maxWidth,point('foot_l').distanceTo(point('foot_r')));
  for(const n of names){const q=b[n].quaternion.clone();if(i&&q.dot(new T.Quaternion().fromArray(tracks[n],(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);tracks[n].push(...q.toArray())}pelvis.push(...b.pelvis.position.toArray());
 }
 const animation=doc.animations.find(a=>a.name===name),timeAccessor=accessor(times,1);
 for(const [n,path,values,width]of [...names.map(n=>[n,'rotation',tracks[n],4]),['pelvis','translation',pelvis,3]]){const node=doc.nodes.findIndex(v=>v.name===n),channel=animation.channels.find(c=>c.target.node===node&&c.target.path===path);if(!channel)throw Error('Missing channel '+n+path);channel.sampler=animation.samplers.length;animation.samplers.push({input:timeAccessor,output:accessor(values,width),interpolation:'LINEAR'});}
 animation.extras={...animation.extras,nativeStrafeVersion:STRAFE_VERSION};
 if(maxReachLowering < -1e-6)throw Error(`${name} needs more pelvis clearance. Increase the constant pelvisDrop; do not clip its bounce.`);
 if(maxError>1e-5)throw Error(`${name} cannot reach its foot targets: ${maxError}m.`);
 rows.push({name,maxError,maxReachLowering,maxWidth,minPelvis,maxPelvis});
}
doc.buffers[0].byteLength=length;const pad=(b,byte=0)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,byte)]),json=pad(Buffer.from(JSON.stringify(doc)),32),binary=pad(Buffer.concat(parts)),out=chunks.map(c=>({type:c.type,data:c.type===0x4e4f534a?json:c.type===0x004e4942?binary:c.data})),header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+out.reduce((n,c)=>n+8+c.data.length,0),8);fs.writeFileSync(output,Buffer.concat([header,...out.flatMap(c=>{const h=Buffer.alloc(8);h.writeUInt32LE(c.data.length);h.writeUInt32LE(c.type,4);return[h,c.data]})]));console.log(JSON.stringify({input,output,version:STRAFE_VERSION,clips:rows},null,2));
