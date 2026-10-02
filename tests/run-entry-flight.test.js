import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {RunEntryFlight,predictRunLanding} from '../src/run-entry-flight.js';
import {attackEntryVelocity,attackEntryVelocityAt} from '../src/attack-braking.js';

const close=(actual,expected,tolerance=1e-9)=>assert.ok(actual.distanceTo(expected)<tolerance,
 `Expected ${expected.toArray()}, received ${actual.toArray()}`);
const flight=()=>new RunEntryFlight({start:new Vector3(.2,.1,-.4),velocity:new Vector3(0,.2,1.5),
 end:new Vector3(.2,.1,1.8),phase:.35,phaseRate:1.8});

test('first recovery preserves the departure pose and velocity, then settles at its landing',()=>{
 const f=flight(),start=f.sample(.35),end=f.sample(1);
 close(start.p,f.start);close(start.derivative.clone().multiplyScalar(1.8),new Vector3(0,.2,1.5));
 close(end.p,f.end);close(end.derivative,new Vector3());
 // Check the actual curve as well as its reported derivative.
 const h=1e-6;
 close(f.sample(.35+h).p.sub(start.p).divideScalar(h),start.derivative,1e-5);
 close(end.p.clone().sub(f.sample(1-h).p).divideScalar(h),new Vector3(),1e-5);
});

test('a resting departure rises before it develops appreciable horizontal speed',()=>{
 const f=new RunEntryFlight({start:new Vector3(),velocity:new Vector3(),end:new Vector3(0,0,2),phase:.5,phaseRate:1.5});
 const near=f.sample(.501).p;
 assert.ok(near.y>0);assert.ok(Math.abs(near.z)<1e-6);
 for(let i=0;i<=100;i++){
  const p=f.sample(.5+i*.005).p;
  assert.ok(p.y>=-1e-12&&p.y<=.080001,'The recovery arc exceeded its clearance budget.');
  assert.ok(p.z>=-1e-12&&p.z<=2.000001,'A resting flight overshot its endpoint.');
 }
});

test('early steering preserves position and velocity at each landing update',()=>{
 const f=flight();
 for(const phase of [.4,.48,.6]){
  const before=f.sample(phase),end=f.end.clone().add(new Vector3(.12,0,-.08));
  assert.equal(f.retarget(phase,end),true);
  const after=f.sample(phase);close(after.p,before.p);close(after.derivative,before.derivative);
  close(after.secondDerivative,before.secondDerivative);
  close(f.sample(1).p,end);close(f.sample(1).derivative,new Vector3());
 }
 const endpoint=f.end.clone();
 assert.equal(f.retarget(.7,endpoint.clone().add(new Vector3(.2,0,0))),false);
 close(f.end,endpoint);
});

test('frequent steering cannot accumulate extra foot lift',()=>{
 const f=flight(),reference=flight();
 for(let i=0;i<60;i++){
  const phase=.35+i*.01;
  f.retarget(phase,new Vector3(.2+Math.sin(i)*.15,.1,1.8+Math.cos(i)*.1));
  const actual=f.sample(phase),expected=reference.sample(phase);
  for(const key of ['p','derivative','secondDerivative'])assert.ok(Math.abs(actual[key].y-expected[key].y)<1e-9,
   `Steering altered vertical ${key} at phase ${phase}.`);
 }
});

test('landing prediction stays fixed while the body accelerates along the same course',()=>{
 const args={center:new Vector3(2,0,4),phase:.4,amplitude:.3,scale:1.15,travelHeading:.7,bodyHeading:.2,side:'l'};
 const expected=predictRunLanding(args);
 for(const distance of [.003,.014,.052,.17,.3]){
  args.center.add(new Vector3(Math.sin(.7),0,Math.cos(.7)).multiplyScalar(distance));
  args.phase+=distance*.28/(2*args.amplitude*args.scale);
  close(predictRunLanding(args),expected);
 }
});

test('invalid flight clocks fail before they can corrupt a skeleton',()=>{
 for(const phaseRate of [0,-1,NaN])assert.throws(()=>new RunEntryFlight({phase:.2,phaseRate}),/positive phase rate/);
 for(const phase of [-.1,1,2])assert.throws(()=>new RunEntryFlight({phase,phaseRate:2}),/departure phase/);
});

