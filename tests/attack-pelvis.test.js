import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Euler,MathUtils,Quaternion,Vector3} from 'three';
import {blendAttackPelvis} from '../src/attack-pelvis.js';

const up=new Vector3(0,1,0),rad=MathUtils.degToRad;
const pose=(yaw,pitch=0,roll=0)=>new Quaternion().setFromEuler(new Euler(rad(pitch),rad(yaw),rad(roll),'YXZ'));

test('Moving cuts bound residual yaw on either side without changing the pelvic lean',()=>{
 for(const yaw of [-170,-90,-40,-20,0,20,40,90,170])for(const pitch of [-20,0,25]){
  const original=pose(yaw,pitch,12),gait=pose(0,-4,3),turned=original.clone().slerp(gait,.55);
  const result=blendAttackPelvis(original,gait,{turnWeight:.55,walkWeight:1});
  assert.ok(Math.abs(result.afterYaw)<=rad(18)+1e-9,`Residual yaw ${result.afterYaw}`);
  const beforeLean=up.clone().applyQuaternion(turned).dot(up),afterLean=up.clone().applyQuaternion(result.rotation).dot(up);
  assert.ok(Math.abs(beforeLean-afterLean)<1e-12,'The yaw constraint changes pelvic lean');
  assert.ok(Math.abs(result.afterYaw)<=Math.abs(result.beforeYaw)+1e-12,'The correction increases the turn');
 }
});

test('Small moving cuts and stationary poses keep their existing rotations',()=>{
 const original=pose(12,20,-10),gait=pose(0,0,0);
 for(const [turnWeight,walkWeight]of [[0,0],[.55,1]]){
  const expected=original.clone().slerp(gait,turnWeight),result=blendAttackPelvis(original,gait,{turnWeight,walkWeight});
  assert.equal(result.extraYaw,0);assert.ok(result.rotation.angleTo(expected)<1e-7);
 }
 const still=blendAttackPelvis(pose(100),gait,{turnWeight:0,walkWeight:0});
 assert.ok(still.rotation.angleTo(pose(100))<1e-7);
});

test('The yaw rule follows the actor frame and does not depend on quaternion sign',()=>{
 const frame=pose(72,15,8),axis=up.clone().applyQuaternion(frame),original=pose(-80,18,5),gait=pose(3,-5,2);
 const a=blendAttackPelvis(original,gait,{turnWeight:.4,walkWeight:1});
 const rotated=blendAttackPelvis(frame.clone().multiply(original),frame.clone().multiply(gait),{turnWeight:.4,walkWeight:1,up:axis});
 assert.ok(rotated.rotation.angleTo(frame.clone().multiply(a.rotation))<1e-7);
 const negative=gait.clone();negative.set(-negative.x,-negative.y,-negative.z,-negative.w);
 const b=blendAttackPelvis(original,negative,{turnWeight:.4,walkWeight:1});
 assert.ok(a.rotation.angleTo(b.rotation)<1e-7);
});

test('Crossing either end of the yaw band has continuous speed and acceleration',()=>{
 const value=yaw=>blendAttackPelvis(pose(0),pose(yaw),{turnWeight:0,walkWeight:1}).extraYaw;
 const h=.0005;
 for(const boundary of [-22,-14,14,22]){
  const f=value(boundary),before=(f-value(boundary-h))/h,after=(value(boundary+h)-f)/h;
  assert.ok(Math.abs(after-before)<1e-7,`Speed changes at ${boundary}`);
  const a=(f-2*value(boundary-h)+value(boundary-2*h))/h**2;
  const b=(value(boundary+2*h)-2*value(boundary+h)+f)/h**2;
  assert.ok(Math.abs(a-b)<1e-5,`Acceleration changes at ${boundary}`);
 }
});
