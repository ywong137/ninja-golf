import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,MathUtils,Quaternion,Vector3} from 'three';
import {SourceRunEntry,sourceEntryPhase,entryDisplacement} from '../src/source-run-entry.js';
import {gaitContactWeight} from '../src/source-gait-clock.js';

const profile={feet:{r:{supportInterval:[42/88,60/88]},l:{supportInterval:[-2/88,15/88]}}};
const blend={profiles:[profile],weights:[1]};

function entryFixture(){
 const root=new Group(),model=new Group();root.add(model);
 const bones={},contacts={},feet={},pole={axis:new Vector3(0,-1,0),bend:new Vector3(0,0,1)};
 for(const side of ['r','l']){
  const hip=new Group();hip.position.set(side==='r'?-.2:.2,1,0);model.add(hip);bones['thigh_'+side]=hip;
  const knee=new Group(),foot=new Group();knee.position.set(0,-.45,.2);foot.position.set(0,-.45,-.2);hip.add(knee);knee.add(foot);bones['calf_'+side]=knee;bones['foot_'+side]=foot;
  contacts[side]={contacts:[new Vector3(0,-.1,.12),new Vector3(0,-.1,-.12)]};
  feet[side]={p:new Vector3(hip.position.x,.1,0),q:new Quaternion(),pole};
 }
 root.updateMatrixWorld(true);
 const action={getClip:()=>({name:'Captured'}),getEffectiveWeight:()=>1};
 const entry=new SourceRunEntry(root,model,bones,{},contacts,{Captured:{count:1,rows:[feet,feet]}});
 return{root,entry,contacts,feet,action};
}

test('recorded turn entry uses the outgoing world frame, independent of render step size',()=>{
 const profile={duration:1,poseFrame:'travel-heading',contactFade:.02,contacts:{l:[[0,.2],[.6,.8]],r:[[.3,.45],[.9,1]]},root:{duration:1,rows:[{time:0,x:0,z:0,heading:0},{time:1,x:0,z:2,heading:0}]}};
 const results=[];
 for(const hz of [40,120]){
  const {root,entry,feet,action}=entryFixture();
  const outgoing=Object.fromEntries(['r','l'].map(side=>[side,{...feet[side],p:feet[side].p.clone()}]));
  outgoing.r.p.z=-.2;
  outgoing.r.velocity=new Vector3(0,0,3);
  entry.beginTurn({feet:outgoing,support:'l',grounded:true,rootPosition:new Vector3(),rootRotation:new Quaternion()},profile,.05);
  let result;
  for(let i=1;i<=hz/40;i++){
   root.position.z=2*i/hz;root.updateMatrixWorld(true);
   result=entry.apply([action],.05+i/hz,1/hz,()=>0);
  }
  results.push(result);
  assert.ok(result.targets.l.p.distanceTo(outgoing.l.p)<1e-12,'The loaded foot left its footprint');
  assert.ok(result.targets.r.p.z>outgoing.r.p.z,'The free foot froze on its first rendered frame');
 }
 for(const side of ['r','l'])assert.ok(results[0].targets[side].p.distanceTo(results[1].targets[side].p)<1e-12,'Entry depends on frame size');
});

test('entry displacement preserves departure velocity and arrives without a residual velocity',()=>{
 const offset=new Vector3(.1,.2,-.3),velocity=new Vector3(-.4,.2,1.5),duration=.3,h=1e-6;
 const sample=t=>entryDisplacement(offset,velocity,t/duration,t);
 assert.ok(sample(0).distanceTo(offset)<1e-12);
 assert.ok(sample(h).sub(sample(0)).divideScalar(h).distanceTo(velocity)<.0001);
 assert.ok(sample(duration).length()<1e-12);
 assert.ok(sample(duration).sub(sample(duration-h)).divideScalar(h).length()<.0001);
 assert.throws(()=>entryDisplacement(offset,velocity,0,-1),/nonnegative normalized progress/);
});

