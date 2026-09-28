#!/usr/bin/env node
// Author one native full-body attack without retargeting a source mannequin.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {solveLeg} from '../../src/foot-placement.js';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations} from '../native-arm-anatomy.mjs';
import {cleavePhase,CLEAVE_DURATION,CLEAVE_MOUNT_ROLL} from './heavy-cleave-profile.mjs';
const {values}=parseArgs({options:{output:{type:'string'},input:{type:'string'},frames:{type:'string'},grips:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/author-heavy-cleave.mjs --output /tmp/ronin-cleave.glb --record /tmp/ronin-cleave.json [--input MODEL.glb] [--frames FRAME.json] [--grips GRIPS.json]\nCreates a review candidate with one native Ronin attack. Other animation and model bytes remain intact.');process.exit(0);}
if(!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --output and --record. See --help.');
if(path.resolve(values.output).startsWith(new URL('../../public/',import.meta.url).pathname))throw Error('Candidate output must remain outside public/.');
const input=values.input??new URL('../../public/models/ronin.glb',import.meta.url),raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
const g=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
const point=n=>bones[n].getWorldPosition(new T.Vector3()),worldQ=n=>bones[n].getWorldQuaternion(new T.Quaternion());
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone(),world:worldQ(n)}]));
const pelvisOrigin=point('pelvis'),footBase=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),toe:point('ball_'+s),q:worldQ('foot_'+s)}]));
const armRest=Object.fromEntries(['r','l'].map(side=>{const a=point('upperarm_'+side),b=point('lowerarm_'+side),c=point('hand_'+side),upper=b.clone().sub(a).normalize(),lower=c.clone().sub(b).normalize();return[side,{a:a.distanceTo(b),b:b.distanceTo(c),upper,lower,normal:new T.Vector3().crossVectors(upper,lower).normalize()}];}));
const anatomy=Object.fromEntries(['r','l'].map(side=>[side,calibrateArmAnatomy(captureArmPose(bones,side))]));
const profiles=JSON.parse(fs.readFileSync(values.grips??new URL('./sword-grips.json',import.meta.url))).ronin.sword;
const frames=JSON.parse(fs.readFileSync(values.frames??new URL('./heavy-cleave-frames.json',import.meta.url)));
frames.r.frame=new T.Quaternion().fromArray(frames.r.frame).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),CLEAVE_MOUNT_ROLL)).toArray();
const neutral=Object.fromEntries(['r','l'].map(s=>[s,new T.Quaternion().fromArray(frames[s].neutralHandRotation).normalize()]));
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const rotation=(yaw,bend)=>new T.Quaternion().setFromAxisAngle(Y,yaw).multiply(new T.Quaternion().setFromAxisAngle(X,bend));
function setWorld(name,q){const b=bones[name];b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
function orient(name,q){setWorld(name,q.clone().multiply(rest[name].world));}
function reset(){for(const [n,b]of Object.entries(bones)){b.position.copy(rest[n].p);b.quaternion.copy(rest[n].q);b.scale.copy(rest[n].s);}g.scene.updateMatrixWorld(true);}
function segmentFrame(direction,normal){const x=direction.clone().normalize(),z=normal.clone().normalize(),y=new T.Vector3().crossVectors(z,x).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
const D=Math.PI/180;
const palm=side=>point('hand_'+side).add(new T.Vector3().fromArray(profiles[side].center).applyQuaternion(worldQ('hand_'+side)));
function primaryArm(v){
 const [az,el,roll,flex,twist,wx,wz]=v,c=anatomy.r,cd=worldQ('spine_03').multiply(c.bindChestQuaternion.clone().invert());
 const direction=new T.Vector3(Math.sin(az*D)*Math.cos(el*D),Math.sin(el*D),Math.cos(az*D)*Math.cos(el*D)).applyQuaternion(cd);
 const transported=cd.clone().multiply(c.bindUpperArmQuaternion),reference=c.upperAxisLocal.clone().applyQuaternion(transported);
 setWorld('upperarm_r',new T.Quaternion().setFromAxisAngle(direction,roll*D).multiply(new T.Quaternion().setFromUnitVectors(reference,direction)).multiply(transported));
 bones.lowerarm_r.quaternion.copy(new T.Quaternion().setFromAxisAngle(c.hingeAxisLocal,flex*D-c.bindFlexionRadians)).multiply(rest.lowerarm_r.q).multiply(new T.Quaternion().setFromAxisAngle(c.forearmAxisLocal,twist*D));bones.lowerarm_r.updateWorldMatrix(false,true);
 const fa=rest.hand_r.p.clone().normalize(),bx=X.clone().addScaledVector(fa,-X.dot(fa)).normalize(),bz=fa.clone().cross(bx).normalize(),mag=Math.hypot(wx,wz),axis=bx.multiplyScalar(wx).addScaledVector(bz,wz).normalize();
 bones.hand_r.quaternion.copy(new T.Quaternion().setFromAxisAngle(axis,mag*D)).multiply(neutral.r);bones.hand_r.updateWorldMatrix(false,true);
 const measured=measureArmAnatomy(c,captureArmPose(bones,'r'));const violations=armAuthoringViolations(measured,{maxHingeDeviationDegrees:.1});if(violations.length||mag>14)throw Error('Primary arm exceeds its native bounds: '+JSON.stringify(violations));
 return{p:palm('r'),shaft:new T.Vector3().fromArray(profiles.r.axis).applyQuaternion(worldQ('hand_r')),wrist:mag};
}
let previousSecondary=null,initialSecondary=null;
function secondary(center,shaft,time,elbowGuide){
 const shoulder=point('upperarm_l'),base=armRest.l,chestQ=worldQ('spine_03'),front=Z.clone().applyQuaternion(chestQ.clone().multiply(rest.spine_03.world.clone().invert()));
 const axis=new T.Vector3().fromArray(profiles.l.axis).normalize(),q0=new T.Quaternion().setFromUnitVectors(axis,shaft),offset=center.clone().sub(shoulder);
 const forearmAxis=rest.hand_l.p.clone().normalize(),bendX=X.clone().addScaledVector(forearmAxis,-X.dot(forearmAxis)).normalize(),bendZ=forearmAxis.clone().cross(bendX).normalize();
 const evaluate=(wx,wz)=>{
  const magnitude=Math.hypot(wx,wz);if(magnitude>13.9)return null;
  const wristAxis=bendX.clone().multiplyScalar(wx).addScaledVector(bendZ,wz).normalize(),wristQ=new T.Quaternion().setFromAxisAngle(wristAxis,magnitude*Math.PI/180).multiply(neutral.l);
  const handToElbow=new T.Vector3().fromArray(profiles.l.center).add(rest.hand_l.p.clone().applyQuaternion(wristQ.clone().invert()));
  const vector=handToElbow.clone().applyQuaternion(q0),parallel=shaft.clone().multiplyScalar(vector.dot(shaft)),u=vector.clone().sub(parallel),v=new T.Vector3().crossVectors(shaft,u);
  const aa=offset.dot(u),bb=offset.dot(v),cc=(offset.lengthSq()+vector.lengthSq()-base.a**2)/2-offset.dot(parallel),radius=Math.hypot(aa,bb);
  if(Math.abs(cc)>radius+1e-8)return null;
  const phase=Math.atan2(bb,aa),spread=Math.acos(T.MathUtils.clamp(cc/radius,-1,1));let best;
  for(const angle of [phase-spread,phase+spread]){
   const handQ=new T.Quaternion().setFromAxisAngle(shaft,angle).multiply(q0),elbow=center.clone().sub(handToElbow.clone().applyQuaternion(handQ));
   const wrist=center.clone().sub(new T.Vector3().fromArray(profiles.l.center).applyQuaternion(handQ));
   const upper=elbow.clone().sub(shoulder).normalize(),lower=wrist.clone().sub(elbow).normalize(),normal=new T.Vector3().crossVectors(upper,lower).normalize();
   const upperQ=segmentFrame(upper,normal).multiply(segmentFrame(base.upper,base.normal).invert()).multiply(rest.upperarm_l.world),lowerQ=handQ.clone().multiply(wristQ.clone().invert());
   const measured=measureArmAnatomy(anatomy.l,{shoulder,elbow,wrist,upperArmQuaternion:upperQ,forearmQuaternion:lowerQ,chestQuaternion:chestQ});
   const violations=armAuthoringViolations(measured,{maxHingeDeviationDegrees:.1,maxHumeralRollDegrees:69.5,maxForearmTwistDegrees:69.5});
   let cost=violations.reduce((sum,x)=>sum+1e10+(Math.abs(x.value)-x.limit)**2*1e9,0)+measured.humeralRollDegrees**2+measured.forearmTwistDegrees**2+15*magnitude**2+1e8*Math.max(0,.150-elbow.clone().sub(shoulder).dot(front))**2;
   if(elbowGuide)cost+=1e8*elbow.distanceToSquared(new T.Vector3().fromArray(elbowGuide));
   if(previousSecondary)cost+=150*(upperQ.angleTo(previousSecondary.upperQ)**2+lowerQ.angleTo(previousSecondary.lowerQ)**2+handQ.angleTo(previousSecondary.handQ)**2)*(180/Math.PI)**2;
   if(!best||cost<best.cost)best={cost,upperQ,lowerQ,handQ,wristQ,measured,wx,wz};
  }
  return best;
 };
 let best=null;const attempt=(x,z)=>{const result=evaluate(x,z);if(result&&(!best||result.cost<best.cost))best=result;};
 if(previousSecondary)attempt(previousSecondary.wx,previousSecondary.wz);
 attempt(0,0);for(const radius of [4,8,12,13.85])for(let k=0;k<24;k++)attempt(radius*Math.cos(k*Math.PI/12),radius*Math.sin(k*Math.PI/12));
 if(!best)throw Error('The secondary hand cannot reach the fixed handle with a wrist under 14 degrees.');
 for(const step of [2,1,.5,.2,.05])for(let pass=0;pass<4;pass++){const {wx,wz}=best;for(const [x,z]of [[step,0],[-step,0],[0,step],[0,-step],[step,step],[-step,step],[step,-step],[-step,-step]])attempt(wx+x,wz+z);}
 // Return the same fitted grip to Ready. Blend wrist parameters, then solve
 // the exact handle constraint again; quaternion blending would open the grip.
 if(initialSecondary&&time>=.58){
  const u=T.MathUtils.smoothstep(time,.58,.76),target=evaluate(T.MathUtils.lerp(best.wx,initialSecondary.wx,u),T.MathUtils.lerp(best.wz,initialSecondary.wz,u));
  if(target&&armAuthoringViolations(target.measured,{maxHingeDeviationDegrees:.1,maxHumeralRollDegrees:69.5,maxForearmTwistDegrees:69.5}).length===0)best=target;
 }
 const violations=armAuthoringViolations(best.measured,{maxHingeDeviationDegrees:.1});
 if(violations.length)throw Error(`The secondary grip exceeds native arm limits at ${time.toFixed(4)} seconds: ${violations.map(v=>v.message).join(' ')}`);
 if(!initialSecondary)initialSecondary=best;
 setWorld('upperarm_l',best.upperQ);setWorld('lowerarm_l',best.lowerQ);bones.hand_l.quaternion.copy(best.wristQ);bones.hand_l.updateWorldMatrix(true,true);previousSecondary=best;
 return{error:0,flex:best.wristQ.angleTo(neutral.l),gap:palm('l').distanceTo(center),anatomy:best.measured};
}

function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;}
const name='Ronin_Heavy_Cleave',duration=CLEAVE_DURATION,count=Math.ceil(duration*240),times=Float32Array.from({length:count+1},(_,i)=>Math.min(i/240,duration));
const tracks=Object.fromEntries(Object.keys(bones).map(n=>[n,{translation:new Float32Array(times.length*3),rotation:new Float32Array(times.length*4),scale:new Float32Array(times.length*3)}]));
const poses=[],report={mountingRoll:CLEAVE_MOUNT_ROLL,mountedFrame:frames.r.frame,maxPrimaryWrist:0,maxSecondaryWrist:0,maxSecondaryGap:0,maxFootReachError:0,minBladeHeight:Infinity,frames:[]};
const source=p=>[p.x,-p.z,p.y];
for(let i=0;i<times.length;i++){
 reset();const time=times[i],phase=cleavePhase(time),hip=rotation(phase.hip,phase.hinge),chest=rotation(phase.chest,phase.bend);
 const pelvis=pelvisOrigin.clone().add(new T.Vector3(phase.x,phase.y,phase.z));bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));
 orient('pelvis',hip);orient('spine_01',hip);orient('spine_02',rotation(T.MathUtils.lerp(phase.hip,phase.chest,.55),T.MathUtils.lerp(phase.hinge,phase.bend,.5)));orient('spine_03',chest);orient('neck_01',rotation(phase.chest*.7,phase.bend*.65));orient('Head',rotation(phase.chest*.35,phase.bend*.3));
 for(const side of ['r','l']){
  const shoulderLift=.10+Math.max(0,Math.sin(phase.control[1]*D))*.35;orient('clavicle_'+side,chest.clone().multiply(new T.Quaternion().setFromAxisAngle(Y,side==='r'?phase.protraction+.15:-phase.protraction-.15)).multiply(new T.Quaternion().setFromAxisAngle(Z,side==='r'?-shoulderLift:shoulderLift)));
  const base=footBase[side],ankle=base.p.clone();ankle.x=side==='r'?-.23-.035*phase.step:.25;ankle.z=side==='r'?.50*phase.step:-.10;
  if(side==='r'&&time<.30)ankle.y+=.06*Math.sin(Math.PI*phase.step);if(side==='r'&&time>.54)ankle.y+=.045*Math.sin(Math.PI*phase.step);
  // The native left shoe already toes out14.3°. Cancel that bind angle for the rear support.
  const footQ=rotation(side==='r'?-.08:-.25+.15*phase.heel,side==='l'?.25*phase.heel:0).multiply(base.q);if(side==='l'){const plantedToe=ankle.clone().add(rest.ball_l.p.clone().applyQuaternion(rotation(-.25,0).multiply(base.q)));ankle.copy(plantedToe).sub(rest.ball_l.p.clone().applyQuaternion(footQ));}const error=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],ankle,footQ,{maxReach:.999});if(error>report.maxFootReachError){report.maxFootReachError=error;report.worstFoot={time,side};}
 }
 const primaryState=primaryArm(phase.control),shaft=primaryState.shaft,primary=primaryState.p,primaryFlex=primaryState.wrist*D;

 const secondaryReport=secondary(primary.clone().addScaledVector(shaft,-.15),shaft,time,phase.secondaryElbow);
 for(const side of ['r','l'])for(const [n,q]of Object.entries(profiles[side].rotations))bones[n].quaternion.fromArray(q);
 const weaponQ=worldQ('hand_r').multiply(new T.Quaternion().fromArray(frames.r.frame)),tip=primary.clone().add(new T.Vector3(.16,1.475,0).applyQuaternion(weaponQ));
 report.maxPrimaryWrist=Math.max(report.maxPrimaryWrist,primaryFlex);report.maxSecondaryWrist=Math.max(report.maxSecondaryWrist,secondaryReport.flex);report.maxSecondaryGap=Math.max(report.maxSecondaryGap,secondaryReport.gap);report.minBladeHeight=Math.min(report.minBladeHeight,tip.y,primary.y+.075*shaft.y);
 const frame={time,controls:phase.control,pelvis:point('pelvis').toArray(),chest:worldQ('spine_03').toArray(),elbows:{r:point('lowerarm_r').toArray(),l:point('lowerarm_l').toArray()},feet:Object.fromEntries(['r','l'].map(side=>[side,{ankle:point('foot_'+side).toArray(),toe:point('ball_'+side).toArray()}])),weaponQuaternion:weaponQ.toArray(),primary:primary.toArray(),secondary:palm('l').toArray(),shaft:shaft.toArray(),bladeTip:tip.toArray(),wrist:[primaryFlex,secondaryReport.flex],armAnatomy:Object.fromEntries(['r','l'].map(side=>[side,measureArmAnatomy(anatomy[side],captureArmPose(bones,side))])),secondaryGap:secondaryReport.gap,secondaryReach:secondaryReport.error};report.frames.push(frame);
 const legacyFrame=new T.Quaternion().setFromUnitVectors(Y,shaft),rollDelta=legacyFrame.invert().multiply(weaponQ),roll=2*Math.atan2(rollDelta.y,rollDelta.w);
 poses.push({t:i===0?0:i===times.length-1?1:time/duration,roll,grip:source(primary),tip:source(primary.clone().addScaledVector(shaft,1.15)),secondaryGrip:source(palm('l')),hip:phase.hip,chest:phase.chest,bend:phase.bend,pelvisBend:phase.hinge,shift:[phase.x,-phase.z,phase.y],footR:source(point('foot_r').add(new T.Vector3(0,-footBase.r.p.y,0))),footL:source(point('foot_l').add(new T.Vector3(0,-footBase.l.p.y,0))),yawR:-.08,yawL:-.25+.15*phase.heel,elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l')),step:0,heel:phase.heel});
 for(const [n,b]of Object.entries(bones)){const out=tracks[n],q=b.quaternion.clone();if(i&&q.dot(new T.Quaternion().fromArray(out.rotation,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);b.position.toArray(out.translation,i*3);q.toArray(out.rotation,i*4);b.scale.toArray(out.scale,i*3);}
}
report.edgeAlignment=report.frames.filter(f=>f.time>=.335&&f.time<=.385).map(f=>{
 const index=report.frames.indexOf(f),sample=index=>{const frame=report.frames[index];return new T.Vector3().fromArray(frame.primary).add(new T.Vector3(.08,.80,0).applyQuaternion(new T.Quaternion().fromArray(frame.weaponQuaternion)));};
 const direction=sample(Math.min(report.frames.length-1,index+1)).sub(sample(Math.max(0,index-1))).normalize(),q=new T.Quaternion().fromArray(f.weaponQuaternion);
 return{time:f.time,edge:direction.dot(new T.Vector3(1,0,0).applyQuaternion(q)),face:direction.dot(new T.Vector3(0,0,1).applyQuaternion(q))};
});
const timeAccessor=accessor(times,'SCALAR'),constantTime=accessor(new Float32Array([0,duration]),'SCALAR'),animation={name,channels:[],samplers:[],extras:{nativeCleaveVersion:2,reviewCandidate:true}};
for(const [n,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
 const stride=property==='rotation'?4:3,bind=(property==='rotation'?rest[n].q:property==='translation'?rest[n].p:rest[n].s).toArray(),constant=array.every((v,i)=>Math.abs(v-array[i%stride])<1e-7);
 if(constant&&array.subarray(0,stride).every((v,i)=>Math.abs(v-bind[i])<1e-7))continue;
 const node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);if(node<0)throw Error('Missing '+n);
 animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});animation.samplers.push({input:constant?constantTime:timeAccessor,output:accessor(constant?Float32Array.from([...array.subarray(0,stride),...array.subarray(0,stride)]):array,property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
}
if(!doc.animations.some(a=>a.name==='Heavy_Cleave'||a.name===name))throw Error('Input has no Ronin heavy cleave.');doc.animations=doc.animations.filter(a=>a.name!==name).map(a=>a.name==='Heavy_Cleave'?animation:a);if(!doc.animations.some(a=>a.name===name))doc.animations.push(animation);
const readyName='Ronin_Ready',readyDuration=2,readyTime=accessor(new Float32Array([0,readyDuration]),'SCALAR'),readyAnimation={name:readyName,channels:[],samplers:[],extras:{nativeCleaveVersion:2,reviewCandidate:true}};
for(const [n,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
 const stride=property==='rotation'?4:3,first=Array.from(array.subarray(0,stride)),bind=(property==='rotation'?rest[n].q:property==='translation'?rest[n].p:rest[n].s).toArray();if(first.every((v,i)=>Math.abs(v-bind[i])<1e-7))continue;
 const node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);readyAnimation.channels.push({sampler:readyAnimation.samplers.length,target:{node,path:property}});readyAnimation.samplers.push({input:readyTime,output:accessor(Float32Array.from([...first,...first]),property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
}
doc.animations=doc.animations.filter(a=>a.name!==readyName).map(a=>a.name==='Ready'?readyAnimation:a);if(!doc.animations.some(a=>a.name===readyName))doc.animations.push(readyAnimation);
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));
const record={duration,twoHanded:true,gripSpacing:.15,nativeSampleRate:240,nativeCleaveVersion:2,carryExitDuration:.08,nativeAttachment:true,nativeStanceFeet:true,athleticAttack:true,rootAdvance:0,impacts:[.36],footPlants:{r:[[0,.16],[.30,.54],[.755,.76]],l:[[0,.16],[.65,.76]]},toePlants:{l:[[.16,.65]]},poses};
fs.writeFileSync(values.record,JSON.stringify({[name]:record}));const readyRecord={duration:readyDuration,twoHanded:true,gripSpacing:.15,nativeAttachment:true,nativeStanceFeet:true,nativeAttackReady:true,rootAdvance:0,impacts:[],footPlants:{r:[[0,readyDuration]],l:[[0,readyDuration]]},poses:[{...poses[0],t:0},{...poses[0],t:1}]};fs.writeFileSync(values.record.replace(/\.json$/,'.ready.json'),JSON.stringify({[readyName]:readyRecord}));fs.writeFileSync(values.record.replace(/\.json$/,'.report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,frames:undefined,output:values.output,record:values.record},null,2));
