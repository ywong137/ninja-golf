import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TravelPose,TRAVEL_POSES} from '../src/travel-pose.js';
import {bladeGeometry,BLADE_PROFILES} from '../src/weapons.js';

test('Carry solver preserves native arm lengths and restores mixer input exactly',()=>{
 for(const kind of Object.keys(TRAVEL_POSES)){
  const root=new THREE.Group(),upper=new THREE.Bone(),lower=new THREE.Bone(),hand=new THREE.Bone();root.add(upper);upper.add(lower);lower.add(hand);upper.position.set(-.2,1.45,0);lower.position.set(0,-.27,0);hand.position.set(0,-.25,0);root.scale.setScalar(1.1);root.rotation.y=.6;
  const bones={upperarm_r:upper,lowerarm_r:lower,hand_r:hand},actor={root,bones,palmGrips:{r:new THREE.Vector3(0,-.08,0)},shaftAxes:{r:new THREE.Vector3(0,0,1)},runPhase:.3,offhand:null},pose=new TravelPose(actor,kind),before=[upper,lower,hand].map(b=>b.quaternion.clone());
  for(let frame=0;frame<20;frame++){pose.restore();pose.apply(1/60,true);root.updateMatrixWorld(true);assert.ok(Math.abs(upper.getWorldPosition(new THREE.Vector3()).distanceTo(lower.getWorldPosition(new THREE.Vector3()))-.297)<1e-10);assert.ok(Math.abs(lower.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()))-.275)<1e-10);}
  pose.restore();[upper,lower,hand].forEach((bone,i)=>assert.ok(bone.quaternion.angleTo(before[i])<1e-10));assert.deepEqual(root.position.toArray(),[0,0,0]);
  for(let frame=0;frame<11;frame++){pose.restore();pose.apply(1/60,false);}assert.equal(pose.weight,0);
 }
});

test('Thinner steel retains original reach and hero-to-enemy size contrast',()=>{
 for(const [kind,length]of [['odachi',1.4],['twin',.94],['naginata',1.1]]){const profile=BLADE_PROFILES[kind],g=bladeGeometry(profile);assert.equal(profile.length,length);assert.ok(g.boundingBox.max.z-g.boundingBox.min.z<=.00811);assert.ok(profile.width>BLADE_PROFILES.lancer.width*1.6);}
});

test('Ordinary enemy blade dimensions stay unchanged',()=>{assert.deepEqual(['scout','guard','lancer','skirmisher'].map(kind=>BLADE_PROFILES[kind].width),[.035,.045,.05,.038]);});
