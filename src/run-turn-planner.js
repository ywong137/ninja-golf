import {Vector3,Quaternion,MathUtils} from 'three';
import {rollRunSupport,turnPlantedSupports} from './run-support.js';
import {RunEntryFlight,predictRunLanding} from './run-entry-flight.js';
import {attackEntryVelocity,attackEntryVelocityAt} from './attack-braking.js';
import {advanceRunCadence,runPhaseTime,RUN_ENTRY_CADENCE} from './run-cadence.js';
import {fitSupportFootprint} from './run-landing.js';

const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const right=heading=>new Vector3(Math.cos(heading),0,-Math.sin(heading));
const phaseAt=(phase,side)=>(phase+(side==='r'?0:.5))%1;
const radians=Math.PI/180;
const supportFraction=(collecting,across)=>(collecting?.5:.28)*(1-.5*across);

// Changing from an open-hip run to backpedaling reverses the hip branch.
// A Cartesian blend of those clips swaps the feet. Turn the hips separately,
// shorten pivot support, and change lanes only while each foot is airborne.
export class RunTurnPlanner{
 constructor({heading,back=false,feet,center,toeAxes,contactGeometry,contactEntry=false}={}){
  this.heading=heading;this.back=back;this.feet={};this.toeAxes=toeAxes;this.contactGeometry=contactGeometry;
  this.worldContacts=contactEntry;
  this.entryLandings=contactEntry?0:2;
  if(feet)for(const side of ['r','l']){
   const previous=feet[side],loaded=previous.phase<.28;
   this.feet[side]={entrySwing:contactEntry,entryVelocity:!loaded?previous.velocity?.clone():null,phase:previous.phase,support:contactEntry&&loaded?.5:.28,last:previous.p.clone(),lastQ:previous.q.clone(),offset:new Vector3(),rebase:true,
    ...(!loaded&&contactEntry?{release:previous.phase}:{}),
    ...(loaded?{anchor:previous.p.clone(),floor:center.y,supportQ:previous.q.clone(),heading:this.shoeHeading(side,previous.q)}:{}),};
  }
 }
 get collecting(){return this.worldContacts&&this.entryLandings===0;}
 get targetCadence(){return this.entryLandings<2?RUN_ENTRY_CADENCE:this.distanceCadence??RUN_ENTRY_CADENCE;}
 landingSupport(side,heading=this.heading){
  const ordinal=phaseAt(this.phase,side)>=.5?1:2;
  return supportFraction(this.worldContacts&&this.entryLandings+ordinal<2,Math.abs(Math.sin(this.travelHeading-heading)));
 }
 collectionDelay(){
  if(!this.collecting)return 0;
  const remaining=Math.min(1-phaseAt(this.phase,'r'),1-phaseAt(this.phase,'l'));
  const seconds=runPhaseTime(this.cadence??RUN_ENTRY_CADENCE,this.targetCadence,remaining).duration;
  // The controller starts acceleration on the frame after this landing.
  return this.dt>0?Math.ceil((seconds-1e-9)/this.dt)*this.dt:seconds;
 }
 advanceCadence(distanceRate,dt){
  if(!this.worldContacts)return distanceRate;
  this.distanceCadence=Math.max(.1,distanceRate);
  const wanted=this.targetCadence;
  this.cadence??=wanted;
  // Keep an unfinished flight's velocity continuous when the two collecting
  // steps finish and distance-driven cadence resumes.
  const next=advanceRunCadence(this.cadence,wanted,dt);this.cadence=next.rate;
  return dt>0?next.phase/dt:this.cadence;
 }
 shoeHeading(side,q){
  const toe=(this.toeAxes?.[side]??new Vector3(0,0,1)).clone().applyQuaternion(q);
  return Math.atan2(toe.x,toe.z)-(side==='r'?-1:1)*8*radians;
 }
 begin({angle,phase,dt,sourceHeading,center,rootYaw,scale,amplitude,groundHeight,motionPrediction=null,movementHeading=null,focused=false,hipHeightAt=null}){
  this.groundHeight=this.worldContacts?groundHeight:null;
  this.hipHeightAt=hipHeightAt;
  this.motionPrediction=this.worldContacts?motionPrediction:null;
  const first=this.heading===undefined;
  this.rootYaw=this.rootYaw===undefined?rootYaw:this.rootYaw+wrap(rootYaw-this.rootYaw);
  rootYaw=this.rootYaw;
  if(first)this.back=Math.abs(angle)>105*radians;
  else if(this.back&&Math.abs(angle)<98*radians)this.back=false;
  else if(!this.back&&Math.abs(angle)>112*radians)this.back=true;
  const target=this.back?wrap(angle-Math.PI):Math.abs(angle)<=Math.PI/2?sourceHeading:Math.sign(angle)*95*radians;
  const directed=this.worldContacts&&Number.isFinite(movementHeading);
  if(directed){
   // Free movement follows one world direction while the visible root catches
   // up. Reclassifying the same turn as backward, then forward, reverses it.
   const relative=wrap(movementHeading-rootYaw);
   const focusedTarget=rootYaw+MathUtils.clamp(relative,-85*radians,85*radians)*(1-MathUtils.smootherstep(Math.abs(relative),Math.PI/2,Math.PI));
   const wanted=focused?focusedTarget:movementHeading;
   const previous=this.steeringFocused===focused?this.desiredHeading:this.heading;
   const reference=previous??wanted;
   let delta=wrap(wanted-reference);
   if(Math.abs(Math.abs(delta)-Math.PI)<1e-8)delta=Math.PI*(this.turnDirection??1);
   this.desiredHeading=reference+delta;this.steeringFocused=focused;
  }else this.desiredHeading=target+rootYaw;
  if(first)this.heading=target+rootYaw;
  const frameDt=Math.min(.05,Math.max(0,dt));this.age=(this.age??0)+frameDt;this.entryWeight=1-Math.exp(-24*this.age);
  // Both branches face through the front hemisphere. Avoid a 190-degree
  // branch change taking the shorter route behind the camera-facing torso.
  const difference=directed?this.desiredHeading-this.heading:target-wrap(this.heading-rootYaw);
  if(Math.abs(difference)>1e-8)this.turnDirection=Math.sign(difference);
  const turn=MathUtils.clamp(difference,-6*frameDt,6*frameDt);
  this.heading+=turnPlantedSupports(this.feet,{turn,heading:this.heading,dt:frameDt,center,scale,
   phaseAt:side=>phaseAt(phase,side),normalAt:p=>this.normal(p),geometry:this.contactGeometry});
  this.localHeading=this.heading-rootYaw;
  // The camera can turn faster than a planted body. Keep the torso's counter
  // turn bounded relative to the hips; never scale accumulated full rotations.
  const counter=MathUtils.clamp(wrap(rootYaw-this.heading),-95*radians,95*radians);
  this.counterYaw??=counter;
  this.counterYaw+=MathUtils.clamp(counter-this.counterYaw,-6*frameDt,6*frameDt);
  this.backWeight=first?Number(this.back):MathUtils.lerp(this.backWeight??0,Number(this.back),1-Math.exp(-16*dt));
  const across=Math.abs(Math.sin(angle-this.localHeading));
  const supportAcross=directed?Math.abs(Math.sin(movementHeading-this.heading)):across;
  this.support=supportFraction(false,supportAcross);
  this.dt=frameDt;this.center=center;this.scale=scale;this.phase=phase;this.amplitude=amplitude;this.across=across;
  this.travelHeading=directed?movementHeading:angle+rootYaw;
  for(const side of ['r','l']){
   const p=phaseAt(phase,side),f=this.feet[side]??={phase:p,support:this.support,offset:new Vector3()};
   if(p<f.phase){
    this.entryLandings=Math.min(2,this.entryLandings+1);
    // A new lateral landing needs an earlier liftoff than a straight step.
    // Plan that shorter contact before landing, rather than overextending a
    // footprint to hold a long walking stance through a fast body turn.
    f.support=supportFraction(this.worldContacts&&this.entryLandings<2,supportAcross);f.pivotTurn=0;
   }
   else if(f.anchor&&this.beyondSupportRadius(f.anchor,center)){
    // An abrupt input reversal can outrun the old support footprint. Release
    // that contact coherently instead of pulling the pelvis toward the floor.
    f.support=Math.min(f.support,p);
   }
   // Once released, a foot cannot acquire a second contact in the same cycle.
   this.feet[side]=f;
  }
  if(this.motionPrediction?.pending)this.motionPrediction={...this.motionPrediction,time:-this.collectionDelay()};
  return this.localHeading;
 }
 predictHeading(seconds){
  const difference=this.desiredHeading-this.heading,sign=Math.sign(difference);
  if(Math.abs(difference)<1e-10)return this.heading;
  const clock=phase=>runPhaseTime(this.cadence??1.7,this.targetCadence,phase).duration;
  const supports=[],boundaries=[0,seconds];
  // Include the opposite foot's next landing. Ignoring that future support
  // predicts a free airborne turn while the actual body must pivot on a shoe.
  for(const side of ['r','l']){
   const f=this.feet[side],p=phaseAt(this.phase,side);
   if(!f)continue;
   if(f.anchor&&p<f.support)supports.push({start:0,end:this.supportDeadline(f,clock(f.support-p)),budget:Math.max(0,25*radians-sign*(f.pivotTurn??0))});
   const next=1-p,start=clock(next);
   if(start<seconds)supports.push({start,end:clock(next+this.landingSupport(side)),budget:25*radians});
  }
  for(const s of supports)boundaries.push(Math.min(seconds,s.start),Math.min(seconds,s.end));
  boundaries.sort((a,b)=>a-b);let allowance=0;
  for(let i=1;i<boundaries.length;i++){
   const start=boundaries[i-1],end=boundaries[i],dt=end-start;
   const active=supports.filter(s=>s.start<=start&&s.end>=end);
   let turn=Math.min(6*dt,Math.abs(difference)-allowance);
   for(const s of active)turn=Math.min(turn,3*dt,s.budget);
   allowance+=turn;for(const s of active)s.budget-=turn;
  }
  return this.heading+sign*Math.min(Math.abs(difference),allowance);
 }
 beyondSupportRadius(ankle,center,time=this.motionPrediction?.time){
  const x=ankle.x-center.x,z=ankle.z-center.z;
  if(Math.hypot(x,z)<=.48*this.scale)return false;
  if(!this.worldContacts||!this.motionPrediction)return true;
  const {source,wanted,duration}=this.motionPrediction,velocity=attackEntryVelocityAt(source,wanted,time,duration);
  // A reachable leading foot can land beyond the early stride radius. Keep
  // that support while travel approaches it; lane and reach checks still apply.
  return x*velocity.x+z*velocity.z<=0;
 }
 supportDeadline(foot,nominal){
  if(!this.worldContacts||!this.motionPrediction)return nominal;
  const {source,wanted,time,duration}=this.motionPrediction;
  const pivot=foot.roll?.pivotAnchor??foot.contactAnchor;
  const difference=this.desiredHeading-this.heading,sign=Math.sign(difference);
  const budget=Math.max(0,25*radians-sign*(foot.pivotTurn??0));
  const outside=seconds=>{
   const velocity=attackEntryVelocity(source,wanted,time,seconds,duration);
   const center=this.center.clone().add(new Vector3(velocity.x,0,velocity.z).multiplyScalar(seconds));
   const ankle=foot.anchor.clone();
   if(pivot)ankle.sub(pivot).applyAxisAngle(this.normal(foot.anchor),sign*Math.min(Math.abs(difference),3*seconds,budget)).add(pivot);
   return this.beyondSupportRadius(ankle,center,time+seconds);
  };
  // begin() releases this contact when travel exceeds the same radial bound.
  // Include that event before predicting a later landing's body orientation.
  let previous=0;
  for(let t=Math.min(.01,nominal);t<=nominal+1e-9;t=Math.min(t+.01,nominal)){
   if(outside(t)){
    let lo=previous,hi=t;
    for(let i=0;i<12;i++){const middle=(lo+hi)*.5;if(outside(middle))hi=middle;else lo=middle;}
    return hi;
   }
   if(t>=nominal)break;previous=t;
  }
  return nominal;
 }
 animationPhase(side){const p=phaseAt(this.phase,side),s=this.feet[side].support;return p<s?p/s*.28:.28+(p-s)/(1-s)*.72;}
 recoveryPhase(side){
  const f=this.feet[side];
  if(!this.worldContacts||f.anchor||f.release===undefined)return this.animationPhase(side);
  return .28+.72*MathUtils.clamp((phaseAt(this.phase,side)-f.release)/(1-f.release),0,1);
 }
 travel(side){
  const p=phaseAt(this.phase,side),s=this.feet[side].support,a=this.amplitude*s/.28;
  if(p<s)return a*(1-2*p/s);
  // Match the support velocity at both ends of the airborne path.
  const u=(p-s)/(1-s),m=-2*this.amplitude*(1-s)/.28;
  return(2*u**3-3*u*u+1)*(-a)+(u**3-2*u*u+u)*m+(-2*u**3+3*u*u)*a+(u**3-u*u)*m;
 }
 width(side){return .17+this.amplitude*this.feet[side].support/.28*this.across;}
 minimumSoleHeight(side){
  const f=this.feet[side],p=phaseAt(this.phase,side);
  if(f.anchor||p<f.support)return null;
  const u=MathUtils.clamp((p-(f.release??f.support))/(1-(f.release??f.support)),0,1);
  return this.center.y+.08*this.scale*Math.sin(Math.PI*u);
 }
 gap(side,p,q){
  return Math.min(...this.contactGeometry[side].points.map(v=>{
   const point=v.clone().applyQuaternion(q).add(p);
   return point.y-(this.groundHeight?this.groundHeight(point.x,point.z):this.center.y);
  }));
 }
 normal(p){
  const e=.12,g=this.groundHeight;
  return g?new Vector3(g(p.x-e,p.z)-g(p.x+e,p.z),2*e,g(p.x,p.z-e)-g(p.x,p.z+e)).normalize():new Vector3(0,1,0);
 }
 fitLanding(side,end,{remaining,rate,support,heading,shoe,hip,reach}){
  if(!this.worldContacts||!this.motionPrediction)return end;
  const sign=side==='r'?-1:1,planes=[],disks=[];
  const wanted=this.entryLandings+(phaseAt(this.phase,side)>=.5?1:2)<2?RUN_ENTRY_CADENCE:this.distanceCadence??rate;
  const duration=runPhaseTime(rate,wanted,support).duration;
  const {source,wanted:velocity,time,duration:acceleration}=this.motionPrediction;
  const normal=this.normal(end),orientation=shoe.clone().premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),heading-this.shoeHeading(side,shoe)));
  const points=this.contactGeometry?.[side]?.points??[new Vector3()];
  const hipOffset=hip?.clone().sub(this.center);
  for(const fraction of [0,.25,.5,.75,1]){
   const elapsed=duration*fraction,total=remaining+elapsed;
   const average=attackEntryVelocity(source,velocity,time,total,acceleration);
   const center=this.center.clone().add(new Vector3(average.x,0,average.z).multiplyScalar(total));
   if(this.groundHeight)center.y=this.groundHeight(center.x,center.z);
   const futureHeading=this.predictHeading(total),axis=right(futureHeading).multiplyScalar(sign);
   const delta=MathUtils.clamp(futureHeading-heading,-Math.min(25*radians,3*elapsed),Math.min(25*radians,3*elapsed));
   // Either end of the sole can become the fixed pivot. Keep the proposed
   // footprint clear for both possibilities throughout the held interval.
   let minimum=-Infinity,futureHip=null;
   if(hipOffset&&reach){
    futureHip=hipOffset.clone().applyAxisAngle(new Vector3(0,1,0),futureHeading-this.heading).add(center);
    if(this.hipHeightAt){
     const phase=((side==='r'?0:.5)+advanceRunCadence(rate,wanted,elapsed).phase)%1;
     const change=this.hipHeightAt(side,phase)-this.hipHeightAt(side,this.phase);
     futureHip.y+=change*(1-Math.exp(-32*total));
    }
   }
   for(const point of points){
    const offset=point.clone().applyQuaternion(orientation);
    const shift=offset.clone().sub(offset.clone().applyAxisAngle(normal,delta));
    minimum=Math.max(minimum,axis.dot(center)-axis.dot(shift)+(.06+.04*(1-fraction))*this.scale);
    if(futureHip){
     const diskCenter=futureHip.clone().sub(shift),vertical=diskCenter.y-end.y,radiusSquared=(reach*.95)**2-vertical*vertical;
     if(radiusSquared<=0)return end;
     disks.push({center:diskCenter,radius:Math.sqrt(radiusSquared)});
    }
   }
   planes.push({normal:axis,minimum});
  }
  const fitted=fitSupportFootprint(end,planes,disks);
  return fitted??end;
 }
 limitFlightTarget(side,target,q,p,{hip,reach}={}){
  const f=this.feet[side],sign=side==='r'?-1:1;
   const planar=target.clone().sub(this.center).setY(0),radius=planar.length(),start=.42*this.scale,range=.04*this.scale;
   if(radius>start){
    const reachable=start+range*Math.tanh((radius-start)/range),release=f.release??f.support;
    const airborne=MathUtils.smootherstep(p,release,Math.min(1,release+.12));
    // Near touchdown, the anatomical reach limit owns the free foot. Keeping
    // the early stride radius here drags a reachable landing with the root
    // until contact, overriding the flight's planned deceleration.
    const approaching=this.worldContacts&&hip&&reach?MathUtils.smootherstep(p===1?1:this.animationPhase(side),.7,.95):0;
    target.addScaledVector(planar,(reachable/radius-1)*this.entryWeight*airborne*(1-approaching));
   }
   const r=right(this.heading),lateral=sign*target.clone().sub(this.center).dot(r),margin=.13*this.scale;
   // Smoothly clear the other leg. Never displace the loaded foot for this.
   const correction=.5*(margin-lateral+Math.sqrt((margin-lateral)**2+.0004));
   const release=f.release??f.support;
   target.addScaledVector(r,sign*correction*this.entryWeight*MathUtils.smootherstep(p,release,Math.min(1,release+.12)));
   if(this.contactGeometry){
    // A released, rolling toe must clear the floor before traveling. Imported
    // recovery height alone can keep that toe at ground level after release.
    const u=MathUtils.clamp((p-(f.release??f.support))/(1-(f.release??f.support)),0,1);
    const gap=this.gap(side,target,q);
    target.y+=Math.max(0,.08*this.scale*Math.sin(Math.PI*u)-gap);
   }
   if(hip&&reach){
    // Plan a reachable landing before contact. Releasing immediately after an
    // overextended touchdown would skip the useful support part of the step.
    const height=hip.y-target.y,landingReach=reach*.95;
    const radius=Math.sqrt(Math.max(.01,landingReach*landingReach-height*height));
    const planar=target.clone().sub(hip).setY(0),distance=planar.length();
    const limit=Math.max(.08,radius-.025*this.scale),width=.025*this.scale;
    if(distance>limit){
     const allowed=limit+width*Math.tanh((distance-limit)/width);
     const approaching=MathUtils.smootherstep((p===1?1:this.animationPhase(side)),.7,.95);
     target.addScaledVector(planar,(allowed/distance-1)*approaching*this.entryWeight);
    }
   }
 }
 place(side,target,q,{hip,reach}={}){
  const p=phaseAt(this.phase,side),f=this.feet[side],sign=side==='r'?-1:1;
  const plannedFlight=f.entrySwing||this.worldContacts;
  if(this.groundHeight&&this.contactGeometry){
   const nativeGap=Math.max(0,Math.min(...this.contactGeometry[side].points.map(v=>v.clone().applyQuaternion(q).add(target).y-this.center.y)));
   if(p<f.support)q.premultiply(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),this.normal(target)));
   target.y+=nativeGap-this.gap(side,target,q);
  }
  f.last??=target.clone();f.lastQ??=q.clone();
  if(p<f.support){
   if(!f.anchor||p<f.phase){
    const landing=p<f.phase;
    let touchdown=f.last;
    if(landing&&this.worldContacts&&f.flight){
     // Complete the flight at touchdown. Freezing the preceding render sample
     // shortens the step by a different distance at every frame rate.
     touchdown=f.flight.sample(1).p;
     this.limitFlightTarget(side,touchdown,f.lastQ,1,{hip,reach});
    }
    if(landing){f.entrySwing=false;f.entryStart=null;f.entryQ=null;f.entryVelocity=null;f.flight=null;f.release=undefined;}
    f.anchor=landing?touchdown.clone():target.clone();
    if(this.groundHeight)f.anchor.y-=this.gap(side,f.anchor,landing?f.lastQ:q);else f.anchor.y=target.y;
    f.roll=null;f.rollStart=landing?0:p;f.floor=this.center.y;f.supportQ=landing?f.lastQ.clone():q.clone();f.heading=this.shoeHeading(side,f.supportQ);
   }
   const floorDelta=this.groundHeight?0:this.center.y-f.floor;
   target.copy(f.anchor);target.y+=floorDelta;q.copy(f.supportQ);f.offset.set(0,0,0);f.rebase=false;
   if(this.contactGeometry&&hip){
    if(!f.roll)f.rollStart??=f.phase;
    const geometry=this.groundHeight?{...this.contactGeometry[side],normal:this.normal(f.anchor)}:this.contactGeometry[side];
    const support=rollRunSupport(f,geometry,hip,p,floorDelta,this.dt);
    target.copy(support.position);q.copy(support.q);f.contact=support.index;f.contactAnchor=support.anchor;
    // A transferred foot starts from a held world pose. It needs lead time
    // to lift before adopting the new gait. Ordinary recovery already moves.
    const phaseRate=this.dt>0?((p-f.phase+1)%1)/this.dt:0;
    const supportTime=this.worldContacts
     ?runPhaseTime(this.cadence??1.7,this.targetCadence,f.support-p).duration
     :phaseRate>1e-8?(f.support-p)/phaseRate:Infinity;
    // Reach prediction ends at scheduled liftoff. A short lateral contact
    // must not release early because the body moves farther after it ends.
    const horizon=Math.min(supportTime,plannedFlight?2*this.dt+.015:Math.max(this.dt,.025));
    const futureHip=hip.clone();
    if(f.lastHip&&this.dt>0)futureHip.addScaledVector(hip.clone().sub(f.lastHip),horizon/this.dt);
    let losingLane=false;
    if(this.worldContacts&&this.motionPrediction){
     // Lift before lateral travel carries the pelvis across this footprint.
     // Keep the footprint fixed until release; moving it would slide the shoe.
     // The foot only needs this lane until its scheduled liftoff. Looking
     // beyond that point can reject a valid short contact on its first frame.
     const horizon=Math.min(supportTime,Math.max(.10,2*this.dt+.015)),{source,wanted,time,duration}=this.motionPrediction;
     const velocity=attackEntryVelocity(source,wanted,time,horizon,duration);
     const futureCenter=this.center.clone().add(new Vector3(velocity.x,0,velocity.z).multiplyScalar(horizon));
     const futureHeading=this.predictHeading(horizon);
     const futureTarget=target.clone(),pivot=f.roll?.pivotAnchor??f.contactAnchor;
     if(pivot){
      const delta=futureHeading-this.heading,turnSign=Math.sign(delta);
      const budget=Math.max(0,25*radians-turnSign*(f.pivotTurn??0));
      const turn=turnSign*Math.min(Math.abs(delta),3*horizon,budget);
      futureTarget.sub(pivot).applyAxisAngle(this.normal(target),turn).add(pivot);
     }
     const currentLane=sign*target.clone().sub(this.center).dot(right(this.heading));
     const futureLane=sign*futureTarget.sub(futureCenter).dot(right(futureHeading));
     losingLane=futureLane<.04*this.scale&&futureLane<currentLane-.005*this.scale;
    }
    if(losingLane||reach&&Math.max(hip.distanceTo(target),futureHip.distanceTo(target))>reach*.98){
     // Release before the geometry forces a late, abrupt body compression.
     f.support=p;f.anchor=null;f.rebase=true;f.releaseType=losingLane?'lane':'reach';
     f.release=p;
     if(plannedFlight){f.entryStart=target.clone();f.entryQ=q.clone();f.entryVelocity=f.velocity?.clone()??new Vector3();}
    }
   }
  }else{
   f.contact=null;
   if(f.anchor||f.rebase){f.offset.copy(f.last).sub(target);f.rotationOffset=f.lastQ.clone().multiply(q.clone().invert());f.release??=p;f.anchor=null;f.rebase=false;}
   const fade=1-MathUtils.smootherstep(p,f.release??f.support,1);
   if(plannedFlight){
    f.entryStart??=f.last.clone();f.entryQ??=f.lastQ.clone();
    f.entryVelocity??=f.velocity?.clone()??new Vector3();
    const geometry=this.contactGeometry?.[side],flat=f.entryQ.clone();
    if(geometry)flat.premultiply(new Quaternion().setFromUnitVectors(geometry.up.clone().applyQuaternion(flat),new Vector3(0,1,0)));
    const clearance=geometry?-Math.min(...geometry.points.map(v=>v.clone().applyQuaternion(flat).y)):.1*this.scale;
    const rate=this.dt>0?(p-f.phase)/this.dt:1.7;
    const clock=this.cadence===undefined?{duration:(1-p)/Math.max(.1,rate),rate:Math.max(.1,rate)}:
     runPhaseTime(this.cadence,this.targetCadence,1-p);
    const remaining=clock.duration;
    const landingHeading=this.worldContacts?this.predictHeading(remaining):this.heading+MathUtils.clamp(wrap(this.desiredHeading-this.heading),-6*remaining,6*remaining);
    const support=this.landingSupport(side,landingHeading);
    let displacement=null,landingAmplitude=this.amplitude;
    if(this.motionPrediction&&remaining>0){
     const {source,wanted,time,duration}=this.motionPrediction;
     const average=attackEntryVelocity(source,wanted,time,remaining,duration),landing=attackEntryVelocityAt(source,wanted,time+remaining,duration);
     displacement=new Vector3(average.x,0,average.z).multiplyScalar(remaining);
     landingAmplitude=Math.hypot(landing.x,landing.z)*.28/(2*this.scale*clock.rate);
    }
    let end=predictRunLanding({center:this.center,phase:p,amplitude:this.amplitude,scale:this.scale,
     travelHeading:this.travelHeading,bodyHeading:landingHeading,side,width:.17,minimumLane:.17,clearance,support,displacement,landingAmplitude});
    if(this.groundHeight)end.y-=this.gap(side,end,flat);
    if(!f.flight||(p-f.flight.departure)/(1-f.flight.departure)<.5)
     end=this.fitLanding(side,end,{remaining,rate:clock.rate,support,heading:landingHeading,shoe:flat,hip,reach});
    if(this.groundHeight)end.y-=this.gap(side,end,flat);
    if(!f.flight){
     const release=f.release??f.support;
     const clearance=geometry?Math.max(0,this.gap(side,f.entryStart,f.entryQ)):0;
     const lift=Math.max(0,.08*this.scale-clearance);
     const turn=Math.abs(wrap(landingHeading-this.heading));
     // Clear the body using its measured hip lane. A fixed half-metre arc
     // makes a short collecting step whip around the body during a reversal.
     const hipLane=hip?Math.abs(hip.clone().sub(this.center).dot(right(this.heading))):.13*this.scale;
     const clearanceLane=Math.max(.13*this.scale,hipLane);
     const outward=right(landingHeading).multiplyScalar(sign*2*clearanceLane*Math.sin(turn/2));
     outward.addScaledVector(new Vector3(Math.sin(this.travelHeading),0,Math.cos(this.travelHeading)),.15*this.scale*Math.sin(turn/2));
     if(f.entrySwing)outward.set(0,0,0);
     f.flight=new RunEntryFlight({start:f.entryStart,velocity:f.entryVelocity??new Vector3(),end,phase:release,phaseRate:Math.max(.1,rate),lift,outward,recovering:!f.entrySwing});
     f.flightFloor=this.center.y;
    }
    if(!this.groundHeight)end.y=f.flight.end.y;
    f.flight.retarget(p,end);
    target.copy(f.flight.sample(p).p);
    if(!this.groundHeight)target.y+=(this.center.y-f.flightFloor)*MathUtils.smoothstep(p,f.flight.departure,1);
    q.slerp(f.entryQ,fade);
   }else{
    target.addScaledVector(f.offset,fade);
    if(f.rotationOffset)q.premultiply(f.rotationOffset.clone().slerp(f.rotationOffset.clone().identity(),1-fade));
   }
   if(this.dt>0)q.copy(f.lastQ.clone().slerp(q,1-Math.exp(-32*this.dt)));
   this.limitFlightTarget(side,target,q,p,{hip,reach});
  }
  f.phase=p;f.last.copy(target);f.lastQ.copy(q);if(hip)f.lastHip=hip.clone();
 }
 contacts(){
  const contactWeights={},stance={};
  for(const side of ['r','l']){
   const p=this.animationPhase(side);stance[side]=p<.28;
   contactWeights[side]=p<.28?1:p<.38?1-MathUtils.smoothstep(p,.28,.38):MathUtils.smoothstep(p,.90,1);
  }
  return{contactWeights,stance};
 }
}
