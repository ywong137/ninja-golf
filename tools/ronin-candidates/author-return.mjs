#!/usr/bin/env node
// Candidate authoring only. Replace Cut_Return without changing other assets.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {solveLeg} from '../../src/foot-placement.js';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations} from '../native-arm-anatomy.mjs';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
if(values.help){
 console.log('node tools/ronin-candidates/author-return.mjs --input FAMILY.glb --output /tmp/return.glb --record /tmp/return.json\nRequires reviewed Ronin_Ready, Ronin_Heavy_Cleave, and the corrected first cut. Replaces only Cut_Return. Outputs must remain outside public/.');
 process.exit(0);
}
if(!values.input?.endsWith('.glb')||!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --input, --output, and --record. See --help.');
for(const file of [values.output,values.record]){
 if(path.resolve(file).startsWith(path.resolve(new URL('../../public/',import.meta.url).pathname)+path.sep))throw Error('Keep candidate outputs outside public/.');
 if(path.resolve(file)===path.resolve(values.input))throw Error('Do not overwrite the source model.');
}
const profile=JSON.parse(fs.readFileSync(new URL('./return-profile.json',import.meta.url)));
const grips=JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword;
const frames=JSON.parse(fs.readFileSync(new URL('./heavy-cleave-frames.json',import.meta.url)));
const mounted=new T.Quaternion().fromArray(frames.r.frame).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),profile.mountRollDegrees*Math.PI/180)).normalize();
if(mounted.angleTo(new T.Quaternion().fromArray(grips.r.frame).normalize())>1e-6)throw Error('The sword mount differs from the reviewed return contract.');
const g=await loadNativeSkin(values.input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const point=n=>bones[n].getWorldPosition(new T.Vector3()),world=n=>bones[n].getWorldQuaternion(new T.Quaternion());
const rest=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone(),world:world(n)}]));
const pelvisOrigin=point('pelvis');
const anatomy=calibrateArmAnatomy(captureArmPose(bones,'r'));
const neutral=new T.Quaternion().fromArray(frames.r.neutralHandRotation);
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1),D=Math.PI/180;
function setWorld(name,q){const b=bones[name];b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
function orient(name,q){setWorld(name,q.clone().multiply(rest[name].world));}
const rotation=(yaw,bend)=>new T.Quaternion().setFromAxisAngle(Y,yaw).multiply(new T.Quaternion().setFromAxisAngle(X,bend));
const snapshot=()=>Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.toArray(),q:b.quaternion.toArray(),s:b.scale.toArray()}]));
const restore=pose=>{for(const[n,b]of Object.entries(bones)){b.position.fromArray(pose[n].p);b.quaternion.fromArray(pose[n].q);b.scale.fromArray(pose[n].s);}g.scene.updateMatrixWorld(true);};
const readyClip=g.animations.find(c=>c.name==='Ronin_Ready');if(!readyClip)throw Error('Missing reviewed Ronin_Ready.');
if(!g.animations.some(c=>c.name==='Ronin_Cut_Diagonal'))throw Error('Missing corrected Ronin_Cut_Diagonal for the actual combo boundary.');
const readyAction=g.mixer.clipAction(readyClip).play();g.mixer.setTime(0);g.scene.updateMatrixWorld(true);const ready=snapshot();readyAction.stop();
if(profile.supportFrames.length!==Math.round(profile.duration*profile.sampleRate)+1)throw Error('Support frames do not cover the authored duration.');

