import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TravelPose,TRAVEL_POSES} from '../src/travel-pose.js';
import {bladeGeometry,BLADE_PROFILES} from '../src/weapons.js';

test('Carry solver preserves native arm lengths and restores mixer input exactly',()=>{
 for(const kind of Object.keys(TRAVEL_POSES)){
  const root=new THREE.Group(),upper=new THREE.Bone(),lower=new THREE.Bone(),hand=new THREE.Bone();root.add(upper);upper.add(lower);lower.add(hand);upper.position.set(-.2,1.45,0);lower.position.set(0,-.27,0);hand.position.set(0,-.25,0);root.scale.setScalar(1.1);root.rotation.y=.6;
  const bones={upperarm_r:upper,lowerarm_r:lower,hand_r:hand},actor={root,bones,neutralHandRotations:{r:hand.quaternion.clone()},palmGrips:{r:new THREE.Vector3(0,-.08,0)},shaftAxes:{r:new THREE.Vector3(0,0,1)},runPhase:.3,offhand:null},pose=new TravelPose(actor,kind),before=[upper,lower,hand].map(b=>b.quaternion.clone());
  for(let frame=0;frame<20;frame++){pose.restore();pose.apply(1/60,true);root.updateMatrixWorld(true);assert.ok(Math.abs(upper.getWorldPosition(new THREE.Vector3()).distanceTo(lower.getWorldPosition(new THREE.Vector3()))-.297)<1e-10);assert.ok(Math.abs(lower.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()))-.275)<1e-10);}
  pose.restore();[upper,lower,hand].forEach((bone,i)=>assert.ok(bone.quaternion.angleTo(before[i])<1e-10));assert.deepEqual(root.position.toArray(),[0,0,0]);
  for(let frame=0;frame<11;frame++){pose.restore();pose.apply(1/60,false);}assert.equal(pose.weight,0);
 }
});

test('Carry release keeps its chosen wrist turn when the target passes a half-turn',()=>{
 const root=new THREE.Group(),upper=new THREE.Bone(),lower=new THREE.Bone(),hand=new THREE.Bone();
 root.add(upper);upper.add(lower);lower.add(hand);upper.position.set(-.2,1.45,0);lower.position.set(0,-.27,0);hand.position.set(0,-.25,0);root.updateMatrixWorld(true);
 const axis=new THREE.Vector3(0,0,1),palm=new THREE.Vector3(0,-.08,0);
 const actor={root,bones:{upperarm_r:upper,lowerarm_r:lower,hand_r:hand},palmGrips:{r:palm},shaftAxes:{r:axis},runPhase:0,offhand:null};
 const pose=new TravelPose(actor,'sickle');pose.weight=1;
 pose.carry.r={palm:hand.localToWorld(palm.clone()),elbow:lower.getWorldPosition(new THREE.Vector3()),axis:axis.clone(),rotation:new THREE.Quaternion()};
 let previous=new THREE.Quaternion(),largestTurn=0;
 for(let frame=0;frame<48;frame++){
  pose.restore();hand.quaternion.setFromAxisAngle(axis,(160+40*frame/47)*Math.PI/180);
  pose.apply(1/240,false,{exitDuration:.2});root.updateMatrixWorld(true);
  const actual=hand.getWorldQuaternion(new THREE.Quaternion());largestTurn=Math.max(largestTurn,actual.angleTo(previous));previous=actual;
 }
 assert.ok(largestTurn<.1,`The wrist reversed its turn during release: ${largestTurn} radians`);
 assert.ok(previous.angleTo(new THREE.Quaternion().setFromAxisAngle(axis,200*Math.PI/180))<1e-6);
});

test('Heavy hero blades retain their reach while Shinobi carries short, narrow blades',()=>{
 for(const [kind,length]of [['odachi',1.4],['twin',.53],['naginata',1.1]]){const profile=BLADE_PROFILES[kind],g=bladeGeometry(profile);assert.equal(profile.length,length);assert.ok(g.boundingBox.max.z-g.boundingBox.min.z<=.00811);if(kind!=='twin')assert.ok(profile.width>BLADE_PROFILES.lancer.width*1.6);}
 assert.ok(BLADE_PROFILES.twin.width<.05);assert.ok(BLADE_PROFILES.twin.curve<.02);
});

test('Ordinary enemy blade dimensions stay unchanged',()=>{assert.deepEqual(['scout','guard','lancer','skirmisher'].map(kind=>BLADE_PROFILES[kind].width),[.035,.045,.05,.038]);});
