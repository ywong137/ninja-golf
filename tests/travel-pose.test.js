import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TravelPose,TRAVEL_POSES} from '../src/travel-pose.js';
import {bladeGeometry,BLADE_PROFILES} from '../src/weapons.js';

function testActor(){
 const root=new THREE.Group(),chest=new THREE.Bone(),bones={spine_03:chest};root.add(chest);
 const actor={root,bones,neutralHandRotations:{},selectionArmRest:{},palmGrips:{},shaftAxes:{},runPhase:.3,offhand:null};
 for(const side of ['r','l']){
  const upper=new THREE.Bone(),lower=new THREE.Bone(),hand=new THREE.Bone();chest.add(upper);upper.add(lower);lower.add(hand);
  upper.position.set(side==='r'?-.2:.2,1.45,0);lower.position.set(0,-.27,0);hand.position.set(0,-.25,0);
  // A slightly flexed bind pose defines an unambiguous forward elbow hinge.
  lower.quaternion.setFromAxisAngle(new THREE.Vector3(-1,0,0),.2);
  Object.assign(bones,{['upperarm_'+side]:upper,['lowerarm_'+side]:lower,['hand_'+side]:hand});
  actor.neutralHandRotations[side]=hand.quaternion.clone();
  actor.selectionArmRest[side]={upperInChest:upper.quaternion.clone(),lower:lower.quaternion.clone(),hinge:new THREE.Vector3(-1,0,0),flexion:.2};
  actor.palmGrips[side]=new THREE.Vector3(0,-.08,0);actor.shaftAxes[side]=new THREE.Vector3(0,0,1);
 }
 root.updateMatrixWorld(true);return actor;
}

test('Carry solver preserves native arm lengths and restores mixer input exactly',()=>{
 for(const kind of Object.keys(TRAVEL_POSES)){
  const actor=testActor(),{root,bones}=actor,{upperarm_r:upper,lowerarm_r:lower,hand_r:hand}=bones;root.scale.setScalar(1.1);root.rotation.y=.6;
  const pose=new TravelPose(actor,kind),all=Object.values(bones),before=all.map(b=>b.quaternion.toArray());
  for(let frame=0;frame<20;frame++){pose.restore();pose.apply(1/60,true);root.updateMatrixWorld(true);assert.ok(Math.abs(upper.getWorldPosition(new THREE.Vector3()).distanceTo(lower.getWorldPosition(new THREE.Vector3()))-.297)<1e-10);assert.ok(Math.abs(lower.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()))-.275)<1e-10);}
  pose.restore();all.forEach((bone,i)=>assert.deepEqual(bone.quaternion.toArray(),before[i]));assert.deepEqual(root.position.toArray(),[0,0,0]);
  for(let frame=0;frame<11;frame++){pose.restore();pose.apply(1/60,false);}assert.equal(pose.weight,0);
 }
});

