import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Quaternion,Vector3} from 'three';
import {RunAttackStep} from '../src/run-attack-step.js';

function fixture(){
 const root=new Group();root.position.z=.5;root.updateMatrixWorld(true);
 const contacts=Object.fromEntries(['r','l'].map(s=>[s,{contacts:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.06)]}]));
 const planner=new RunAttackStep(root,{}, {},contacts);
 const feet=Object.fromEntries(['r','l'].map(s=>[s,{p:new Vector3(s==='r'?-.25:.25,.2,.3),q:new Quaternion(),velocity:new Vector3(0,-.5,1)}]));
 planner.state={age:.15,join:.3,moving:true,first:'r',turnRequestedAt:.12,rootVelocity:new Vector3(0,0,5.6),plannedTravel:new Vector3(0,0,2.52),travel:new Vector3(0,0,-2.52),lastFeet:feet,
  plans:{r:{takeoff:0,landing:.2,end:new Vector3(-.25,.1,.8),q:new Quaternion()},l:{takeoff:0,landing:.3,end:new Vector3(.25,.1,.9),q:new Quaternion()}}};
 return planner;
}

test('a steering change transfers the actual supporting foot and the airborne pose',()=>{
 const planner=fixture();planner.report={feet:[{side:'r',weight:1,error:0,actualGap:0},{side:'l',weight:0,error:.04,actualGap:.2}]};
 const handoff=planner.handoffToGuard();assert.equal(handoff.support,'r');
 assert.equal(handoff.feet,planner.state.lastFeet,'Handover must retain actual world poses');
 planner.state.travel.copy(planner.state.plannedTravel);
 assert.equal(planner.handoffToGuard(),null,'An unchanged trajectory should finish its braking steps');
});

test('a clock crossing cannot authorize a handover without real support',()=>{
 const planner=fixture();planner.state.age=.4;
 planner.report={feet:[{side:'r',weight:0,error:0,actualGap:.03},{side:'l',weight:1,error:.04,actualGap:0}]};
 assert.equal(planner.handoffToGuard(),null);
 planner.report.feet[1]={side:'l',weight:1,error:0,actualGap:0};
 assert.equal(planner.handoffToGuard().support,'l');
});

test('a standing push-off requires a completed turn and two actual supporting feet',()=>{
 const planner=fixture();planner.state.lastRootRotation=new Quaternion();planner.state.basePelvis=new Vector3(0,.8,0);
 planner.report={feet:[{side:'r',weight:1,error:0,actualGap:0},{side:'l',weight:1,error:0,actualGap:0}]};
 assert.equal(planner.handoffToStart(),null,'An ordinary moving attack is not a standing restart');
 planner.state.reorientation={complete:false};assert.equal(planner.handoffToStart(),null);
 planner.state.reorientation.complete=true;
 for(const invalid of [{weight:0},{actualGap:.025},{error:.02}]){
  const original={...planner.report.feet[1]};Object.assign(planner.report.feet[1],invalid);
  assert.equal(planner.handoffToStart(),null,'The source start cannot invent its second support');
  planner.report.feet[1]=original;
 }
 const result=planner.handoffToStart();assert.ok(result);
 assert.deepEqual(result.contactWeights,{r:1,l:1});
 assert.deepEqual(result.rootVelocity.toArray(),[0,0,0]);
 for(const side of ['r','l'])assert.equal(result.feet[side].p,planner.state.lastFeet[side].p);
});

test('the guard handover retains elapsed support time without moving its footprint',()=>{
 const planner=fixture(),state=planner.state;state.age=.225;
 planner.report={feet:[{side:'r',weight:1,error:0,actualGap:0},{side:'l',weight:0,error:0,actualGap:.1}]};
 const handoff=planner.handoffToGuard();
 assert.ok(Math.abs(handoff.elapsed-.025)<1e-12);
 assert.equal(handoff.feet.r.p,state.lastFeet.r.p);
 const run=planner.handoffToRun();
 assert.ok(Math.abs(run.elapsed-.025)<1e-12);
});

