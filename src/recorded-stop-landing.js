import {MathUtils,Quaternion,Vector3} from 'three';

const SIDES=['r','l'];
function sample(data,side,time,duration){
 const at=MathUtils.clamp(time/duration,0,1)*data.count,i=Math.min(data.count-1,Math.floor(at)),t=at-i;
 const a=data.rows[i][side],b=data.rows[i+1][side];
 return{p:a.p.clone().lerp(b.p,t),q:a.q.clone().slerp(b.q,t).normalize(),ballQ:a.ballQ.clone().slerp(b.ballQ,t).normalize()};
}

// Shape the existing airborne steps toward the actor's own ready stance.
// Contacts hold their actual world frame until the recorded takeoff.
export class RecordedStopLanding{
 constructor(root,model,bones,contacts,ready){
  Object.assign(this,{root,model,bones,contacts,ready});this.state=null;this.saved=[];
 }
 restore(){for(const [bone,q]of this.saved)bone.quaternion.copy(q);this.saved=[];}
 reset(){this.restore();this.state=null;this.report=null;}
 readyTargets(ground){
  this.root.updateMatrixWorld(true);const modelQ=this.model.getWorldQuaternion(new Quaternion()).normalize();
  return Object.fromEntries(SIDES.map(side=>{const ready=this.ready.rows[0][side],p=ready.p.clone().applyMatrix4(this.model.matrixWorld),q=modelQ.clone().multiply(ready.q);
   p.y-=Math.min(...this.contacts[side].surface.points(ready.ballQ).map(v=>{const c=v.applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);}));
   return[side,{p,q}];}));
 }
 begin(profile,data,entryTime){
  if(!this.ready?.rows?.length)throw Error('Recorded stopping requires the actor’s ready stance.');
  this.state={profile,data,entryTime,feet:{}};
  for(const side of SIDES){
   const endpoint=sample(data,side,profile.exitTime,profile.duration),ready=this.ready.rows[0][side];
   const contacts=profile.contacts[side],landings=contacts.filter(([a])=>a>entryTime);
   this.state.feet[side]={offset:ready.p.clone().sub(endpoint.p),readyQ:ready.q.clone(),readyBallQ:ready.ballQ.clone(),
    flights:landings.map(([landing,end],index)=>({start:Math.max(entryTime,...contacts.filter(([,b])=>b<landing).map(([,b])=>b)),landing,end,amount:(index+1)/landings.length}))};
  }
 }
 apply(time,base,ground){
  const state=this.state;if(!state)return base;
  this.root.updateMatrixWorld(true);
  const modelQ=this.model.getWorldQuaternion(new Quaternion()).normalize(),modelScale=this.model.getWorldScale(new Vector3()),targets={};
  for(const side of SIDES){
   const f=state.feet[side],bone=this.bones['ball_'+side],native=base.targets[side],flight=f.flights.find(flight=>time<=flight.end)??f.flights.at(-1);
   let amount=0;
   if(flight){const before=f.flights.indexOf(flight)/f.flights.length;amount=MathUtils.lerp(before,flight.amount,MathUtils.smootherstep(time,flight.start,flight.landing));}
   const offset=f.offset.clone().multiply(modelScale).applyQuaternion(modelQ);
   let p=native.p.clone().addScaledVector(offset,amount),q=native.q.clone().slerp(modelQ.clone().multiply(f.readyQ),amount).normalize();
   this.saved.push([bone,bone.quaternion.clone()]);bone.quaternion.slerp(f.readyBallQ,amount).normalize();
   // Turning the ankle and toe changes the visible sole height. Keep the
   // airborne shoe clear before its contact weight reaches full support.
   const gap=()=>Math.min(...this.contacts[side].surface.points().map(v=>{const c=v.applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);}));
   if(amount>0)p.y-=Math.min(0,gap());
   const supported=(base.contactWeights[side]??0)>.95;
   if(supported&&amount>0){
    if(!f.hold||f.hold.flight!==flight){
     p.y-=gap();
     f.hold={flight,p:p.clone(),q:q.clone(),ballQ:bone.quaternion.clone()};
    }
    p.copy(f.hold.p);q.copy(f.hold.q);bone.quaternion.copy(f.hold.ballQ);
   }else f.hold=null;
   targets[side]={...native,p,q};f.amount=amount;
  }
  this.report={time,feet:SIDES.map(side=>({side,amount:state.feet[side].amount,held:!!state.feet[side].hold,target:targets[side].p.toArray()}))};
  return{...base,targets};
 }
}
