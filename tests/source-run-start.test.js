import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceRunStart,runStartContacts,runStartBrakingProfile,validateRunStart,selectRunStartLoadingTime} from '../src/source-run-start.js';
import {sourceSupportIntervals} from '../src/source-gait-clock.js';

const profile={version:1,duration:1,exitTime:.75,exitSpeed:2,contactFade:.02,contacts:{r:[[-.2,.15],[.5,.65],[.9,1]],l:[[-.2,.4],[.75,.9]]},root:{duration:1,rows:[{time:0,x:0,z:0},{time:.25,x:.01,z:.0625},{time:.5,x:0,z:.25},{time:.75,x:0,z:.5625},{time:1,x:0,z:1}]}};
test('a loaded restart matches source compression before the pushing foot leaves support',()=>{
 const samples={count:100,rows:Array.from({length:101},(_,i)=>({pelvis:{y:1-i/100}}))};
 assert.equal(selectRunStartLoadingTime(profile,samples,.72),.28);
 assert.equal(selectRunStartLoadingTime(profile,samples,.3),.39,'The entry must precede the end of the pushing support');
 assert.throws(()=>selectRunStartLoadingTime(profile,samples,NaN),/finite pelvis height/);
});
test('a loaded restart accelerates from rest on the same source path at 40 and 120 Hz',()=>{
 const results=[];
 for(const hz of [40,120]){
  const clock=new SourceRunStart(profile,1);clock.begin(2,0,{time:.3,fromRest:true});
  assert.equal(clock.state.rate,0);let travel=0,frame;
  for(let i=0;i<hz*.3;i++){frame=clock.advance(1/hz);travel+=frame.delta.z;}
  assert.ok(Math.abs(frame.time-.435)<1e-12);assert.ok(Math.abs(frame.rate-.9)<1e-12);
  results.push(travel);
 }
 assert.ok(Math.abs(results[0]-results[1])<1e-12,'The loading displacement depends on render rate');
});
test('recorded startup integrates the same displacement at 40 and 120 Hz without looping',()=>{
 for(const hz of [40,120]){
  const clock=new SourceRunStart(profile,1.1);clock.begin(2.2,Math.PI/2);
  let x=0,z=0,frame;
  for(let i=0;i<hz*.5;i++){frame=clock.advance(1/hz);x+=frame.delta.x;z+=frame.delta.z;}
  assert.ok(Math.abs(frame.time-.5)<1e-10);assert.ok(Math.abs(x-.275)<1e-10);assert.ok(Math.abs(z)<1e-10);
  while(clock.active)frame=clock.advance(1/hz);
  assert.equal(frame.time,profile.exitTime);
  assert.equal(clock.advance(1/hz),null);
  clock.reset();assert.equal(clock.active,false);
 }
});
test('startup transfers the exact exit pose and unused time at different render rates',()=>{
 const results=[];
 for(const hz of [40,60,120,144]){
  const clock=new SourceRunStart(profile,1);clock.begin(2.6,0);
  let duration=0,travel=0,frame,frames=0;
  while(clock.active){
   frame=clock.advance(1/hz);frames++;duration+=frame.duration;travel+=frame.delta.z;
   assert.ok(Math.abs(frame.duration+frame.remainingDt-1/hz)<1e-12,'The exit lost simulation time');
  }
  assert.equal(frame.time,profile.exitTime,'The exit sampled a different contact phase');
  assert.ok(Math.abs(duration-profile.exitTime/1.3)<1e-12);
  assert.ok(Math.abs(travel-.5625)<1e-12,'The exit lost recorded travel');
  // Advancing the incoming motion through the returned remainder accounts
  // for every frame without stretching the outgoing pose over that time.
  assert.ok(Math.abs(duration+frame.remainingDt-frames/hz)<1e-12);
  results.push({duration,travel});
 }
 for(const result of results)assert.ok(Math.abs(result.duration-results[0].duration)<1e-12&&Math.abs(result.travel-results[0].travel)<1e-12);
});
test('an exit inside an accelerating or decelerating ramp preserves the physical boundary time',()=>{
 for(const [initialSpeed,nextSpeed]of [[1,3],[3,1]]){
  const clock=new SourceRunStart({...profile,exitTime:.1},1);clock.begin(initialSpeed,0);clock.setSpeed(nextSpeed);
  const frame=clock.advance(.3),a=Math.sign(nextSpeed-initialSpeed)*3,r0=initialSpeed/2;
  assert.equal(frame.time,.1);
  assert.ok(Math.abs(r0*frame.duration+a*frame.duration**2/2-.1)<1e-12);
  assert.ok(Math.abs(frame.rate-(r0+a*frame.duration))<1e-12);
  assert.ok(frame.remainingDt>0);
 }
});
test('startup preserves double support, first takeoff, and actual later landing order',()=>{
 assert.deepEqual(runStartContacts(profile,0).stance,{r:true,l:true});
 assert.deepEqual(runStartContacts(profile,.25).stance,{r:false,l:true});
 assert.deepEqual(runStartContacts(profile,.55).stance,{r:true,l:false});
 assert.deepEqual(runStartContacts(profile,.8).stance,{r:false,l:true});
 const intervals=sourceSupportIntervals(runStartBrakingProfile(profile,.7));
 assert.deepEqual(intervals,{r:[.9,1],l:[.75,.9]});
});
test('recorded contact remains physical at rounded capture boundaries',()=>{
 const start=0.6166666666666667,end=.8;
 const p={...profile,contactFade:.025,contacts:{r:[[start,end]],l:[[start,end]]}};
 // A fitted 480 Hz sample lands one representable value before the 120 Hz
 // contact boundary. The previous polynomial returned 1.0000000000000009.
 for(const time of [0.6166666666666666,start,end,end+Number.EPSILON]){
  const {contactWeights}=runStartContacts(p,time);
  for(const weight of Object.values(contactWeights))assert.ok(weight>=0&&weight<=1,'Contact pressure left [0,1]');
 }
 assert.equal(runStartContacts(p,0.6166666666666666).contactWeights.l,1);
 assert.throws(()=>runStartContacts(p,NaN),/finite time/);
});
test('a modest speed change preserves startup progress and continues along the recorded path',()=>{
 const clock=new SourceRunStart(profile,1);clock.begin(2,0);clock.advance(.25);
 clock.setSpeed(1.8);assert.equal(clock.state.time,.25);
 const frame=clock.advance(.25);
 assert.ok(Math.abs(frame.time-(.475+.1*.1/(2*3)))<1e-12);
 assert.equal(frame.previousTime,.25);
 assert.equal(frame.rate,.9);
 assert.throws(()=>clock.setSpeed(0),/positive metres/);
 clock.reset();assert.throws(()=>clock.setSpeed(2),/active recorded start/);
});
test('sprint input retains preparation and integrates a continuous rate change at 40 and 120 Hz',()=>{
 const results=[];
 for(const hz of [40,120]){
  const clock=new SourceRunStart(profile,1);clock.begin(2,0);
  for(let i=0;i<hz*.2;i++)clock.advance(1/hz);
  const before=clock.state.time;clock.setSpeed(3);
  assert.equal(clock.state.rate,1,'The sprint command jumped the animation rate');
  assert.equal(clock.state.time,before,'The sprint command replaced the preparation pose');
  for(let i=0;i<hz*.3;i++){
   const previousRate=clock.state.rate;clock.advance(1/hz);
   assert.ok(Math.abs(clock.state.rate-previousRate)<=3/hz+1e-12,'The rate change exceeded its bound');
  }
  results.push(clock.state.time);
  assert.equal(clock.state.rate,1.5);
 }
 assert.ok(Math.abs(results[0]-results[1])<1e-12,'The animation timing depends on render rate');
});
test('startup rejects invalid units and mismatched pose/root clocks',()=>{
 assert.throws(()=>validateRunStart({...profile,duration:2}),/durations must match/);
 assert.throws(()=>validateRunStart({...profile,exitTime:1}),/exit time/);
 assert.throws(()=>new SourceRunStart(profile,0),/actor scale/);
 const clock=new SourceRunStart(profile,1);
 assert.throws(()=>clock.begin(0,0),/positive speed/);
 clock.begin(2,0);assert.throws(()=>clock.advance(0),/positive seconds/);
});
