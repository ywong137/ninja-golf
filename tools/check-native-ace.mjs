#!/usr/bin/env node
// Dense checks use the actual native skeleton, fitted jian, and deformed skin.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {createWeapon} from '../src/weapons.js';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../tests/native-skin-helper.mjs';

const read=file=>JSON.parse(fs.readFileSync(file));
const UP=new T.Vector3(0,1,0),degrees=180/Math.PI;
const EXPECTED={Ace_Cut_Diagonal:{duration:.60,impact:.27,finish:.34},Ace_Heavy_Cleave:{duration:.76,impact:.36,finish:.44}};
export async function inspectNativeAce({
 model=new URL('../public/models/kaede.glb',import.meta.url),
 record=new URL('../src/motion-data.json',import.meta.url),
 readyRecord=null,
 clip:attackName='Ace_Cut_Diagonal',
 includeSkin=true,
}={}){
 const expected=EXPECTED[attackName];
 if(!expected)throw Error('Choose Ace_Cut_Diagonal or Ace_Heavy_Cleave.');
 const motions={...read(record),...(readyRecord?read(readyRecord):{})};
 assert.ok(motions.Ace_Ready,'Missing Ace_Ready metadata. Supply --ready-record when the candidate records omit it.');
 assert.ok(motions[attackName],`Missing ${attackName} metadata.`);
 const grips=read(new URL('../src/grip-data.json',import.meta.url)).kaede.sword;
 const rig=await loadNativeSkin(model),bones={};
 rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 const pos=name=>bones[name].getWorldPosition(new T.Vector3());
 const rot=name=>bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
 const neutral=Object.fromEntries(['r','l'].map(side=>[side,bones['hand_'+side].quaternion.clone().normalize()]));
 function play(name){
  const clip=rig.animations.find(c=>c.name===name);assert.ok(clip,`Missing ${name}`);rig.mixer.stopAllAction();
  const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  return seconds=>{action.time=Math.min(seconds,clip.duration);rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};
 }
 const sampleReady=play('Ace_Ready');sampleReady(0);
 const ready=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{p:b.position.clone(),q:b.quaternion.clone().normalize(),s:b.scale.clone()}]));
 const pose=motions.Ace_Ready.poses[0],shaft=new T.Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize();
 const frame=rot('hand_r').invert().multiply(new T.Quaternion().setFromUnitVectors(UP,shaft).multiply(new T.Quaternion().setFromAxisAngle(UP,pose.roll??0))).normalize();
 assert.ok(UP.clone().applyQuaternion(frame).angleTo(new T.Vector3().fromArray(grips.r.axis))<.001,'Ready changed the fitted handle axis.');
 const weapon=createWeapon('jian'),blade=weapon.getObjectByName('Flat steel blade'),vertices=blade.geometry.attributes.position;
 const placeWeapon=()=>{
  weapon.quaternion.copy(rot('hand_r')).multiply(frame);
  weapon.position.copy(bones.hand_r.localToWorld(new T.Vector3().fromArray(grips.r.center))).addScaledVector(UP.clone().applyQuaternion(weapon.quaternion),-weapon.userData.primaryGrip);
  weapon.updateMatrixWorld(true);
 };
 const metrics={samples:0,maxWrist:0,minBladeHeight:Infinity,maxPlantDrift:0,maxToePlantDrift:0,maxMedialKnee:0,maxHandSpeed:0,maxArmStepAt120Hz:0,maxFreeArmReach:0};
 for(const name of ['Ace_Ready',attackName]){
  const spec=motions[name],sample=play(name);assert.equal(spec.nativeAttachment,true);assert.equal(spec.twoHanded,false);
  if(name===attackName){assert.equal(spec.duration,expected.duration);assert.deepEqual(spec.impacts,[expected.impact]);assert.deepEqual(spec.toePlants,{r:[[0,spec.duration]],l:[]},'Declare the fixed rear toe throughout the heel pivot.');}
  let previous=null,rearToe=null,rearAnkleLow=Infinity,rearAnkleHigh=-Infinity,leadStart=null,leadLift=0,leadAdvance=0;const plants=new Map(),toePlants=new Map(),trajectory=[];
  for(let i=0;i<=Math.round(spec.duration*480);i++){
   const time=Math.min(i/480,spec.duration);sample(time);metrics.samples++;placeWeapon();
   const current={time,hand:pos('hand_r'),arms:{}};
   const toe=pos('ball_r'),ankleHeight=pos('foot_r').y;rearToe??=toe.clone();
   const leadAnkle=pos('foot_l');leadStart??=leadAnkle.clone();leadLift=Math.max(leadLift,leadAnkle.y-leadStart.y);leadAdvance=Math.max(leadAdvance,leadAnkle.z-leadStart.z);
   for(const [finger,quaternion]of Object.entries(grips.r.rotations))assert.ok(bones[finger].quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(quaternion).normalize())<.001,`${name}/${time}/${finger}: the sword hand loses its fitted wrap.`);
   assert.ok(toe.distanceTo(rearToe)<.001,'Rear toe slides during the heel pivot.');
   rearAnkleLow=Math.min(rearAnkleLow,ankleHeight);rearAnkleHigh=Math.max(rearAnkleHigh,ankleHeight);
   trajectory.push({time,tip:weapon.localToWorld(new T.Vector3().fromArray(weapon.userData.tip)),palm:bones.hand_r.localToWorld(new T.Vector3().fromArray(grips.r.center))});
   for(const side of ['r','l']){
    const toeInterval=spec.toePlants?.[side]?.findIndex(([a,b])=>time>=a&&time<=b)??-1;
    if(toeInterval>=0){
     const key=side+':'+toeInterval,position=pos('ball_'+side);
     if(!toePlants.has(key))toePlants.set(key,position.clone());
     const drift=position.distanceTo(toePlants.get(key));metrics.maxToePlantDrift=Math.max(metrics.maxToePlantDrift,drift);
     assert.ok(drift<.001,`${name}/${time}/${side}: declared toe support slides by ${(drift*1000).toFixed(3)} mm.`);
    }
    const wrist=bones['hand_'+side].quaternion.clone().normalize().angleTo(neutral[side])*degrees;
    metrics.maxWrist=Math.max(metrics.maxWrist,wrist);assert.ok(wrist<15,`${name}/${time}/${side}: wrist departs ${wrist.toFixed(2)} degrees from neutral.`);
    const upper=pos('lowerarm_'+side).sub(pos('upperarm_'+side)),forearm=pos('hand_'+side).sub(pos('lowerarm_'+side)),hand=pos('middle_01_'+side).sub(pos('hand_'+side));
    assert.ok(forearm.angleTo(hand)*degrees<20,`${name}/${time}/${side}: hand folds across forearm.`);
    if(side==='l'){const reach=upper.clone().add(forearm).length()/(upper.length()+forearm.length());metrics.maxFreeArmReach=Math.max(metrics.maxFreeArmReach,reach);assert.ok(reach<=.95,`${name}/${time}: free arm reaches ${reach.toFixed(6)} of its straight length.`);}
    assert.ok(upper.angleTo(forearm)*degrees<155,`${name}/${time}/${side}: elbow overfolds.`);
    for(const part of ['upperarm','lowerarm']){
     const bone=part+'_'+side;current.arms[bone]=rot(bone);
     if(previous){const step=current.arms[bone].angleTo(previous.arms[bone])*degrees/((time-previous.time)*120);metrics.maxArmStepAt120Hz=Math.max(metrics.maxArmStepAt120Hz,step);assert.ok(step<23,`${name}/${time}/${bone}: arm turns ${step.toFixed(2)} degrees per 120Hz sample.`);}
    }
    const interval=spec.footPlants[side].findIndex(([a,b])=>time>=a&&time<=b);
    if(interval>=0){
     const ankle=pos('foot_'+side),foot=rot('foot_'+side),key=side+':'+interval;
     if(!plants.has(key))plants.set(key,{ankle:ankle.clone(),foot:foot.clone()});
     const anchor=plants.get(key),drift=ankle.distanceTo(anchor.ankle);metrics.maxPlantDrift=Math.max(metrics.maxPlantDrift,drift);
     assert.ok(drift<.001,`${name}/${time}/${side}: planted ankle slides.`);assert.ok(foot.angleTo(anchor.foot)<.005,`${name}/${time}/${side}: planted foot rotates.`);
     const forward=pos('ball_'+side).sub(ankle).setY(0).normalize(),outward=UP.clone().cross(forward).multiplyScalar(side==='l'?1:-1);
     const medial=-pos('calf_'+side).sub(ankle).dot(outward);metrics.maxMedialKnee=Math.max(metrics.maxMedialKnee,medial);assert.ok(medial<=.020,`${name}/${time}/${side}: loaded knee falls inside its shoe plane.`);
    }
   }
   if(previous)metrics.maxHandSpeed=Math.max(metrics.maxHandSpeed,current.hand.distanceTo(previous.hand)/(time-previous.time));
   previous=current;
   for(let v=0;v<vertices.count;v++)metrics.minBladeHeight=Math.min(metrics.minBladeHeight,new T.Vector3().fromBufferAttribute(vertices,v).applyMatrix4(blade.matrixWorld).y);
   assert.ok(metrics.minBladeHeight>.10,`${name}/${time}: blade enters the ground.`);
  }
  if(name===attackName){
   assert.ok(rearAnkleHigh-rearAnkleLow>.035,'The rear heel must rise during the body turn.');
   assert.ok(leadLift>.04,'The lead foot must lift during the forward step.');
   assert.ok(leadAdvance>(attackName==='Ace_Heavy_Cleave'?.28:.18),'The lead step has insufficient forward travel.');
   assert.ok(spec.footPlants.l.some(([start,end])=>start<=expected.impact-.04&&end>=expected.impact),'The lead foot must plant before contact.');
   metrics.leadLift=leadLift;metrics.leadAdvance=leadAdvance;
   for(const time of [0,spec.duration]){
    sample(time);
    for(const [name,bind]of Object.entries(ready)){assert.ok(bones[name].position.distanceTo(bind.p)<.0001,`${name}: ready translation mismatch.`);assert.ok(bones[name].quaternion.clone().normalize().angleTo(bind.q)<.001,`${name}: ready rotation mismatch.`);assert.ok(bones[name].scale.distanceTo(bind.s)<.00001,`${name}: ready scale mismatch.`);}
   }
   const bladePoint=time=>{sample(time);placeWeapon();return weapon.localToWorld(new T.Vector3(0,.7,0));};
   const velocity=bladePoint(expected.impact+1/480).sub(bladePoint(expected.impact-1/480)).normalize();sample(expected.impact);placeWeapon();
   const edge=Math.abs(velocity.dot(new T.Vector3(1,0,0).applyQuaternion(weapon.quaternion))),face=Math.abs(velocity.dot(new T.Vector3(0,0,1).applyQuaternion(weapon.quaternion)));
   assert.ok(edge>.75&&face<.35,`Contact strikes with the blade face: edge ${edge.toFixed(3)}, face ${face.toFixed(3)}.`);metrics.contactEdgeAlignment=edge;metrics.contactFaceAlignment=face;
   const speeds=trajectory.slice(1,-1).map((row,i)=>({...row,velocity:trajectory[i+2].tip.clone().sub(trajectory[i].tip).multiplyScalar(240)}));
   const peak=speeds.reduce((a,b)=>a.velocity.lengthSq()>b.velocity.lengthSq()?a:b),contact=speeds.find(row=>Math.abs(row.time-expected.impact)<=1/960),finish=trajectory.find(row=>Math.abs(row.time-expected.finish)<=1/960);
   metrics.peakTipSpeed=peak.velocity.length();metrics.peakTipTime=peak.time;metrics.contactTipSpeed=contact.velocity.length();metrics.contactTipVelocity=contact.velocity.toArray();
   assert.ok(contact.tip.z-contact.palm.z>.25,'Contact tip points sideways or behind the hand.');
   assert.ok(contact.velocity.x>0&&contact.velocity.y<0&&contact.velocity.z>-3,'Contact must cut down and left, without sweeping back toward the body.');
   assert.ok(finish.tip.y<finish.palm.y-.10,'The diagonal cut needs a low follow-through.');
   assert.ok(metrics.peakTipSpeed<35,`Blade tip jumps at ${metrics.peakTipSpeed.toFixed(1)} m/s.`);
   assert.ok(metrics.contactTipSpeed>=metrics.peakTipSpeed*.60,'Damage contact occurs after the blade has largely stopped.');
  }
 }
 assert.ok(metrics.maxHandSpeed<12.5,`Hand speed exceeds the animation brief: ${metrics.maxHandSpeed.toFixed(2)} m/s.`);
 if(includeSkin) metrics.skin=await inspectSkin(model,attackName);
 return metrics;
}

