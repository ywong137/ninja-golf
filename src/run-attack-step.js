import {Vector3,Quaternion,MathUtils} from 'three';
import {captureLegPole,blendLegPole,solveLegWithPole} from './leg-pole.js';
import {attackEntryVelocity} from './attack-braking.js';
import {ContactBraking} from './contact-braking.js';
import {sourceSupportIntervals} from './source-gait-clock.js';
import {PlantedPoseTransfer} from './planted-pose-transfer.js';
const point=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();
const UP=new Vector3(0,1,0),SIDES=['r','l'];
const smooth=t=>MathUtils.smootherstep(t,0,1);
function trajectory(start,velocity,end,duration,time){
 const u=MathUtils.clamp(time/duration,0,1);
 return start.clone().multiplyScalar(2*u**3-3*u*u+1)
  .addScaledVector(velocity,(u**3-2*u*u+u)*duration)
  .addScaledVector(end,-2*u**3+3*u*u);
}
// Experimental running-to-attack step planner. Only the candidate roster opts in.
// The actual source gait determines takeoff; each landing has a fixed footprint.
export class RunAttackStep{
 constructor(root,bones,anatomy,contacts){this.root=root;this.bones=bones;this.anatomy=anatomy;this.contacts=contacts;this.saved=[];}
 restore(){for(const[b,p,q]of this.saved){b.position.copy(p);b.quaternion.copy(q);}this.saved=[];}
 points(side,ballQ){return this.contacts[side].surface?.points(ballQ)??this.contacts[side].contacts;}
 gap(side,p,q,ground){return Math.min(...this.points(side).map(v=>{const c=v.clone().applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);}));}
 observe(running,phase,dt,groundHeight,contactWeights,pelvisPosition=this.bones.pelvis.position,sourceGait=null){
  if(!running){this.observedRunning=false;return;}
  this.root.updateMatrixWorld(true);
  const previous=this.observedRunning?this.previous:null,root=point(this.root);
  const rootVelocity=previous&&dt>0?root.clone().sub(previous.root).multiplyScalar(1/dt):new Vector3();
  const phaseRate=previous&&dt>0?((phase-previous.phase+1)%1)/dt:1.7;
  const feet=Object.fromEntries(SIDES.map(s=>{
   const p=point(this.bones['foot_'+s]),q=rotation(this.bones['foot_'+s]);
   const velocity=previous&&dt>0?p.clone().sub(previous.feet[s].p).multiplyScalar(1/dt):rootVelocity.clone();
   return[s,{p,q,ballQ:this.bones['ball_'+s]?.quaternion.clone(),velocity,gap:groundHeight?this.gap(s,p,q,groundHeight):Infinity,weight:contactWeights?.[s]??0,
    pole:captureLegPole(this.bones['thigh_'+s],this.bones['calf_'+s],this.bones['foot_'+s],this.anatomy[s].hinge)}];
  }));
  this.observedRunning=true;
  this.previous={phase,phaseRate,root,rootVelocity,feet,pelvis:pelvisPosition.clone(),supportIntervals:sourceGait?sourceSupportIntervals(sourceGait):null};
 }
 begin({duration=.18,contactDriven=false}={}){
  if(!Number.isFinite(duration)||duration<=0)throw Error('Braking needs a positive finite duration.');
  if(!this.previous)return;
  this.state={...this.previous,brakeDuration:duration,age:0,poleContinuity:{r:{},l:{}}};this.report=null;
  if(contactDriven)this.state.braking=new ContactBraking(this.state.rootVelocity,duration);
 }
 beginPlanted({velocity,support,duration=.15}){
  if(!this.previous||!SIDES.every(s=>this.previous.feet[s].weight>.95&&Math.abs(this.previous.feet[s].gap)<.012))
   throw Error('Finish a recorded stop only after both feet reach the ground.');
  if(!velocity||![velocity.x,velocity.z].every(Number.isFinite))throw Error('A planted stop needs its measured exit velocity.');
  if(!SIDES.includes(support))throw Error('A planted stop needs its last supporting foot.');
  this.begin({duration,contactDriven:true});
  const state=this.state;state.rootVelocity.set(velocity.x,0,velocity.z);state.braking=new ContactBraking(velocity,duration);
  state.support=support;state.preferredSupport=support;state.first=support==='r'?'l':'r';state.join=0;state.brakeWindows=[[0,Infinity]];state.plans={};state.recordedStop=true;state.plannedTravel=new Vector3();
  for(const side of SIDES){const f=state.feet[side];state.plans[side]={takeoff:Infinity,landing:0,end:f.p.clone(),q:f.q.clone(),velocity:new Vector3(),lift:0};}
 }
 advanceBraking(dt,ground){
  const state=this.state;
  if(!state?.braking)throw Error('Start contact-driven braking before advancing its root.');
  if(!state.plans)this.plan(state,ground,{x:0,z:0});
  // Only the previous corrected pose can authorize support. Forecasting a
  // touchdown does not mean that an unreachable foot actually landed.
  const contacts=this.report?.feet??SIDES.map(side=>({side,weight:state.feet[side].weight,error:0,actualGap:state.feet[side].gap}));
  let loaded=0;
  for(const f of contacts){
   if(f.weight<=.5||f.error>=.01||Math.abs(f.actualGap)>=.012)continue;
   const plan=state.plans[f.side];
   const remaining=state.age>=plan.landing?Infinity:plan.takeoff-state.age;
   loaded=Math.max(loaded,MathUtils.clamp(remaining,0,dt));
  }
  const frame=state.braking.advance(dt,loaded);state.brakeFrame=frame;return frame;
 }
 get brakingComplete(){return this.state?.braking?this.state.braking.done:(this.state?.age??0)>=(this.state?.brakeDuration??.18);}
 finishStop(){
  // Keep the actual braking footprints. Restarting the planner here would
  // invent another pair of braking steps after the character already stopped.
  if(this.state)this.state.reorientation=null;
 }
 handoffToGuard({moving=false}={}){
  const state=this.state;if(!state?.lastFeet||!state.moving&&!moving)return null;
  // A changed direction needs a new step, not the old forward landing. Once
  // one foot actually supports the body, the guard gait can carry that contact
  // and continue the other foot's flight toward the requested direction.
  const turned=state.plannedTravel&&state.travel&&state.plannedTravel.distanceTo(state.travel)>.5;
  const grounded=this.report.feet.filter(f=>f.weight>.95&&f.error<.01&&Math.abs(f.actualGap)<.012);
  if(!grounded.length||(!turned&&(state.age<state.join||grounded.length<2)))return null;
  const support=grounded.sort((a,b)=>state.plans[b.side].landing-state.plans[a.side].landing)[0].side;
  // An existing support cannot start the new direction's choreography before
  // that direction was requested. A later touchdown can delay eligibility.
  const eligible=Math.max(state.plans[support].landing,turned?(state.turnRequestedAt??state.age):state.join);
  return{feet:state.lastFeet,support,elapsed:state.parked?0:Math.max(0,state.age-eligible),contacts:this.contacts,anatomy:this.anatomy};
 }
 handoffToRun({travel}={}){
  const state=this.state;if(!state?.lastFeet||!state.plans)return null;
  if(state.reorientation&&!state.reorientation.complete)return null;
  const planted=(this.report?.feet??[]).filter(f=>f.weight>.95&&f.error<.01&&Math.abs(f.actualGap)<.012).map(f=>f.side);
  if(!planted.length)return null;
  const landing=s=>state.settle?.feet[s]?.landing??state.plans[s].landing;
  if(travel&&Math.hypot(travel.x,travel.z)>.1){
   const center=point(this.root),lead=side=>(state.lastFeet[side].p.x-center.x)*travel.x+(state.lastFeet[side].p.z-center.z)*travel.z;
   // The rear support in the new direction can push the body into that
   // direction. Selecting only the latest landing discards that loaded foot.
   state.preferredSupport=planted.toSorted((a,b)=>lead(a)-lead(b))[0];
  }
  const support=planted.includes(state.preferredSupport)?state.preferredSupport:planted.sort((a,b)=>landing(b)-landing(a))[0];
  const phase=support==='r'?0:.5;
  const feet=Object.fromEntries(SIDES.map(s=>[s,{...state.lastFeet[s],phase:(phase+(s==='l'?.5:0))%1}]));
  return{phase,feet,support,elapsed:Math.max(0,state.age-landing(support)),rootRotation:state.lastRootRotation,
   ...(state.reorientation?{rootPosition:point(this.root),rootVelocity:new Vector3(),grounded:true}: {})};
 }
 handoffToStart(){
  // A recorded standing push starts in double support. Do not manufacture
  // that contact state from an unfinished turn or an airborne recovery.
  if(!this.state?.reorientation?.complete)return null;
  const handoff=this.handoffToRun();
  if(!handoff||!SIDES.every(side=>this.report.feet.some(f=>f.side===side&&f.weight>.95&&f.error<.01&&Math.abs(f.actualGap)<.012)))return null;
  return{...handoff,contactWeights:{r:1,l:1},pelvisPosition:(this.state.basePelvis??this.state.pelvis).clone()};
 }
 reorient(dt,yaw,ground){
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(yaw))throw Error('Reorientation needs positive frame time and a finite requested heading.');
  const state=this.state;
  if(!state?.lastFeet||!this.report||!ground)return this.root.rotation.y;
  // The braking footprints already account for the remaining root travel.
  // Do not replace them with a standing pivot while that travel continues.
  if(!this.brakingComplete)return this.root.rotation.y;
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const planted=this.report.feet.filter(f=>f.weight>.95&&f.error<.01&&Math.abs(f.actualGap)<.012);
  if(!state.reorientation&&!planted.length)return this.root.rotation.y;
  const turn=state.reorientation??={heading:this.root.rotation.y,pelvis:(state.basePelvis??this.bones.pelvis.position).clone(),step:null,complete:false};
  turn.requestedYaw=turn.heading+wrap(yaw-turn.heading);
  if(turn.complete&&Math.abs(wrap(yaw-turn.heading))<.12)return turn.heading;
  turn.complete=false;
  if(!turn.step){
   if(!planted.length)return turn.heading;
   const difference=wrap(yaw-turn.heading);
   if(Math.abs(difference)<.12){turn.complete=true;return turn.heading;}
   const support=planted.sort((a,b)=>state.plans[b.side].landing-state.plans[a.side].landing)[0].side;
   const side=support==='r'?'l':'r',start=state.lastFeet[side],held=state.lastFeet[support];
   let angle=MathUtils.clamp(difference,-Math.PI/3,Math.PI/3);
   // Collect a distant trailing footprint before turning over it. Rotating
   // the hips through the full angle can put a planted ankle beyond reach.
   // The next step can turn farther once its new support is under the body.
   const hip=point(this.bones['thigh_'+support]),knee=point(this.bones['calf_'+support]),ankle=point(this.bones['foot_'+support]);
   const reach=(hip.distanceTo(knee)+knee.distanceTo(ankle))*.96;
   const vertical=Math.max(0,hip.y-held.p.y-.10*this.root.scale.x);
   const radius=Math.sqrt(Math.max(0,reach*reach-vertical*vertical)),origin=point(this.root);
   const distance=theta=>{const p=hip.clone().sub(origin).applyAxisAngle(UP,theta).add(origin);return Math.hypot(p.x-held.p.x,p.z-held.p.z);};
   const limit=Math.max(radius,distance(0));
   if(distance(angle)>limit){let lo=0,hi=1;for(let i=0;i<16;i++){const u=(lo+hi)/2;if(distance(angle*u)<=limit)lo=u;else hi=u;}angle*=lo;}
   const endYaw=turn.heading+angle;
   const forward=new Vector3(Math.sin(endYaw),0,Math.cos(endYaw)),right=new Vector3().crossVectors(UP,forward);
   const duration=MathUtils.clamp(.14+Math.abs(endYaw-turn.heading)*.02,.15,.19);
   const remaining=Math.max(0,.2-state.age);
   const velocity=remaining?attackEntryVelocity(state.rootVelocity,{x:0,z:0},state.age,remaining,.2):{x:0,z:0};
   const end=point(this.root).add(new Vector3(velocity.x*remaining,0,velocity.z*remaining))
    .addScaledVector(right,(side==='r'?-.24:.24)*this.root.scale.x).addScaledVector(forward,.05*this.root.scale.x);
   const q=start.q.clone();q.premultiply(new Quaternion().setFromUnitVectors(this.contacts[side].soleUp.clone().applyQuaternion(q),UP));
   const toe=this.bones['ball_'+side].position.clone().applyQuaternion(q).setY(0).normalize();
   q.premultiply(new Quaternion().setFromAxisAngle(UP,endYaw+(side==='r'?-.10:.10)-Math.atan2(toe.x,toe.z)));
   end.y-=this.gap(side,end,q,ground);
   const initialContact=planted.some(f=>f.side===side),prepare=initialContact?.025:0;
   const sole=this.points(support,held.ballQ),index=sole.reduce((best,p,i)=>p.clone().applyQuaternion(held.q).y<sole[best].clone().applyQuaternion(held.q).y?i:best,0);
   turn.step={side,support,from:turn.heading,to:endYaw,age:0,prepare,duration,
    start:{p:start.p.clone(),q:start.q.clone()},velocity:initialContact?new Vector3():start.velocity.clone(),end,q,
    held:{p:held.p.clone(),q:held.q.clone()},pivot:sole[index].clone().applyQuaternion(held.q).add(held.p),pivotIndex:index};
   state.settle=null;
  }
  const step=turn.step;step.age+=dt;
  const u=MathUtils.clamp((step.age-step.prepare)/step.duration,0,1);
  turn.heading=MathUtils.lerp(step.from,step.to,smooth(u));
  return turn.heading;
 }
 restartBraking(rootVelocity){
  const state=this.state;if(!state?.lastFeet)return;
  if(!Number.isFinite(rootVelocity?.x)||!Number.isFinite(rootVelocity?.z))throw Error('Restarting braking requires the current horizontal root velocity.');
  const support=(this.report?.feet??[]).filter(f=>f.weight>.95).map(f=>f.side)[0]??state.first;
  const feet=Object.fromEntries(SIDES.map(side=>[side,{...state.lastFeet[side],
   gap:this.report?.feet.find(f=>f.side===side)?.actualGap??0,weight:this.report?.feet.find(f=>f.side===side)?.weight??0}]));
  this.state={phase:support==='r'?0:.5,phaseRate:1.7,root:point(this.root),rootVelocity:new Vector3(rootVelocity.x,0,rootVelocity.z),
   feet,pelvis:(state.basePelvis??this.bones.pelvis.position).clone(),supportIntervals:null,age:0,poleContinuity:{r:{},l:{}}};
  this.report=null;this.targets=null;this.standing=null;
 }
 reset(){this.state=null;this.report=null;this.targets=null;this.standing=null;}
 plan(state,ground,wanted){
  const phaseFor=s=>(state.phase+(s==='l'?.5:0))%1;
  const untilContact=s=>state.supportIntervals?MathUtils.euclideanModulo(state.supportIntervals[s][0]-state.phase,1):1-phaseFor(s);
  const untilTakeoff=s=>{
   if(!state.supportIntervals)return Math.max(0,.28-phaseFor(s));
   const [a,b]=state.supportIntervals[s],cycle=Math.round(state.phase-(a+b)/2);
   // A fading contact just after toe-off belongs to the ending interval.
   // Wrapping its negative remainder would pin it for another whole stride.
   return Math.max(0,b+cycle-state.phase);
  };
  const loaded=SIDES.filter(s=>state.feet[s].gap<.015&&state.feet[s].weight>.5);
  const support=loaded.sort((a,b)=>state.feet[a].gap-state.feet[b].gap)[0]??null;
  const first=support?(support==='r'?'l':'r'):(untilContact('r')<untilContact('l')?'r':'l');
  const second=first==='r'?'l':'r',rate=Math.max(.5,state.phaseRate);
  const firstTime=MathUtils.clamp(untilContact(first)/rate,.065,.18);
  const source=state.rootVelocity;
  if(state.braking){
   state.brakeWindows=[[firstTime,Infinity]];
   if(support){const takeoff=untilTakeoff(support)/rate;if(takeoff>0)state.brakeWindows.push([0,takeoff]);}
  }
  const futureRoot=t=>{
   if(state.braking){const {delta}=state.braking.predict(t,state.brakeWindows);return state.root.clone().add(new Vector3(delta.x,0,delta.z));}
   const v=attackEntryVelocity(source,wanted,0,t,state.brakeDuration??.18);
   return state.root.clone().add(new Vector3(v.x*t,0,v.z*t));
  };
  const forward=new Vector3(0,0,1).applyQuaternion(rotation(this.root)).setY(0).normalize();
  const right=new Vector3().crossVectors(UP,forward);
  const travel=new Vector3(wanted.x,0,wanted.z);
  if(travel.lengthSq()<.01)travel.copy(source).setY(0);
  if(travel.lengthSq()<.01)travel.copy(forward);else travel.normalize();
  state.first=first;state.support=support;state.plans={};
  state.plannedTravel=new Vector3(wanted.x,0,wanted.z);
  for(const s of [first,second]){
   const start=state.feet[s],takeoff=s===support?untilTakeoff(s)/rate:0;
   const landing=s===first?firstTime:Math.max(firstTime+.14,takeoff+.14);
   const end=futureRoot(landing).addScaledVector(right,(s==='r'?-.25:.25)*this.root.scale.x)
    .addScaledVector(travel,(s===first?.18:Math.hypot(wanted.x,wanted.z)>.1?.25:0)*this.root.scale.x);
   const q=start.q.clone();q.premultiply(new Quaternion().setFromUnitVectors(this.contacts[s].soleUp.clone().applyQuaternion(q),UP));
   const shoeForward=this.bones['ball_'+s].position.clone().applyQuaternion(q).setY(0).normalize();
   const yaw=Math.atan2(forward.x,forward.z)+(s==='r'?-.10:.10)-Math.atan2(shoeForward.x,shoeForward.z);
   q.premultiply(new Quaternion().setFromAxisAngle(UP,yaw));end.y-=this.gap(s,end,q,ground);
   state.plans[s]={takeoff,landing,end,q,recovery:s===second,lift:(s===second?.18:.025)*this.root.scale.x,velocity:s===support?new Vector3():start.velocity.clone()};
  }
  state.join=Math.max(...Object.values(state.plans).map(p=>p.landing));
 }
 retargetFlight(state,ground,travel,dt){
  const wanted=new Vector3(travel.x,0,travel.z),previous=state.previousTravel??state.plannedTravel;
  state.previousTravel=wanted;
  if(previous.distanceTo(wanted)<.5||state.settle||!state.lastFeet)return;
  state.turnRequestedAt=state.age-dt;
  const forward=new Vector3(0,0,1).applyQuaternion(rotation(this.root)).setY(0).normalize();
  const right=new Vector3().crossVectors(UP,forward),direction=wanted.length()>.1?wanted.clone().normalize():forward;
  for(const s of [state.first,state.first==='r'?'l':'r']){
   const plan=state.plans[s];if(state.age-dt>=plan.landing)continue;
   const last=state.lastFeet[s];
   const landingAt=duration=>{
    const velocity=attackEntryVelocity(state.rootVelocity,travel,state.age,duration,state.brakeDuration??.18);
    const end=point(this.root).add(new Vector3(velocity.x*duration,0,velocity.z*duration))
     .addScaledVector(right,(s==='r'?-.25:.25)*this.root.scale.x)
     .addScaledVector(direction,(s===state.first?.18:.25)*this.root.scale.x);
    end.y-=this.gap(s,end,plan.q,ground);return end;
   };
   const adjustment=landingAt(Math.max(.1,plan.landing-state.age)).distanceTo(plan.end);
   const remaining=Math.max(plan.landing-state.age,.1,Math.min(.22,Math.sqrt(adjustment/40)));
   // Preserve the actual airborne position and velocity. A reversal gets a
   // longer flight rather than pulling a foot to a new endpoint in one frame.
   plan.start={p:last.p.clone(),q:last.q.clone()};plan.takeoff=state.age-dt;
   plan.landing=state.age+remaining;plan.end=landingAt(remaining);
   plan.velocity=last.velocity?.clone()??new Vector3();plan.lift=.035*this.root.scale.x;plan.recovery=false;
  }
  state.join=Math.max(...Object.values(state.plans).map(p=>p.landing));
 }
 apply(dt,{groundHeight,travel={x:0,z:0},active=false,enabled=true,authoredPose=null,readyFeet=null}={}){
  if(!enabled||!groundHeight){this.reset();return null;}
  const state=this.state;if(!state||dt<=0)return null;
  state.age+=dt;const age=state.age;state.moving=Math.hypot(travel.x,travel.z)>.1;state.travel=new Vector3(travel.x,0,travel.z);
  this.root.updateMatrixWorld(true);
  if(!state.plans)this.plan(state,groundHeight,travel);
  this.retargetFlight(state,groundHeight,travel,dt);
  const incoming=Object.fromEntries(SIDES.map(s=>[s,{p:point(this.bones['foot_'+s]),q:rotation(this.bones['foot_'+s]),pole:captureLegPole(this.bones['thigh_'+s],this.bones['calf_'+s],this.bones['foot_'+s],this.anatomy[s].hinge)}]));
  for(const n of ['pelvis','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l']){const b=this.bones[n];this.saved.push([b,b.position.clone(),b.quaternion.clone()]);}
  // An airborne foot cannot pull the pelvis down for an unreachable target.
  const pelvis=this.bones.pelvis;
  pelvis.position.copy(state.reorientation?.pelvis??state.pelvis.clone().lerp(pelvis.position,MathUtils.smootherstep(age,0,.28)));
  this.root.updateMatrixWorld(true);
  // A standing recovery uses real, alternating steps into the ready stance.
  // A resumed run takes ownership through handoffToRun before this layer runs.
  if(state.parked&&authoredPose?.active&&!state.authoredTransfer){state.authoredTransfer=new PlantedPoseTransfer(state.lastFeet??state.feet,this.contacts);state.reorientation=null;}
  if(state.authoredTransfer&&authoredPose)state.authoredTransfer.begin(dt,authoredPose.key,authoredPose.time);
  if(!state.reorientation&&(!state.braking||state.braking.done)&&!active&&age>=state.join&&!state.settle&&!state.parked){
   const fit=SIDES.map(s=>{const current=state.lastFeet?.[s]??state.feet[s],ready=readyFeet?.[s]??incoming[s],end=ready.p.clone();end.y-=this.gap(s,end,ready.q,groundHeight);return{side:s,distance:current.p.distanceTo(end),angle:current.q.angleTo(ready.q)};});
   // The recorded landing already widened during flight. Keep a useful
   // stance instead of forcing a small correction through two extra steps.
   if(state.recordedStop&&fit.every(f=>f.distance<.08*this.root.scale.x&&f.angle<.26))state.parked=true;
   else{
   state.settle={start:age,feet:{}};
   let next=age;
   for(const s of [state.first,state.first==='r'?'l':'r']){
    const end=incoming[s].p.clone(),q=incoming[s].q.clone();end.y-=this.gap(s,end,q,groundHeight);
    const start=(state.lastFeet?.[s]?.p??state.plans[s].end).clone(),distance=start.distanceTo(end),duration=MathUtils.clamp(.16+distance*.18,.18,.32);
    state.settle.feet[s]={start,q0:(state.lastFeet?.[s]?.q??state.plans[s].q).clone(),end,q,prepare:next,takeoff:next+.24,landing:next+.24+duration,lift:MathUtils.clamp(distance*.25,.025,.12)*this.root.scale.x};
    next+=.24+duration;
   }
   state.settle.end=next+.24;
   }
  }
  if(state.settle||state.reorientation?.step){
   const body=point(pelvis),offset=new Vector3(),targets={};
   if(state.reorientation?.step){
    const step=state.reorientation.step,u=MathUtils.clamp(step.age/(step.prepare+step.duration),0,1);
    offset.copy(step.held.p).sub(body).setY(0).multiplyScalar(.5).clampLength(0,.055*this.root.scale.x);
    offset.multiplyScalar(Math.sin(Math.PI*u)**2);
    targets[step.support]=[step.held.p];targets[step.side]=[step.start.p,step.end];
   }else for(const s of SIDES){
    const step=state.settle.feet[s],other=s==='r'?'l':'r',support=state.settle.feet[other];
    const weight=MathUtils.smootherstep(age,step.prepare,step.takeoff)*(1-MathUtils.smootherstep(age,step.landing,step.landing+.24));
    const anchor=age>=support.landing?support.end:support.start;
    const shift=anchor.clone().sub(body).setY(0).multiplyScalar(.6);shift.clampLength(0,.10*this.root.scale.x);
    offset.addScaledVector(shift,weight);targets[s]=[step.start,step.end];
   }
   // Prepare a shift which can also finish the next landing. A lateral body
   // offset must not leave the opposite planted foot beyond the leg's reach.
   let allowed=1;
   for(const s of SIDES){
    const hip=point(this.bones['thigh_'+s]),knee=point(this.bones['calf_'+s]),ankle=point(this.bones['foot_'+s]);
    const reach=(hip.distanceTo(knee)+knee.distanceTo(ankle))*.993;
    for(const target of targets[s]){
     const limit=Math.max(reach,hip.distanceTo(target));
     if(hip.clone().addScaledVector(offset,allowed).distanceTo(target)<=limit)continue;
     let lo=0,hi=allowed;for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(hip.clone().addScaledVector(offset,mid).distanceTo(target)<=limit)lo=mid;else hi=mid;}
     allowed=lo;
    }
   }
   const owner=state.reorientation?.step?state.reorientation:state.settle;
   owner.shift=offset.clone().multiplyScalar(allowed);
   pelvis.position.copy(pelvis.parent.worldToLocal(body.add(owner.shift)));this.root.updateMatrixWorld(true);
  }
  const feet=[],targets={};
  state.previousFeet=state.lastFeet;
  for(const s of SIDES){
   const plan=state.plans[s],start=plan.start??state.feet[s],native=incoming[s];let p,q,plannedContact,clearance=0;
   if(age<=plan.takeoff){p=start.p.clone();q=start.q.clone();plannedContact=true;}
   else{
    const duration=plan.landing-plan.takeoff,u=MathUtils.clamp((age-plan.takeoff)/duration,0,1);
    p=trajectory(start.p,plan.velocity,plan.end,duration,age-plan.takeoff);clearance=.06*this.root.scale.x*Math.sin(Math.PI*u);
    // The rear knee folds shortly after toe-off, before the ankle passes the
    // body. A symmetric arc lifts too late during a fast braking step.
    const arc=plan.recovery?729/16*u*u*(1-u)**4:16*u*u*(1-u)*(1-u);
    p.y+=plan.lift*arc+(plan.recovery?.06*this.root.scale.x*16*u*u*(1-u)*(1-u):0);
    q=start.q.clone().slerp(state.moving?plan.q:native.q,smooth(u));plannedContact=u>=1;
    if(!state.moving&&plannedContact&&!state.settle){
     // Preserve the authored toe/heel pivot while the body turns over support.
     // Lock the contacting point, not the whole orientation of the shoe.
     if(!plan.pivot){
      const points=this.points(s),index=points.reduce((best,v,i)=>v.clone().applyQuaternion(q).y<points[best].clone().applyQuaternion(q).y?i:best,0);
      const anchor=points[index].clone().applyQuaternion(q).add(p);anchor.y=groundHeight(anchor.x,anchor.z);
      plan.pivot={index,anchor,p:p.clone(),q:q.clone(),ballQ:this.bones['ball_'+s]?.quaternion.clone()};
     }
     const pivot=plan.pivot,points=this.points(s),other=points.reduce((best,v,i)=>v.clone().applyQuaternion(q).y<points[best].clone().applyQuaternion(q).y?i:best,0);
     if(points[other].clone().applyQuaternion(q).y<points[pivot.index].clone().applyQuaternion(q).y-1e-5){
      pivot.anchor=this.points(s,pivot.ballQ)[other].clone().applyQuaternion(pivot.q).add(pivot.p);pivot.anchor.y=groundHeight(pivot.anchor.x,pivot.anchor.z);pivot.index=other;
     }
     p=pivot.anchor.clone().sub(points[pivot.index].clone().applyQuaternion(q));pivot.p.copy(p);pivot.q.copy(q);pivot.ballQ=this.bones['ball_'+s]?.quaternion.clone();
    }
   }
   let mode=plannedContact?'support':'braking';
   if(state.parked){
    const toe=this.bones['ball_'+s];this.saved.push([toe,toe.position.clone(),toe.quaternion.clone()]);
    if(state.authoredTransfer&&authoredPose){
     const placed=state.authoredTransfer.place(s,{...native,ballQ:toe.quaternion.clone()},authoredPose.motion,groundHeight,authoredPose.contactWeights?.[s]);
     p=placed.p;q=placed.q;toe.quaternion.copy(placed.ballQ);plannedContact=placed.supported;mode=plannedContact?'authored-support':'authored-flight';
    }else{const held=state.authoredTransfer?.feet[s].last??state.feet[s];p=held.p.clone();q=held.q.clone();toe.quaternion.copy(held.ballQ);mode='parked';}
   }
   if(state.settle){
    const step=state.settle.feet[s],u=MathUtils.clamp((age-step.takeoff)/(step.landing-step.takeoff),0,1);
    p=step.start.clone().lerp(step.end,smooth(u));p.y+=step.lift*16*u*u*(1-u)*(1-u);
    q=step.q0.clone().slerp(step.q,smooth(u));clearance=step.lift*.5*Math.sin(Math.PI*u);plannedContact=u===0||u===1;mode=u===0?'support':u===1?'settled':'recovery';
   }
   if(state.reorientation?.step||state.reorientation?.completedStep){
    const step=state.reorientation.step??state.reorientation.completedStep,u=MathUtils.clamp((step.age-step.prepare)/step.duration,0,1);
    if(s===step.side){
     p=trajectory(step.start.p,step.velocity,step.end,step.duration,Math.max(0,step.age-step.prepare));
     p.y+=.085*this.root.scale.x*16*u*u*(1-u)*(1-u);
     q=step.start.q.clone().slerp(step.q,smooth(u));plannedContact=u===1||step.age<=step.prepare;
     clearance=.035*this.root.scale.x*Math.sin(Math.PI*u);mode=plannedContact?'support':'reorientation';
    }else{
     const pivotAngle=MathUtils.clamp(state.reorientation.heading-step.from,-Math.PI/9,Math.PI/9);
     q=step.held.q.clone().premultiply(new Quaternion().setFromAxisAngle(UP,pivotAngle));
     p=step.pivot.clone().sub(this.points(s)[step.pivotIndex].clone().applyQuaternion(q));
     plannedContact=true;clearance=0;mode='support';
    }
   }
   const gap=this.gap(s,p,q,groundHeight);if(gap<clearance)p.y+=clearance-gap;
   targets[s]={p:p.clone(),q:q.clone()};
   const thigh=this.bones['thigh_'+s],axis=p.clone().sub(point(thigh)).normalize();
   const bend=blendLegPole(state.feet[s].pole,native.pole,axis,MathUtils.smootherstep(age,0,.28),state.poleContinuity[s]);
   const error=solveLegWithPole(thigh,this.bones['calf_'+s],this.bones['foot_'+s],p,q,this.anatomy[s].hinge,{axis,bend});
   const actualGap=this.gap(s,point(this.bones['foot_'+s]),rotation(this.bones['foot_'+s]),groundHeight);
   feet.push({side:s,error,preTerrainError:error,target:p.toArray(),actualGap,weight:Number(plannedContact&&Math.abs(actualGap)<.012&&error<.01),plannedContact,mode,takeoff:state.settle?.feet[s].takeoff??plan.takeoff,landing:state.settle?.feet[s].landing??plan.landing});
  }
  this.report={age,support:state.support,first:state.first,join:state.join,parked:!!state.parked,feet,shift:state.settle?.shift?.toArray()};
  this.targets=targets;
  // The terrain layer runs after this planner. Save its input, so a handoff
  // does not bake the previous terrain offset and then apply it a second time.
  state.basePelvis=pelvis.position.clone();
  this.standing=Object.fromEntries(SIDES.map(s=>{
    const standing=incoming[s].p.clone();standing.y-=this.gap(s,standing,incoming[s].q,groundHeight);
    return[s,{p:standing,q:incoming[s].q}];
  }));
  // Terrain owns the final pelvis reserve and leg solve. Keep intended world
  // targets even when the provisional, unlowered leg cannot yet reach them.
  return{contactWeights:Object.fromEntries(feet.map(f=>[f.side,Number(f.plannedContact)])),stance:Object.fromEntries(feet.map(f=>[f.side,f.plannedContact])),targets};
 }
 finalize(dt,groundHeight){
  const state=this.state;if(!state||!this.targets)return;
  this.root.updateMatrixWorld(true);state.lastFeet={};state.lastRootRotation=rotation(this.root);
  for(const s of SIDES){
   const p=point(this.bones['foot_'+s]),q=rotation(this.bones['foot_'+s]),previous=state.previousFeet?.[s];
   state.lastFeet[s]={p,q,ballQ:this.bones['ball_'+s]?.quaternion.clone(),velocity:previous?p.clone().sub(previous.p).divideScalar(dt):state.feet[s].velocity.clone(),pole:captureLegPole(this.bones['thigh_'+s],this.bones['calf_'+s],this.bones['foot_'+s],this.anatomy[s].hinge)};
   state.authoredTransfer?.record(s,p,q,this.bones['ball_'+s].quaternion);
   const report=this.report.feet.find(f=>f.side===s);
   report.error=p.distanceTo(this.targets[s].p);report.actualGap=this.gap(s,p,q,groundHeight);
   report.weight=Number(report.plannedContact&&Math.abs(report.actualGap)<.012&&report.error<.01);
  }
  const turn=state.reorientation,step=turn?.step;
  if(step&&step.age>=step.prepare+step.duration&&this.report.feet.find(f=>f.side===step.side)?.weight){
   // Support transfers only after the corrected foot actually reaches terrain.
   state.plans[step.side].landing=state.age;turn.completedStep=step;turn.step=null;
   if(Math.abs(Math.atan2(Math.sin(turn.requestedYaw-turn.heading),Math.cos(turn.requestedYaw-turn.heading)))<.12)turn.complete=true;
  }
  if(state.settle&&state.age>=state.settle.end&&SIDES.every(s=>state.lastFeet[s].p.distanceTo(this.standing[s].p)<.003&&state.lastFeet[s].q.angleTo(this.standing[s].q)<.01))this.state=null;
 }
}
