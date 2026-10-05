import test from 'node:test';
import assert from 'node:assert/strict';
import {attackControlWindow,movementRedirected,steerAttack,swingSoundTimes} from '../src/combat-control.js';
const a={kind:'heavy',hits:[.5,1.2],duration:2,time:0};
test('A strike commits only through contact, with cancellable startup and recovery',()=>{
 for(const time of [0,.2,.7,1,1.4,1.9])assert.ok(attackControlWindow({...a,time}).cancel,`time ${time}`);
 for(const time of [.4,.5,.6,1.1,1.2,1.3])assert.equal(attackControlWindow({...a,time}).cancel,false,`time ${time}`);
 assert.equal(attackControlWindow({...a,kind:'musou',time:1.9}).cancel,false);
 assert.equal(attackControlWindow({...a,time:1.4}).recovery,true);
});
test('New travel and changed direction break an attack, but held forward does not',()=>{
 const forward={x:0,z:1};
 assert.ok(movementRedirected({x:0,z:0},forward));
 assert.ok(movementRedirected(forward,{x:0,z:-1}));
 assert.ok(movementRedirected(forward,{x:1,z:0}));
 assert.equal(movementRedirected(forward,{x:0,z:0}),false);
 assert.equal(movementRedirected(forward,{x:0,z:.5}),false);
});
test('Steering crosses the angle seam on the shortest path at a bounded rate',()=>{
 assert.ok(steerAttack(Math.PI-.01,-Math.PI+.02,.016)>Math.PI);
 for(const hz of [40,60,144]){
  let yaw=0;for(let i=0;i<hz*.5;i++)yaw=steerAttack(yaw,Math.PI,1/hz);
  assert.ok(Math.abs(yaw-Math.PI)<1e-8);
 }
});
test('Each swing produces one air cue before its contact marker',()=>{
 assert.deepEqual(swingSoundTimes(a),[.31,1.01]);
 assert.deepEqual(swingSoundTimes({...a,kind:'light',hits:[.1,.5]}),[0,.37]);
});