async function inspectSkin(model,attackName){
 const rig=await loadNativeSkin(model),metadata=skinGroups(rig),rows=[];
 for(const group of ['torso','upperarm_r','lowerarm_r','upperarm_l','lowerarm_l'])assert.ok(metadata.triangles.filter(row=>row.group===group).length>10,`Missing ${group} skin coverage.`);
 const clip=rig.animations.find(c=>c.name===attackName),action=rig.mixer.clipAction(clip).setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 for(let i=0;i<=Math.round(clip.duration*480);i++){
  action.time=Math.min(clip.duration,i/480);rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
  for(const side of ['r','l']){const skin=measureArmSkin(rig,metadata,side);rows.push({time:action.time,side,inset:skin['fold_'+side].maxRadialPenetration,torso:skin['forearmTorso_'+side].pairs,upper:skin['upperarmTorso_'+side].pairs});}
 }
 const worst=key=>rows.reduce((a,b)=>a[key]>b[key]?a:b);
 const report={samples:rows.length,worstFold:worst('inset'),worstTorso:worst('torso'),worstUpper:worst('upper')};
 assert.ok(rows.every(r=>r.inset<=.003),`Forearm folds inside upper arm: ${JSON.stringify(report.worstFold)}.`);
 assert.ok(rows.every(r=>r.torso===0),`Forearm passes through torso: ${JSON.stringify(report.worstTorso)}.`);
 assert.ok(rows.every(r=>r.upper===0),`Upper arm passes through torso: ${JSON.stringify(report.worstUpper)}.`);
 return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},'ready-record':{type:'string'},clip:{type:'string'},output:{type:'string'},'no-skin':{type:'boolean'},help:{type:'boolean'}}});
 if(values.help){console.log('node tools/check-native-ace.mjs [--model MODEL.glb --record RECORDS.json] [--ready-record READY.json] [--clip Ace_Cut_Diagonal|Ace_Heavy_Cleave] [--output REPORT.json] [--no-skin]\nChecks the actual skeleton, grip, blade trajectory, and deformed arms at 480 Hz. Defaults to installed assets.');process.exit(0);}
 if(Boolean(values.model)!==Boolean(values.record))throw Error('Supply --model and --record together.');
 // Retain the candidate-prefix interface used by earlier review commands.
 const candidate=process.env.NINJA_ACE_CANDIDATE;
 const result=await inspectNativeAce({model:values.model??(candidate?candidate+'.glb':undefined),record:values.record??(candidate?candidate+'.json':undefined),readyRecord:values['ready-record']??(candidate?candidate+'.ready.json':undefined),clip:values.clip??process.env.NINJA_ACE_CLIP,includeSkin:!values['no-skin']});
 if(values.output)fs.writeFileSync(values.output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
