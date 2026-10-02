import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRunCadence,runPhaseTime} from '../src/run-cadence.js';

test('cadence integrates the ramp and the constant-speed remainder',()=>{
 const result=advanceRunCadence(1,2,.5);
 assert.equal(result.rate,2);
 assert.equal(result.phase,.375+.5);
 const reverse=advanceRunCadence(2,1,.5);
 assert.equal(reverse.rate,1);
 assert.equal(reverse.phase,.375+.25);
});

test('landing time remains fixed as cadence changes at different frame rates',()=>{
 for(const [initial,wanted] of [[1/.48,1.657],[1.4,2.2],[1.8,1.8]])for(const hz of [40,144]){
  const expected=runPhaseTime(initial,wanted,.5);let rate=initial,phase=0,time=0;
  while(time<expected.duration-1e-10){
   const future=runPhaseTime(rate,wanted,.5-phase);
   assert.ok(Math.abs(time+future.duration-expected.duration)<1e-10,'The predicted landing moved with the frame rate.');
   const dt=Math.min(1/hz,expected.duration-time),next=advanceRunCadence(rate,wanted,dt);
   phase+=next.phase;rate=next.rate;time+=dt;
  }
  assert.ok(Math.abs(phase-.5)<1e-10);
  assert.ok(Math.abs(rate-expected.rate)<1e-10);
 }
});

test('invalid cadence requests fail before producing an invalid pose',()=>{
 assert.throws(()=>advanceRunCadence(0,1,.1),/positive/);
 assert.throws(()=>runPhaseTime(1,-1,.1),/positive/);
 assert.throws(()=>advanceRunCadence(1,2,NaN),/finite/);
 assert.throws(()=>runPhaseTime(1,2,-1),/nonnegative/);
});
