import {Vector3,MathUtils} from 'three';
import {rollRunSupport} from './run-support.js';

const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const right=heading=>new Vector3(Math.cos(heading),0,-Math.sin(heading));
const phaseAt=(phase,side)=>(phase+(side==='r'?0:.5))%1;
const radians=Math.PI/180;

// Changing from an open-hip run to backpedaling reverses the hip branch.
// A Cartesian blend of those clips swaps the feet. Turn the hips separately,
// shorten pivot support, and change lanes only while each foot is airborne.
export class RunTurnPlanner{
 constructor({heading,back=false,feet,center,toeAxes,contactGeometry}={}){
  this.heading=heading;this.back=back;this.feet={};this.toeAxes=toeAxes;this.contactGeometry=contactGeometry;
  if(feet)for(const side of ['r','l']){
   const previous=feet[side],loaded=previous.phase<.28;
   this.feet[side]={phase:previous.phase,support:.28,last:previous.p.clone(),lastQ:previous.q.clone(),offset:new Vector3(),rebase:true,
    ...(loaded?{anchor:previous.p.clone(),floor:center.y,supportQ:previous.q.clone(),heading:this.shoeHeading(side,previous.q)}:{}),};
  }
 }
 shoeHeading(side,q){
  const toe=(this.toeAxes?.[side]??new Vector3(0,0,1)).clone().applyQuaternion(q);
  return Math.atan2(toe.x,toe.z)-(side==='r'?-1:1)*8*radians;
 }
 begin({angle,phase,dt,sourceHeading,center,rootYaw,scale,amplitude}){
  const first=this.heading===undefined;
  this.rootYaw=this.rootYaw===undefined?rootYaw:this.rootYaw+wrap(rootYaw-this.rootYaw);
  rootYaw=this.rootYaw;
  if(first)this.back=Math.abs(angle)>105*radians;
  else if(this.back&&Math.abs(angle)<98*radians)this.back=false;
  else if(!this.back&&Math.abs(angle)>112*radians)this.back=true;
  const target=this.back?wrap(angle-Math.PI):Math.abs(angle)<=Math.PI/2?sourceHeading:Math.sign(angle)*95*radians;
  if(first)this.heading=target+rootYaw;
  const frameDt=Math.min(.05,Math.max(0,dt));this.age=(this.age??0)+frameDt;this.entryWeight=1-Math.exp(-24*this.age);
  // Both branches face through the front hemisphere. Avoid a 190-degree
  // branch change taking the shorter route behind the camera-facing torso.
  const difference=target-wrap(this.heading-rootYaw);
  const turn=MathUtils.clamp(difference,-6*frameDt,6*frameDt);
  let allowed=1;
  for(const side of ['r','l']){
   const f=this.feet[side],p=phaseAt(phase,side),sign=side==='r'?-1:1;
   if(!f?.anchor||p>=f.support||p<f.phase)continue;
   const v=f.anchor.clone().sub(center),initial=sign*v.dot(right(this.heading));
   // The loaded foot must stay on its own side of the pelvis.
   if(sign*v.dot(right(this.heading+turn*allowed))<Math.min(initial,.08*scale)){
    let lo=0,hi=allowed;
    for(let i=0;i<12;i++){
     const middle=(lo+hi)*.5;
     if(sign*v.dot(right(this.heading+turn*middle))>=Math.min(initial,.08*scale))lo=middle;else hi=middle;
    }
    allowed=lo;
   }
   // Limit pelvic rotation against a loaded, non-swiveling shoe.
   const old=wrap(this.heading-f.heading),next=old+turn*allowed;
   if(Math.abs(next)>8*radians&&Math.abs(next)>Math.abs(old))allowed=Math.min(allowed,Math.max(0,(Math.sign(next)*Math.max(8*radians,Math.abs(old))-old)/turn));
  }
  this.heading+=turn*allowed;this.localHeading=this.heading-rootYaw;
  // The camera can turn faster than a planted body. Keep the torso's counter
  // turn bounded relative to the hips; never scale accumulated full rotations.
  const counter=MathUtils.clamp(wrap(rootYaw-this.heading),-95*radians,95*radians);
  this.counterYaw??=counter;
  this.counterYaw+=MathUtils.clamp(counter-this.counterYaw,-6*frameDt,6*frameDt);
  this.backWeight=first?Number(this.back):MathUtils.lerp(this.backWeight??0,Number(this.back),1-Math.exp(-16*dt));
  const across=Math.abs(Math.sin(angle-this.localHeading));
  this.support=.28*(1-.5*across);
  this.dt=frameDt;this.center=center;this.scale=scale;this.phase=phase;this.amplitude=amplitude;this.across=across;
  for(const side of ['r','l']){
   const p=phaseAt(phase,side),f=this.feet[side]??={phase:p,support:this.support,offset:new Vector3()};
   if(p<f.phase)f.support=this.support;
   else if(f.anchor&&Math.hypot(f.anchor.x-center.x,f.anchor.z-center.z)>.48*scale){
    // An abrupt input reversal can outrun the old support footprint. Release
    // that contact coherently instead of pulling the pelvis toward the floor.
    f.support=Math.min(f.support,p);
   }
   // Once released, a foot cannot acquire a second contact in the same cycle.
   this.feet[side]=f;
  }
  return this.localHeading;
 }
 animationPhase(side){const p=phaseAt(this.phase,side),s=this.feet[side].support;return p<s?p/s*.28:.28+(p-s)/(1-s)*.72;}
 travel(side){
  const p=phaseAt(this.phase,side),s=this.feet[side].support,a=this.amplitude*s/.28;
  if(p<s)return a*(1-2*p/s);
  // Match the support velocity at both ends of the airborne path.
  const u=(p-s)/(1-s),m=-2*this.amplitude*(1-s)/.28;
  return(2*u**3-3*u*u+1)*(-a)+(u**3-2*u*u+u)*m+(-2*u**3+3*u*u)*a+(u**3-u*u)*m;
 }
 width(side){return .17+this.amplitude*this.feet[side].support/.28*this.across;}
 place(side,target,q,{hip,reach}={}){
  const p=phaseAt(this.phase,side),f=this.feet[side],sign=side==='r'?-1:1;
  f.last??=target.clone();f.lastQ??=q.clone();
  if(p<f.support){
   if(!f.anchor||p<f.phase){
    const landing=p<f.phase;
    f.anchor=landing?f.last.clone():target.clone();f.anchor.y=target.y;
    f.roll=null;f.rollStart=landing?0:p;f.supportDistance=undefined;f.floor=this.center.y;f.supportQ=landing?f.lastQ.clone():q.clone();f.heading=this.shoeHeading(side,f.supportQ);
   }
   target.copy(f.anchor);target.y+=this.center.y-f.floor;q.copy(f.supportQ);f.offset.set(0,0,0);f.rebase=false;
   if(this.contactGeometry&&hip){
    if(!f.roll)f.rollStart??=f.phase;
    const support=rollRunSupport(f,this.contactGeometry[side],hip,p,this.center.y-f.floor);
    target.copy(support.position);q.copy(support.q);f.contact=support.index;f.contactAnchor=support.anchor;
    const distance=hip.distanceTo(target),approach=f.supportDistance===undefined||!this.dt?0:Math.max(0,(distance-f.supportDistance)/this.dt);
    f.supportDistance=distance;
    if(reach&&distance+approach*.025>reach*.98){
     // Release before the geometry forces a late, abrupt body compression.
     f.support=p;f.anchor=null;f.rebase=true;f.releaseType='reach';
    }
   }
  }else{
   f.contact=null;
   if(f.anchor||f.rebase){f.offset.copy(f.last).sub(target);f.rotationOffset=f.lastQ.clone().multiply(q.clone().invert());f.release=p;f.anchor=null;f.rebase=false;}
   const fade=1-MathUtils.smootherstep(p,f.release??f.support,1);target.addScaledVector(f.offset,fade);
   if(f.rotationOffset)q.premultiply(f.rotationOffset.clone().slerp(f.rotationOffset.clone().identity(),1-fade));
   if(this.dt>0)q.copy(f.lastQ.clone().slerp(q,1-Math.exp(-32*this.dt)));
   const planar=target.clone().sub(this.center).setY(0),radius=planar.length(),start=.42*this.scale,range=.04*this.scale;
   if(radius>start){const reachable=start+range*Math.tanh((radius-start)/range);target.addScaledVector(planar,(reachable/radius-1)*this.entryWeight);}
   const r=right(this.heading),lateral=sign*target.clone().sub(this.center).dot(r),margin=.13*this.scale;
   // Smoothly clear the other leg. Never displace the loaded foot for this.
   const correction=.5*(margin-lateral+Math.sqrt((margin-lateral)**2+.0004));
   target.addScaledVector(r,sign*correction*this.entryWeight*MathUtils.smootherstep(p,f.support,Math.min(1,f.support+.12)));
   if(hip&&reach){
    // Plan a reachable landing before contact. Releasing immediately after an
    // overextended touchdown would skip the useful support part of the step.
    const height=hip.y-target.y,landingReach=reach*.95;
    const radius=Math.sqrt(Math.max(.01,landingReach*landingReach-height*height));
    const planar=target.clone().sub(hip).setY(0),distance=planar.length();
    const limit=Math.max(.08,radius-.025*this.scale),width=.025*this.scale;
    if(distance>limit){
     const allowed=limit+width*Math.tanh((distance-limit)/width);
     const approaching=MathUtils.smootherstep(this.animationPhase(side),.7,.95);
     target.addScaledVector(planar,(allowed/distance-1)*approaching*this.entryWeight);
    }
   }
  }
  f.phase=p;f.last.copy(target);f.lastQ.copy(q);
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
