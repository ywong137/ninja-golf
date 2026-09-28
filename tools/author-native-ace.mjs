#!/usr/bin/env node
// Review candidate: neutral wrists and a forward diagonal cutting plane.
// Author one native full-body attack without retargeting a source mannequin.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {acePhase,ACE_DURATION,ACE_IMPACT,ACE_PLANTS,aceHeavyPhase,ACE_HEAVY_DURATION,ACE_HEAVY_IMPACT,ACE_HEAVY_PLANTS} from './native-ace-profile.mjs';
import {createWeapon} from '../src/weapons.js';
const {values}=parseArgs({options:{clip:{type:'string',default:'light'},output:{type:'string'},input:{type:'string'},frames:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-native-ace.mjs --output /tmp/ace-cut.glb --record /tmp/ace-cut.json [--input MODEL.glb] [--frames FRAME.json] [--clip light|heavy]\nLight replaces the opening cut and Ready. Heavy replaces only the heavy cleave; its input must contain Ace_Ready. Other model data remain intact.');process.exit(0);}
if(!['light','heavy'].includes(values.clip))throw Error('Choose --clip light or --clip heavy.');
if(!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --output and --record. See --help.');
if(path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Candidate output must remain outside public/.');
const input=values.input??new URL('../public/models/kaede.glb',import.meta.url),raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
const g=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
const point=n=>bones[n].getWorldPosition(new T.Vector3()),worldQ=n=>bones[n].getWorldQuaternion(new T.Quaternion());
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone(),world:worldQ(n)}]));
const pelvisOrigin=point('pelvis'),footBase=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),q:worldQ('foot_'+s)}]));
const rearToeLocal=bones.foot_r.worldToLocal(point('ball_r'));
const armRest=Object.fromEntries(['r','l'].map(side=>{const a=point('upperarm_'+side),b=point('lowerarm_'+side),c=point('hand_'+side),upper=b.clone().sub(a).normalize(),lower=c.clone().sub(b).normalize();return[side,{a:a.distanceTo(b),b:b.distanceTo(c),upper,lower,normal:new T.Vector3().crossVectors(upper,lower).normalize()}];}));
const profiles=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).kaede.sword;
const frames=JSON.parse(fs.readFileSync(values.frames??new URL('./native-ace-frames.json',import.meta.url)));
const neutral=Object.fromEntries(['r','l'].map(s=>[s,new T.Quaternion().fromArray(frames[s].neutralHandRotation).normalize()]));
for(const side of ['r','l']){
 if(neutral[side].angleTo(rest['hand_'+side].q)>.001)throw Error(`The ${side} neutral hand changed. Recapture native-ace-frames.json.`);
 if(new T.Vector3().fromArray(frames[side].center).distanceTo(new T.Vector3().fromArray(profiles[side].center))>.00001)throw Error(`The ${side} fitted grip changed. Recapture native-ace-frames.json.`);
}
// The cylinder fit supplies the shaft and palm position. Align the blade edge
// with the neutral forearm, instead of rolling the forearm to suit a flat face.
const originalFrame=new T.Quaternion().fromArray(frames.r.frame);
const forearmInWeapon=armRest.r.lower.clone().applyQuaternion(rest.hand_r.world.clone().multiply(originalFrame).invert());
const mountingRoll=Math.atan2(-forearmInWeapon.z,forearmInWeapon.x)+Math.PI;
frames.r.frame=originalFrame.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),mountingRoll)).toArray();

