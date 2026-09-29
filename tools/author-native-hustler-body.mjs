#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {solveLeg} from '../src/foot-placement.js';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';
import {HUSTLER_BODY_CLIP as name,HUSTLER_BODY_DURATION as duration,HUSTLER_BODY_IMPACT as impact,HUSTLER_BODY_CARRY_EXIT,HUSTLER_BODY_KEYS,HUSTLER_BODY_PLANTS,HUSTLER_BODY_TOES,hustlerHeavyBody,hustlerHeavyArmTime} from './native-hustler-body-profile.mjs';

const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},output:{type:'string'},'output-record':{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-native-hustler-body.mjs --model BASE.glb --record MOTIONS.json --output /tmp/CANDIDATE.glb --output-record /tmp/CLIP.json\nRebuilds only the Hustler heavy cleave. Uses the source arm choreography, a new body and foot sequence, and a longer recovery. Preserves all other clips, geometry, and materials. Outputs one motion record for candidate routing.');process.exit(0);}
for(const key of ['model','record','output','output-record'])if(!values[key])throw Error('Supply --'+key+'. See --help.');
if(!values['output-record'].endsWith('.json'))throw Error('--output-record must end in .json.');
for(const key of ['output','output-record']){
 if(path.resolve(values[key]).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Write candidates outside public/.');
 if(['model','record'].some(input=>path.resolve(values[input])===path.resolve(values[key])))throw Error('Keep candidate outputs separate from their source files.');
}
if(path.resolve(values.output)===path.resolve(values['output-record']))throw Error('Use separate model and motion record output paths.');
const raw=fs.readFileSync(values.model),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),original=doc.animations.find(a=>a.name===name),chunks=[raw.subarray(28+size)];let length=chunks[0].length;
if(original?.extras?.nativeHustlerBodyVersion)throw Error('Use the unmodified baseline model, not an already baked candidate.');
const records=JSON.parse(fs.readFileSync(values.record)),spec=records[name],readySpec=records.Ring_Ready;
assert.ok(spec&&readySpec,'The source record needs Ring_Ready and '+name);
const g=await loadNativeSkin(values.model),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
// Keep source playback untouched. AnimationMixer can skip writing held keys;
// applying offsets to that same rig would accumulate those offsets each frame.
const sourceRig=await loadNativeSkin(values.model),sourceBones={};sourceRig.scene.traverse(b=>{if(b.isBone)sourceBones[b.name]=b;});
const point=n=>bones[n].getWorldPosition(new T.Vector3()),rotation=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
const UP=new T.Vector3(0,1,0),RIGHT=new T.Vector3(1,0,0),D=Math.PI/180,source=v=>[v.x,-v.z,v.y];
const grip=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).ayame.sword.r;
const mount=new T.Quaternion().fromArray(grip.frame);
const bodyNames=['pelvis','spine_01','spine_02','spine_03','neck_01','Head','thigh_r','calf_r','foot_r','ball_r','thigh_l','calf_l','foot_l','ball_l'];
const indexByName=Object.fromEntries(doc.nodes.map((n,i)=>[n.name,i]));
const channelBone=c=>bones[T.PropertyBinding.sanitizeNodeName(doc.nodes[c.target.node].name)];
const ready=g.mixer.clipAction(g.animations.find(c=>c.name==='Ring_Ready')).play();ready.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
const readyRotation=Object.fromEntries(bodyNames.map(n=>[n,rotation(n)]));
const readyLegs=Object.fromEntries(Object.entries(bones).filter(([n])=>/^(thigh|calf|foot|ball)_[rl]$/.test(n)).map(([n,b])=>[n,b.quaternion.clone()]));
const readyFreeFingers=Object.fromEntries(Object.entries(bones).filter(([n])=>/^(thumb|index|middle|ring|pinky)_\d+_l$/.test(n)).map(([n,b])=>[n,b.quaternion.clone()]));
const readyPelvis=point('pelvis'),readyFeet=Object.fromEntries(['r','l'].map(s=>[s,{p:point('foot_'+s),toe:point('ball_'+s),q:rotation('foot_'+s),toeQ:rotation('ball_'+s)}]));
g.mixer.stopAllAction();const clip=sourceRig.animations.find(c=>c.name===name),action=sourceRig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
const channels=original.channels.map(c=>({...c,target:{...c.target}}));
for(const n of bodyNames)if(!channels.some(c=>c.target.node===indexByName[n]&&c.target.path==='rotation'))channels.push({target:{node:indexByName[n],path:'rotation'}});
if(!channels.some(c=>c.target.node===indexByName.pelvis&&c.target.path==='translation'))channels.push({target:{node:indexByName.pelvis,path:'translation'}});
const fields={rotation:['quaternion','VEC4',4],translation:['position','VEC3',3],scale:['scale','VEC3',3]};
for(const c of channels)assert.ok(fields[c.target.path]&&channelBone(c), 'Unsupported animation target: '+doc.nodes[c.target.node].name);
const times=Float32Array.from([...new Set([...Array.from({length:Math.ceil(duration*240)+1},(_,i)=>Math.min(i/240,duration)),...HUSTLER_BODY_KEYS.map(r=>r[0]),impact].map(Math.fround))].sort((a,b)=>a-b));
const outputs=channels.map(c=>new Float32Array(times.length*fields[c.target.path][2])),poses=[],report={clip:name,duration,impact,samples:times.length,maxLegError:0,frames:[]};
function setWorld(n,q){const b=bones[n];b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
function bodyRotation(n,yaw,bend){return new T.Quaternion().setFromAxisAngle(UP,yaw*D).multiply(new T.Quaternion().setFromAxisAngle(RIGHT,bend*D)).multiply(readyRotation[n]);}
function sourcePose(t){let i=0;while(i<spec.poses.length-2&&t>spec.poses[i+1].t)i++;const a=spec.poses[i],b=spec.poses[i+1],u=T.MathUtils.clamp((t-a.t)/(b.t-a.t||1),0,1);return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,Array.isArray(v)?v.map((x,j)=>T.MathUtils.lerp(x,b[k]?.[j]??x,u)):typeof v==='number'?T.MathUtils.lerp(v,b[k]??v,u):v]));}
for(let i=0;i<times.length;i++){
 const time=times[i],armTime=hustlerHeavyArmTime(time),p=hustlerHeavyBody(time);
 action.time=Math.min(armTime,clip.duration);sourceRig.mixer.update(0);
 for(const [n,bone]of Object.entries(bones)){bone.position.copy(sourceBones[n].position);bone.quaternion.copy(sourceBones[n].quaternion);bone.scale.copy(sourceBones[n].scale);}
 // Reuse Ready's axial leg frames, so the fixed ankle solve cannot retain a
 // different calf twist from the old, almost stationary attack.
 for(const [n,q]of Object.entries(readyLegs))bones[n].quaternion.copy(q);
 const fingerWeight=Math.min(T.MathUtils.smoothstep(time,0,.1),1-T.MathUtils.smoothstep(time,.84,duration));
 for(const [n,q]of Object.entries(readyFreeFingers))bones[n].quaternion.copy(q).slerp(sourceBones[n].quaternion,fingerWeight);
 g.scene.updateMatrixWorld(true);
 const pelvis=readyPelvis.clone().add(new T.Vector3(p.x,p.y,p.z));bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis.clone()));g.scene.updateMatrixWorld(true);
 setWorld('pelvis',bodyRotation('pelvis',p.hip,p.pelvisBend));
 // This native rig parents its thighs to spine_01. Keep that joint in the hip frame.
 setWorld('spine_01',bodyRotation('spine_01',p.hip,p.pelvisBend));
 setWorld('spine_02',bodyRotation('spine_02',T.MathUtils.lerp(p.hip,p.chest,.55),T.MathUtils.lerp(p.pelvisBend,p.bend,.55)));
 setWorld('spine_03',bodyRotation('spine_03',p.chest,p.bend));
 setWorld('neck_01',bodyRotation('neck_01',p.chest*.45,p.bend*.4));setWorld('Head',bodyRotation('Head',p.chest*.2,p.bend*.15));
 const chestDelta=rotation('spine_03').multiply(readyRotation.spine_03.clone().invert());
 const counterLoad=Math.max(0,p.counter);
 setWorld('clavicle_l',new T.Quaternion().setFromAxisAngle(UP.clone().applyQuaternion(chestDelta),-12*counterLoad*D).multiply(rotation('clavicle_l')));
 for(const [side,degrees]of [['r',p.chamberLift],['l',p.counter*38]]){
  const axis=RIGHT.clone().applyQuaternion(chestDelta);
  setWorld('upperarm_'+side,new T.Quaternion().setFromAxisAngle(axis,-degrees*D).multiply(rotation('upperarm_'+side)));
  if(side==='l')setWorld('upperarm_l',new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1).applyQuaternion(chestDelta),6*counterLoad*D).multiply(rotation('upperarm_l')));
 }
 for(const s of ['r','l']){
  const f=readyFeet[s],q=f.q.clone(),ankle=f.p.clone();
  if(s==='l')ankle.add(new T.Vector3(.015*p.step,p.footLift,.38*p.step));
  else{
   const forward=f.toe.clone().sub(f.p).setY(0).normalize(),axis=UP.clone().cross(forward).normalize();
   q.premultiply(new T.Quaternion().setFromAxisAngle(axis,18*p.pivot*D)).premultiply(new T.Quaternion().setFromAxisAngle(UP,32*p.pivot*D));
   ankle.copy(f.toe).sub(bones.ball_r.position.clone().applyQuaternion(q));
  }
  const error=solveLeg(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],ankle,q,{maxReach:.999999});report.maxLegError=Math.max(report.maxLegError,error);
  setWorld('ball_'+s,new T.Quaternion().setFromAxisAngle(UP,s==='r'?32*p.pivot*D:0).multiply(f.toeQ));
 }
 g.scene.updateMatrixWorld(true);
 for(let c=0;c<channels.length;c++){
  const channel=channels[c],value=channelBone(channel)[fields[channel.target.path][0]].clone(),width=fields[channel.target.path][2],out=outputs[c];
  if(width===4&&i&&value.dot(new T.Quaternion().fromArray(out,(i-1)*4))<0)value.set(-value.x,-value.y,-value.z,-value.w);
  value.toArray(out,i*width);
 }
 const palm=bones.hand_r.localToWorld(new T.Vector3().fromArray(grip.center)),q=rotation('hand_r').multiply(mount),shaft=UP.clone().applyQuaternion(q),roll=new T.Quaternion().setFromUnitVectors(UP,shaft).invert().multiply(q);
 const pose=sourcePose(armTime/spec.duration);Object.assign(pose,{t:i===0?0:i===times.length-1?1:time/duration,grip:source(palm),tip:source(palm.clone().add(shaft)),roll:2*Math.atan2(roll.y,roll.w),hip:readySpec.poses[0].hip+p.hip*D,chest:readySpec.poses[0].chest+p.chest*D,bend:readySpec.poses[0].bend+p.bend*D,pelvisBend:p.pelvisBend*D,shift:source(pelvis.clone().sub(readyPelvis)).map((x,j)=>x+readySpec.poses[0].shift[j]),heel:18*p.pivot*D,step:p.step,yawR:readySpec.poses[0].yawR+32*p.pivot*D,yawL:readySpec.poses[0].yawL,elbowR:source(point('lowerarm_r')),elbowL:source(point('lowerarm_l'))});
 for(const s of ['r','l']){const key=s==='r'?'footR':'footL',delta=source(point('foot_'+s).sub(readyFeet[s].p));pose[key]=delta.map((x,j)=>x+readySpec.poses[0][key][j]);}
 poses.push(pose);report.frames.push({time,armTime,...p,pelvis:pelvis.toArray(),feet:Object.fromEntries(['r','l'].map(s=>[s,point('foot_'+s).toArray()]))});
}
assert.ok(report.maxLegError<.001,'Unreachable foot target: '+report.maxLegError);
function append(array,type,width){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(bytes);doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});length+=bytes.length;const accessor={bufferView:view,componentType:5126,count:array.length/width,type};if(width===1){accessor.min=[array[0]];accessor.max=[array.at(-1)];}doc.accessors.push(accessor);return doc.accessors.length-1;}
const input=append(times,'SCALAR',1),animation={...original,channels:[],samplers:[],extras:{...original.extras,nativeHustlerBodyVersion:1,nativeHustlerDuration:duration}};
for(let i=0;i<channels.length;i++){const c=channels[i],[,type,width]=fields[c.target.path];animation.channels.push({target:c.target,sampler:i});animation.samplers.push({input,output:append(outputs[i],type,width),interpolation:'LINEAR'});}
doc.animations[doc.animations.indexOf(original)]=animation;doc.buffers[0].byteLength=length;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);let bin=Buffer.concat(chunks);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(values.output,Buffer.concat([h,json,bh,bin]));
fs.writeFileSync(values['output-record'],JSON.stringify({[name]:{...spec,duration,impacts:[impact],carryExitDuration:HUSTLER_BODY_CARRY_EXIT,footPlants:HUSTLER_BODY_PLANTS,toePlants:HUSTLER_BODY_TOES,nativeHustlerBodyVersion:1,poses}}));
report.preservation=verifyAnimationReplacement(values.model,values.output,[[name,name]]);fs.writeFileSync(values['output-record'].replace(/\.json$/,'.body-report.json'),JSON.stringify(report));console.log(JSON.stringify({output:values.output,samples:times.length,maxLegError:report.maxLegError,preservation:report.preservation}));