test('a curved recovery preserves departure and landing states during retargeting',()=>{
 const f=new RunEntryFlight({start:new Vector3(.2,.1,-.4),velocity:new Vector3(0,.2,1.5),
  end:new Vector3(.2,.1,1.8),phase:.35,phaseRate:1.8,outward:new Vector3(.3,0,.1),recovering:true});
 close(f.sample(.35).p,f.start);close(f.sample(.35).derivative.clone().multiplyScalar(1.8),new Vector3(0,.2,1.5));
 for(const phase of [.37,.5,.63]){
  const h=1e-6,a=f.sample(phase),b=f.sample(phase+h),c=f.sample(phase-h);
  close(b.p.sub(c.p).divideScalar(2*h),a.derivative,1e-7);
  close(b.derivative.sub(c.derivative).divideScalar(2*h),a.secondDerivative,1e-6);
 }
 const before=f.sample(.5);assert.equal(f.retarget(.5,new Vector3(.3,.2,1.7)),true);
 const after=f.sample(.5);for(const key of ['p','derivative','secondDerivative'])close(after[key],before[key]);
 close(f.sample(1).p,f.end);close(f.sample(1).derivative,new Vector3());
});

test('a short pivot support produces a shorter landing step',()=>{
 const args={center:new Vector3(),phase:.4,amplitude:.3,scale:1,travelHeading:0,bodyHeading:0,side:'l'};
 const full=predictRunLanding(args),short=predictRunLanding({...args,support:.14});
 assert.ok(Math.abs(full.z-short.z-.15)<1e-10);
 assert.equal(full.x,short.x);assert.equal(full.y,short.y);
});

test('turning landings clear the inside leg without doubling the outside step',()=>{
 for(const scale of [.85,1.2])for(const heading of [-1,-.5,.5,1]){
  const center=new Vector3(2,0,3),drift=new Vector3(.1,0,-.3),lateral=new Vector3(Math.cos(heading),0,-Math.sin(heading));
  const args={center,phase:.6,amplitude:.2,scale,travelHeading:Math.PI,bodyHeading:heading,
   displacement:drift,width:.17,minimumLane:.17};
  for(const side of ['r','l']){
   const sign=side==='r'?-1:1,p=predictRunLanding({...args,side});
   const lane=sign*p.clone().sub(center).sub(drift).dot(lateral);
   assert.ok(lane>=.17*scale-1e-10,'The inside foot crossed its hip lane.');
   const outside=sign*Math.sin(Math.PI-heading)>0;
   if(outside){
    const uncorrected=predictRunLanding({...args,side,minimumLane:0});
    close(p,uncorrected);
    assert.ok(lane<=.17*scale+.2*scale+1e-10,'Sideways travel was counted twice.');
   }
  }
 }
});

test('a collecting-step landing stays fixed through the controller acceleration at different frame rates',()=>{
 const source={x:0,z:2.52},wanted={x:0,z:5.6},duration=.2,cadence=1/.48,flightTime=.24,scale=1.1;
 const args={center:new Vector3(),phase:.5,amplitude:.16,scale,travelHeading:0,bodyHeading:0,side:'r'};
 const expected=new Vector3(-.17*scale,.1,2.52*.1+5.6*(flightTime-.1)+.34*scale);
 for(const rate of [40,144]){
  let time=0;const center=new Vector3();
  while(time<flightTime-1e-9){
   const remaining=flightTime-time,average=attackEntryVelocity(source,wanted,time,remaining,duration);
   const landing=attackEntryVelocityAt(source,wanted,flightTime,duration);
   const actual=predictRunLanding({...args,center,phase:.5+time*cadence,
    displacement:new Vector3(average.x,0,average.z).multiplyScalar(remaining),landingAmplitude:landing.z*.28/(2*scale*cadence)});
   close(actual,expected,1e-10);
   const dt=Math.min(1/rate,remaining),velocity=attackEntryVelocity(source,wanted,time,dt,duration);
   center.add(new Vector3(velocity.x,0,velocity.z).multiplyScalar(dt));time+=dt;
  }
 }
});
