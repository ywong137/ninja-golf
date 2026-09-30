#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {inspectNativeArmFamily,verifyArmFamilyPreservation} from './check-native-arm-family.mjs';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {createWeapon} from '../src/weapons.js';
import {headSurfaceMetadata,measureTriangleHeadClearance} from './blade-head-surface.mjs';
import {SHINOBI_CLIPS} from './native-shinobi-profile.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from './native-leg-anatomy.mjs';

export const verifyShinobiPreservation=(before,after,{footSupport=false}={})=>verifyArmFamilyPreservation(before,after,SHINOBI_CLIPS,{dualWield:true,footSupport});

function segmentSeparation(a,b,c,d){
 const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c);
 const aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w),denominator=aa*cc-bb*bb;
 let distance=Math.min(...[[a,c,d],[b,c,d],[c,a,b],[d,a,b]].map(([p,a,b])=>new T.Line3(a,b).closestPointToPoint(p,true,new T.Vector3()).distanceTo(p)));
 if(denominator>1e-10){
  const s=(bb*ee-cc*dd)/denominator,t=(aa*ee-bb*dd)/denominator;
  if(s>=0&&s<=1&&t>=0&&t<=1)distance=Math.min(distance,a.clone().addScaledVector(u,s).distanceTo(c.clone().addScaledVector(v,t)));
 }
 return distance;
}

