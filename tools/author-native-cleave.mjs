#!/usr/bin/env node
// Author one native full-body attack without retargeting a source mannequin.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {cleavePhase,CLEAVE_DURATION} from './native-cleave-profile.mjs';
const {values}=parseArgs({options:{output:{type:'string'},input:{type:'string'},frames:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-native-cleave.mjs --output /tmp/ronin-cleave.glb --record /tmp/ronin-cleave.json [--input MODEL.glb] [--frames FRAME.json]\nCreates a review candidate with one native Ronin attack. Other animation and model bytes remain intact.');process.exit(0);}
if(!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --output and --record. See --help.');
if(path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Candidate output must remain outside public/.');
const input=values.input??new URL('../public/models/ronin.glb',import.meta.url),raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
const g=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
const point=n=>bones[n].getWorldPosition(new T.Vector3()),worldQ=n=>bones[n].getWorldQuaternion(new T.Quaternion());
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone(),world:worldQ(n)}]));
const pelvisOrigin=point('pelvis'),footBase=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),toe:point('ball_'+s),q:worldQ('foot_'+s)}]));
const armRest=Object.fromEntries(['r','l'].map(side=>{const a=point('upperarm_'+side),b=point('lowerarm_'+side),c=point('hand_'+side),upper=b.clone().sub(a).normalize(),lower=c.clone().sub(b).normalize();return[side,{a:a.distanceTo(b),b:b.distanceTo(c),upper,lower,normal:new T.Vector3().crossVectors(upper,lower).normalize()}];}));
const profiles=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).ronin.sword;
const frames=JSON.parse(fs.readFileSync(values.frames??new URL('./native-cleave-frames.json',import.meta.url)));
const neutral=Object.fromEntries(['r','l'].map(s=>[s,new T.Quaternion().fromArray(frames[s].neutralHandRotation).normalize()]));
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const rotation=(yaw,bend)=>new T.Quaternion().setFromAxisAngle(X,bend).multiply(new T.Quaternion().setFromAxisAngle(Y,yaw));
function setWorld(name,q){const b=bones[name];b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
function orient(name,q){setWorld(name,q.clone().multiply(rest[name].world));}
function reset(){for(const [n,b]of Object.entries(bones)){b.position.copy(rest[n].p);b.quaternion.copy(rest[n].q);b.scale.copy(rest[n].s);}g.scene.updateMatrixWorld(true);}
function segmentFrame(direction,normal){const x=direction.clone().normalize(),z=normal.clone().normalize(),y=new T.Vector3().crossVectors(z,x).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
function poseArm(side,upperDirection,lowerDirection,shaft,alignWrist=true){
 const base=armRest[side],normal=new T.Vector3().crossVectors(upperDirection,lowerDirection).normalize();
 setWorld('upperarm_'+side,segmentFrame(upperDirection,normal).multiply(segmentFrame(base.upper,base.normal).invert()).multiply(rest['upperarm_'+side].world));
 setWorld('lowerarm_'+side,segmentFrame(lowerDirection,normal).multiply(segmentFrame(base.lower,base.normal).invert()).multiply(rest['lowerarm_'+side].world));
 bones['hand_'+side].quaternion.copy(neutral[side]);bones['hand_'+side].updateWorldMatrix(true,true);
 const actual=new T.Vector3().fromArray(profiles[side].axis).applyQuaternion(worldQ('hand_'+side));
 const from=actual.clone().addScaledVector(lowerDirection,-actual.dot(lowerDirection)).normalize(),to=shaft.clone().addScaledVector(lowerDirection,-shaft.dot(lowerDirection)).normalize();
 const roll=Math.atan2(from.clone().cross(to).dot(lowerDirection),from.dot(to));
 setWorld('lowerarm_'+side,new T.Quaternion().setFromAxisAngle(lowerDirection,roll).multiply(worldQ('lowerarm_'+side)));
 if(alignWrist){const direction=new T.Vector3().fromArray(profiles[side].axis).applyQuaternion(worldQ('hand_'+side));setWorld('hand_'+side,new T.Quaternion().setFromUnitVectors(direction,shaft).multiply(worldQ('hand_'+side)));}
 return bones['hand_'+side].quaternion.angleTo(neutral[side]);
}
const palm=side=>point('hand_'+side).add(new T.Vector3().fromArray(profiles[side].center).applyQuaternion(worldQ('hand_'+side)));
function secondary(center,shaft,swivel,authoredHand){
 const handQ=new T.Quaternion().fromArray(authoredHand).normalize(),currentShaft=new T.Vector3().fromArray(profiles.l.axis).applyQuaternion(handQ);handQ.premultiply(new T.Quaternion().setFromUnitVectors(currentShaft,shaft));
 const shoulder=point('upperarm_l'),base=armRest.l,target=center.clone().sub(new T.Vector3().fromArray(profiles.l.center).applyQuaternion(handQ));
 const axis=target.clone().sub(shoulder),distance=T.MathUtils.clamp(axis.length(),Math.abs(base.a-base.b)+.001,(base.a+base.b)*.9995),error=Math.max(0,axis.length()-distance);axis.normalize();
 const sideAxis=X.clone().addScaledVector(axis,-axis.x).normalize(),crossAxis=new T.Vector3().crossVectors(axis,sideAxis),bend=sideAxis.multiplyScalar(Math.cos(swivel)).addScaledVector(crossAxis,Math.sin(swivel)),along=(base.a**2-base.b**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,base.a**2-along**2));
 const elbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height),end=shoulder.clone().addScaledVector(axis,distance),upperDirection=elbow.clone().sub(shoulder).normalize(),lowerDirection=end.clone().sub(elbow).normalize(),normal=new T.Vector3().crossVectors(upperDirection,lowerDirection).normalize();
 setWorld('upperarm_l',segmentFrame(upperDirection,normal).multiply(segmentFrame(base.upper,base.normal).invert()).multiply(rest.upperarm_l.world));
 const neutralLower=handQ.clone().multiply(neutral.l.clone().invert()),forearmAxis=rest.hand_l.p.clone().normalize().applyQuaternion(neutralLower);
 setWorld('lowerarm_l',new T.Quaternion().setFromUnitVectors(forearmAxis,lowerDirection).multiply(neutralLower));setWorld('hand_l',handQ);
 return{error,flex:bones.hand_l.quaternion.angleTo(neutral.l),gap:palm('l').distanceTo(center)};
}

