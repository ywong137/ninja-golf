import {Vector3,Quaternion,MathUtils} from 'three';
import {rollRunSupport,turnPlantedSupports} from './run-support.js';
const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();

// Carry real braking footprints into the guard gait. Cartesian corrections
// disappear only during swing; the support point stays fixed in world space.
export class GuardContactTransfer{
 constructor({feet,support,contacts,bones,root,elapsed=0,walkPhase,grounded=true,rootRotation,rootPosition,rootVelocity}){
  if(walkPhase!==undefined&&(!Number.isFinite(walkPhase)||walkPhase<0||walkPhase>=1))throw Error('A walking handoff needs its current phase in [0,1).');
  // The incoming pose was captured now. Its blend clock starts now, even when
  // the step clock already passed the event which authorized this transfer.
  this.root=root;this.contacts=contacts;this.bones=bones;this.age=0;this.entryElapsed=elapsed;this.feet={};
  const forward=new Vector3(0,0,1).applyQuaternion(rootRotation??rotation(root));
  this.heading=Math.atan2(forward.x,forward.z);
  this.lastRootPosition=rootPosition?.clone()??point(root);this.lastRootVelocity=rootVelocity?.clone()??new Vector3();
  this.geometry=Object.fromEntries(['r','l'].map(s=>[s,{points:contacts[s].contacts,up:contacts[s].soleUp}]));
  this.phase=walkPhase??(support==='r'?.75:.25);
  for(const s of ['r','l']){
   const source=feet[s],phase=(this.phase+(s==='r'?.25:.75))%1;
   this.feet[s]={phase,support:.5,heading:this.heading,last:source.p.clone(),lastQ:source.q.clone(),lastActual:source.p.clone(),velocity:source.velocity?.clone()??new Vector3(),rebase:true,
    ...(s===support&&grounded?{anchor:source.p.clone(),supportQ:source.q.clone(),floor:root.position.y,rollStart:phase}:{})};
  }
 }
 begin(dt,groundHeight){
  this.age+=dt;this.frameDt=dt;this.landing=null;this.groundHeight=groundHeight;
  const forward=new Vector3(0,0,1).applyQuaternion(rotation(this.root)),wanted=Math.atan2(forward.x,forward.z);
  const difference=Math.atan2(Math.sin(wanted-this.heading),Math.cos(wanted-this.heading));
  this.heading+=turnPlantedSupports(this.feet,{turn:MathUtils.clamp(difference,-6*dt,6*dt),heading:this.heading,dt,
   center:point(this.root),scale:this.root.scale.x,phaseAt:s=>this.feet[s].phase,normalAt:p=>this.normal(p),geometry:this.geometry});
  this.yawCorrection=this.heading-wanted;
  this.bodyCorrection=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),this.yawCorrection);
 }
 normal(p){
  const g=this.groundHeight,e=.04;
  return g?new Vector3(g(p.x-e,p.z)-g(p.x+e,p.z),2*e,g(p.x,p.z-e)-g(p.x,p.z+e)).normalize():new Vector3(0,1,0);
 }
 points(side){return this.contacts[side].surface?.points()??this.contacts[side].contacts;}
 place(side,target,q,phase,dt,groundHeight){
  const f=this.feet[side],hip=point(this.bones['thigh_'+side]);
  const reach=hip.distanceTo(point(this.bones['calf_'+side]))+point(this.bones['calf_'+side]).distanceTo(point(this.bones['foot_'+side]));
  // A late swing can inherit a distant target from another pose. Keep its
  // catch-up speed proportional to the native leg, then plant the footprint
  // it can actually reach instead of snapping to the new clip's endpoint.
  const maximumFootSpeed=11*reach;
  if(groundHeight){
   const nativeGap=Math.min(...this.points(side).map(v=>v.clone().applyQuaternion(q).add(target).y-this.root.position.y));
   const groundGap=this.gap(side,target,q,groundHeight);
   target.y+=Math.max(0,nativeGap)-groundGap;
  }
  if(phase<f.phase){
   this.landingElapsed=dt*phase/(1+phase-f.phase);
   // A landing on the first transferred frame still belongs to the visible
   // outgoing foot. Do not replace it with an unrelated proxy footprint.
   if(f.rebase){target.copy(f.last);q.copy(f.lastQ);if(groundHeight)target.y-=this.gap(side,target,q,groundHeight);}
   else if(f.catchupLimited){
    const delta=target.clone().sub(f.last),available=Math.max(0,dt-this.landingElapsed)*maximumFootSpeed;
    if(delta.length()>available)delta.setLength(available);
    target.copy(f.last).add(delta);
    if(groundHeight)target.y-=this.gap(side,target,q,groundHeight);
   }
   f.catchupLimited=false;
   f.support=.5;f.anchor=target.clone();f.supportQ=q.clone();f.floor=this.root.position.y;f.roll=null;f.rollStart=0;f.rebase=false;f.distance=undefined;f.heading=this.heading;f.pivotTurn=0;
   this.landing=side;
  }
  if(f.anchor&&phase<f.support){
   const support=rollRunSupport(f,{...this.geometry[side],normal:this.normal(f.anchor)},hip,phase,groundHeight?0:this.root.position.y-f.floor,dt);
   f.contact=support.index;f.contactAnchor=support.anchor;
   target.copy(support.position);q.copy(support.q);
   const distance=hip.distanceTo(target),approach=f.distance===undefined?0:Math.max(0,(distance-f.distance)/dt);f.distance=distance;
   if(distance+approach*.03>reach*.97){f.support=phase;f.anchor=null;f.rebase=true;}
  }else{
   if(f.anchor||f.rebase){
    f.offset=f.last.clone().sub(target);f.rotationOffset=f.lastQ.clone().multiply(q.clone().invert());
    f.release=phase;f.anchor=null;f.rebase=false;
   }
   const u=MathUtils.clamp((phase-(f.release??.5))/(1-(f.release??.5)),0,1),fade=1-MathUtils.smootherstep(u,0,1);
   if(f.offset)target.addScaledVector(f.offset,fade);
   if(f.rotationOffset)q.premultiply(f.rotationOffset.clone().slerp(new Quaternion(),1-fade));
   // An early reach release must lift before the native half-cycle starts.
   if((f.release??.5)<.5)target.y+=.08*this.root.scale.x*16*u*u*(1-u)*(1-u);
   const clearancePhase=(f.release??.5)>=.5?MathUtils.clamp((phase-.5)/.5,0,1):u;
   if(groundHeight)target.y+=Math.max(0,.05*this.root.scale.x*Math.sin(Math.PI*clearancePhase)-this.gap(side,target,q,groundHeight));
  }
  // A toe blend changes the visible sole. Retain the support frame but keep
  // every shoe corner above terrain, including during a heel/toe pivot.
  if(groundHeight)target.y-=Math.min(0,this.gap(side,target,q,groundHeight));
  if(!f.anchor&&dt>0){
   const delta=target.clone().sub(f.last),maximum=maximumFootSpeed*dt;
   if(delta.length()>maximum){
    target.copy(f.last).add(delta.setLength(maximum));f.catchupLimited=true;
    if(groundHeight)target.y-=Math.min(0,this.gap(side,target,q,groundHeight));
   }
  }
  f.target=target.clone();f.targetQ=q.clone();
  f.phase=phase;f.last.copy(target);f.lastQ.copy(q);
  return!!f.anchor&&phase<f.support;
 }
 gap(side,p,q,groundHeight){return Math.min(...this.points(side).map(v=>{const point=v.clone().applyQuaternion(q).add(p);return point.y-groundHeight(point.x,point.z);}));}
 record(side,error){
  const f=this.feet[side];f.last.copy(point(this.bones['foot_'+side]));f.lastQ.copy(rotation(this.bones['foot_'+side]));
  if(this.frameDt>0)f.velocity.copy(f.last).sub(f.lastActual).divideScalar(this.frameDt);
  f.lastActual.copy(f.last);
  if(this.landing===side&&error>.01)this.landing=null;
 }
 handoff(){
  const support=this.landing;if(!support)return null;
  const phase=support==='r'?0:.5;
  const elapsed=this.landingElapsed??0;
  return {phase,support,elapsed,bodyHeading:this.heading,rootRotation:this.lastRootRotation,rootPosition:this.lastRootPosition.clone(),rootVelocity:this.lastRootVelocity.clone(),
   // Walking and running have different stride lengths and support fractions.
   // Transfer physical velocity, not the walking clip's cycle frequency.
   ...(this.phaseRate>0?{supportProgress:Math.min(.99,elapsed*this.phaseRate/.5)}:{}),
   feet:Object.fromEntries(['r','l'].map(s=>[s,{p:this.feet[s].last.clone(),q:this.feet[s].lastQ.clone(),velocity:this.feet[s].velocity.clone(),pole:this.feet[s].lastPole,phase:(phase+(s==='l'?.5:0))%1}]))};
 }
}