const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0);
const rotation=(yaw,bend)=>new T.Quaternion().setFromAxisAngle(X,bend).multiply(new T.Quaternion().setFromAxisAngle(Y,yaw));
function setWorld(name,q){const b=bones[name];b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
function orient(name,q){setWorld(name,q.clone().multiply(rest[name].world));}
function reset(){for(const [n,b]of Object.entries(bones)){b.position.copy(rest[n].p);b.quaternion.copy(rest[n].q);b.scale.copy(rest[n].s);}g.scene.updateMatrixWorld(true);}
function segmentFrame(direction,normal){const x=direction.clone().normalize(),z=normal.clone().normalize(),y=new T.Vector3().crossVectors(z,x).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));}
const armRolls={};
function poseArm(side,upperDirection,lowerDirection,shaft,rollOverride=null){
 const base=armRest[side],normal=new T.Vector3().crossVectors(upperDirection,lowerDirection).normalize();
 setWorld('upperarm_'+side,segmentFrame(upperDirection,normal).multiply(segmentFrame(base.upper,base.normal).invert()).multiply(rest['upperarm_'+side].world));
 setWorld('lowerarm_'+side,segmentFrame(lowerDirection,normal).multiply(segmentFrame(base.lower,base.normal).invert()).multiply(rest['lowerarm_'+side].world));
 bones['hand_'+side].quaternion.copy(neutral[side]);bones['hand_'+side].updateWorldMatrix(true,true);
 const actual=new T.Vector3().fromArray(profiles[side].axis).applyQuaternion(worldQ('hand_'+side));
 const from=actual.clone().addScaledVector(lowerDirection,-actual.dot(lowerDirection)).normalize(),to=shaft.clone().addScaledVector(lowerDirection,-shaft.dot(lowerDirection)).normalize();
 const roll=rollOverride??Math.atan2(from.clone().cross(to).dot(lowerDirection),from.dot(to));armRolls[side]=roll;
 setWorld('lowerarm_'+side,new T.Quaternion().setFromAxisAngle(lowerDirection,roll).multiply(worldQ('lowerarm_'+side)));

 return bones['hand_'+side].quaternion.angleTo(neutral[side]);
}
const palm=side=>point('hand_'+side).add(new T.Vector3().fromArray(profiles[side].center).applyQuaternion(worldQ('hand_'+side)));