test('Carry release keeps its chosen wrist turn when the target passes a half-turn',()=>{
 const actor=testActor(),{root,bones:{lowerarm_r:lower,hand_r:hand}}=actor;
 const axis=actor.shaftAxes.r,palm=actor.palmGrips.r;
 const pose=new TravelPose(actor,'sickle');pose.weight=1;
 pose.carry.r={palm:hand.localToWorld(palm.clone()),elbow:lower.getWorldPosition(new THREE.Vector3()),axis:axis.clone(),rotation:new THREE.Quaternion()};
 let previous=new THREE.Quaternion(),largestTurn=0;
 for(let frame=0;frame<48;frame++){
  pose.restore();root.updateMatrixWorld(true);
  hand.quaternion.copy(lower.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(new THREE.Quaternion().setFromAxisAngle(axis,(160+40*frame/47)*Math.PI/180));
  pose.apply(1/240,false,{exitDuration:.2});root.updateMatrixWorld(true);
  const actual=hand.getWorldQuaternion(new THREE.Quaternion());largestTurn=Math.max(largestTurn,actual.angleTo(previous));previous=actual;
 }
 assert.ok(largestTurn<.1,`The wrist reversed its turn during release: ${largestTurn} radians`);
 assert.ok(previous.angleTo(new THREE.Quaternion().setFromAxisAngle(axis,200*Math.PI/180))<1e-6);
});

test('Carry entry converges onto the settled pose without applying its shoulder limit twice',()=>{
 for(const kind of Object.keys(TRAVEL_POSES))for(const bindTwist of [-1,0,1]){
  const actor=testActor(),pose=new TravelPose(actor,kind),bones=Object.values(actor.bones);
  actor.bones.upperarm_r.quaternion.setFromAxisAngle(new THREE.Vector3(0,-1,0),bindTwist);
  actor.selectionArmRest.r.upperInChest.copy(actor.bones.upperarm_r.quaternion);
  pose.weight=1-1e-8;pose.apply(0,true);
  const almost=bones.map(bone=>bone.quaternion.clone().normalize());pose.restore();
  pose.weight=1;pose.apply(0,true);
  const largest=Math.max(...bones.map((bone,index)=>bone.quaternion.clone().normalize().angleTo(almost[index])));
  assert.ok(largest<1e-4,`${kind} changes at the entry boundary: ${largest} radians`);
 }
});

test('Heavy hero blades retain their reach while Shinobi carries short, narrow blades',()=>{
 for(const [kind,length]of [['odachi',1.4],['twin',.53],['naginata',1.1]]){const profile=BLADE_PROFILES[kind],g=bladeGeometry(profile);assert.equal(profile.length,length);assert.ok(g.boundingBox.max.z-g.boundingBox.min.z<=.00811);if(kind!=='twin')assert.ok(profile.width>BLADE_PROFILES.lancer.width*1.6);}
 assert.ok(BLADE_PROFILES.twin.width<.05);assert.ok(BLADE_PROFILES.twin.curve<.02);
});

test('Ordinary enemy blade dimensions stay unchanged',()=>{assert.deepEqual(['scout','guard','lancer','skirmisher'].map(kind=>BLADE_PROFILES[kind].width),[.035,.045,.05,.038]);});

test('Captured carry follows torso rotation and preserves neutral wrists under actor turns',()=>{
 for(const kind of Object.keys(TRAVEL_POSES)){
  const results=[];
  for(const yaw of [0,1.1]){
   const actor=testActor(),pose=new TravelPose(actor,kind);pose.weight=1;
   actor.root.rotation.y=yaw;actor.bones.spine_03.rotation.set(.08,.15,-.04);actor.root.updateMatrixWorld(true);
   pose.apply(0,true,{bodyMotionWeight:1});
   const hand=actor.bones.hand_r,rootQ=actor.root.getWorldQuaternion(new THREE.Quaternion());
   results.push({p:actor.root.worldToLocal(hand.getWorldPosition(new THREE.Vector3())),q:rootQ.invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()))});
   assert.ok(hand.quaternion.angleTo(actor.neutralHandRotations.r)<1e-6,kind+' bends the wrist');
  }
  assert.ok(results[0].p.distanceTo(results[1].p)<1e-6,kind+' carry depends on world heading');
  assert.ok(results[0].q.angleTo(results[1].q)<1e-6,kind+' blade rotation depends on world heading');
 }
});

test('Captured carry responds continuously to animation weight and rejects invalid weights',()=>{
 const actor=testActor(),pose=new TravelPose(actor,'odachi');pose.weight=1;
 actor.bones.spine_03.rotation.set(.08,.18,0);actor.root.updateMatrixWorld(true);
 let previous,maxStep=0;
 for(let i=0;i<=100;i++){
  pose.restore();pose.apply(0,true,{bodyMotionWeight:i/100});
  const q=actor.bones.hand_r.getWorldQuaternion(new THREE.Quaternion()).normalize();
  if(previous)maxStep=Math.max(maxStep,previous.angleTo(q));previous=q;
 }
 assert.ok(maxStep<.01,'Blending captured carry introduces a rotation jump');
 for(const weight of [NaN,-.01,1.01])assert.throws(()=>pose.apply(0,true,{bodyMotionWeight:weight}),/between zero and one/);
});


test('Carry entry eases from rest and preserves its displayed weight through interruptions',()=>{
 for(const hz of [40,60,120,480]){
  const actor=testActor(),pose=new TravelPose(actor,'naginata'),dt=1/hz;
  pose.apply(dt,true);
  assert.ok(pose.weight<dt/.12,'Entry immediately applies the full linear angular rate');
  for(let i=1;i<Math.ceil(.12*hz);i++){pose.restore();pose.apply(dt,true);}
  assert.equal(pose.weight,1,'Entry does not reach the carry pose on schedule');
  pose.restore();pose.apply(.04,false,{exitDuration:.16});
  const released=pose.weight;assert.ok(released>0&&released<1);
  pose.restore();pose.apply(0,true);
  assert.equal(pose.weight,released,'Interrupted release snaps back to its old entry clock');
  pose.restore();pose.apply(.05,true);assert.equal(pose.weight,1);
  pose.reset();assert.equal(pose.weight,0);pose.restore();pose.apply(0,true);assert.equal(pose.weight,0);
 }
});