test('a focused reversal retains the rear support in the new travel direction',()=>{
 const planner=fixture(),state=planner.state;
 state.lastFeet.r.p.z=.8;state.lastFeet.l.p.z=.4;
 planner.report={feet:[{side:'r',weight:1,error:0,actualGap:0},{side:'l',weight:1,error:0,actualGap:0}]};
 const handoff=planner.handoffToRun({travel:{x:0,z:-5.3}});
 assert.equal(handoff.support,'r','The forward braking foot becomes the backward push-off foot');
 assert.equal(planner.handoffToRun().support,'r','The animation handover must retain the controller selection');
 planner.report.feet[1].weight=0;
 assert.equal(planner.handoffToRun({travel:{x:0,z:-5.3}}).support,'r','One actual support suffices; the other foot keeps its flight');
 assert.equal(handoff.feet.r.p,state.lastFeet.r.p,'Selecting support cannot move the footprint');
});

test('a new direction cannot advance the guard gait before the input arrived',()=>{
 const planner=fixture(),state=planner.state;state.plans.r.landing=.065;
 planner.report={feet:[{side:'r',weight:1,error:0,actualGap:0},{side:'l',weight:0,error:0,actualGap:.1}]};
 assert.ok(Math.abs(planner.handoffToGuard().elapsed-.03)<1e-12);
});

test('a midair reversal retains the current foot position and velocity',()=>{
 const planner=fixture(),state=planner.state,source=state.lastFeet.r;
 planner.retargetFlight(state,()=>0,{x:0,z:-2.52},.025);
 const plan=state.plans.r;
 assert.ok(plan.start.p.distanceTo(source.p)<1e-12);
 assert.ok(plan.start.q.angleTo(source.q)<1e-7);
 assert.ok(plan.velocity.distanceTo(source.velocity)<1e-12);
 assert.ok(plan.landing-state.age>=.1,'A late reversal needs flight time');
 assert.ok(plan.end.z<planner.root.position.z,'The new landing must follow the requested backward motion');
 assert.ok(Math.abs(planner.gap('r',plan.end,plan.q,()=>0))<1e-9);
});

test('retargeting an airborne step never moves the planted footprint',()=>{
 const planner=fixture(),state=planner.state;
 state.plans.r.landing=.1;const end=state.plans.r.end.clone();
 planner.retargetFlight(state,()=>0,{x:2.52,z:0},.025);
 assert.ok(state.plans.r.end.equals(end));assert.equal(state.plans.r.start,undefined);
 assert.ok(state.plans.l.start,'The airborne foot needs a new continuous path');
});

test('restarting during recovery uses current support instead of an old landing clock',()=>{
 const planner=fixture(),state=planner.state;state.age=1;
 state.settle={feet:{r:{landing:1.2},l:{landing:1.5}}};
 planner.report={feet:[{side:'r',weight:1,error:0,actualGap:0},{side:'l',weight:0,error:0,actualGap:.12}]};
 assert.equal(planner.handoffToRun().phase,0,'The right foot supports this recovery frame');
 planner.report.feet[0].weight=0;
 assert.equal(planner.handoffToRun(),null,'Two airborne feet cannot authorize a planted run entry');
 planner.report.feet[1]={side:'l',weight:1,error:0,actualGap:0};
 assert.equal(planner.handoffToRun().phase,.5);
});

function sourceTimingFixture(phase,support=null){
 const planner=fixture(),state=planner.state;
 state.phase=phase;state.phaseRate=2;state.root=planner.root.position.clone();
 state.supportIntervals={r:[42/88,60/88],l:[-2/88,15/88]};
 state.feet=Object.fromEntries(['r','l'].map(s=>[s,{...state.lastFeet[s],gap:s===support?0:.1,weight:Number(s===support)}]));
 for(const s of ['r','l']){planner.contacts[s].soleUp=new Vector3(0,1,0);planner.bones['ball_'+s]={position:new Vector3(0,0,.14)};}
 planner.plan(state,()=>0,{x:0,z:0});return state;
}

test('a captured airborne attack lands the approaching left foot, rather than the legacy right phase',()=>{
 const state=sourceTimingFixture(.9);
 assert.equal(state.first,'l');
 assert.ok(state.plans.l.landing<state.plans.r.landing);
});

test('the captured right support remains planted through its actual takeoff interval',()=>{
 const state=sourceTimingFixture(.5,'r');
 assert.equal(state.first,'l');assert.equal(state.support,'r');
 assert.ok(state.plans.r.takeoff>.08&&state.plans.r.takeoff<.10,'The support released at the legacy phase boundary');
});

