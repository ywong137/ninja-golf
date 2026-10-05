// Shared source-pose validation for authored one-handed arm families.
import fs from 'node:fs';
import * as T from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../tests/native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy,armAuthoringViolations} from './native-arm-anatomy.mjs';
import {createWeapon} from '../src/weapons.js';
import {gripFrame} from '../src/hand-grip.js';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';
import {samplePlanarRoot} from '../src/attack-root-motion.js';

const read=file=>JSON.parse(fs.readFileSync(file));
const Y=new T.Vector3(0,1,0),DEGREES=180/Math.PI;
const unpack=file=>{const bytes=fs.readFileSync(file),size=bytes.readUInt32LE(12);return{doc:JSON.parse(bytes.subarray(20,20+size)),bin:bytes.subarray(28+size)};};
const inputTimes=(file,index)=>{const a=file.doc.accessors[index],v=file.doc.bufferViews[a.bufferView],offset=(v.byteOffset??0)+(a.byteOffset??0);return Array.from({length:a.count},(_,i)=>file.bin.readFloatLE(offset+i*4));};

export function verifyArmFamilyPreservation(before,after,clips,{dualWield=false,footSupport=false}={}){
 const result=verifyAnimationReplacement(before,after,clips.map(name=>[name,name]));
 const oldFile=unpack(before),newFile=unpack(after),a=oldFile.doc,b=newFile.doc,timingScales={};let retainedChannels=0;
 for(const name of clips){
  const original=a.animations.find(clip=>clip.name===name),candidate=b.animations.find(clip=>clip.name===name);
  for(const channel of original.channels){
   const bone=a.nodes[channel.target.node].name;
   const finger=/^(index|middle|ring|pinky|thumb)_\d+_([rl])$/.exec(bone);
   if(footSupport&&/^(thigh|calf|foot)_[rl]$/.test(bone)&&channel.target.path==='rotation')continue;
   const edited=/^(clavicle|upperarm|lowerarm|hand)_[rl]$/.test(bone)||!!(finger&&(finger[2]==='r'||dualWield));
   if(edited&&channel.target.path==='rotation')continue;
   const next=candidate.channels.find(c=>c.target.node===channel.target.node&&c.target.path===channel.target.path);
   if(JSON.stringify(next)!==JSON.stringify(channel))
    throw Error(`${name}/${bone}/${channel.target.path}: unrelated animation channel changed.`);
   const oldSampler=original.samplers[channel.sampler],newSampler=candidate.samplers[next.sampler];
   if(oldSampler.output!==newSampler.output||oldSampler.interpolation!==newSampler.interpolation)
    throw Error(`${name}/${bone}/${channel.target.path}: original pose values changed.`);
   const oldTimes=inputTimes(oldFile,oldSampler.input),newTimes=inputTimes(newFile,newSampler.input);
   if(oldTimes.length!==newTimes.length)throw Error(`${name}/${bone}: original key count changed.`);
   const scale=newTimes.at(-1)/oldTimes.at(-1);
   if(timingScales[name]!==undefined&&Math.abs(timingScales[name]-scale)>1e-6)throw Error(`${name}: body channels have different timing scales.`);
   timingScales[name]=scale;
   for(let i=0;i<oldTimes.length;i++)if(Math.abs(newTimes[i]-Math.fround(oldTimes[i]*scale))>5e-7)
    throw Error(`${name}/${bone}: original timing curve changed beyond a uniform scale.`);
   retainedChannels++;
  }
 }
 return{...result,retainedBodyLegAndOtherChannels:retainedChannels,timingScales};
}

