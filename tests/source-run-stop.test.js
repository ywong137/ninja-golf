import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {parseAcclaimSkeleton,parseAcclaimMotion} from '../tools/acclaim-motion.mjs';
import {createAcclaimGaitSequence} from '../tools/acclaim-gait-sequence.mjs';
import {createAcclaimGaitRig} from '../tools/acclaim-gait-rig.mjs';
import {SourceRunStop,recordedStopVelocity,selectRunStop,validateRunStop} from '../src/source-run-stop.js';
import {samplePlanarRoot} from '../src/attack-root-motion.js';
const skeleton=parseAcclaimSkeleton(fs.readFileSync(new URL('./fixtures/cmu-running-start/143.asf',import.meta.url),'utf8'));
const motion=parseAcclaimMotion(fs.readFileSync(new URL('./fixtures/cmu-running-stop/143_02.amc',import.meta.url),'utf8'),skeleton);
const sequence=createAcclaimGaitSequence(skeleton,motion,{rate:120});
const contacts=JSON.parse(fs.readFileSync(new URL('./fixtures/cmu-running-stop/contacts.json',import.meta.url)));
function profile(mirror=false){
 const rows=motion.map((_,i)=>{const time=i/120,p=sequence.sample(time).displacement;return{time,x:p.x*(mirror?-1:1),z:p.z};});
 return{version:1,poseFrame:'fixed-heading',duration:sequence.duration,exitTime:1.05,entryRange:[44/120,55/120],root:{duration:sequence.duration,rows},contactFade:contacts.fade,
  contacts:mirror?{r:contacts.feet.l,l:contacts.feet.r}:contacts.feet};
}
const speedAt=(p,t)=>{const v=recordedStopVelocity(p,t);return Math.hypot(v.x,v.z);};
test('recorded stop preserves measured slowing, distance, and handoff at different render rates and body scales',()=>{
 for(const mirror of [false,true])for(const scale of [.9,1.1])for(const yaw of [-2.8,.6])for(const rate of [.86,1,1.14])for(const hz of [40,60,120,144]){
  const p=profile(mirror),time=.4,clock=new SourceRunStop(p,scale);clock.begin(speedAt(p,time)*scale*rate,yaw,time);
  const initial=samplePlanarRoot(p.root,time),end=samplePlanarRoot(p.root,p.exitTime),base=clock.state.yaw;
  let x=0,z=0,elapsed=0,frame;
  while(clock.active){
   const before=clock.state.time;frame=clock.advance(1/hz);x+=frame.delta.x;z+=frame.delta.z;elapsed+=frame.duration;
   assert.ok(Math.abs(frame.time-before-frame.duration*rate)<1e-10,'The body and root must use the same captured time');
   assert.ok(Math.abs(frame.duration+frame.remainingDt-1/hz)<1e-12);
   assert.ok(Object.values(frame.contactWeights).every(w=>w>=0&&w<=1));
  }
  const dx=(end.x-initial.x)*scale,dz=(end.z-initial.z)*scale;
  assert.ok(Math.abs(x-(dx*Math.cos(base)+dz*Math.sin(base)))<1e-10);
  assert.ok(Math.abs(z-(dz*Math.cos(base)-dx*Math.sin(base)))<1e-10);
  assert.ok(Math.abs(elapsed-(p.exitTime-time)/rate)<1e-10);
  assert.equal(frame.time,p.exitTime);assert.deepEqual(frame.stance,{r:true,l:true});
  assert.ok(Math.abs(Math.hypot(frame.exitVelocity.x,frame.exitVelocity.z)-speedAt(p,p.exitTime)*scale*rate)<1e-10,'Preserve residual momentum for the guard transition');
  assert.ok(Math.hypot(frame.exitVelocity.x,frame.exitVelocity.z)>0,'Do not delete momentum when the clip ends');
  assert.equal(clock.advance(1/hz),null);
 }
});
test('stop selection uses the loaded foot and support phase, and rejects slow-motion hop stops',()=>{
 for(const mirror of [false,true])for(const progress of [.1,.5,.9]){
  const p=profile(mirror),side=mirror?'r':'l',time=44/120+11/120*progress,speed=speedAt(p,time)*1.1;
  const args={speed,scale:1.1,support:side,grounded:true,supportProgress:progress};
  const selected=selectRunStop(p,args);assert.ok(selected);assert.ok(Math.abs(selected.time-time)<1e-12);
  assert.equal(selectRunStop(p,{...args,grounded:false}),null,'Do not turn predicted touchdown into support');
  assert.equal(selectRunStop(p,{...args,support:side==='r'?'l':'r'}),null,'Choose the mirrored source instead of reversing a joint');
  assert.equal(selectRunStop(p,{...args,speed:speed*.5}),null,'A slowed hop is not a walking stop');
  assert.equal(selectRunStop(p,{...args,speed:speed*1.5}),null,'Do not speed up the source outside the reviewed range');
 }
});
test('the source stop mirror reflects actual joint positions and swaps complete legs',()=>{
 const original=createAcclaimGaitRig(skeleton),mirrored=createAcclaimGaitRig(skeleton,{mirror:true});
 for(let i=0;i<=240;i++){
  const frame=sequence.sample(i/240*sequence.duration);original.apply(frame,{yaw:sequence.yaw,origin:frame.origin});mirrored.apply(frame,{yaw:sequence.yaw,origin:frame.origin});
  for(const name of Object.keys(original.bones)){
   const swapped=name.replace(/_([rl])$/,(all,side)=>'_'+(side==='r'?'l':'r'));
   const a=original.bones[swapped].getWorldPosition(new Vector3());a.x=-a.x;
   const b=mirrored.bones[name].getWorldPosition(new Vector3());
   assert.ok(a.distanceTo(b)<1e-9,`${name} did not reflect the captured joint`);
  }
 }
});
test('a stop profile rejects invalid inputs and an exit that precedes braking',()=>{
 const p=profile(),clock=new SourceRunStop(p,1);
 assert.throws(()=>validateRunStop({...p,exitTime:.5,contacts:{r:[[0,p.duration]],l:[[0,p.duration]]}}),/below 0.5/);
 assert.throws(()=>validateRunStop({...p,entryRange:[.5,.2]}),/ordered entry range/);
 assert.throws(()=>validateRunStop({...p,contacts:{...p.contacts,l:[[.1,.2]]}}),/both feet supported/);
 assert.throws(()=>new SourceRunStop(p,0),/positive actor scale/);
 assert.throws(()=>clock.begin(5,0,.8),/inside its entry range/);
 assert.throws(()=>clock.advance(0),/positive seconds/);
 assert.throws(()=>selectRunStop(p,{speed:5,support:'r',grounded:true,supportProgress:NaN}),/progress/);
 assert.throws(()=>createAcclaimGaitRig(skeleton,{mirror:'yes'}),/boolean/);
 const speed=speedAt(p,.4);clock.begin(speed,0,.4);assert.equal(clock.active,true);clock.reset();assert.equal(clock.active,false);
});
