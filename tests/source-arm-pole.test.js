import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Quaternion,Vector3,MathUtils} from 'three';
import {stabilizeSourceArmPole} from '../tools/source-arm-pole.mjs';

test('a near-straight source elbow cannot flip its plane in one frame',()=>{
 const scene=new Group(),upper=new Bone(),lower=new Bone(),hand=new Bone();scene.add(upper);upper.add(lower);lower.add(hand);lower.position.set(0,-.5,0);hand.position.set(0,-.5,0);
 const down=new Vector3(0,-1,0),state={},flex=MathUtils.degToRad(2),reach=Math.cos(flex/2),wrist=new Vector3(0,-reach,0);let previous,maxCorrection=0;
 for(let i=0;i<100;i++){
  const roll=i<20?0:MathUtils.degToRad(150),elbow=new Vector3(Math.sin(flex/2)*Math.cos(roll),-Math.cos(flex/2),Math.sin(flex/2)*Math.sin(roll)).multiplyScalar(.5);
  upper.quaternion.setFromUnitVectors(down,elbow.clone().normalize());
  lower.quaternion.copy(upper.quaternion).invert().multiply(new Quaternion().setFromUnitVectors(down,wrist.clone().sub(elbow).normalize()));
  hand.quaternion.copy(upper.quaternion.clone().multiply(lower.quaternion).invert());scene.updateMatrixWorld(true);
  const r=stabilizeSourceArmPole({upper,lower,hand,state,dt:1/240,hinge:new Vector3(0,0,1)});maxCorrection=Math.max(maxCorrection,r.wristCorrection);
  if(previous)assert.ok(previous.angleTo(state.bend)<=MathUtils.degToRad(3)+1e-7,'The elbow plane jumped.');previous=state.bend.clone();
  const a=upper.getWorldPosition(new Vector3()),b=lower.getWorldPosition(new Vector3()),c=hand.getWorldPosition(new Vector3());
  assert.ok(Math.abs(a.distanceTo(b)-.5)<1e-7&&Math.abs(b.distanceTo(c)-.5)<1e-7,'A limb stretched.');
  assert.ok(hand.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion())<1e-7,'The fixed hand frame changed.');
 }
 assert.ok(maxCorrection<.0025);assert.ok(state.bend.angleTo(new Vector3(Math.cos(MathUtils.degToRad(150)),0,Math.sin(MathUtils.degToRad(150))))<1e-6);
});