export async function inspectNativeShinobi({model,record,rate=480,skin=false,clips=SHINOBI_CLIPS}={}){
 const result=await inspectNativeArmFamily({model,record,rate,skin,clips,modelKey:'shinobi',readyName:'Twin_Ready',weaponKind:'twin'});
 const records=JSON.parse(fs.readFileSync(record)),grips=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).shinobi.sword,grip=grips.l;
 const rig=await loadNativeSkin(model),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 rig.scene.updateMatrixWorld(true);
 const legBind=Object.fromEntries(['r','l'].map(side=>[side,calibrateLegAnatomy(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side])]));
 const headSurfaces=skin?headSurfaceMetadata(rig):null,limbSurfaces=[];
 if(skin)rig.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const a=mesh.geometry.attributes,names=mesh.skeleton.bones.map(b=>b.name),index=mesh.geometry.index;
  for(const side of ['r','l']){
   const pattern=new RegExp('^(lowerarm|hand|thumb_\\d+|index_\\d+|middle_\\d+|ring_\\d+|pinky_\\d+)_'+side+'$');
   const weights=Array.from({length:a.position.count},(_,i)=>{let weight=0;for(let k=0;k<4;k++)if(pattern.test(names[a.skinIndex.getComponent(i,k)]))weight+=a.skinWeight.getComponent(i,k);return weight;});
   const triangles=[],vertices=new Set();
   for(let i=0;i<(index?index.count:a.position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.some(v=>weights[v]>.5)){triangles.push(ids);for(const v of ids)vertices.add(v);}}
   if(triangles.length)limbSurfaces.push({side,mesh,triangles,vertices:[...vertices]});
  }
 });
 const Y=new T.Vector3(0,1,0),q=()=>bones.hand_l.getWorldQuaternion(new T.Quaternion()).normalize();
 const sampleClip=name=>{
  rig.mixer.stopAllAction();const clip=rig.animations.find(c=>c.name===name);
  if(!clip)throw Error('Missing native clip: '+name);
  const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  return time=>{action.time=Math.min(time,clip.duration);rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};
 };
 sampleClip('Twin_Ready')(0);
 const ready=records.Twin_Ready.poses[0],shaft=new T.Vector3(ready.offTip[0]-ready.offGrip[0],ready.offTip[2]-ready.offGrip[2],ready.offGrip[1]-ready.offTip[1]).normalize();
 const mount=q().invert().multiply(new T.Quaternion().setFromUnitVectors(Y,shaft).multiply(new T.Quaternion().setFromAxisAngle(Y,ready.offRoll))).normalize();
 if(Y.clone().applyQuaternion(mount).angleTo(new T.Vector3().fromArray(grip.axis))>.001)throw Error('The off-hand mount changed the fitted shaft axis.');
 const weapon=createWeapon('twin'),primaryWeapon=createWeapon('twin'),primaryMount=new T.Quaternion().fromArray(result.mountedFrame),blade=weapon.getObjectByName('Flat steel blade'),vertices=blade.geometry.attributes.position;
 const fail=(name,time,issue,value,side='l')=>{result.passed=false;result.violationCount++;if(result.violations.length<50)result.violations.push({name,time,side,issue,value});};
 for(const name of clips){
  const spec=records[name],sample=sampleClip(name),times=[...new Set([...Array.from({length:Math.ceil(spec.duration*rate)+1},(_,i)=>Math.min(i/rate,spec.duration)),...(spec.impacts??[]),...Object.values(spec.footPlants??{}).flat(2),...Object.values(spec.toePlants??{}).flat(2)])].sort((a,b)=>a-b);
  const metrics={minBladeHeight:Infinity,minBladeSeparation:Infinity,peakTipSpeed:0,contacts:[]},trajectory=[];
  const limbHead=skin&&spec.nativeShinobiBodyPilotVersion?{minimumClearance:.05,crossings:0}:null;
  if(limbHead)for(const side of ['r','l'])if(!limbSurfaces.some(s=>s.side===side))throw Error('Missing '+side+' fist/forearm surfaces.');
  const support={maxDrift:0,maxToeDrift:0,maxTurn:0,maxLoadedMedial:0,maxKneeSpeed:0,maxAnkleSpeed:0,maxHipTwist:0,maxAnkleTwist:0,maxKneeSidebend:0},plants={},previous={};
  for(const time of times){
   sample(time);
   for(const side of ['r','l']){
    if(spec.nativeKneeHeading){
     const m=measureLegAnatomy(legBind[side],bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);
     support.maxHipTwist=Math.max(support.maxHipTwist,Math.abs(m.hipTwist));support.maxAnkleTwist=Math.max(support.maxAnkleTwist,Math.abs(m.ankleTwist));support.maxKneeSidebend=Math.max(support.maxKneeSidebend,m.kneeDeviation);
     if(Math.abs(m.hipTwist)>45||Math.abs(m.ankleTwist)>15||m.kneeDeviation>.01||m.kneeFlexion<=0||m.kneeFlexion>=120)fail(name,time,'native leg frame',m,side);
    }
    const ankle=bones['foot_'+side].getWorldPosition(new T.Vector3()),knee=bones['calf_'+side].getWorldPosition(new T.Vector3()),toe=bones['ball_'+side].getWorldPosition(new T.Vector3()),rotation=bones['foot_'+side].getWorldQuaternion(new T.Quaternion()).normalize();
    const interval=spec.footPlants?.[side]?.findIndex(([start,end])=>time>=start-1e-8&&time<=end+1e-8)??-1,toeInterval=spec.toePlants?.[side]?.findIndex(([start,end])=>time>=start-1e-8&&time<=end+1e-8)??-1;
    if(interval>=0){
     const key=side+':'+interval;plants[key]??={ankle:ankle.clone(),rotation:rotation.clone()};
     const drift=ankle.distanceTo(plants[key].ankle),turn=rotation.angleTo(plants[key].rotation),outward=new T.Vector3(0,1,0).cross(toe.clone().sub(ankle).setY(0).normalize()).multiplyScalar(side==='r'?-1:1),medial=-knee.clone().sub(ankle).dot(outward);
     support.maxDrift=Math.max(support.maxDrift,drift);support.maxTurn=Math.max(support.maxTurn,turn);support.maxLoadedMedial=Math.max(support.maxLoadedMedial,medial);
     if(drift>.003)fail(name,time,'planted foot drift',drift,side);
     if(turn>.020)fail(name,time,'planted foot turn',turn,side);
     if(!spec.nativeKneeHeading&&medial>.020)fail(name,time,'loaded knee tracks inward',medial,side);
    }
    if(toeInterval>=0){
     const key=side+':toe:'+toeInterval;plants[key]??={toe:toe.clone()};const drift=toe.distanceTo(plants[key].toe),outward=new T.Vector3(0,1,0).cross(toe.clone().sub(ankle).setY(0).normalize()).multiplyScalar(side==='r'?-1:1),medial=-knee.clone().sub(ankle).dot(outward);
     support.maxToeDrift=Math.max(support.maxToeDrift,drift);support.maxLoadedMedial=Math.max(support.maxLoadedMedial,medial);
     if(drift>.003)fail(name,time,'planted toe drift',drift,side);if(!spec.nativeKneeHeading&&medial>.020)fail(name,time,'toe-supported knee tracks inward',medial,side);
    }
    const old=previous[side],dt=old?time-old.time:0;
    if(dt>1e-6){support.maxKneeSpeed=Math.max(support.maxKneeSpeed,knee.distanceTo(old.knee)/dt);support.maxAnkleSpeed=Math.max(support.maxAnkleSpeed,ankle.distanceTo(old.ankle)/dt);}
    previous[side]={time,knee,ankle};
   }
   if(limbHead){
    const posed={r:[],l:[]};
    for(const {side,mesh,triangles,vertices}of limbSurfaces){mesh.skeleton.update();const points=new Map(vertices.map(i=>[i,mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld)]));posed[side].push(...triangles.map(ids=>ids.map(i=>points.get(i))));}
    const measured=measureTriangleHeadClearance(headSurfaces,posed,{distanceCap:.05});limbHead.minimumClearance=Math.min(limbHead.minimumClearance,measured.minimumClearance);limbHead.crossings+=measured.crossings;
    if(measured.minimumClearance<.005)fail(name,time,'fist or forearm enters head clearance',measured.minimumClearance,measured.closest?.source);
   }
   for(const[n,rotation]of Object.entries(grip.rotations))if(bones[n].quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(rotation).normalize())>.001)fail(name,time,'fitted off-hand fingers changed',n);
   const palm=bones.hand_l.localToWorld(new T.Vector3().fromArray(grip.center));
   weapon.quaternion.copy(q()).multiply(mount);weapon.position.copy(palm).addScaledVector(Y.clone().applyQuaternion(weapon.quaternion),-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
   primaryWeapon.quaternion.copy(bones.hand_r.getWorldQuaternion(new T.Quaternion()).normalize()).multiply(primaryMount);
   primaryWeapon.position.copy(bones.hand_r.localToWorld(new T.Vector3().fromArray(grips.r.center))).addScaledVector(Y.clone().applyQuaternion(primaryWeapon.quaternion),-primaryWeapon.userData.primaryGrip);primaryWeapon.updateMatrixWorld(true);
   const separation=segmentSeparation(primaryWeapon.localToWorld(new T.Vector3(0,.17,0)),primaryWeapon.localToWorld(new T.Vector3().fromArray(primaryWeapon.userData.tip)),weapon.localToWorld(new T.Vector3(0,.17,0)),weapon.localToWorld(new T.Vector3().fromArray(weapon.userData.tip)));
   metrics.minBladeSeparation=Math.min(metrics.minBladeSeparation,separation);
   // Two blade half-widths plus their maximum centerline curvature error fit within 6 cm.
   if(separation<.06)fail(name,time,'dual blade envelopes overlap',separation);
   let minY=Infinity;for(let i=0;i<vertices.count;i++)minY=Math.min(minY,new T.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(blade.matrixWorld).y);
   metrics.minBladeHeight=Math.min(metrics.minBladeHeight,minY);if(minY<.03)fail(name,time,'off-hand blade ground clearance',minY);
   trajectory.push({time,tip:weapon.localToWorld(new T.Vector3().fromArray(weapon.userData.tip)),edge:new T.Vector3(1,0,0).applyQuaternion(weapon.quaternion)});
  }
  const velocity=index=>{const a=trajectory[Math.max(0,index-1)],b=trajectory[Math.min(trajectory.length-1,index+1)];return b.tip.clone().sub(a.tip).multiplyScalar(1/(b.time-a.time));};
  metrics.peakTipSpeed=Math.max(...trajectory.map((_,i)=>velocity(i).length()));
  if(support.maxKneeSpeed>12||support.maxAnkleSpeed>12)fail(name,0,'abrupt leg movement',support);
  if(metrics.peakTipSpeed>35)fail(name,0,'off-hand blade speed',metrics.peakTipSpeed);
  for(const[hitIndex,time]of(spec.impacts??[]).entries()){
   const index=trajectory.findIndex(p=>p.time===time),v=velocity(index),edge=v.clone().normalize().dot(trajectory[index].edge),activeHand=spec.impactHands?.[hitIndex]??'r';
   metrics.contacts.push({time,activeHand,speed:v.length(),velocity:v.toArray(),signedEdgeAlignment:edge,fractionOfGlobalPeak:v.length()/metrics.peakTipSpeed});
   if(activeHand==='l'||activeHand==='both'){
    if(edge<.75)fail(name,time,'off-hand sharpened edge alignment',edge);
    if(v.length()<4)fail(name,time,'off-hand stops at impact',v.length());
    if(v.length()/metrics.peakTipSpeed<.5)fail(name,time,'off-hand contact speed fraction',v.length()/metrics.peakTipSpeed);
   }
  }
  result.clips[name].offhand=metrics;result.clips[name].support=support;if(limbHead)result.clips[name].limbHead=limbHead;
 }
 return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},output:{type:'string'},before:{type:'string'},'foot-support':{type:'boolean'},rate:{type:'string',default:'480'},skin:{type:'boolean'},help:{type:'boolean'}}});
 if(values.help)console.log('node tools/check-native-shinobi.mjs --model MODEL.glb --record RECORDS.json [--skin] [--rate 480] [--output REPORT.json] [--before ORIGINAL.glb] [--foot-support]\nChecks both native arms, fitted hands, actual blades, each active cutting edge, and foot support. Use --foot-support to permit the separate leg support bake during preservation checks.');
 else{
  const report=await inspectNativeShinobi({model:values.model,record:values.record,rate:Number(values.rate),skin:values.skin});
  if(values.before)report.preservation=verifyShinobiPreservation(values.before,values.model,{footSupport:values['foot-support']});
  if(values.output)fs.writeFileSync(values.output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,violationCount:report.violationCount,violations:report.violations,clips:report.clips},null,2));
  if(!report.passed)process.exitCode=1;
 }
}
