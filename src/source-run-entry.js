import {MathUtils,Quaternion,Vector3} from 'three';
import {captureLegPole,blendLegPole} from './leg-pole.js';
import {gaitContactWeight,sourceSupportIntervals} from './source-gait-clock.js';
import {runStartContacts} from './source-run-start.js';
import {turnHeading} from './source-run-turn.js';
import {attackRootDelta} from './attack-root-motion.js';

const SIDES=['r','l'],wrap=x=>MathUtils.euclideanModulo(x,1);
const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const sequenceHeading=(profile,time)=>profile.poseFrame==='fixed-heading'?0:turnHeading(profile,time);

export function entryDisplacement(offset,velocity,progress,elapsedSeconds){
 if(!Number.isFinite(progress)||progress<0||!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw Error('Blend entry displacement with nonnegative normalized progress and elapsed seconds.');
 const u=MathUtils.clamp(progress,0,1);
 // Position recovery follows the source phase. Momentum uses real seconds.
 // Dividing velocity by the near-zero initial cadence amplifies it when the
 // run accelerates, throwing the free foot far outside the human stride.
 return offset.clone().multiplyScalar(2*u**3-3*u*u+1).addScaledVector(velocity,elapsedSeconds*(1-u)*(1-u));
}

export function sourceEntryPhase(blend,support){
 if(!SIDES.includes(support))throw Error('Captured run entry requires a supporting foot.');
 const intervals=sourceSupportIntervals(blend),[start,end]=intervals[support];
 return {phase:wrap((start+end)/2),intervals};
}

// Preserve the outgoing world contacts until the source gait takes each foot
// through a complete swing. A bone crossfade cannot preserve a planted shoe.
// Only this layer owns the first captured stride; it never seeds the legacy
// procedural gait and then discards that gait's contact plan.
export class SourceRunEntry{
 constructor(root,model,bones,anatomy,contacts,data){
  Object.assign(this,{root,model,bones,anatomy,contacts,data});this.state=null;
 }
 reset(){this.state=null;this.report=null;}
 sample(actions,phase){
  const active=actions.filter(a=>a.getEffectiveWeight()>1e-8);
  const total=active.reduce((sum,a)=>sum+a.getEffectiveWeight(),0);
  if(!total)throw Error('Captured run entry needs a weighted source clip.');
  const modelQ=rotation(this.model),feet={};
  for(const side of SIDES){
   const p=new Vector3(),q=new Quaternion(),ballQ=new Quaternion(),axis=new Vector3(),bend=new Vector3();let accumulated=0;
   for(const action of active){
    const clip=action.getClip(),{rows,count}=this.data[clip.name];
    const sequence=clip.userData?.sourceRunStart||clip.userData?.sourceRunTurn||clip.userData?.sourceRunStop;
    // A complete stop or turn ends at its final pose. Only gait loops wrap.
    const at=(sequence?MathUtils.clamp(phase,0,1):wrap(phase))*count;
    const i=Math.min(count-1,Math.floor(at)),t=at-i,weight=action.getEffectiveWeight()/total;
    p.addScaledVector(rows[i][side].p.clone().lerp(rows[i+1][side].p,t),weight);
    const orientation=rows[i][side].q.clone().slerp(rows[i+1][side].q,t);
    const toe=rows[i][side].ballQ?.clone().slerp(rows[i+1][side].ballQ,t)??new Quaternion();
    axis.addScaledVector(rows[i][side].pole.axis.clone().lerp(rows[i+1][side].pole.axis,t),weight);
    bend.addScaledVector(rows[i][side].pole.bend.clone().lerp(rows[i+1][side].pole.bend,t),weight);
    if(!accumulated){q.copy(orientation);ballQ.copy(toe);}else{q.slerp(orientation,weight/(accumulated+weight));ballQ.slerp(toe,weight/(accumulated+weight));}
    accumulated+=weight;
   }
   axis.normalize().applyQuaternion(modelQ);bend.applyQuaternion(modelQ);bend.addScaledVector(axis,-bend.dot(axis));
   if(bend.lengthSq()<1e-8)throw Error('Captured run entry cannot interpolate an undefined source knee plane.');
   feet[side]={p:p.applyMatrix4(this.model.matrixWorld),q:q.premultiply(modelQ),ballQ,pole:{axis,bend:bend.normalize()}};
  }
  return feet;
 }
 begin(handoff,blend){
  const entry=sourceEntryPhase(blend,handoff.support),intervals=entry.intervals;
  if(handoff.supportProgress!==undefined&&(!Number.isFinite(handoff.supportProgress)||handoff.supportProgress<0||handoff.supportProgress>1))throw Error('Source support progress must be in [0,1].');
  const phase=handoff.supportProgress===undefined?entry.phase:wrap(MathUtils.lerp(...intervals[handoff.support],Math.min(.98,handoff.supportProgress)));
  const schedule=Object.fromEntries(SIDES.map(side=>{
   const supported=side===handoff.support&&handoff.grounded!==false,release=side===handoff.support?wrap(intervals[side][1]-phase):0;
   let landing=wrap(intervals[side][0]-phase);
   // At the exact start of support, its next landing is one cycle away.
   // A zero-length flight would snap the released shoe to the source pose.
   if(supported&&landing<=release)landing+=1;
   return[side,{release,landing,supported}];
  }));
  const result=this.seed(handoff,phase,intervals,schedule);
  if(handoff.supportProgress!==undefined)this.state.pivotSupport=true;
  if(handoff.rootPosition){
   this.state.entryFrame={p:handoff.rootPosition.clone(),q:handoff.rootRotation.clone()};
   this.state.entryPhaseRate=blend.phaseRate;this.state.entryRootVelocity=handoff.rootVelocity?.clone();
  }
  return result;
 }
 beginStart(handoff,profile,time=0){
  if(!Number.isFinite(time)||time<0||time>=profile.duration)throw Error('Enter a recorded start inside its source duration.');
  const intervals={},schedule={};
  for(const side of SIDES){
   const rows=profile.contacts[side],first=rows.find(([a,b])=>a<=time&&b>time),next=rows.find(([a])=>a>time);
   if((time===0&&!first)||!next)throw Error('A standing start needs initial support and the next landing for both feet.');
   intervals[side]=(first??next).map(t=>t/profile.duration);
   schedule[side]={release:first?(first[1]-time)/profile.duration:0,landing:(next[0]-time)/profile.duration,supported:true};
  }
  return this.seed(handoff,time/profile.duration,intervals,schedule,profile);
 }
 beginTurn(handoff,profile,time,rate=1){return this.beginSequence(handoff,profile,time,rate);}
 beginSequence(handoff,profile,time,rate=1){
  const phase=time/profile.duration,intervals={},schedule={};
  for(const side of SIDES){
   const current=profile.contacts[side].find(([a,b])=>a<=time&&b>time);
   const next=profile.contacts[side].find(([a])=>a>time);
   const supported=handoff.grounded!==false&&handoff.support===side&&!!current;
   intervals[side]=(current??next??profile.contacts[side].at(-1)).map(t=>t/profile.duration);
   schedule[side]={supported,release:supported?(current[1]-time)/profile.duration:0,
    landing:current&&!supported?Math.min(.08,current[1]-time)/profile.duration:((next?.[0]??profile.duration)-time)/profile.duration};
  }
  const result=this.seed(handoff,phase,intervals,schedule,profile);this.state.pivotSupport=true;
  this.state.entryFrame={p:handoff.rootPosition.clone(),q:handoff.rootRotation.clone()};
  this.state.entryRate=rate;
  return result;
 }
 seed(handoff,phase,intervals,schedule,startProfile=null){
  this.state={phase,initialPhase:phase,progress:0,age:0,intervals,feet:{},support:handoff.support,startProfile,preserveSupportSchedule:!!handoff.preserveSupportSchedule};
  for(const side of SIDES){
   const source=handoff.feet[side];
   this.state.feet[side]={p:source.p.clone(),q:source.q.clone(),ballQ:source.ballQ?.clone()??this.bones['ball_'+side]?.quaternion.clone(),pole:source.pole??captureLegPole(
    this.bones['thigh_'+side],this.bones['calf_'+side],this.bones['foot_'+side],this.anatomy[side].hinge),
    velocity:source.velocity?.clone(),continuity:{},...schedule[side],done:false};
  }
  return phase;
 }
 points(side,ballQ){return this.contacts[side].surface?.points(ballQ)??this.contacts[side].contacts;}
 gap(side,p,q,ground,ballQ){return Math.min(...this.points(side,ballQ).map(v=>{const c=v.clone().applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);}));}
 apply(actions,phase,dt,ground){
  this.report=null;
  const state=this.state;if(!state||!ground)return null;
  const previousProgress=state.progress,advance=wrap(phase-state.phase);
  if(advance>.5)throw Error('Captured run entry received a discontinuous phase.');
  state.progress+=advance;state.phase=phase;state.age+=dt;
  this.root.updateMatrixWorld(true);
  const native=this.sample(actions,phase),targets={},contactWeights={},stance={};
  if((state.pivotSupport||state.entryFrame)&&!state.nativeEntry){
   state.nativeEntry=this.sample(actions,state.initialPhase);
   if(state.entryFrame){
    // The controller has advanced the root already. Reconstruct the source
    // entry at the outgoing world transform, not at the first rendered frame.
    const p=point(this.root),q=state.entryFrame.q.clone().multiply(rotation(this.root).invert());
    for(const n of Object.values(state.nativeEntry)){
     n.p.sub(p).applyQuaternion(q).add(state.entryFrame.p);n.q.premultiply(q);
     n.pole.axis.applyQuaternion(q);n.pole.bend.applyQuaternion(q);
    }
    if(state.startProfile&&SIDES.some(side=>state.feet[side].velocity)){
     const profile=state.startProfile,time=state.initialPhase*profile.duration,deltaTime=Math.min(.001,profile.duration-time);
     const future=this.sample(actions,(time+deltaTime)/profile.duration),heading=sequenceHeading(profile,time);
     const yawVector=new Vector3(0,0,1).applyQuaternion(state.entryFrame.q),baseYaw=Math.atan2(yawVector.x,yawVector.z)-heading;
     const travel=attackRootDelta(profile.root,time,time+deltaTime,profile.duration,baseYaw,this.root.scale.x);
     const futureQ=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),sequenceHeading(profile,time+deltaTime)-heading).multiply(q);
     for(const side of SIDES){
      const f=state.feet[side];if(!f.velocity)continue;
      const next=future[side].p.sub(p).applyQuaternion(futureQ).add(state.entryFrame.p).add(new Vector3(travel.x,0,travel.z));
      const nativeVelocity=next.sub(state.nativeEntry[side].p).multiplyScalar(state.entryRate/deltaTime);
      f.velocityOffset=f.velocity.clone().sub(nativeVelocity);
     }
    }
    else if(state.entryRootVelocity&&state.entryPhaseRate>0){
     const dt=.001,future=this.sample(actions,wrap(state.initialPhase+dt*state.entryPhaseRate));
     for(const side of SIDES){
      const f=state.feet[side];if(!f.velocity)continue;
      const next=future[side].p.sub(p).applyQuaternion(q).add(state.entryFrame.p).addScaledVector(state.entryRootVelocity,dt);
      const nativeVelocity=next.sub(state.nativeEntry[side].p).divideScalar(dt);
      f.velocityOffset=f.velocity.clone().sub(nativeVelocity);
     }
    }
   }
  }
  for(const side of SIDES){
   const f=state.feet[side],n=native[side];
   // Keep the source's intended clearance over the local ground.
   const height=this.root.position.y,sourceGap=Math.min(...this.points(side,n.ballQ).map(v=>v.clone().applyQuaternion(n.q).add(n.p).y-height));
   n.p.y+=Math.max(0,sourceGap)-this.gap(side,n.p,n.q,ground,n.ballQ);
   let p,q,loaded=false;
   if(f.supported&&state.progress<f.release){
    p=f.p.clone();q=f.q.clone();
    if(state.pivotSupport){
     if(!f.pivot){
      const points=this.points(side,f.ballQ),world=points.map(v=>v.clone().applyQuaternion(q).add(p));
      const index=world.reduce((best,v,i)=>v.y-ground(v.x,v.z)<world[best].y-ground(world[best].x,world[best].z)?i:best,0);
      const anchor=world[index];anchor.y=ground(anchor.x,anchor.z);
      f.pivot={index,anchor,entryQ:q.clone(),p:p.clone(),q:q.clone(),ballQ:f.ballQ?.clone()};
     }
     // A late support rotates around its sole contact. Freezing the ankle
     // instead prevents heel rise and forces an artificial pelvis drop.
     q.copy(n.q).multiply(state.nativeEntry[side].q.clone().invert()).multiply(f.pivot.entryQ).normalize();
     const pivot=f.pivot,points=this.points(side);
     p.copy(pivot.anchor).sub(points[pivot.index].clone().applyQuaternion(q));
     const gaps=points.map(v=>{const c=v.clone().applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);});
     const next=gaps.indexOf(Math.min(...gaps));
     if(gaps[next]<-1e-5){
      // Roll onto the next real sole vertex. Keep that vertex's outgoing
      // footprint instead of holding a heel after the forefoot takes load.
      pivot.anchor=this.points(side,pivot.ballQ)[next].clone().applyQuaternion(pivot.q).add(pivot.p);
      pivot.anchor.y=ground(pivot.anchor.x,pivot.anchor.z);pivot.index=next;
     }
     pivot.localPoint=points[pivot.index];p.copy(pivot.anchor).sub(pivot.localPoint.clone().applyQuaternion(q));
     pivot.p.copy(p);pivot.q.copy(q);pivot.ballQ=this.bones['ball_'+side]?.quaternion.clone();
    }
    if(!state.startProfile&&!state.preserveSupportSchedule&&this.bones['calf_'+side]&&this.bones['foot_'+side]){
     // A new acceleration can carry the hips past the outgoing footprint
     // before the source's scheduled takeoff. Release that support while
     // the knee still has reserve, instead of dragging an extended leg.
     const hip=point(this.bones['thigh_'+side]),knee=point(this.bones['calf_'+side]);
     const length=hip.distanceTo(knee)+knee.distanceTo(point(this.bones['foot_'+side]));
     const distance=hip.distanceTo(p),approach=f.supportDistance===undefined||dt<=0?0:(distance-f.supportDistance)/dt;
     const safety=distance+Math.max(0,approach)*.04-length*.97;
     if(approach>0&&safety>0){
      const fraction=f.supportSafety<0?MathUtils.clamp(-f.supportSafety/(safety-f.supportSafety),0,1):0;
      f.release=MathUtils.lerp(previousProgress,state.progress,fraction);f.earlyRelease=true;
     }
     f.supportDistance=distance;
     f.supportSafety=safety;
    }
    loaded=state.progress<f.release;
   }
   if(!loaded){
    if(!f.offset){
     let departure=f.p.clone(),departureQ=f.q.clone(),nativeP=n.p,nativeQ=n.q;
     f.releaseProgress=state.progress;
     f.releaseAge=state.age;
     if(!f.supported&&state.entryFrame){
      nativeP=state.nativeEntry[side].p;nativeQ=state.nativeEntry[side].q;f.releaseProgress=0;f.releaseAge=0;
     }
     if(f.supported&&f.previousNative&&previousProgress<=f.release&&state.progress>=f.release&&advance>0){
      // Takeoff can occur between render frames. Sample that boundary instead
      // of holding the old footprint through the first airborne frame.
      const fraction=(f.release-previousProgress)/advance;
      nativeP=f.previousNative.p.clone().lerp(n.p,fraction);
      nativeQ=f.previousNative.q.clone().slerp(n.q,fraction);
      f.releaseProgress=f.release;
      f.releaseAge=state.age-dt+fraction*dt;
      if(f.pivot){
       departureQ=nativeQ.clone().multiply(state.nativeEntry[side].q.clone().invert()).multiply(f.pivot.entryQ).normalize();
       const currentBallQ=this.bones['ball_'+side]?.quaternion,ballQ=f.previousBallQ?.clone().slerp(currentBallQ,fraction);
       departure=f.pivot.anchor.clone().sub(this.points(side,ballQ)[f.pivot.index].clone().applyQuaternion(departureQ));
      }
     }
     f.offset=departure.sub(nativeP);f.rotationOffset=departureQ.multiply(nativeQ.clone().invert());
    }
    const span=Math.max(1e-6,f.landing-f.releaseProgress);
    const u=MathUtils.clamp((state.progress-f.releaseProgress)/span,0,1);
    // Recover the outgoing position difference during the rising half of the
    // swing. Retaining it until touchdown leaves the released shoe behind the
    // moving body and forces a straight, overextended trailing leg.
    // A recorded turn or stop supplies a complete free-foot swing. Preserve
    // that flight time when closing the difference between two running poses.
    const recoveryEnd=state.startProfile&&state.entryFrame?1:.5;
    const weight=MathUtils.smootherstep(u,0,recoveryEnd);
    p=n.p.clone();
    if(!f.supported&&f.velocityOffset)p.add(entryDisplacement(f.offset,f.velocityOffset,(state.progress-f.releaseProgress)/(span*recoveryEnd),state.age-f.releaseAge));
    else p.addScaledVector(f.offset,1-weight);
    q=n.q.clone().premultiply(f.rotationOffset.clone().slerp(new Quaternion(),weight));
    // Leave the old footprint through the air, including when the source
    // opposite foot is still close to the ground at the selected phase.
    const clearance=.045*this.root.scale.x*16*u*u*(1-u)*(1-u);
    p.y+=Math.max(0,clearance-this.gap(side,p,q,ground));
    if(u===1)f.done=true;
   }
   const axis=p.clone().sub(point(this.bones['thigh_'+side])).normalize();
   const pole={axis,bend:blendLegPole(f.pole,n.pole,axis,MathUtils.smootherstep(state.age,0,.24),f.continuity)};
   targets[side]={p,q,pole};contactWeights[side]=f.done?(state.startProfile?runStartContacts(state.startProfile,phase*state.startProfile.duration).contactWeights[side]:gaitContactWeight(phase,state.intervals[side])):Number(loaded);stance[side]=contactWeights[side]>.95;
   f.p.copy(p);f.q.copy(q);f.previousNative={p:n.p.clone(),q:n.q.clone(),ballQ:n.ballQ?.clone()};f.previousBallQ=this.bones['ball_'+side]?.quaternion.clone();
  }
  this.report={progress:state.progress,feet:SIDES.map(side=>({side,supported:stance[side],done:state.feet[side].done}))};
  if(SIDES.every(side=>state.feet[side].done))this.state=null;
  return{targets,contactWeights,stance};
 }
}