test('an accelerating source clock cannot amplify the incoming foot momentum',()=>{
 const offset=new Vector3(),velocity=new Vector3(0,0,2),h=1e-6;
 const progress=t=>.001*t+20*t*t;
 const sample=t=>entryDisplacement(offset,velocity,progress(t),t);
 assert.ok(sample(h).divideScalar(h).distanceTo(velocity)<.0001,'The first frame must retain world velocity');
 for(let t=0;t<.25;t+=.001){
  assert.ok(sample(t).length()<=velocity.length()*t+1e-12,'Increasing cadence must not stretch time in the momentum term');
 }
 assert.equal(sample(.25).length(),0,'The correction must finish at its scheduled source phase');
});

test('entry starts inside the actual supporting foot interval, including intervals across zero',()=>{
 for(const support of ['r','l']){
  const {phase,intervals}=sourceEntryPhase(blend,support);
  assert.equal(gaitContactWeight(phase,intervals[support]),1);
  assert.equal(gaitContactWeight(phase,intervals[support==='r'?'l':'r']),0);
 }
 assert.ok(sourceEntryPhase(blend,'r').phase>.5);
 assert.ok(sourceEntryPhase(blend,'l').phase<.1);
 assert.throws(()=>sourceEntryPhase(blend,'unknown'),/supporting foot/);
 const other=structuredClone(profile);other.feet.r.supportInterval=[.1,.3];
 assert.throws(()=>sourceEntryPhase({profiles:[profile,other],weights:[.5,.5]},'r'),/aligned support/);
});

test('a captured startup transfers its actual support progress instead of restarting the planted interval',()=>{
 for(const support of ['r','l'])for(const progress of [0,.2,.75,1]){
  const {entry,feet}=entryFixture();
  const phase=entry.begin({feet,support,supportProgress:progress},blend);
  const expected=MathUtils.euclideanModulo(MathUtils.lerp(...profile.feet[support].supportInterval,Math.min(.98,progress)),1);
  assert.ok(Math.abs(phase-expected)<1e-12);
  assert.ok(entry.state.feet[support].release>0);
 }
 const {entry,feet}=entryFixture();
 for(const supportProgress of [-.1,1.1,NaN])assert.throws(()=>entry.begin({feet,support:'l',supportProgress},blend),/support progress/);
});

test('late support permits heel rise while its toe stays on the outgoing footprint',()=>{
 const {root,entry,contacts,feet,action}=entryFixture();
 contacts.l.contacts.reverse();
 entry.sample=(_actions,p)=>Object.fromEntries(['r','l'].map(side=>[side,{p:feet[side].p.clone(),q:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),p*2),pole:feet[side].pole}]));
 const phase=entry.begin({feet,support:'l',supportProgress:.4},blend);
 entry.apply([action],phase,0,()=>0);
 const sole=contacts.l.contacts[1],anchor=sole.clone().add(feet.l.p);
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.1);
 root.position.z+=.03;root.updateMatrixWorld(true);
 const result=entry.apply([action],phase+.05,1/120,()=>0),target=result.targets.l;
 assert.ok(sole.clone().applyQuaternion(target.q).add(target.p).distanceTo(anchor)<1e-12,'The toe slid during heel rise');
 assert.ok(target.p.distanceTo(feet.l.p)>.01,'The ankle was frozen instead of rotating around the toe');
 assert.ok(target.q.angleTo(rotation)<1e-7);
 assert.ok(entry.gap('l',target.p,target.q,()=>0)>=-1e-12);
 assert.equal(result.stance.l,true);
 const releasePhase=profile.feet.l.supportInterval[1];
 const released=entry.apply([action],releasePhase,1/120,()=>0).targets.l;
 const releaseRotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),(releasePhase-phase)*2);
 assert.ok(released.q.angleTo(releaseRotation)<1e-7,'An exact-boundary frame skipped the final toe roll');
 assert.ok(sole.clone().applyQuaternion(released.q).add(released.p).distanceTo(anchor)<1e-12,'The toe moved at the release boundary');
});