function primaryArm(v){
 const [az,el,roll,flex,twist,wx,wz]=v,c=anatomy,delta=world('spine_03').multiply(c.bindChestQuaternion.clone().invert());
 const direction=new T.Vector3(Math.sin(az*D)*Math.cos(el*D),Math.sin(el*D),Math.cos(az*D)*Math.cos(el*D)).applyQuaternion(delta);
 const transported=delta.clone().multiply(c.bindUpperArmQuaternion),reference=c.upperAxisLocal.clone().applyQuaternion(transported);
 setWorld('upperarm_r',new T.Quaternion().setFromAxisAngle(direction,roll*D).multiply(new T.Quaternion().setFromUnitVectors(reference,direction)).multiply(transported));
 bones.lowerarm_r.quaternion.copy(new T.Quaternion().setFromAxisAngle(c.hingeAxisLocal,flex*D-c.bindFlexionRadians)).multiply(rest.lowerarm_r.q).multiply(new T.Quaternion().setFromAxisAngle(c.forearmAxisLocal,twist*D));
 bones.lowerarm_r.updateWorldMatrix(false,true);
 const axis=rest.hand_r.p.clone().normalize(),bendX=X.clone().addScaledVector(axis,-X.dot(axis)).normalize(),bendZ=axis.clone().cross(bendX).normalize(),magnitude=Math.hypot(wx,wz);
 bones.hand_r.quaternion.copy(new T.Quaternion().setFromAxisAngle(bendX.multiplyScalar(wx).addScaledVector(bendZ,wz).normalize(),magnitude*D)).multiply(neutral);
 bones.hand_r.updateWorldMatrix(false,true);
 const failures=armAuthoringViolations(measureArmAnatomy(c,captureArmPose(bones,'r')),{maxHingeDeviationDegrees:.1});
 if(failures.length||magnitude>14)throw Error('Primary arm exceeds the reviewed bounds: '+JSON.stringify(failures));
}
function keyAt(t){
 let i=0;while(i<profile.keys.length-2&&t>profile.keys[i+1].t)i++;
 const a=profile.keys[i],b=profile.keys[i+1],w=T.MathUtils.smoothstep(t,a.t,b.t),mix=(x,y)=>T.MathUtils.lerp(x,y,w);
 return{a,b,w,control:a.control.map((v,j)=>mix(v,b.control[j])),hip:mix(a.hip,b.hip),hinge:mix(a.hinge,b.hinge),shift:a.shift.map((v,j)=>mix(v,b.shift[j]))};
}
// Sample an untouched source. Three's mixer does not restore unchanged values
// after a caller edits the live bones, so candidate edits use a separate rig.
const legs=await loadNativeSkin(values.input),legClip=legs.animations.find(c=>c.name==='Ronin_Heavy_Cleave');
if(!legClip)throw Error('Missing reviewed Ronin_Heavy_Cleave foot path.');
const legAction=legs.mixer.clipAction(legClip).setLoop(T.LoopOnce,1);legAction.clampWhenFinished=true;legAction.play();
const legBones={};legs.scene.traverse(b=>{if(b.isBone)legBones[b.name]=b;});
const footTime=t=>t<.30?t:t<.34?.30+(t-.30)/.04*.175:t<=.60?.475:.50+(t-.60)/.25*.26;
const poses=[];
for(const support of profile.supportFrames){
 const t=support.t,{a,b,w,control,hip,hinge,shift}=keyAt(t);restore(ready);
 shift[1]-=profile.bodyCompression*Math.sin(Math.PI*t/profile.duration);
 bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvisOrigin.clone().add(new T.Vector3().fromArray(shift))));
 orient('pelvis',rotation(hip,hinge));orient('spine_01',rotation(hip,hinge));
 // spine_01 also parents the thighs. Apply the separate torso turn above them.
 setWorld('spine_02',new T.Quaternion().fromArray(a.torso).slerp(new T.Quaternion().fromArray(b.torso),w));
 for(const n of ['spine_03','neck_01','clavicle_r','clavicle_l']){
  const anticipation=t>=.18&&t<=.34&&n.startsWith('clavicle')?1-(1-w)**2:w;
  bones[n].quaternion.fromArray(a.local[n]).slerp(new T.Quaternion().fromArray(b.local[n]),anticipation);
 }
 g.scene.updateMatrixWorld(true);setWorld('Head',new T.Quaternion().fromArray(a.head).slerp(new T.Quaternion().fromArray(b.head),w));
 if(t>.60){const lift=profile.recoveryShoulderLiftDegrees*D*Math.sin(Math.PI*T.MathUtils.clamp((t-.60)/.25,0,1)),up=Y.clone().applyQuaternion(world('spine_03').multiply(rest.spine_03.world.clone().invert()));setWorld('clavicle_l',world('clavicle_l').premultiply(new T.Quaternion().setFromAxisAngle(up,-lift)));}
 legs.mixer.setTime(footTime(t));legs.scene.updateMatrixWorld(true);
 // Start each leg solve in its bind frame. Starting in an already solved pose
 // accumulates thigh twist even when its ankle and knee positions match.
 for(const s of ['r','l'])for(const part of ['thigh_','calf_'])bones[part+s].quaternion.copy(rest[part+s].q);
 g.scene.updateMatrixWorld(true);
 for(const s of ['r','l']){
  const foot=legBones['foot_'+s],error=solveLeg(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],foot.getWorldPosition(new T.Vector3()),foot.getWorldQuaternion(new T.Quaternion()),{maxReach:.999});
  if(error>.001)throw Error('Leg cannot reach the authored foot target at '+t+' / '+s);
 }
 primaryArm(control);setWorld('upperarm_l',new T.Quaternion().fromArray(support.upper));setWorld('lowerarm_l',new T.Quaternion().fromArray(support.lower));bones.hand_l.quaternion.fromArray(support.wrist);
 for(const side of ['r','l'])for(const[n,q]of Object.entries(grips[side].rotations))bones[n].quaternion.fromArray(q);
 g.scene.updateMatrixWorld(true);poses.push({t,pose:snapshot()});
}

