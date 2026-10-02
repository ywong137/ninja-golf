import {MathUtils,Quaternion} from 'three';

const SIDES=['r','l'];
const smooth=t=>MathUtils.smootherstep(t,0,1);
const pose=f=>({p:f.p.clone(),q:f.q.clone(),ballQ:f.ballQ.clone()});

// Transfer an actual standing footprint into an authored attack. A planted
// foot can pivot; positional corrections disappear only during a free step.
export class PlantedPoseTransfer{
 constructor(feet,contacts){
  this.contacts=contacts;this.age=0;this.motion=null;
  this.feet=Object.fromEntries(SIDES.map(side=>[side,{last:pose({...feet[side],ballQ:feet[side].ballQ??new Quaternion()}),velocity:feet[side].velocity?.clone()??feet[side].p.clone().set(0,0,0)}]));
 }
 begin(dt,key,time){
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(time)||time<0)throw Error('A planted pose transfer needs positive frame time and a valid motion time.');
  this.dt=dt;
  if(this.motion!==key||time<this.time){
   this.motion=key;this.age=0;
   for(const f of Object.values(this.feet)){f.changed=true;f.rotation=null;f.flight=null;}
  }
  this.age+=dt;this.time=time;
 }
 points(side,ballQ){return this.contacts[side].surface.points(ballQ);}
 gap(side,frame,ground){return Math.min(...this.points(side,frame.ballQ).map(v=>{const p=v.applyQuaternion(frame.q).add(frame.p);return p.y-ground(p.x,p.z);}));}
 place(side,native,motion,ground,contactWeight){
  const f=this.feet[side],time=this.time;
  const flat=motion?.footPlants?.[side]??[],toe=motion?.toePlants?.[side]??[],intervals=[...flat,...toe].sort((a,b)=>a[0]-b[0]);
  const hasSchedule=Array.isArray(motion?.footPlants?.[side])||Array.isArray(motion?.toePlants?.[side]);
  if(!hasSchedule&&(!Number.isFinite(contactWeight)||contactWeight<0||contactWeight>1))throw Error('An authored pose without contact intervals needs its evaluated support weight.');
  const contains=ranges=>ranges.some(([a,b])=>time>=a-1e-7&&time<=b+1e-7);
  let kind=hasSchedule?(contains(flat)?'flat':contains(toe)?'toe':'free'):(contactWeight>(f.kind==='free'?.65:.35)?'flat':'free');
  if(!f.rotation){f.rotation=f.last.q.clone().multiply(native.q.clone().invert());f.toeRotation=f.last.ballQ.clone().multiply(native.ballQ.clone().invert());}
  // A new clip cannot declare an airborne foot planted. Finish a short,
  // continuous landing from its actual position and velocity first.
  if(f.changed&&kind!=='free'&&this.gap(side,f.last,ground)>=.012){
   f.bridge={start:this.age,duration:MathUtils.clamp(.1+this.gap(side,f.last,ground)*.4,.12,.2),from:pose(f.last),velocity:f.velocity.clone()};
  }
  f.changed=false;
  if(f.bridge){
   const b=f.bridge,u=MathUtils.clamp((this.age-b.start)/b.duration,0,1),target=pose(native);target.p.y-=this.gap(side,target,ground);
   const p=b.from.p.clone().multiplyScalar(2*u**3-3*u*u+1).addScaledVector(b.velocity,(u**3-2*u*u+u)*b.duration).addScaledVector(target.p,-2*u**3+3*u*u);
   const frame={p,q:b.from.q.clone().slerp(target.q,smooth(u)),ballQ:b.from.ballQ.clone().slerp(target.ballQ,smooth(u)),supported:u===1};
   frame.p.y-=Math.min(0,this.gap(side,frame,ground));
   f.kind='free';f.anchor=null;f.flat=null;
   if(u===1){f.bridge=null;f.flat=pose(frame);f.kind='flat';f.rotation.identity();f.toeRotation.identity();}
   return frame;
  }
  if(f.kind==='free'&&kind!=='free'&&f.flight){f.rotation.identity();f.toeRotation.identity();}
  let p=native.p.clone(),q=f.rotation.clone().multiply(native.q),ballQ=f.toeRotation.clone().multiply(native.ballQ);
  if(kind==='flat'){
   if(!f.flat||f.kind!=='flat')f.flat=pose(f.last);
   ({p,q,ballQ}=pose(f.flat));f.anchor=null;f.flight=null;
  }else if(kind==='toe'){
   const points=this.points(side,ballQ);
   if(f.kind!=='toe'||!f.anchor){
    const axes=this.contacts[side].contacts;if(!axes?.length)throw Error('Toe contact needs calibrated front and rear sole points.');
    const forward=axes[0].clone().sub(axes[1]).normalize(),along=points.map(v=>v.dot(forward)),front=Math.max(...along),back=Math.min(...along);
    const candidates=points.map((v,i)=>({i,y:v.clone().applyQuaternion(q).y})).filter(({i})=>along[i]>=back+(front-back)*.8);
    f.index=candidates.reduce((a,b)=>a.y<=b.y?a:b).i;
    f.anchor=this.points(side,f.last.ballQ)[f.index].applyQuaternion(f.last.q).add(f.last.p);f.anchor.y=ground(f.anchor.x,f.anchor.z);
   }
   p.copy(f.anchor).sub(points[f.index].clone().applyQuaternion(q));f.flight=null;f.flat=null;
  }else{
   if(!f.flight){
    const landing=intervals.find(([a])=>a>time)?.[0]??motion?.duration??time+.18;
    f.flight={start:time,end:Math.max(time+.025,landing),offset:f.last.p.clone().sub(native.p),rotation:f.last.q.clone().multiply(native.q.clone().invert()),ballQ:f.last.ballQ.clone()};
   }
   const flight=f.flight,u=MathUtils.clamp((time-flight.start)/(flight.end-flight.start),0,1),blend=smooth(u);
   p.addScaledVector(flight.offset,1-blend);q=flight.rotation.clone().slerp(new Quaternion(),blend).multiply(native.q);ballQ.copy(flight.ballQ).slerp(native.ballQ,blend);
   f.anchor=null;f.flat=null;
   const gap=Math.min(...this.points(side,ballQ).map(v=>{const c=v.applyQuaternion(q).add(p);return c.y-ground(c.x,c.z);}));
   p.y+=Math.max(0,.01*Math.sin(Math.PI*u)-gap);
  }
  f.kind=kind;
  return{p,q:q.normalize(),ballQ:ballQ.normalize(),supported:kind!=='free'};
 }
 record(side,p,q,ballQ){const f=this.feet[side];if(this.dt>0)f.velocity.copy(p).sub(f.last.p).divideScalar(this.dt);f.last={p:p.clone(),q:q.clone(),ballQ:ballQ.clone()};}
}
