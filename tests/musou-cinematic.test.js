import test from 'node:test';import assert from 'node:assert/strict';
import {musouCameraFrame,musouReadyPose} from '../src/musou-cinematic.js';
test('The camera moves around the hero at a constant radius in each shot',()=>{
 for(const [lo,hi]of [[0,.33],[.34,1]]){
  const first=musouCameraFrame(lo),last=musouCameraFrame(hi);
  assert.equal(first.distance,last.distance);assert.ok(Math.abs(first.yaw-last.yaw)>.4);
  assert.ok(first.distance>=1.2);
 }
 assert.equal(musouCameraFrame(.33).shot,0);assert.equal(musouCameraFrame(.34).shot,1);
});
test('Reduced motion retains framing without camera orbit or roll',()=>{
 const a=musouCameraFrame(.4,{reducedMotion:true}),b=musouCameraFrame(.95,{reducedMotion:true});
 assert.equal(a.yaw,b.yaw);assert.equal(a.roll,0);
});
test('The cinematic samples captured preparation, never a strike or an unrelated idle',()=>{
 const motions={cut:{duration:2,impacts:[.6]}};
 const a=musouReadyPose(motions,'cut',0),b=musouReadyPose(motions,'cut',1);
 assert.equal(a.clip,'cut');assert.ok(a.time<b.time&&b.time<.6);
 assert.throws(()=>musouReadyPose(motions,'missing',1),/authored attack windup/);
});
