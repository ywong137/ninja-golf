import test from 'node:test';
import assert from 'node:assert/strict';
import {activeBladeTrailHands} from '../src/effects.js';

test('alternating dual attacks leave the covering blade without a hit trail',()=>{
 const action={hits:[.28,.532],impactHands:['r','l']};
 for(const offset of [-.08,0,.08]){
  assert.deepEqual(activeBladeTrailHands({...action,time:.28+offset},true),['r']);
  assert.deepEqual(activeBladeTrailHands({...action,time:.532+offset},true),['l']);
 }
 assert.deepEqual(activeBladeTrailHands({...action,time:0},true),[]);
 assert.deepEqual(activeBladeTrailHands({...action,time:.812},true),[]);
});

test('overlapping cuts, legacy dual attacks, and single swords retain their own trail channels',()=>{
 assert.deepEqual(activeBladeTrailHands({hits:[.3,.4],time:.35,impactHands:['r','l']},true),['r','l']);
 assert.deepEqual(activeBladeTrailHands({hits:[.3],time:.3,impactHands:['both']},true),['r','l']);
 assert.deepEqual(activeBladeTrailHands({hits:[.3],time:.3},true),['r','l']);
 assert.deepEqual(activeBladeTrailHands({hits:[.3],time:.3},false),['r']);
 assert.deepEqual(activeBladeTrailHands({hits:[.3],time:.3,impactHands:['both']},false),['r']);
 assert.throws(()=>activeBladeTrailHands({hits:[.3],time:.3,impactHands:['unknown']},true),/Unknown attack hand/);
});