function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;}
const name='Ronin_Heavy_Cleave',duration=CLEAVE_DURATION,count=Math.ceil(duration*240),times=Float32Array.from({length:count+1},(_,i)=>Math.min(i/240,duration));
const tracks=Object.fromEntries(Object.keys(bones).map(n=>[n,{translation:new Float32Array(times.length*3),rotation:new Float32Array(times.length*4),scale:new Float32Array(times.length*3)}]));
const poses=[],report={maxPrimaryWrist:0,maxSecondaryWrist:0,maxSecondaryGap:0,maxFootReachError:0,minBladeHeight:Infinity,frames:[]};
const source=p=>[p.x,-p.z,p.y];
for(let i=0;i<times.length;i++){
 reset();const time=times[i],phase=cleavePhase(time),hip=rotation(phase.hip,phase.hinge),chest=rotation(phase.chest,phase.bend);
 const pelvis=pelvisOrigin.clone().add(new T.Vector3(phase.x,phase.y,phase.z));bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));
 orient('pelvis',hip);orient('spine_01',hip);orient('spine_02',rotation(T.MathUtils.lerp(phase.hip,phase.chest,.55),T.MathUtils.lerp(phase.hinge,phase.bend,.5)));orient('spine_03',chest);orient('neck_01',chest);orient('Head',rotation(phase.chest*.35,.03));
 for(const side of ['r','l']){
  orient('clavicle_'+side,chest.clone().multiply(new T.Quaternion().setFromAxisAngle(Y,side==='r'?phase.protraction:-phase.protraction))); 
  const base=footBase[side],ankle=base.p.clone();ankle.x=side==='r'?-.23-.045*phase.step:.25;ankle.z=side==='r'?.29*phase.step:-.07;
  if(side==='r'&&time<.30)ankle.y+=.06*Math.sin(Math.PI*phase.step);if(side==='r'&&time>.54)ankle.y+=.045*Math.sin(Math.PI*phase.step);
  // The native left shoe already toes out14.3°. Cancel that bind angle for the rear support.
  const footQ=rotation(side==='r'?-.08:-.25,0).multiply(base.q);const error=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],ankle,footQ,{maxReach:.999});if(error>report.maxFootReachError){report.maxFootReachError=error;report.worstFoot={time,side};}
 }
 const shaft=phase.shaft,guide=phase.forearm.clone().applyAxisAngle(Y,phase.chest),perpendicular=guide.addScaledVector(shaft,-guide.dot(shaft)).normalize(),cosine=Math.cos(75*Math.PI/180-phase.release),lower=perpendicular.multiplyScalar(Math.sqrt(1-cosine*cosine)).addScaledVector(shaft,cosine);
 const projectedX=X.clone().addScaledVector(lower,-lower.x),inward=T.MathUtils.clamp((phase.inward-lower.x*Math.cos(phase.elbow))/(Math.sin(phase.elbow)*projectedX.length()),-.95,.95),sideward=projectedX.normalize(),down=new T.Vector3().crossVectors(lower,sideward).normalize();if(down.y>0)down.negate();
 const bendPlane=sideward.multiplyScalar(inward).addScaledVector(down,Math.sqrt(1-inward*inward)),upper=lower.clone().multiplyScalar(Math.cos(phase.elbow)).addScaledVector(bendPlane,Math.sin(phase.elbow));
 const primaryFlex=poseArm('r',upper,lower,shaft),primary=palm('r');

 const secondaryReport=secondary(primary.clone().addScaledVector(shaft,-.09),shaft,phase.leftSwivel,phase.leftHand);
 for(const side of ['r','l'])for(const [n,q]of Object.entries(profiles[side].rotations))bones[n].quaternion.fromArray(q);
 const weaponQ=worldQ('hand_r').multiply(new T.Quaternion().fromArray(frames.r.frame)),tip=primary.clone().add(new T.Vector3(.16,1.475,0).applyQuaternion(weaponQ));
 report.maxPrimaryWrist=Math.max(report.maxPrimaryWrist,primaryFlex);report.maxSecondaryWrist=Math.max(report.maxSecondaryWrist,secondaryReport.flex);report.maxSecondaryGap=Math.max(report.maxSecondaryGap,secondaryReport.gap);report.minBladeHeight=Math.min(report.minBladeHeight,tip.y,primary.y+.075*shaft.y);
 const frame={time,primary:primary.toArray(),secondary:palm('l').toArray(),shaft:shaft.toArray(),bladeTip:tip.toArray(),wrist:[primaryFlex,secondaryReport.flex],secondaryGap:secondaryReport.gap,secondaryReach:secondaryReport.error};report.frames.push(frame);
 const legacyFrame=new T.Quaternion().setFromUnitVectors(Y,shaft),rollDelta=legacyFrame.invert().multiply(weaponQ),roll=2*Math.atan2(rollDelta.y,rollDelta.w);
 poses.push({t:i===0?0:i===times.length-1?1:time/duration,roll,grip:source(primary),tip:source(primary.clone().addScaledVector(shaft,1.15)),secondaryGrip:source(palm('l')),hip:phase.hip,chest:phase.chest,bend:phase.bend,pelvisBend:phase.hinge,shift:[phase.x,-phase.z,phase.y],footR:source(point('foot_r').add(new T.Vector3(0,-footBase.r.p.y,0))),footL:source(point('foot_l').add(new T.Vector3(0,-footBase.l.p.y,0))),yawR:-.08,yawL:-.25,elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l')),step:0,heel:0});
 for(const [n,b]of Object.entries(bones)){const out=tracks[n],q=b.quaternion.clone();if(i&&q.dot(new T.Quaternion().fromArray(out.rotation,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);b.position.toArray(out.translation,i*3);q.toArray(out.rotation,i*4);b.scale.toArray(out.scale,i*3);}
}
const timeAccessor=accessor(times,'SCALAR'),constantTime=accessor(new Float32Array([0,duration]),'SCALAR'),animation={name,channels:[],samplers:[],extras:{nativeCleaveVersion:1,reviewCandidate:true}};
for(const [n,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
 const stride=property==='rotation'?4:3,bind=(property==='rotation'?rest[n].q:property==='translation'?rest[n].p:rest[n].s).toArray(),constant=array.every((v,i)=>Math.abs(v-array[i%stride])<1e-7);
 if(constant&&array.subarray(0,stride).every((v,i)=>Math.abs(v-bind[i])<1e-7))continue;
 const node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);if(node<0)throw Error('Missing '+n);
 animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});animation.samplers.push({input:constant?constantTime:timeAccessor,output:accessor(constant?Float32Array.from([...array.subarray(0,stride),...array.subarray(0,stride)]):array,property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
}
if(!doc.animations.some(a=>a.name==='Heavy_Cleave'||a.name===name))throw Error('Input has no Ronin heavy cleave.');doc.animations=doc.animations.filter(a=>a.name!==name).map(a=>a.name==='Heavy_Cleave'?animation:a);if(!doc.animations.some(a=>a.name===name))doc.animations.push(animation);
const readyName='Ronin_Ready',readyDuration=2,readyTime=accessor(new Float32Array([0,readyDuration]),'SCALAR'),readyAnimation={name:readyName,channels:[],samplers:[],extras:{nativeCleaveVersion:1,reviewCandidate:true}};
for(const [n,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
 const stride=property==='rotation'?4:3,first=Array.from(array.subarray(0,stride)),bind=(property==='rotation'?rest[n].q:property==='translation'?rest[n].p:rest[n].s).toArray();if(first.every((v,i)=>Math.abs(v-bind[i])<1e-7))continue;
 const node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);readyAnimation.channels.push({sampler:readyAnimation.samplers.length,target:{node,path:property}});readyAnimation.samplers.push({input:readyTime,output:accessor(Float32Array.from([...first,...first]),property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
}
doc.animations=doc.animations.filter(a=>a.name!==readyName).map(a=>a.name==='Ready'?readyAnimation:a);if(!doc.animations.some(a=>a.name===readyName))doc.animations.push(readyAnimation);
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));
const record={duration,twoHanded:true,gripSpacing:.09,nativeSampleRate:240,carryExitDuration:.08,nativeAttachment:true,nativeStanceFeet:true,athleticAttack:true,rootAdvance:0,impacts:[.36],footPlants:{r:[[0,.16],[.30,.54],[.755,.76]],l:[[0,.76]]},poses};
fs.writeFileSync(values.record,JSON.stringify({[name]:record}));const readyRecord={duration:readyDuration,twoHanded:true,gripSpacing:.09,nativeAttachment:true,nativeStanceFeet:true,nativeAttackReady:true,rootAdvance:0,impacts:[],footPlants:{r:[[0,readyDuration]],l:[[0,readyDuration]]},poses:[{...poses[0],t:0},{...poses[0],t:1}]};fs.writeFileSync(values.record.replace(/\.json$/,'.ready.json'),JSON.stringify({[readyName]:readyRecord}));fs.writeFileSync(values.record.replace(/\.json$/,'.report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,frames:undefined,output:values.output,record:values.record},null,2));