const raw=fs.readFileSync(values.input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
if(!doc.animations.some(a=>a.name==='Cut_Return'))throw Error('Input must contain the original Cut_Return, not a previously replaced return.');
function accessor(array,type){
 const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}
 const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length});chunks.push(bytes);byteLength+=bytes.length;
 const a={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;
}
const name='Ronin_Cut_Return',duration=profile.duration,animation={name,samplers:[],channels:[],extras:{reviewCandidate:true,nativeReturnVersion:1}},times=accessor(Float32Array.from(poses.map(p=>p.t)),'SCALAR'),constantTime=accessor(new Float32Array([0,duration]),'SCALAR');
for(const bone of Object.keys(poses[0].pose)){
 const node=doc.nodes.findIndex(n=>T.PropertyBinding.sanitizeNodeName(n.name??'')===bone);if(node<0)throw Error('Missing native node '+bone);
 for(const [key,property,type,stride]of [['p','translation','VEC3',3],['q','rotation','VEC4',4],['s','scale','VEC3',3]]){
  const array=new Float32Array(poses.length*stride);let previous;
  poses.forEach((row,i)=>{let v=row.pose[bone][key];if(key==='q'&&previous&&v.reduce((sum,x,j)=>sum+x*previous[j],0)<0)v=v.map(x=>-x);array.set(v,i*stride);previous=v;});
  const constant=array.every((v,i)=>Math.abs(v-array[i%stride])<1e-7);animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});
  animation.samplers.push({input:constant?constantTime:times,output:accessor(constant?Float32Array.from([...array.slice(0,stride),...array.slice(0,stride)]):array,type),interpolation:'LINEAR'});
 }
}
doc.animations=doc.animations.map(a=>a.name==='Cut_Return'?animation:a);doc.buffers[0].byteLength=byteLength;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));

// Derive the runtime grip record from the exported native bones.
const out=await loadNativeSkin(values.output),outBones={};out.scene.traverse(b=>{if(b.isBone)outBones[b.name]=b;});const outAction=out.mixer.clipAction(out.animations.find(a=>a.name===name)).setLoop(T.LoopOnce,1);outAction.clampWhenFinished=true;outAction.play();
const p=n=>outBones[n].getWorldPosition(new T.Vector3()),q=n=>outBones[n].getWorldQuaternion(new T.Quaternion()),source=v=>[v.x,-v.z,v.y];
const records=poses.map(row=>{
 out.mixer.setTime(row.t);out.scene.updateMatrixWorld(true);
 const center=p('hand_r').add(new T.Vector3().fromArray(grips.r.center).applyQuaternion(q('hand_r'))),shaft=new T.Vector3().fromArray(grips.r.axis).applyQuaternion(q('hand_r'));
 const weapon=q('hand_r').multiply(new T.Quaternion().fromArray(grips.r.frame)),roll=new T.Quaternion().setFromUnitVectors(Y,shaft).invert().multiply(weapon);
 return{...profile.recordDefaults,t:row.t/duration,grip:source(center),tip:source(center.clone().addScaledVector(shaft,1.15)),secondaryGrip:source(p('hand_l').add(new T.Vector3().fromArray(grips.l.center).applyQuaternion(q('hand_l')))),elbowR:source(p('lowerarm_r')),elbowL:source(p('lowerarm_l')),roll:2*Math.atan2(roll.y,roll.w),footR:source(p('foot_r')),footL:source(p('foot_l'))};
});
const record={duration,twoHanded:true,pairedGrip:true,gripSpacing:profile.gripSpacing,nativeSampleRate:profile.sampleRate,nativeReturnVersion:1,carryExitDuration:.08,nativeAttachment:true,nativeStanceFeet:true,athleticAttack:true,rootAdvance:0,impacts:[profile.impact],footPlants:profile.footPlants,toePlants:profile.toePlants,poses:records};
fs.writeFileSync(values.record,JSON.stringify({[name]:record}));console.log(JSON.stringify({output:values.output,record:values.record,frames:poses.length,duration,impact:profile.impact}));
