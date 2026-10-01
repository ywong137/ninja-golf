import test from 'node:test';
import assert from 'node:assert/strict';
import {attackContinuation,matchesContinuationBoundary} from '../src/attack-continuation.js';
const records={first:{duration:.6,impacts:[.28],continuations:{light:{at:.384,clip:'second',step:1}}},second:{duration:.71,combatDuration:.5,impacts:[.295]}};
const action={motionName:'first',time:.25,duration:.4},queued={kind:'light',expires:2};
test('A queued branch uses native time and waits until the first cut has landed',()=>{
 assert.deepEqual(attackContinuation(action,queued,1,1/60,records),{clip:'second',step:1,kind:'light',at:.256});
 assert.equal(attackContinuation({...action,time:.2},queued,1,1/60,records),null);
});
test('Unqueued, expired, late, or incompatible input keeps ordinary recovery',()=>{
 for(const q of [null,{...queued,expires:.99},{...queued,kind:'heavy'}])assert.equal(attackContinuation(action,q,1,1/60,records),null);
 assert.equal(attackContinuation({...action,time:.27},queued,1,1/60,records),null);
 assert.equal(attackContinuation({...action,motionName:'ordinary'},queued,1,1/60,records),null);
});
test('Invalid branches fail before an impact can be skipped',()=>{
 for(const at of [0,NaN,.25,.6]){
  const invalid=structuredClone(records);invalid.first.continuations.light.at=at;
  assert.throws(()=>attackContinuation(action,queued,1,1/60,invalid),/continuation/i);
 }
 const invalid=structuredClone(records);delete invalid.second.combatDuration;
 assert.throws(()=>attackContinuation(action,queued,1,1/60,invalid),/combat duration/);
 for(const impacts of [undefined,[NaN],[-.1],[.71]]){
  const bad=structuredClone(records);bad.second.impacts=impacts;
  assert.throws(()=>attackContinuation(action,queued,1,1/60,bad),/Invalid attack continuation/);
 }
});
test('Only the named target at its declared boundary is eligible for direct entry',()=>{
 assert.equal(matchesContinuationBoundary(records.first,'second',.384),true);
 assert.equal(matchesContinuationBoundary(records.first,'second',.3),false);
 assert.equal(matchesContinuationBoundary(records.first,'unrelated',.384),false);
 assert.equal(matchesContinuationBoundary(null,'second',.384),false);
});
