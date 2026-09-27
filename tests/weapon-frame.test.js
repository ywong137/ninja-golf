import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {alignWeaponShaft,palmWeaponBasis} from '../src/weapon-frame.js';

const y=new Vector3(0,1,0),x=new Vector3(1,0,0);

test('Palm bases retain shaft and knuckle directions in either hand',()=>{
 for(const side of [-1,1]){
  const shaft=new Vector3(.91,.21,side*.36).normalize(),knuckle=new Vector3(-.19,.98,side*.08);
  const frame=palmWeaponBasis(shaft,knuckle),forward=knuckle.clone().addScaledVector(shaft,-knuckle.dot(shaft)).normalize();
  assert.ok(y.clone().applyQuaternion(frame).distanceTo(shaft)<1e-12);
  assert.ok(new Vector3(0,0,-1).applyQuaternion(frame).distanceTo(forward)<1e-12);
 }
 assert.throws(()=>palmWeaponBasis(y,y),/knuckle direction/);
});

test('A downward blade sweep retains hand roll across the world-axis singularity',()=>{
 const tilt=new Quaternion().setFromAxisAngle(y,.7);let previous=null;
 for(let i=-120;i<=120;i++){
  const hand=new Quaternion().setFromAxisAngle(x,Math.PI+i*.001).multiply(tilt);
  const nativeAxis=y.clone().applyQuaternion(hand),target=nativeAxis.clone().applyAxisAngle(x,.015);
  const blade=alignWeaponShaft(hand.clone(),target);
  assert.ok(y.clone().applyQuaternion(blade).distanceTo(target)<1e-12);
  assert.ok(Math.abs(hand.angleTo(blade)-.015)<1e-10);
  if(previous)assert.ok(previous.angleTo(blade)<.001001);
  previous=blade;
 }
});

test('A half-turn correction uses the hand frame and is independent of world orientation',()=>{
 const hand=new Quaternion().setFromAxisAngle(y,.43),target=y.clone().negate();
 const corrected=alignWeaponShaft(hand.clone(),target);
 assert.ok(y.clone().applyQuaternion(corrected).distanceTo(target)<1e-12);
 assert.ok(x.clone().applyQuaternion(corrected).distanceTo(x.clone().applyQuaternion(hand))<1e-12);
 const world=new Quaternion().setFromAxisAngle(new Vector3(.3,.5,.7).normalize(),1.3);
 const rotated=alignWeaponShaft(hand.clone().premultiply(world),target.clone().applyQuaternion(world));
 assert.ok(rotated.angleTo(corrected.premultiply(world))<1e-7);
});