export async function inspectNativeArmFamily({model,record,modelKey,readyName,weaponKind,clips,doubleEdged=false,readyRecord,referenceClip=readyName,rate=480,skin=false}={}){
 if(!model||!record)throw Error('Supply the paired model and motion records.');
 if(!Number.isInteger(rate)||rate<60||rate>960)throw Error('Choose an integer sample rate from 60 through 960 Hz.');
 if(!modelKey||!readyName||!weaponKind||!clips?.length)throw Error('Supply modelKey, readyName, weaponKind, and clips.');
 const motions=read(record);if(readyRecord)motions[readyName]=readyRecord;
 const grip=read(new URL('../src/grip-data.json',import.meta.url))[modelKey]?.sword;
 if(!grip)throw Error('No fitted sword grip for '+modelKey);
 const rig=await loadNativeSkin(model),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 const point=name=>bones[name].getWorldPosition(new T.Vector3());
 const rotation=name=>bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
 const bind=Object.fromEntries(['r','l'].map(side=>[side,calibrateArmAnatomy(captureArmPose(bones,side))]));
 const neutral=Object.fromEntries(['r','l'].map(side=>[side,bones['hand_'+side].quaternion.clone().normalize()]));
 const groups=skin?skinGroups(rig):null;
 const sampleClip=name=>{
  rig.mixer.stopAllAction();const clip=rig.animations.find(c=>c.name===name);
  if(!clip)throw Error('Missing native clip: '+name);
  const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  return time=>{action.time=Math.min(time,clip.duration);rig.mixer.update(0);const root=motions[name]?.planarRoot?samplePlanarRoot(motions[name].planarRoot,time):{x:0,z:0};rig.scene.position.set(root.x,0,root.z);rig.scene.updateMatrixWorld(true);};
 };
 sampleClip(referenceClip)(0);
 const ready=motions[referenceClip]?.poses?.[0];if(!ready)throw Error('Supply the matching '+readyName+' record.');
 const shaft=new T.Vector3(ready.tip[0]-ready.grip[0],ready.tip[2]-ready.grip[2],ready.grip[1]-ready.tip[1]).normalize();
 const reference=rotation('hand_r').invert().multiply(new T.Quaternion().setFromUnitVectors(Y,shaft).multiply(new T.Quaternion().setFromAxisAngle(Y,ready.roll??0))).normalize();
 const mount=gripFrame(bones,grip.r,'r',reference).frame;
 if(Y.clone().applyQuaternion(mount).angleTo(new T.Vector3().fromArray(grip.r.axis))>.001)throw Error('The Ready record changed the fitted handle axis.');
 const weapon=createWeapon(weaponKind),blade=weapon.getObjectByName('Flat steel blade'),vertices=blade.geometry.attributes.position;
 const result={rate,skin,mountedFrame:mount.toArray(),passed:true,violationCount:0,violations:[],clips:{}};
 const fail=(name,time,side,issue,value)=>{result.passed=false;result.violationCount++;if(result.violations.length<50)result.violations.push({name,time,side,issue,value});};
 for(const name of clips){
  const spec=motions[name];if(!spec?.nativeAttachment)throw Error(`${name}: missing nativeAttachment metadata.`);
  if(spec.impactHands&&(spec.impactHands.length!==(spec.impacts?.length??0)||spec.impactHands.some(side=>!['r','l','both'].includes(side))))
   throw Error(`${name}: impactHands needs one r, l, or both entry per impact.`);
  const sample=sampleClip(name),times=[...new Set([...Array.from({length:Math.ceil(spec.duration*rate)+1},(_,i)=>Math.min(i/rate,spec.duration)),...(spec.impacts??[])])].sort((a,b)=>a-b);
  const metrics={samples:times.length,maxWristDegrees:0,maxFlexionDegrees:0,maxHumeralRollDegrees:0,maxForearmTwistDegrees:0,maxHingeDeviationDegrees:0,maxArmStep120Hz:0,maxHandSpeed:0,minBladeHeight:Infinity,maxFoldDepth:0,maxForearmTorsoPairs:0,maxUpperarmTorsoPairs:0,contacts:[]};
  let previous=null;const trajectory=[];
  for(const time of times){
   sample(time);
   const palm=bones.hand_r.localToWorld(new T.Vector3().fromArray(grip.r.center));
   weapon.quaternion.copy(rotation('hand_r')).multiply(mount).multiply(new T.Quaternion().setFromAxisAngle(Y,spec.weaponGripRoll??0));
   weapon.position.copy(palm).addScaledVector(Y.clone().applyQuaternion(weapon.quaternion),-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
   let minY=Infinity;for(let i=0;i<vertices.count;i++)minY=Math.min(minY,new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(blade.matrixWorld).y);
   metrics.minBladeHeight=Math.min(metrics.minBladeHeight,minY);if(minY<.03)fail(name,time,'r','blade ground clearance',minY);
   const current={time,hands:{r:point('hand_r'),l:point('hand_l')},arms:{}};
   trajectory.push({time,palm:palm.toArray(),tip:weapon.localToWorld(new T.Vector3().fromArray(weapon.userData.tip)).toArray(),edge:new T.Vector3(1,0,0).applyQuaternion(weapon.quaternion).toArray(),face:new T.Vector3(0,0,1).applyQuaternion(weapon.quaternion).toArray()});
   for(const [bone,q]of Object.entries(grip.r.rotations))if(bones[bone].quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(q).normalize())>.001)fail(name,time,'r','fitted finger wrap changed',bone);
   for(const side of ['r','l']){
    const anatomy=measureArmAnatomy(bind[side],captureArmPose(bones,side));
    for(const violation of armAuthoringViolations(anatomy,{maxHingeDeviationDegrees:1}))fail(name,time,side,violation.metric,violation.value);
    metrics.maxFlexionDegrees=Math.max(metrics.maxFlexionDegrees,anatomy.signedFlexionDegrees);
    metrics.maxHumeralRollDegrees=Math.max(metrics.maxHumeralRollDegrees,Math.abs(anatomy.humeralRollDegrees));
    metrics.maxForearmTwistDegrees=Math.max(metrics.maxForearmTwistDegrees,Math.abs(anatomy.forearmTwistDegrees));
    metrics.maxHingeDeviationDegrees=Math.max(metrics.maxHingeDeviationDegrees,anatomy.hingeDeviationDegrees);
    const wrist=bones['hand_'+side].quaternion.clone().normalize().angleTo(neutral[side])*DEGREES;
    metrics.maxWristDegrees=Math.max(metrics.maxWristDegrees,wrist);if(wrist>20)fail(name,time,side,'wrist deviation',wrist);
    for(const part of ['upperarm','lowerarm']){
     const bone=part+'_'+side;current.arms[bone]=rotation(bone);
     if(previous){const step=current.arms[bone].angleTo(previous.arms[bone])*DEGREES/((time-previous.time)*120);metrics.maxArmStep120Hz=Math.max(metrics.maxArmStep120Hz,step);if(step>23)fail(name,time,side,'arm rotation per 120 Hz sample',step);}
    }
    if(skin){
     const measured=measureArmSkin(rig,groups,side),fold=measured['fold_'+side].maxRadialPenetration,forearm=measured['forearmTorso_'+side].pairs,upper=measured['upperarmTorso_'+side].pairs;
     metrics.maxFoldDepth=Math.max(metrics.maxFoldDepth,fold);metrics.maxForearmTorsoPairs=Math.max(metrics.maxForearmTorsoPairs,forearm);metrics.maxUpperarmTorsoPairs=Math.max(metrics.maxUpperarmTorsoPairs,upper);
     if(fold>.003)fail(name,time,side,'forearm penetrates upper arm',fold);
     if(forearm)fail(name,time,side,'forearm crosses torso',forearm);
     if(upper)fail(name,time,side,'upper arm crosses torso',upper);
    }
   }
   if(previous)for(const side of ['r','l']){
    const speed=current.hands[side].distanceTo(previous.hands[side])/(time-previous.time);
    metrics.maxHandSpeed=Math.max(metrics.maxHandSpeed,speed);if(speed>15)fail(name,time,side,'hand speed',speed);
   }
   previous=current;
  }
  const tipSpeeds=trajectory.map((p,index)=>{
   const a=trajectory[Math.max(0,index-1)],b=trajectory[Math.min(trajectory.length-1,index+1)];
   return new T.Vector3().fromArray(b.tip).sub(new T.Vector3().fromArray(a.tip)).length()/(b.time-a.time);
  });
  metrics.peakTipSpeed=Math.max(...tipSpeeds);
  if(metrics.peakTipSpeed>35)fail(name,trajectory[tipSpeeds.indexOf(metrics.peakTipSpeed)].time,'r','blade tip speed',metrics.peakTipSpeed);
  for(const [hitIndex,hit]of (spec.impacts??[]).entries()){
   const index=trajectory.findIndex(p=>p.time===hit),p=trajectory[index],a=trajectory[Math.max(0,index-1)],b=trajectory[Math.min(trajectory.length-1,index+1)];
   const velocity=new T.Vector3().fromArray(b.tip).sub(new T.Vector3().fromArray(a.tip)).multiplyScalar(1/(b.time-a.time));
   const edge=velocity.clone().normalize().dot(new T.Vector3().fromArray(p.edge));
   const activeHand=spec.impactHands?.[hitIndex]??'r';
   metrics.contacts.push({time:hit,activeHand,tip:p.tip,palm:p.palm,velocity:velocity.toArray(),speed:velocity.length(),fractionOfGlobalPeak:velocity.length()/metrics.peakTipSpeed,signedEdgeAlignment:edge,faceAlignment:Math.abs(velocity.clone().normalize().dot(new T.Vector3().fromArray(p.face)))});
   const cuttingAlignment=doubleEdged?Math.abs(edge):edge;
   if(activeHand!=='l'&&cuttingAlignment<.75)fail(name,hit,'r','sharpened edge alignment',cuttingAlignment);
  }
  result.clips[name]=metrics;
 }
 return result;
}
