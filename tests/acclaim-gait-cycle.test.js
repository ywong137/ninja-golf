import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseAcclaimSkeleton,parseAcclaimMotion} from '../tools/acclaim-motion.mjs';
import {createAcclaimGaitCycle} from '../tools/acclaim-gait-cycle.mjs';
const skeleton=parseAcclaimSkeleton(fs.readFileSync(new URL('./fixtures/cmu-running/09.asf',import.meta.url),'utf8'));
const motion=parseAcclaimMotion(fs.readFileSync(new URL('./fixtures/cmu-running/09_01.amc',import.meta.url),'utf8'),skeleton);
const cycle=createAcclaimGaitCycle(skeleton,motion,{startFrame:2,endFrame:90,rate:120});

test('optional capture filtering preserves the loop, mean, and one-axis knees',()=>{
 const filtered=createAcclaimGaitCycle(skeleton,motion,{startFrame:2,endFrame:90,rate:120,smooth:true});
 assert.equal(filtered.duration,cycle.duration);
 assert.equal(filtered.horizontalTravel,cycle.horizontalTravel);
 const count=cycle.count,raw=Array.from({length:count},(_,i)=>cycle.channelsAt(i/count)),smooth=Array.from({length:count},(_,i)=>filtered.channelsAt(i/count));
 for(const name of Object.keys(raw[0]))for(let axis=0;axis<raw[0][name].length;axis++){
  const a=raw.map(r=>r[name][axis]),b=smooth.map(r=>r[name][axis]);
  assert.ok(Math.abs(a.reduce((x,y)=>x+y,0)-b.reduce((x,y)=>x+y,0))<1e-8,'Filtering changed a channel mean');
  assert.ok(Math.min(...b)>=Math.min(...a)-1e-9&&Math.max(...b)<=Math.max(...a)+1e-9,'Filtering introduced a new joint extremum');
 }
 for(let i=0;i<=480;i++)for(const side of ['r','l']){
  const knee=filtered.channelsAt(i/480)[side+'tibia'];
  assert.equal(knee.length,1);assert.ok(knee[0]>=0&&knee[0]<160);
 }
 assert.deepEqual(filtered.channelsAt(0),filtered.channelsAt(1));
 const speed=rows=>Math.max(...rows.map((r,i)=>Math.abs(r.root[4]-rows[(i+1)%count].root[4])));
 assert.ok(speed(smooth)<speed(raw),'The filter must reduce the captured hip velocity peak');
});