test('a standing start retains both feet until their separate recorded takeoffs',()=>{
 const {root,entry,feet,action}=entryFixture();
 const start={duration:1,contactFade:.02,contacts:{r:[[-.1,.15],[.45,.55]],l:[[-.1,.35],[.75,.85]]}};
 entry.beginStart({feet,support:'l'},start);
 for(const phase of [.05,.1]){
  root.position.z+=.02;root.updateMatrixWorld(true);
  const result=entry.apply([action],phase,.05,()=>0);
  for(const side of ['r','l']){
   assert.ok(result.targets[side].p.distanceTo(feet[side].p)<1e-12);
   assert.equal(result.stance[side],true);
  }
 }
 const firstRelease=entry.apply([action],.2,.1,()=>0);
 assert.equal(firstRelease.stance.r,false);assert.equal(firstRelease.stance.l,true);
 assert.equal(entry.state.feet.r.landing,.45);assert.equal(entry.state.feet.l.landing,.75);
 assert.throws(()=>entry.beginStart({feet,support:'l'},{...start,contacts:{...start.contacts,r:[[.1,.2],[.4,.5]]}}),/initial support/);
});

test('entry into a loaded start retains the pushing foot and the remaining source landing order',()=>{
 const {entry,feet,action}=entryFixture();
 const start={duration:1,contactFade:.02,contacts:{r:[[-.1,.15],[.5,.6]],l:[[-.1,.4],[.75,.85]]}};
 const phase=entry.beginStart({feet,support:'l'},start,.3);
 assert.equal(phase,.3);
 const first=entry.apply([action],phase,0,()=>0);
 assert.ok(first.targets.r.p.distanceTo(feet.r.p)<1e-12,'The first free-foot pose must retain its outgoing position');
 assert.equal(first.stance.l,true);assert.equal(first.stance.r,false);
 const during=entry.apply([action],.35,.05,()=>0);
 assert.ok(during.targets.l.p.distanceTo(feet.l.p)<1e-12,'The pushing foot must retain its footprint');
 assert.equal(during.stance.r,false);
 assert.ok(Math.abs(entry.state.feet.r.landing-.2)<1e-12);
 assert.ok(Math.abs(entry.state.feet.l.release-.1)<1e-12);
 assert.throws(()=>entry.beginStart({feet,support:'l'},start,1),/source duration/);
});

test('a gait handoff cannot turn an airborne foot into an anchored support',()=>{
 const {entry,feet,action}=entryFixture();
 feet.r.p.y+=.08;feet.l.p.y+=.06;
 const phase=entry.begin({feet,support:'l',grounded:false},blend);
 const result=entry.apply([action],phase,0,()=>0);
 for(const side of ['r','l']){
  assert.equal(result.stance[side],false);
  assert.equal(entry.state.feet[side].supported,false);
  assert.ok(result.targets[side].p.distanceTo(feet[side].p)<1e-12);
 }
});

test('a released foot recovers its outgoing offset before the landing half of the swing',()=>{
 const {entry,feet,action}=entryFixture();
 const outgoing=Object.fromEntries(['r','l'].map(side=>[side,{...feet[side],p:feet[side].p.clone().add(new Vector3(0,0,-.25))}]));
 const phase=entry.begin({feet:outgoing,support:'l',grounded:false},blend);
 entry.apply([action],phase,0,()=>0);
 const halfway=entry.state.feet.r.landing/2;
 const result=entry.apply([action],(phase+halfway)%1,halfway,()=>0);
 assert.ok(Math.abs(result.targets.r.p.z-feet.r.p.z)<1e-9,'The outgoing offset kept the recovering foot behind the body');
 assert.equal(result.stance.r,false,'Recovering the offset created an early support');
 assert.equal(entry.state.feet.r.done,false,'The swing ended before the actual landing');
});