test('a fading source contact cannot pin its foot through another complete stride',()=>{
 const state=sourceTimingFixture(60/88+.005,'r');
 assert.equal(state.plans.r.takeoff,0);
 assert.ok(state.plans.r.landing<.4,'The released rear leg must collect in this stride');
 const acrossZero=sourceTimingFixture(.99,'l');
 assert.ok(acrossZero.plans.l.takeoff>.08&&acrossZero.plans.l.takeoff<.1,'A genuine contact across zero still keeps its support');
});

test('canceling a turn retains actual root velocity and current foot frames',()=>{
 const planner=fixture(),state=planner.state;
 state.reorientation={};state.basePelvis=new Vector3(0,.95,0);
 planner.report={feet:[{side:'r',weight:1,actualGap:0},{side:'l',weight:0,actualGap:.08}]};
 const velocity={x:.45,z:1.1};
 planner.restartBraking(velocity);
 assert.deepEqual(planner.state.rootVelocity.toArray(),[.45,0,1.1]);
 assert.ok(planner.state.root.equals(planner.root.position));
 assert.ok(planner.state.pelvis.equals(state.basePelvis));
 for(const side of ['r','l']){
  assert.equal(planner.state.feet[side].p,state.lastFeet[side].p);
  assert.equal(planner.state.feet[side].velocity,state.lastFeet[side].velocity);
 }
 assert.equal(planner.state.feet.r.weight,1);assert.equal(planner.state.feet.l.weight,0);
 assert.equal(planner.state.reorientation,undefined);
});

test('canceling a turn cannot silently discard unknown velocity',()=>{
 const planner=fixture();planner.state.reorientation={};
 assert.throws(()=>planner.restartBraking(),/current horizontal root velocity/);
});

test('a backward brake places the first landing behind the future body and uses the controller duration',()=>{
 const planner=fixture(),state=planner.state;
 state.phase=.9;state.phaseRate=2;state.root=planner.root.position.clone();state.rootVelocity.set(0,0,-5.3);state.brakeDuration=.2;
 state.supportIntervals={r:[42/88,60/88],l:[-2/88,15/88]};
 state.feet=Object.fromEntries(['r','l'].map(s=>[s,{...state.lastFeet[s],gap:.1,weight:0}]));
 for(const s of ['r','l']){planner.contacts[s].soleUp=new Vector3(0,1,0);planner.bones['ball_'+s]={position:new Vector3(0,0,.14)};}
 planner.plan(state,()=>0,{x:0,z:0});
 const first=state.plans[state.first];
 // Integrated smootherstep braking travels half its duration at full speed.
 const stopZ=state.root.z-5.3*.2/2;
 assert.ok(first.end.z<state.root.z-.18,'The first foot must reach in the backward travel direction.');
 assert.ok(Math.abs(state.plans[state.first==='r'?'l':'r'].end.z-stopZ)<1e-9,'The second landing must use the same stopping distance as the controller.');
 assert.throws(()=>planner.begin({duration:0}),/positive finite duration/);
});

test('a captured two-foot stop retains both footprints while absorbing its residual velocity',()=>{
 const planner=fixture();
 planner.previous={phase:.6,phaseRate:1,root:planner.root.position.clone(),rootVelocity:new Vector3(0,0,.3),pelvis:new Vector3(0,.8,0),
  feet:Object.fromEntries(['r','l'].map(side=>[side,{...planner.state.lastFeet[side],weight:1,gap:0}]))};
 planner.beginPlanted({velocity:{x:.1,z:.3},support:'r'});
 assert.equal(planner.state.first,'l');assert.equal(planner.state.preferredSupport,'r');
 for(const side of ['r','l'])assert.ok(planner.state.plans[side].end.equals(planner.previous.feet[side].p));
 const frame=planner.advanceBraking(.05,()=>0);
 assert.ok(frame.velocity.z>0&&frame.velocity.z<.3,'Do not erase residual motion at the clip boundary');
 assert.ok(frame.delta.z>0);assert.equal(planner.state.join,0);
 planner.previous.feet.r.gap=.013;
 assert.throws(()=>planner.beginPlanted({velocity:{x:0,z:.3},support:'r'}),/both feet/);
 planner.previous.feet.r.gap=0;
 planner.previous.feet.r.weight=0;
 assert.throws(()=>planner.beginPlanted({velocity:{x:0,z:.3},support:'r'}),/both feet/);
});
