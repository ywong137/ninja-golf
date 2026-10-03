import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {WARRIORS} from '../src/warriors.js';
import {createWeapon} from '../src/weapons.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../tools/native-leg-anatomy.mjs';

const readJSON=file=>JSON.parse(fs.readFileSync(new URL(file,import.meta.url)));
const motions=readJSON('../src/motion-data.json'),grips=readJSON('../src/grip-data.json').ronin.sword;
const UP=new T.Vector3(0,1,0),degrees=180/Math.PI;

test('Ronin retained ready and legacy cleave preserve anatomical wrists, real blade clearance, and planted support',async t=>{
 const hero=WARRIORS.find(w=>w.model==='ronin');
 assert.equal(hero.readyClip,'Ronin_Ready');assert.equal(hero.motionOverrides.Heavy_Cleave,'Ronin_Power_Cut');
 const rig=await loadNativeSkin(new URL('../public/models/ronin.glb',import.meta.url)),bones={};
 rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});rig.scene.updateMatrixWorld(true);
 const position=name=>bones[name].getWorldPosition(new T.Vector3());
 const rotation=name=>bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
 // Read neutral wrists from the imported bind pose, before any animation runs.
 const neutral=Object.fromEntries(['r','l'].map(side=>[side,bones['hand_'+side].quaternion.clone().normalize()]));
 const legAnatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const clips=new Map(rig.animations.map(clip=>[clip.name,clip]));
 function play(name){
  const clip=clips.get(name);assert.ok(clip,`Missing ${name}`);rig.mixer.stopAllAction();
  const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  return seconds=>{action.time=Math.min(seconds,clip.duration);rig.mixer.update(0);rig.scene.updateMatrixWorld(true);};
 }
 const snapshot=()=>Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,{position:bone.position.clone(),rotation:bone.quaternion.clone().normalize(),scale:bone.scale.clone()}]));
 const sampleReady=play(hero.readyClip);sampleReady(0);const ready=snapshot();
 // Match the runtime's initial Ready blade presentation, then retain that fixed
 // hand-relative frame. Subsequent poses receive no procedural wrist correction.
 const pose=motions[hero.readyClip].poses[0],shaft=new T.Vector3(pose.tip[0]-pose.grip[0],pose.tip[2]-pose.grip[2],pose.grip[1]-pose.tip[1]).normalize();
 const readyWeapon=new T.Quaternion().setFromUnitVectors(UP,shaft).multiply(new T.Quaternion().setFromAxisAngle(UP,pose.roll??0));
 const weaponFrame=rotation('hand_r').invert().multiply(readyWeapon).normalize();
 assert.ok(UP.clone().applyQuaternion(weaponFrame).angleTo(new T.Vector3().fromArray(grips.r.axis))<.001,'Ready calibration changed the fitted handle axis.');
 const weapon=createWeapon(hero.weaponKind),blade=weapon.getObjectByName('Flat steel blade');assert.ok(blade?.isMesh);
 const bladePoints=blade.geometry.getAttribute('position'),vertex=new T.Vector3();assert.ok(bladePoints.count>100,'Test the complete curved blade mesh.');
 const metrics={samples:0,maxWristDegrees:0,maxPalmGap:0,minBladeHeight:Infinity,maxPlantDrift:0,maxPlantTurn:0,maxArmStepAt120Hz:0,maxMedialKnee:0};
 for(const name of [hero.readyClip,'Ronin_Heavy_Cleave']){
  const spec=motions[name],clip=clips.get(name),sample=play(name);assert.equal(spec.nativeAttachment,true);assert.ok(Math.abs(clip.duration-spec.duration)<1e-6);
  const times=new Set([0,spec.duration,...(spec.impacts??[])]);
  // Test 240 Hz keys and 480 Hz midpoints to catch gaps hidden at solved keys.
  for(const rate of [120,240,480])for(let i=0;i<=Math.floor(spec.duration*rate);i++)times.add(i/rate);
  const plants=new Map();let previous=null;
  for(const seconds of [...times].sort((a,b)=>a-b)){
   sample(seconds);metrics.samples++;
   const primary=bones.hand_r.localToWorld(new T.Vector3().fromArray(grips.r.center));
   const direction=new T.Vector3().fromArray(grips.r.axis).applyQuaternion(rotation('hand_r')).normalize();
   const secondary=bones.hand_l.localToWorld(new T.Vector3().fromArray(grips.l.center));
   const gap=secondary.distanceTo(primary.clone().addScaledVector(direction,-spec.gripSpacing));
   // Bound interpolation error to 1.25mm; reject the old4mm midpoint separation.
   metrics.maxPalmGap=Math.max(metrics.maxPalmGap,gap);assert.ok(gap<.00125,`${name}/${seconds}: second palm leaves the handle by ${(gap*1000).toFixed(2)} mm.`);
   const current={seconds,arms:{}};
   for(const side of ['r','l']){
    const hand='hand_'+side,forearm='lowerarm_'+side;
    const wrist=bones[hand].quaternion.clone().normalize().angleTo(neutral[side])*degrees;
    metrics.maxWristDegrees=Math.max(metrics.maxWristDegrees,wrist);
    assert.ok(wrist<=14,`${name}/${seconds}/${side}: complete wrist rotation departs ${wrist.toFixed(2)}° from neutral.`);
    const forearmDirection=position(hand).sub(position(forearm)).normalize(),knuckleDirection=position('middle_01_'+side).sub(position(hand)).normalize();
    assert.ok(forearmDirection.angleTo(knuckleDirection)*degrees<20,`${name}/${seconds}/${side}: hand folds across the forearm.`);
    for(const part of ['upperarm','lowerarm']){
     const bone=part+'_'+side;current.arms[bone]={local:bones[bone].quaternion.clone().normalize(),world:rotation(bone)};
     if(previous){
      const dt=seconds-previous.seconds;if(dt<1e-8)continue;
      for(const space of ['local','world']){
       const turn=current.arms[bone][space].angleTo(previous.arms[bone][space])*degrees,at120=turn/(dt*120);
       metrics.maxArmStepAt120Hz=Math.max(metrics.maxArmStepAt120Hz,at120);
       assert.ok(at120<23,`${name}/${seconds}/${bone}: ${space} elbow frame turns ${at120.toFixed(1)}° per 120 Hz sample.`);
      }
     }
    }
    const intervals=spec.footPlants?.[side];assert.ok(intervals?.length,`${name}: missing ${side} support schedule.`);
    const index=intervals.findIndex(([start,end])=>seconds>=start&&seconds<=end);
    if(index>=0){
     const ankle=position('foot_'+side),foot=rotation('foot_'+side),key=side+':'+index;
     if(!plants.has(key))plants.set(key,{ankle:ankle.clone(),foot:foot.clone()});
     const support=plants.get(key),drift=ankle.distanceTo(support.ankle),turn=foot.angleTo(support.foot);
     metrics.maxPlantDrift=Math.max(metrics.maxPlantDrift,drift);metrics.maxPlantTurn=Math.max(metrics.maxPlantTurn,turn);
     assert.ok(drift<.001,`${name}/${seconds}/${side}: planted ankle slides.`);assert.ok(turn<.005,`${name}/${seconds}/${side}: planted shoe turns.`);
     if(spec.nativeKneeHeading){
      // A wide stance need not put the hip in the shoe's vertical plane.
      // Check native joint frames instead of forcing the knee into that plane.
      const leg=measureLegAnatomy(legAnatomy[side],bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);
      assert.ok(leg.kneeDeviation<.1&&Math.abs(leg.hipTwist)<36&&Math.abs(leg.ankleTwist)<10,`${name}/${seconds}/${side}: invalid native leg ${JSON.stringify(leg)}`);
     }else{
      const forward=position('ball_'+side).sub(ankle).setY(0).normalize(),outward=UP.clone().cross(forward).multiplyScalar(side==='l'?1:-1);
      const medial=-position('calf_'+side).sub(ankle).dot(outward);metrics.maxMedialKnee=Math.max(metrics.maxMedialKnee,medial);
      assert.ok(medial<=.020,`${name}/${seconds}/${side}: loaded knee falls ${(medial*100).toFixed(2)} cm inside the shoe plane.`);
     }
    }
   }
   previous=current;
   weapon.quaternion.copy(rotation('hand_r')).multiply(weaponFrame);
   weapon.position.copy(primary).addScaledVector(UP.clone().applyQuaternion(weapon.quaternion),-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
   for(let i=0;i<bladePoints.count;i++)metrics.minBladeHeight=Math.min(metrics.minBladeHeight,vertex.fromBufferAttribute(bladePoints,i).applyMatrix4(blade.matrixWorld).y);
   assert.ok(metrics.minBladeHeight>.10,`${name}/${seconds}: the visible blade enters the ground.`);
  }
  if(name==='Ronin_Heavy_Cleave')for(const seconds of [0,spec.duration]){
   sample(seconds);const endpoint=snapshot();
   for(const [bone,bind]of Object.entries(ready)){
    assert.ok(bind.scale.distanceTo(endpoint[bone].scale)<.00001,`${bone}: ready/attack scale discontinuity.`);
    assert.ok(bind.position.distanceTo(endpoint[bone].position)<.0001,`${bone}: ready/attack translation discontinuity.`);
    assert.ok(bind.rotation.angleTo(endpoint[bone].rotation)<.001,`${bone}: ready/attack rotation discontinuity.`);
   }
  }
 }
 t.diagnostic(JSON.stringify(metrics));
});