test('a moving free foot preserves departure velocity and recovers before the landing half of a running step',()=>{
 const {root,entry,feet,action}=entryFixture(),phaseRate=1.7;
 const outgoing=Object.fromEntries(['r','l'].map(side=>[side,{...feet[side],p:feet[side].p.clone().add(new Vector3(0,0,-.25)),velocity:new Vector3(0,0,-3)}]));
 const phase=entry.begin({feet:outgoing,support:'l',grounded:false,rootPosition:root.position.clone(),rootRotation:new Quaternion(),rootVelocity:new Vector3()},{...blend,phaseRate});
 const first=entry.apply([action],phase,0,()=>0),h=1e-6;
 const second=entry.apply([action],(phase+h*phaseRate)%1,h,()=>0);
 assert.ok(Math.abs((second.targets.r.p.z-first.targets.r.p.z)/h+3)<.001,'The handoff must retain the actual departure velocity');
 const half=entry.state.feet.r.landing/2;
 const result=entry.apply([action],(phase+half)%1,half/phaseRate-h,()=>0);
 assert.ok(Math.abs(result.targets.r.p.z-feet.r.p.z)<1e-9,'The velocity correction stretched into the landing half of the step');
 assert.equal(result.stance.r,false);
 assert.equal(entry.state.feet.r.done,false,'Position recovery must not create a premature landing');
});

test('acceleration releases an outgoing support before the root pulls its knee straight',()=>{
 for(const hz of [40,120]){
  const {root,entry,feet,action}=entryFixture(),phaseRate=.2,dt=1/hz;
  const phase=entry.begin({feet,support:'l',supportProgress:0},{...blend,phaseRate});
  const scheduledRelease=entry.state.feet.l.release;
  let released=false;
  for(let frame=0;frame<hz*.3;frame++){
   root.position.z=frame*dt*3;root.updateMatrixWorld(true);
   const result=entry.apply([action],(phase+frame*dt*phaseRate)%1,dt,()=>0);
   if(!result.stance.l){
    assert.ok(entry.state.progress<scheduledRelease,'Takeoff waited for the source clock despite incompatible acceleration');
    assert.ok(entry.gap('l',result.targets.l.p,result.targets.l.q,()=>0)>=-1e-9);
    released=true;break;
   }
   assert.ok(result.targets.l.p.distanceTo(feet.l.p)<1e-9,`${hz} Hz frame ${frame}: preparing takeoff moved the shoe by ${result.targets.l.p.distanceTo(feet.l.p)} m`);
  }
  assert.ok(released,`${hz} Hz: the planted leg did not release`);
 }
});

test('takeoff between render frames retains the same first-swing trajectory at 40 and 120 Hz',()=>{
 const results=[];
 for(const hz of [40,120]){
  const {root,entry,feet,action}=entryFixture();
  const phase=entry.begin({feet,support:'l'},blend);
  entry.apply([action],phase,0,()=>0);
  let result;
  for(let frame=1;frame<=hz/8;frame++){
   const time=frame/hz;root.position.z=time;root.updateMatrixWorld(true);
   result=entry.apply([action],(phase+time*1.7)%1,1/hz,()=>0);
  }
  assert.equal(result.stance.l,false,'The fixture did not cross takeoff');
  results.push(result.targets.l.p);
 }
 assert.ok(results[0].distanceTo(results[1])<1e-8,'The first airborne frame added a frame-dependent hold');
});

