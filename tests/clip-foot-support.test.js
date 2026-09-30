import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveFootSupport,attackFootContacts} from '../src/foot-placement.js';

const shared={duration:2.4,footPlants:{r:[[0,1.42]],l:[[0,1.1]]},toePlants:{r:[[1.42,2.4]],l:[[1.1,2.4]]},nativeKneeHinges:true};
const support={footPlants:{r:[[0,1.4086]],l:[[0,1.1]]},toePlants:{r:[[1.4086,2.4]],l:[[1.1,2.4]]}};
const animation=footSupport=>({name:'Golf_Swing',duration:Math.fround(2.4),userData:{footSupport}});

test('A retimed character keeps its own foot schedule without changing other characters',()=>{
 const original=structuredClone(shared),retimed=resolveFootSupport(animation(support),shared);
 assert.equal(resolveFootSupport(animation(),shared),shared);
 assert.deepEqual(shared,original);
 assert.equal(retimed.nativeKneeHinges,true);
 assert.equal(retimed.footPlants.r[0][1],1.4086);
 // Support must stay continuous across the earlier heel-to-toe transition.
 for(const t of [0,1.1,1.4085,1.4086,1.4087,1.42,2.4,Math.fround(2.4)])
  assert.deepEqual(attackFootContacts(retimed,t,null),{contactWeights:{r:1,l:1},stance:{r:true,l:true}});
});

test('Imported foot schedules fail on missing, reversed, overlapping or out-of-range intervals',()=>{
 for(const range of [[-.1,1],[2,1],[0,3],[0,NaN],[0]]){
  const data=structuredClone(support);data.footPlants.r=[range];
  assert.throws(()=>resolveFootSupport(animation(data),shared),/Invalid footPlants.r/);
 }
 const overlap=structuredClone(support);overlap.toePlants.r=[[1,1.5],[1.4,2.4]];
 assert.throws(()=>resolveFootSupport(animation(overlap),shared),/Invalid toePlants.r/);
 assert.throws(()=>resolveFootSupport(animation({}),shared),/Invalid/);
 assert.throws(()=>resolveFootSupport(animation(support),{duration:3}),/matching motion duration/);
});
