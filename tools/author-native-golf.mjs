#!/usr/bin/env node
// Bake golf directly on the native human. No source mannequin or shoulder IK.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {alignWeaponShaft,palmWeaponBasis} from '../src/weapon-frame.js';
import {nativeGolfPhase,golfRecords,GOLF_GRIP_SPACING} from './golf-motion-profile.mjs';

const {values}=parseArgs({options:{hero:{type:'string'},output:{type:'string'},input:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-native-golf.mjs --hero ronin --output /tmp/ronin-golf.glb [--input MODEL.glb]\nBakes native golf candidates. Preserves geometry and unrelated animation bytes. Output must remain outside public/.');process.exit(0);}
if(!['ronin','shinobi','monk','kaede','ayame','sora'].includes(values.hero)||!values.output?.endsWith('.glb'))throw Error('Supply --hero and --output. See --help.');
if(path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Use a review output outside public/.');
const input=values.input??new URL(`../public/models/${values.hero}.glb`,import.meta.url);
const raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
const chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
const g=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
const point=n=>bones[n].getWorldPosition(new T.Vector3());
const worldQ=n=>bones[n].getWorldQuaternion(new T.Quaternion());
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone(),world:worldQ(n)}]));
const pelvisOrigin=point('pelvis'),footBase=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),toe:point('ball_'+s),q:worldQ('foot_'+s)}]));
const armRest=Object.fromEntries(['r','l'].map(side=>{const a=point('upperarm_'+side),b=point('lowerarm_'+side),c=point('hand_'+side),upper=b.clone().sub(a).normalize(),lower=c.clone().sub(b).normalize();return[side,{upper,lower,normal:new T.Vector3().crossVectors(upper,lower).normalize()}];}));
const gripData=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)))[values.hero].golf;
const armRatio=point('upperarm_r').distanceTo(point('lowerarm_r'))+point('lowerarm_r').distanceTo(point('hand_r'));
const armScale=armRatio/.5567214;
const motionData=golfRecords();
const handFrames=Object.fromEntries(['r','l'].map(side=>[side,palmWeaponBasis(new T.Vector3().fromArray(gripData[side].axis),bones['hand_'+side].worldToLocal(point('middle_01_'+side)))]));
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const rotation=(yaw,bend,side=0)=>new T.Quaternion().setFromAxisAngle(X,bend).multiply(new T.Quaternion().setFromAxisAngle(Z,side)).multiply(new T.Quaternion().setFromAxisAngle(Y,yaw));
function setWorld(name,q){const b=bones[name];b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
function orient(name,q){setWorld(name,q.clone().multiply(rest[name].world));}
function reset(){for(const [n,b]of Object.entries(bones)){b.position.copy(rest[n].p);b.quaternion.copy(rest[n].q);b.scale.copy(rest[n].s);}g.scene.updateMatrixWorld(true);}
function segmentFrame(direction,normal){const x=direction.clone().normalize(),z=normal.clone().normalize(),y=new T.Vector3().crossVectors(z,x).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
function solveArm(side,target,pole,handRotation){
 const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
 const shoulder=point('upperarm_'+side),elbow=point('lowerarm_'+side),wrist=point('hand_'+side),a=elbow.distanceTo(shoulder),b=wrist.distanceTo(elbow);
 const axis=target.clone().sub(shoulder),d=T.MathUtils.clamp(axis.length(),Math.abs(a-b)+.001,(a+b)*(side==='r'?.995:.985));axis.normalize();
 const bend=pole.clone().sub(shoulder).addScaledVector(axis,-pole.clone().sub(shoulder).dot(axis)).normalize();
 const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),wanted=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height);
 const end=shoulder.clone().addScaledVector(axis,d),upperDirection=wanted.clone().sub(shoulder).normalize(),lowerDirection=end.clone().sub(wanted).normalize(),normal=new T.Vector3().crossVectors(upperDirection,lowerDirection).normalize(),base=armRest[side];
 setWorld(upper.name,segmentFrame(upperDirection,normal).multiply(segmentFrame(base.upper,base.normal).invert()).multiply(rest[upper.name].world));
 setWorld(lower.name,segmentFrame(lowerDirection,normal).multiply(segmentFrame(base.lower,base.normal).invert()).multiply(rest[lower.name].world));
 setWorld(hand.name,handRotation);return end.distanceTo(target);
}
function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;}
for(const name of ['Golf_Address','Golf_Swing','Golf_Putt'])if(!doc.animations?.some(a=>a.name===name))throw Error('Input model is missing '+name);
const reports=[];
for(const name of ['Golf_Address','Golf_Swing','Golf_Putt']){
 const spec=motionData[name],duration=spec.duration,count=Math.ceil(duration*120),times=Float32Array.from({length:count+1},(_,i)=>Math.min(i/120,duration));
 g.mixer.stopAllAction();
 const tracks=Object.fromEntries(Object.keys(bones).map(n=>[n,{translation:new Float32Array(times.length*3),rotation:new Float32Array(times.length*4),scale:new Float32Array(times.length*3)}]));
 const shaftFrames={r:null,l:null};
 const report={clip:name,maxArmReachError:0,maxFootReachError:0,maxGripCorrection:0,contactGripCorrection:0};
 for(let i=0;i<times.length;i++){
  reset();const t=times[i]/duration,{body,grip,direction}=nativeGolfPhase(name,t,armScale);
  if(values.hero==='monk'){body.x-=.065*Math.sin(body.chest);body.z-=.065*Math.cos(body.chest);body.y-=.017*Math.max(0,Math.sin(body.chest));}
  const hip=rotation(body.hip,body.hinge,0),chest=rotation(body.chest,body.bend,body.side);
  const pelvis=pelvisOrigin.clone().add(new T.Vector3(body.x,body.y,body.z));bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));
  orient('pelvis',hip);orient('spine_01',hip);orient('spine_02',rotation(T.MathUtils.lerp(body.hip,body.chest,.55),T.MathUtils.lerp(body.hinge,body.bend,.5),body.side*.45));orient('spine_03',chest);orient('neck_01',chest);
  const headFollow=name==='Golf_Swing'?T.MathUtils.smoothstep(t,.625,.85):0;
  orient('Head',rotation(T.MathUtils.lerp(body.chest*.25,body.chest*.88,headFollow),T.MathUtils.lerp(.40,.045,headFollow),body.side*.15));
  for(const side of ['r','l']){
   // Shoulder elevation remains small. Both arms solve below the clavicles.
   const backswing=Math.max(0,body.chest)/1.57,release=Math.max(0,-body.chest)/1.92,protraction=side==='r'?.16+.19*backswing-.25*release:-.12+.20*backswing-.14*release;
   const shoulder=chest.clone().multiply(new T.Quaternion().setFromAxisAngle(Y,protraction));orient('clavicle_'+side,shoulder);
   const base=footBase[side],outward=side==='r'?-.12:.08,turn=side==='l'?-body.heel*.48:0;
   const footQ=rotation(outward+turn,side==='l'?body.heel*.92:0).multiply(base.q),ankle=base.p.clone();ankle.x=side==='r'?-.205:.205;
   if(side==='l'){
    const toe=base.toe.clone().add(new T.Vector3(.205-base.p.x,0,0));const relative=base.toe.clone().sub(base.p).applyQuaternion(base.q.clone().invert()).applyQuaternion(footQ);ankle.copy(toe.sub(relative));
   }
   const footError=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],ankle,footQ,{maxReach:.999});if(footError>report.maxFootReachError){report.maxFootReachError=footError;report.worstFoot={time:times[i],side,ankle:ankle.toArray(),hip:point('thigh_'+side).toArray()};}
  }
  const primary=new T.Vector3(grip.x,grip.z,-grip.y),authoredPrimary=primary.clone(),shaft=new T.Vector3(direction.x,direction.z,-direction.y);
  if(i)for(const side of ['r','l'])alignWeaponShaft(shaftFrames[side],shaft);
  for(let fit=0;fit<6;fit++)for(const side of ['r','l']){
   const center=primary.clone().addScaledVector(shaft,side==='l'?-GOLF_GRIP_SPACING:0),shoulder=point('upperarm_'+side),entry=gripData[side];
   const back=Math.max(0,body.chest)/1.57,finish=Math.max(0,-body.chest)/1.92;
   const clearance=values.hero==='monk'?.60:values.hero==='sora'?.08:0;
   const guide=side==='r'?new T.Vector3(-.18+.06*back,-.38+.18*back,.24+clearance):new T.Vector3(.18-.30*back-.10*finish,-.33+.03*back,.28-.20*back);
   const pole=shoulder.clone().add(guide.applyQuaternion(chest));
   let handQ=new T.Quaternion(),target=center.clone(),error=0;
   for(let iteration=0;iteration<10;iteration++){
    if(!i){const forearm=iteration?point('hand_'+side).sub(point('lowerarm_'+side)).normalize():center.clone().sub(shoulder).normalize();shaftFrames[side]=palmWeaponBasis(shaft,forearm);}
    handQ.copy(shaftFrames[side]).multiply(handFrames[side].clone().invert());
    target.copy(center).sub(new T.Vector3().fromArray(entry.center).applyQuaternion(handQ));
    error=solveArm(side,target,pole,handQ);
    if(error>1e-9){const correction=shoulder.clone().sub(target).normalize().multiplyScalar(error);primary.add(correction);center.add(correction);}
   }
   if(i&&fit===0){
    // Follow forearm pronation gradually; the shaft/forearm projection becomes
    // singular during takeaway, so it must never reset the wrist frame.
    const forearm=point('hand_'+side).sub(point('lowerarm_'+side)).normalize();
    if(Math.abs(forearm.dot(shaft))<.96){
     const wanted=palmWeaponBasis(shaft,forearm),current=Z.clone().applyQuaternion(shaftFrames[side]),goal=Z.clone().applyQuaternion(wanted);
     const turn=Math.atan2(shaft.dot(current.clone().cross(goal)),current.dot(goal));
     shaftFrames[side].premultiply(new T.Quaternion().setFromAxisAngle(shaft,T.MathUtils.clamp(turn,-.035,.035))).normalize();
    }
   }
   if(fit===5&&error>report.maxArmReachError){report.maxArmReachError=error;report.worstArm={time:times[i],side,target:target.toArray(),shoulder:shoulder.toArray()};}
   for(const [n,q]of Object.entries(entry.rotations))bones[n].quaternion.fromArray(q);
  }
  report.maxGripCorrection=Math.max(report.maxGripCorrection,primary.distanceTo(authoredPrimary));
  if(name==='Golf_Swing'&&Math.abs(times[i]-1.4)<.00001)report.contactGripCorrection=primary.distanceTo(authoredPrimary);
  for(const [n,b]of Object.entries(bones)){const out=tracks[n],q=b.quaternion.clone();if(i&&q.dot(new T.Quaternion().fromArray(out.rotation,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);b.position.toArray(out.translation,i*3);q.toArray(out.rotation,i*4);b.scale.toArray(out.scale,i*3);}
 }
 const time=accessor(times,'SCALAR'),animation={name,channels:[],samplers:[],extras:{nativeGolfVersion:2,reviewCandidate:true}};
 const constantTime=accessor(new Float32Array([0,duration]),'SCALAR');
 for(const [n,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
  const stride=property==='rotation'?4:3,bind=(property==='rotation'?rest[n].q:property==='translation'?rest[n].p:rest[n].s).toArray();
  const constant=array.every((v,i)=>Math.abs(v-array[i%stride])<1e-7);
  if(constant&&array.subarray(0,stride).every((v,i)=>Math.abs(v-bind[i])<1e-7))continue;
  const node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);if(node<0)throw Error('Missing '+n);
  animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});
  animation.samplers.push({input:constant?constantTime:time,output:accessor(constant?Float32Array.from([...array.subarray(0,stride),...array.subarray(0,stride)]):array,property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
 }
 doc.animations=doc.animations.map(a=>a.name===name?animation:a);reports.push(report);
}
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));console.log(JSON.stringify({hero:values.hero,output:values.output,reports},null,2));