function accessor(array,type){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;}
const isHeavy=values.clip==='heavy',name=isHeavy?'Ace_Heavy_Cleave':'Ace_Cut_Diagonal',replaces=isHeavy?'Fan_Heavy_Cleave':'Fan_Cut_Diagonal',duration=isHeavy?ACE_HEAVY_DURATION:ACE_DURATION,impact=isHeavy?ACE_HEAVY_IMPACT:ACE_IMPACT,plants=isHeavy?ACE_HEAVY_PLANTS:ACE_PLANTS,phaseAt=isHeavy?aceHeavyPhase:acePhase;
if(isHeavy&&!doc.animations.some(a=>a.name==='Ace_Ready'))throw Error('Heavy authoring requires an input with the accepted Ace_Ready clip.');
const count=Math.ceil(duration*240),times=Float32Array.from({length:count+1},(_,i)=>Math.min(i/240,duration));
const tracks=Object.fromEntries(Object.keys(bones).map(n=>[n,{translation:new Float32Array(times.length*3),rotation:new Float32Array(times.length*4),scale:new Float32Array(times.length*3)}]));
const poses=[],report={mountingRoll,mountedFrame:frames.r.frame,maxPrimaryWrist:0,maxCounterbalanceWrist:0,maxFootReachError:0,minBladeHeight:Infinity,frames:[]};
const source=p=>[p.x,-p.z,p.y];
const weapon=createWeapon('jian'),blade=weapon.getObjectByName('Flat steel blade'),bladePoints=blade.geometry.attributes.position;weapon.updateMatrixWorld(true);
const bladeLocal=Array.from({length:bladePoints.count},(_,i)=>blade.localToWorld(new T.Vector3().fromBufferAttribute(bladePoints,i)));
for(let i=0;i<times.length;i++){
 reset();const time=times[i],phase=phaseAt(time),hip=rotation(phase.hip,phase.hinge),chest=rotation(phase.chest,phase.bend);
 const pelvis=pelvisOrigin.clone().add(new T.Vector3(phase.x,phase.y,phase.z));bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));
 orient('pelvis',hip);orient('spine_01',hip);orient('spine_02',rotation(T.MathUtils.lerp(phase.hip,phase.chest,.55),T.MathUtils.lerp(phase.hinge,phase.bend,.5)));orient('spine_03',chest);orient('neck_01',chest);orient('Head',rotation(phase.chest*.35,.03));
 for(const side of ['r','l']){
  orient('clavicle_'+side,chest.clone().multiply(new T.Quaternion().setFromAxisAngle(Y,side==='r'?.10:-.05))); 
  const base=footBase[side],ankle=base.p.clone();ankle.x=side==='r'?-.21:.21+(phase.stepOutward??.035)*phase.step;ankle.z=side==='r'?-.08:.03+(phase.stepDistance??.22)*phase.step;
  if(side==='l'){if(phase.footLift!==undefined)ankle.y+=phase.footLift;else{if(time<.13)ankle.y+=.055*Math.sin(Math.PI*phase.step);if(time>.38)ankle.y+=.04*Math.sin(Math.PI*phase.step);}}
  const footQ=rotation(side==='r'?.08+phase.heel*.85:-.25,side==='r'?phase.heel:0).multiply(base.q);
  if(side==='r'){const planted=rotation(.08,0).multiply(base.q),toe=ankle.clone().add(rearToeLocal.clone().applyQuaternion(planted));ankle.copy(toe).sub(rearToeLocal.clone().applyQuaternion(footQ));}
  const error=solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],ankle,footQ,{maxReach:.999});if(error>report.maxFootReachError){report.maxFootReachError=error;report.worstFoot={time,side};}

 }
 const primaryFlex=poseArm('r',phase.upper,phase.forearm,phase.shaft,phase.rightRoll),primary=palm('r');
 const shaft=new T.Vector3().fromArray(profiles.r.axis).applyQuaternion(worldQ('hand_r'));

 const leftUpper=phase.leftUpper.clone().applyAxisAngle(Y,phase.chest),leftLower=phase.leftLower.clone().applyAxisAngle(Y,phase.chest);
 if(phase.freeArmBend){leftUpper.applyAxisAngle(X,phase.freeArmBend);leftLower.applyAxisAngle(X,phase.freeArmBend);}
 const leftFlex=poseArm('l',leftUpper,leftLower,Y);
 for(const [n,q]of Object.entries(profiles.r.rotations))bones[n].quaternion.fromArray(q);
 for(const [n,q]of Object.entries(profiles.l.rotations))bones[n].quaternion.slerp(new T.Quaternion().fromArray(q),.7);
 const weaponQ=worldQ('hand_r').multiply(new T.Quaternion().fromArray(frames.r.frame)),tip=primary.clone().add(new T.Vector3(0,.855,0).applyQuaternion(weaponQ));
 const weaponOrigin=primary.clone().addScaledVector(Y.clone().applyQuaternion(weaponQ),-.095);
 const bladeMin=Math.min(...bladeLocal.map(p=>p.clone().applyQuaternion(weaponQ).add(weaponOrigin).y));
 report.maxPrimaryWrist=Math.max(report.maxPrimaryWrist,primaryFlex);report.maxCounterbalanceWrist=Math.max(report.maxCounterbalanceWrist,leftFlex);report.minBladeHeight=Math.min(report.minBladeHeight,bladeMin);
 const forearmVector=point('hand_r').sub(point('lowerarm_r')).normalize();
 const frame={time,pelvisTurn:phase.hip,chestTurn:phase.chest,rearHeelAngle:phase.heel,elbow:point('lowerarm_r').toArray(),wristPosition:point('hand_r').toArray(),forearmShaftDegrees:forearmVector.angleTo(shaft)*180/Math.PI,primary:primary.toArray(),counterbalance:point('hand_l').toArray(),shaft:shaft.toArray(),bladeTip:tip.toArray(),wrist:[primaryFlex,leftFlex],bladeMin,forearmRoll:{...armRolls},bladeCenter:primary.clone().add(new T.Vector3(0,.48,0).applyQuaternion(weaponQ)).toArray(),edge:new T.Vector3(1,0,0).applyQuaternion(weaponQ).toArray(),face:new T.Vector3(0,0,1).applyQuaternion(weaponQ).toArray()};report.frames.push(frame);

 const legacyFrame=new T.Quaternion().setFromUnitVectors(Y,shaft),rollDelta=legacyFrame.invert().multiply(weaponQ),roll=2*Math.atan2(rollDelta.y,rollDelta.w);
 poses.push({t:i===0?0:i===times.length-1?1:time/duration,roll,grip:source(primary),tip:source(primary.clone().addScaledVector(shaft,1.15)),hip:phase.hip,chest:phase.chest,bend:phase.bend,pelvisBend:phase.hinge,shift:[phase.x,-phase.z,phase.y],footR:source(point('foot_r').add(new T.Vector3(0,-footBase.r.p.y,0))),footL:source(point('foot_l').add(new T.Vector3(0,-footBase.l.p.y,0))),yawR:.08+phase.heel*.85,yawL:-.25,elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l')),step:0,heel:0});
 for(const [n,b]of Object.entries(bones)){const out=tracks[n],q=b.quaternion.clone();if(i&&q.dot(new T.Quaternion().fromArray(out.rotation,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);b.position.toArray(out.translation,i*3);q.toArray(out.rotation,i*4);b.scale.toArray(out.scale,i*3);}
}
// Compare physical blade travel with its edge and face around the damage event.
report.edgeAlignment=report.frames.filter(f=>f.time>=impact-.025&&f.time<=impact+.025).map(frame=>{
 const i=report.frames.indexOf(frame),before=report.frames[Math.max(0,i-1)],after=report.frames[Math.min(report.frames.length-1,i+1)];
 const velocity=new T.Vector3().fromArray(after.bladeCenter).sub(new T.Vector3().fromArray(before.bladeCenter)).multiplyScalar(1/(after.time-before.time)),direction=velocity.clone().normalize();
 return{time:frame.time,speed:velocity.length(),edge:direction.dot(new T.Vector3().fromArray(frame.edge)),face:direction.dot(new T.Vector3().fromArray(frame.face))};
});
report.forearmRoll=Object.fromEntries(['r','l'].map(side=>[side,{min:Math.min(...report.frames.map(f=>f.forearmRoll[side])),max:Math.max(...report.frames.map(f=>f.forearmRoll[side]))}]));
const timeAccessor=accessor(times,'SCALAR'),constantTime=accessor(new Float32Array([0,duration]),'SCALAR'),animation={name,channels:[],samplers:[],extras:{nativeAceVersion:1,kneeAlignmentVersion:1,reviewCandidate:true}};
for(const [n,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
 const stride=property==='rotation'?4:3,bind=(property==='rotation'?rest[n].q:property==='translation'?rest[n].p:rest[n].s).toArray(),constant=array.every((v,i)=>Math.abs(v-array[i%stride])<1e-7);
 if(constant&&array.subarray(0,stride).every((v,i)=>Math.abs(v-bind[i])<1e-7))continue;
 const node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);if(node<0)throw Error('Missing '+n);
 animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});animation.samplers.push({input:constant?constantTime:timeAccessor,output:accessor(constant?Float32Array.from([...array.subarray(0,stride),...array.subarray(0,stride)]):array,property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
}
if(!doc.animations.some(a=>a.name===replaces||a.name===name))throw Error(`Input has no ${replaces} or ${name}.`);doc.animations=doc.animations.filter(a=>a.name!==name).map(a=>a.name===replaces?animation:a);if(!doc.animations.some(a=>a.name===name))doc.animations.push(animation);
const readyName='Ace_Ready',readyDuration=2;
if(!isHeavy){
const readyTime=accessor(new Float32Array([0,readyDuration]),'SCALAR'),readyAnimation={name:readyName,channels:[],samplers:[],extras:{nativeAceVersion:1,kneeAlignmentVersion:1,reviewCandidate:true}};
for(const [n,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
 const stride=property==='rotation'?4:3,first=Array.from(array.subarray(0,stride)),bind=(property==='rotation'?rest[n].q:property==='translation'?rest[n].p:rest[n].s).toArray();if(first.every((v,i)=>Math.abs(v-bind[i])<1e-7))continue;
 const node=doc.nodes.findIndex(n0=>T.PropertyBinding.sanitizeNodeName(n0.name??'')===n);readyAnimation.channels.push({sampler:readyAnimation.samplers.length,target:{node,path:property}});readyAnimation.samplers.push({input:readyTime,output:accessor(Float32Array.from([...first,...first]),property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
}
doc.animations=doc.animations.filter(a=>a.name!==readyName).map(a=>a.name==='Fan_Ready'?readyAnimation:a);if(!doc.animations.some(a=>a.name===readyName))doc.animations.push(readyAnimation);
}
doc.buffers[0].byteLength=byteLength;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));
const record={duration,twoHanded:false,nativeSampleRate:240,carryExitDuration:.065,nativeAttachment:true,nativeStanceFeet:true,athleticAttack:true,rootAdvance:0,impacts:[impact],footPlants:plants,toePlants:{r:[[0,duration]],l:[]},poses};
fs.writeFileSync(values.record,JSON.stringify({[name]:record}));const readyRecord={duration:readyDuration,twoHanded:false,nativeAttachment:true,nativeStanceFeet:true,nativeAttackReady:true,rootAdvance:0,impacts:[],footPlants:{r:[[0,readyDuration]],l:[[0,readyDuration]]},poses:[{...poses[0],t:0},{...poses[0],t:1}]};fs.writeFileSync(values.record.replace(/\.json$/,'.ready.json'),JSON.stringify({[readyName]:readyRecord}));fs.writeFileSync(values.record.replace(/\.json$/,'.report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,frames:undefined,output:values.output,record:values.record},null,2));
