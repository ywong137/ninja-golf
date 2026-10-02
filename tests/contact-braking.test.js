import test from 'node:test';
import assert from 'node:assert/strict';
import {ContactBraking} from '../src/contact-braking.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('flight preserves horizontal momentum regardless of the elapsed stop time',()=>{
 const brake=new ContactBraking({x:-3,z:4},.2);
 const frame=brake.advance(.7,0);
 assert.deepEqual(frame.endVelocity,{x:-3,z:4});near(frame.delta.x,-2.1);near(frame.delta.z,2.8);
 assert.equal(brake.loadedTime,0);assert.equal(brake.done,false);
});
test('loss of support suspends braking without losing the existing velocity',()=>{
 const brake=new ContactBraking({x:0,z:5.3},.2);
 brake.advance(.05,.05);const incoming=brake.velocity;
 const flight=brake.advance(.16,0);assert.deepEqual(flight.endVelocity,incoming);near(flight.delta.z,incoming.z*.16);
 brake.advance(.15,.15);assert.equal(brake.done,true);near(brake.velocity.z,0);
});
test('predicted root travel and actual contacts agree across render rates and partial frames',()=>{
 const windows=[[0,.034],[.177,Infinity]],duration=.2,finish=.5;
 const expected=new ContactBraking({x:2,z:5.3},duration).predict(finish,windows);
 for(const hz of [40,60,120,240]){
  const brake=new ContactBraking({x:2,z:5.3},duration),delta={x:0,z:0};
  while(brake.time<finish-1e-12){
   const start=brake.time,end=Math.min(finish,start+1/hz,...windows.flat().filter(t=>t>start+1e-12));
   const dt=end-start,loaded=windows.some(([a,b])=>start+dt/2>=a&&start+dt/2<b);
   const frame=brake.advance(dt,loaded?dt:0);delta.x+=frame.delta.x;delta.z+=frame.delta.z;
  }
  near(delta.x,expected.delta.x);near(delta.z,expected.delta.z);assert.equal(brake.done,true);
 }
});
test('a missing predicted landing does not authorize deceleration',()=>{
 const brake=new ContactBraking({x:0,z:5.3},.2);
 const expected=brake.predict(.4,[[.1,Infinity]]);assert.equal(expected.done,true);
 const actual=brake.advance(.4,0);assert.equal(actual.done,false);near(actual.endVelocity.z,5.3);
 near(brake.time,.4);assert.equal(brake.loadedTime,0);
});
test('predictions retain the current impulse and never mutate observed support',()=>{
 const brake=new ContactBraking({x:2,z:-5},.2);brake.advance(.04,.04);
 const before={time:brake.time,loadedTime:brake.loadedTime,velocity:brake.velocity};
 const forecast=brake.predict(.3,[[.15,Infinity]]);
 assert.deepEqual({time:brake.time,loadedTime:brake.loadedTime,velocity:brake.velocity},before);
 const first=brake.advance(.11,0),second=brake.advance(.19,.19);
 near(forecast.delta.x,first.delta.x+second.delta.x);near(forecast.delta.z,first.delta.z+second.delta.z);
});
test('a partial support interval brakes before takeoff and then coasts',()=>{
 const brake=new ContactBraking({x:0,z:5.3},.2),split=new ContactBraking({x:0,z:5.3},.2);
 const whole=brake.advance(.025,.007),a=split.advance(.007,.007),b=split.advance(.018,0);
 near(whole.delta.z,a.delta.z+b.delta.z);near(whole.endVelocity.z,b.endVelocity.z);
 assert.throws(()=>brake.advance(.01,.02),/loaded interval/);
});