for(const support of ['r','l'])test(`${support}: entry retains the real footprint and joins the source only after a swing`,()=>{
 for(const scale of [.85,1.1,1.3])for(const yaw of [0,1.3]){
  const root=new Group(),model=new Group();root.add(model);root.scale.setScalar(scale);root.rotation.y=yaw;root.position.set(3,0,-2);
  const bones={},contacts={},feet={},pole={axis:new Vector3(0,-1,0),bend:new Vector3(0,0,1)};
  for(const side of ['r','l']){
   const x=side==='r'?-.2:.2;const hip=new Group();hip.position.set(x,1,0);model.add(hip);bones['thigh_'+side]=hip;
   contacts[side]={contacts:[new Vector3(0,-.1,0)]};
   feet[side]={p:new Vector3(x,.1,0),q:new Quaternion(),pole};
  }
  root.updateMatrixWorld(true);
  const data={Captured:{count:1,rows:[feet,feet]}},action={getClip:()=>({name:'Captured'}),getEffectiveWeight:()=>1};
  const entry=new SourceRunEntry(root,model,bones,{},contacts,data),q=root.getWorldQuaternion(new Quaternion());
  const outgoing=Object.fromEntries(['r','l'].map(side=>[side,{p:feet[side].p.clone().applyMatrix4(model.matrixWorld).add(new Vector3(.08,0,-.12)),q:q.clone(),pole:{axis:pole.axis.clone().applyQuaternion(q),bend:pole.bend.clone().applyQuaternion(q)}}]));
  // Sole offsets are measured world lengths by the existing foot solver.
  for(const side of ['r','l'])outgoing[side].p.y=.1;
  const start=entry.begin({feet:outgoing,support},blend),first=entry.apply([action],start,0,()=>0);
  for(const side of ['r','l'])assert.ok(first.targets[side].p.distanceTo(outgoing[side].p)<1e-9,'The handoff changed its departure pose');
  let last;for(let i=1;i<=120;i++){
   root.position.z+=.004;root.updateMatrixWorld(true);
   last=entry.apply([action],(start+i/120)%1,1/120,()=>0);
   if(!last)break;
   if(entry.state&&entry.state.progress<entry.state.feet[support].release)assert.ok(last.targets[support].p.distanceTo(outgoing[support].p)<1e-9,'Support slid with the root');
   for(const side of ['r','l'])assert.ok(last.targets[side].p.y>=.1-1e-9,'The departing sole entered the ground');
  }
  assert.equal(entry.state,null,'The entry did not finish after one source cycle');
  entry.apply([action],start,0,()=>0);assert.equal(entry.report,null);
 }
});


test('recorded sequence endpoints retain the final foot pose while gait loops wrap',()=>{
 for(const key of ['sourceRunStart','sourceRunTurn','sourceRunStop',null]){
  const {entry,feet}=entryFixture();
  const final=Object.fromEntries(['r','l'].map(side=>[side,{...feet[side],p:feet[side].p.clone().add(new Vector3(0,0,.5)),q:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.3)}]));
  entry.data.Captured.rows=[feet,final];
  const action={getClip:()=>({name:'Captured',userData:key?{[key]:{}}:{}}),getEffectiveWeight:()=>1};
  for(const phase of [1,1+1e-9]){
   const sampled=entry.sample([action],phase);
   for(const side of ['r','l']){
    const wanted=key?final[side]:feet[side];
    assert.ok(sampled[side].p.distanceTo(wanted.p)<1e-8,`${key}: final foot position restarted`);
    assert.ok(sampled[side].q.angleTo(wanted.q)<1e-7,`${key}: final shoe orientation restarted`);
   }
  }
 }
});

for(const poseFrame of ['travel-heading','fixed-heading'])test(`${poseFrame}: recorded moving entry uses the complete free-foot flight`,()=>{
 const {root,entry,feet,action}=entryFixture();
 const profile={duration:1,poseFrame,contactFade:.02,contacts:{l:[[0,.2],[.6,.8]],r:[[.3,.45],[.9,1]]},root:{duration:1,rows:[{time:0,x:0,z:0,...(poseFrame==='travel-heading'?{heading:0}:{})},{time:1,x:0,z:2,...(poseFrame==='travel-heading'?{heading:0}:{})}]}};
 const outgoing=Object.fromEntries(['r','l'].map(side=>[side,{...feet[side],p:feet[side].p.clone(),velocity:new Vector3(0,0,2)}]));
 outgoing.r.p.z=-.2;
 entry.beginSequence({feet:outgoing,support:'l',grounded:true,rootPosition:new Vector3(),rootRotation:new Quaternion()},profile,.05);
 entry.apply([action],.05,0,()=>0);
 root.position.z=.25;root.updateMatrixWorld(true);
 const halfway=entry.apply([action],.175,.125,()=>0);
 assert.ok(Math.abs(halfway.targets.r.p.z-.15)<1e-9,'Position recovery must use the full remaining flight, not half of it');
 assert.equal(halfway.stance.r,false);
 root.position.z=.5;root.updateMatrixWorld(true);
 const landed=entry.apply([action],.3,.125,()=>0);
 assert.ok(Math.abs(landed.targets.r.p.z-.5)<1e-9);
 assert.equal(landed.stance.r,true);
});
