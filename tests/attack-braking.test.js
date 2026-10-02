import test from 'node:test';
import assert from 'node:assert/strict';
import {attackEntryVelocity,attackEntryVelocityAt} from '../src/attack-braking.js';

test('Attack entry decelerates from the actual travel velocity with a frame-independent stopping distance',()=>{
 for(const hz of [40,50,60,144,240]){
  const dt=1/hz;let distance=0,previous=5.6;
  for(let t=0;t<.4;t+=dt){
   const velocity=attackEntryVelocity({x:0,z:5.6},{x:0,z:0},t,dt);
   assert.ok(velocity.z<=previous+1e-10&&velocity.z>=-1e-10);
   distance+=velocity.z*dt;previous=velocity.z;
  }
  assert.ok(Math.abs(distance-.504)<1e-10,`${hz} Hz stopped at ${distance} m`);
 }
});

test('Attack entry retains requested movement and permits an input reversal',()=>{
 const same=attackEntryVelocity({x:2,z:3},{x:2,z:3},.05,.01);
 assert.deepEqual(same,{x:2,z:3});
 const source={x:0,z:5.6},wanted={x:2.52,z:-2.52};
 const middle=attackEntryVelocity(source,wanted,.08,.01);
 assert.ok(middle.x>0&&middle.x<wanted.x&&middle.z<source.z&&middle.z>wanted.z);
 assert.deepEqual(attackEntryVelocity(source,wanted,.18,.01),wanted);
 assert.throws(()=>attackEntryVelocity(source,wanted,0,0),/positive dt/);
});

test('instantaneous velocity agrees with the integrated controller profile',()=>{
 const source={x:-1,z:2.52},wanted={x:2,z:5.6},duration=.2,dt=1e-5;
 for(const time of [0,.04,.1,.16,.2,.3]){
  const instant=attackEntryVelocityAt(source,wanted,time,duration);
  const mean=attackEntryVelocity(source,wanted,Math.max(0,time-dt/2),dt,duration);
  for(const axis of ['x','z'])assert.ok(Math.abs(instant[axis]-mean[axis])<1e-7);
 }
 assert.deepEqual(attackEntryVelocityAt(source,wanted,0,duration),source);
 assert.deepEqual(attackEntryVelocityAt(source,wanted,.2,duration),wanted);
});

test('a delayed acceleration predicts source travel before its start at every frame rate',()=>{
 const source={x:0,z:2.52},wanted={x:0,z:5.6},delay=.16,duration=.2,end=.4;
 assert.deepEqual(attackEntryVelocity(source,wanted,-delay,.05,duration),source);
 assert.deepEqual(attackEntryVelocityAt(source,wanted,-delay,duration),source);
 const expected=source.z*delay+(source.z+wanted.z)*duration/2+wanted.z*(end-duration);
 for(const rate of [40,60,144,240]){
  let time=-delay,distance=0;
  while(time<end-1e-12){
   const dt=Math.min(1/rate,end-time);
   distance+=attackEntryVelocity(source,wanted,time,dt,duration).z*dt;time+=dt;
  }
  assert.ok(Math.abs(distance-expected)<1e-10,`${rate} Hz predicted ${distance} m instead of ${expected} m`);
 }
});
