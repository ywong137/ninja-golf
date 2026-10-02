import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceRunTurn,turnHeading,validateRunTurn,selectRunTurn} from '../src/source-run-turn.js';
import {samplePlanarRoot} from '../src/attack-root-motion.js';

function profile(sign=1){
 const angle=sign*Math.PI/3,radius=2/Math.abs(angle),rows=Array.from({length:121},(_,i)=>{
  const time=i/120,a=angle*time;
  return{time,x:sign*radius*(1-Math.cos(a)),z:radius*Math.sin(Math.abs(a)),heading:a};
 });
 return{version:2,poseFrame:'travel-heading',duration:1,entry:{speed:2},exit:{speed:2},angle,root:{duration:1,rows},
  contactFade:.025,contacts:{r:[[.2,.4],[.8,1]],l:[[0,.1],[.55,.7]]}};
}
test('recorded turns retain path, heading, and exact exit across rates, directions, yaw, and body scales',()=>{
 for(const sign of [-1,1])for(const scale of [.9,1.1])for(const yaw of [-2.9,.8])for(const hz of [40,60,120,144]){
  const p=profile(sign),clock=new SourceRunTurn(p,scale);clock.begin(2*scale,yaw);
  let x=0,z=0,time=0,frame;
  while(clock.active){
   frame=clock.advance(1/hz);x+=frame.delta.x;z+=frame.delta.z;time+=frame.duration;
   assert.ok(Math.abs(frame.duration+frame.remainingDt-1/hz)<1e-12);
   for(const value of Object.values(frame.contactWeights))assert.ok(value>=0&&value<=1);
  }
  const end=p.root.rows.at(-1),expectedX=scale*(end.x*Math.cos(yaw)+end.z*Math.sin(yaw)),expectedZ=scale*(end.z*Math.cos(yaw)-end.x*Math.sin(yaw));
  assert.ok(Math.abs(x-expectedX)<1e-10&&Math.abs(z-expectedZ)<1e-10,'A frame boundary changed total travel');
  assert.ok(Math.abs(time-1)<1e-10);
  assert.ok(Math.abs(frame.yaw-yaw-p.angle)<1e-10,'The body heading drifted away from the recorded path');
  assert.equal(frame.time,1);assert.equal(frame.done,true);assert.equal(clock.advance(1/hz),null);
  assert.ok(Math.abs(Math.hypot(frame.exitVelocity.x,frame.exitVelocity.z)-2*scale)<1e-10);
  clock.reset();assert.equal(clock.active,false);
 }
});
test('speed changes retime the same body trajectory without losing the accelerating exit boundary',()=>{
 for(const hz of [40,60,120,144]){
  const p=profile(),clock=new SourceRunTurn(p,1);clock.begin(2,0);
  let elapsed=0,x=0,z=0;
  while(elapsed<.25-1e-12){const f=clock.advance(Math.min(1/hz,.25-elapsed));elapsed+=f.duration;x+=f.delta.x;z+=f.delta.z;}
  clock.setSpeed(4);assert.equal(clock.state.rate,1);
  while(clock.active){const before=clock.state.rate,f=clock.advance(1/hz);elapsed+=f.duration;x+=f.delta.x;z+=f.delta.z;assert.ok(f.rate-before<=3*f.duration+1e-12);}
  assert.ok(Math.abs(elapsed-(.25+1/3+.125))<1e-10);
  assert.ok(Math.abs(x-p.root.rows.at(-1).x)<1e-10&&Math.abs(z-p.root.rows.at(-1).z)<1e-10);
 }
});
test('a recorded turn reports its actual supporting foot and rejects malformed clocks',()=>{
 const p=profile(),clock=new SourceRunTurn(p,1);clock.begin(2,0);
 assert.deepEqual(clock.advance(.05).stance,{r:false,l:true});
 assert.deepEqual(clock.advance(.10).stance,{r:false,l:false});
 assert.deepEqual(clock.advance(.10).stance,{r:true,l:false});
 assert.equal(turnHeading(p,-1),0);assert.equal(turnHeading(p,2),p.angle);
 assert.throws(()=>clock.advance(0),/positive seconds/);
 assert.throws(()=>clock.setSpeed(NaN),/positive metres/);
 assert.throws(()=>new SourceRunTurn({...p,entry:{speed:Infinity}},1),/positive duration/);
 assert.throws(()=>validateRunTurn({...p,version:1}),/version 2/);
 assert.throws(()=>validateRunTurn({...p,root:{...p.root,rows:p.root.rows.map((r,i)=>i===1?{...r,heading:8}:r)}}),/synchronized/);
 clock.reset();assert.throws(()=>clock.setSpeed(2),/active playback/);
});

test('support-matched entry preserves the remaining world path and heading at every render rate',()=>{
 for(const sign of [-1,1])for(const hz of [40,120,144])for(const time of [.04,.25,.36]){
  const p=profile(sign),scale=1.07,yaw=2.6,clock=new SourceRunTurn(p,scale);
  clock.begin(3.2,yaw,time);
  const a=samplePlanarRoot(p.root,time),b=p.root.rows.at(-1),base=yaw-turnHeading(p,time);
  let x=0,z=0,elapsed=0,frame;
  while(clock.active){frame=clock.advance(1/hz);x+=frame.delta.x;z+=frame.delta.z;elapsed+=frame.duration;}
  assert.ok(Math.abs(x-scale*((b.x-a.x)*Math.cos(base)+(b.z-a.z)*Math.sin(base)))<1e-10);
  assert.ok(Math.abs(z-scale*((b.z-a.z)*Math.cos(base)-(b.x-a.x)*Math.sin(base)))<1e-10);
  assert.ok(Math.abs(elapsed-(1-time)/clock.state.rate)<1e-10);
  assert.ok(Math.abs(frame.yaw-yaw-(p.angle-turnHeading(p,time)))<1e-10);
 }
});

test('turn selection matches support and direction without creating support during flight',()=>{
 const entries=[-1,1].map(sign=>({clip:sign<0?'negative':'positive',profile:profile(sign)}));
 for(const sign of [-1,1])for(const support of ['r','l']){
  const selected=selectRunTurn(entries,{angle:sign*Math.PI/4,support,supportProgress:.4});
  assert.equal(selected.clip,sign<0?'negative':'positive');
  const [a,b]=selected.profile.contacts[support][0];assert.ok(selected.entryTime>a&&selected.entryTime<b);
  assert.equal(selectRunTurn(entries,{angle:sign*Math.PI/4,support,grounded:false}),null);
 }
 assert.equal(selectRunTurn(entries,{angle:Math.PI,support:'r'}),null);
 assert.throws(()=>selectRunTurn(entries,{angle:NaN,support:'r'}),/finite angle/);
});
