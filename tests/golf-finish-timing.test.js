import test from 'node:test';
import assert from 'node:assert/strict';
import {golfFinishSourceTime} from '../tools/golf-finish-timing.mjs';

test('Golf finish timing preserves contact, stays continuous, and never runs a pose backward',()=>{
  let last=-Infinity;
  for(let i=0;i<=24000;i++){
    const time=i/10000,source=golfFinishSourceTime(time);
    assert.ok(source>=last&&source>=0&&source<=2.4);
    if(time<=1.75)assert.equal(source,time,'Retiming changed the downswing or contact');
    if(i)assert.ok(source-last<.0003,'Retiming produces a discontinuous pose time');
    last=source;
  }
  assert.equal(last,2.4,'Retiming lost the final pose');
});
