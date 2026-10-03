import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {measurePalmPronation} from '../tools/source-arm-pronation.mjs';

test('palm pronation follows visible landmarks and cancels whole-body rotations',()=>{
 const calibration={hingeAxisLocal:new Vector3(1,0,0)};
 for(const degrees of [-120,-45,0,65,150]){
  const turn=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),degrees*Math.PI/180);
  const arm={elbow:new Vector3(),wrist:new Vector3(0,0,1),upperArmQuaternion:new Quaternion()};
  const palm={indexKnuckle:new Vector3(1,0,1).applyQuaternion(turn),pinkyKnuckle:new Vector3(-1,0,1).applyQuaternion(turn)};
  assert.ok(Math.abs(measurePalmPronation(calibration,arm,palm)-degrees)<1e-8);
  const whole=new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),2.1);
  for(const p of [arm.elbow,arm.wrist,palm.indexKnuckle,palm.pinkyKnuckle])p.applyQuaternion(whole).add(new Vector3(4,5,6));
  arm.upperArmQuaternion.premultiply(whole);
  assert.ok(Math.abs(measurePalmPronation(calibration,arm,palm)-degrees)<1e-8);
 }
});
