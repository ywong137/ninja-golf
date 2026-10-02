import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {soleForward} from '../src/knee-alignment.js';

test('recovering toes can point backward without reversing shoe heading',()=>{
 const up=new Vector3(0,1,0),toe=new Vector3(0,-.04,.2),right=new Vector3(1,0,0);
 for(const yaw of [-2,-.6,0,.8,2.7])for(const pitch of [-2.4,-1.6,-1.3,0,1.3,1.6,2.4]){
  const q=new Quaternion().setFromAxisAngle(up,yaw).multiply(new Quaternion().setFromAxisAngle(right,pitch));
  const actual=soleForward(up,toe,q),expected=new Vector3(Math.sin(yaw),0,Math.cos(yaw));
  assert.ok(actual.distanceTo(expected)<1e-12,`heading flipped at yaw ${yaw}, pitch ${pitch}`);
 }
});

test('shoe heading is independent of the imported bone axes',()=>{
 const bind=new Quaternion().setFromAxisAngle(new Vector3(.3,.4,.5).normalize(),1.3);
 const localUp=new Vector3(0,1,0).applyQuaternion(bind.clone().invert());
 const localToe=new Vector3(0,0,.2).applyQuaternion(bind.clone().invert());
 for(const pitch of [-2,-1,0,1,2]){
  const q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),pitch).multiply(bind);
  assert.ok(soleForward(localUp,localToe,q).distanceTo(new Vector3(0,0,1))<1e-12);
 }
});
