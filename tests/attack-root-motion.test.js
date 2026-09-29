import test from 'node:test';
import assert from 'node:assert/strict';
import {attackRootDelta,samplePlanarRoot,validatePlanarRoot} from '../src/attack-root-motion.js';

const makePath=()=>({duration:1.4,rows:[{time:0,x:0,z:0},{time:.17,x:-.12,z:.35},{time:.31,x:.08,z:.83},{time:1.4,x:.02,z:1.15}]});

test('Attack travel is identical across frame rates, playback durations and headings',()=>{
 for(const hz of [30,40,50,60,120])for(const duration of [.7,1.1,2.8])for(const yaw of [0,.73,-2.6]){
  const path=makePath(),position={x:0,z:0};let time=0;
  while(time<duration){const next=Math.min(duration,time+1/hz),d=attackRootDelta(path,time,next,duration,yaw,1.1);position.x+=d.x;position.z+=d.z;time=next;}
  const expected=attackRootDelta(path,0,duration,duration,yaw,1.1);
  assert.ok(Math.hypot(position.x-expected.x,position.z-expected.z)<1e-12);
  const finished=attackRootDelta(path,duration,duration+.2,duration,yaw,1.1);assert.equal(Math.hypot(finished.x,finished.z),0);
 }
});

test('Paused and cancelled actions do not apply remaining or repeated travel',()=>{
 const path=makePath(),first=attackRootDelta(path,0,.21,1.4,0),paused=attackRootDelta(path,.21,.21,1.4,0);
 assert.deepEqual(paused,{x:0,z:0});assert.deepEqual(first,samplePlanarRoot(path,.21));
 // A cancelled action makes no further calls. A new action starts from its
 // own zero, rather than retaining the old action's animation cursor.
 assert.deepEqual(attackRootDelta(path,0,.21,1.4,0),first);
});

test('Root samples preserve breakpoints and clamp to both ends',()=>{
 const path=makePath();
 for(const row of path.rows){const p=samplePlanarRoot(path,row.time);assert.ok(Math.hypot(p.x-row.x,p.z-row.z)<1e-14);}
 assert.deepEqual(samplePlanarRoot(path,-5),{x:0,z:0});
 const end=samplePlanarRoot(path,5);assert.ok(Math.hypot(end.x-.02,end.z-1.15)<1e-14);
 assert.throws(()=>samplePlanarRoot(path,NaN),/finite/);
});

test('Malformed root paths and action parameters fail with an actionable error',()=>{
 for(const patch of [{duration:0},{rows:[]},{rows:[{time:0,x:1,z:0},{time:1.4,x:0,z:1}]},{rows:[{time:0,x:0,z:0},{time:0,x:0,z:1}]},{rows:[{time:0,x:0,z:0},{time:1.4,x:NaN,z:1}]}])
  assert.throws(()=>validatePlanarRoot({...makePath(),...patch}),/root/i);
 for(const args of [[.2,.1,1,0,1],[0,1,0,0,1],[0,1,1,NaN,1],[0,1,1,0,-1]])
  assert.throws(()=>attackRootDelta(makePath(),...args),/Root travel/);
});
