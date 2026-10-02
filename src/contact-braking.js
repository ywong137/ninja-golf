import {attackEntryVelocity,attackEntryVelocityAt} from './attack-braking.js';

const STOP={x:0,z:0};
// The braking clock advances only while a foot can transmit horizontal force.
// Flight advances real time and position, but preserves horizontal momentum.
export class ContactBraking{
 constructor(velocity,duration){
  if(![velocity?.x,velocity?.z,duration].every(Number.isFinite)||duration<=0)throw Error('Contact braking needs finite horizontal velocity and a positive loaded duration.');
  this.source={x:velocity.x,z:velocity.z};this.duration=duration;this.loadedTime=0;this.time=0;
 }
 get velocity(){return attackEntryVelocityAt(this.source,STOP,this.loadedTime,this.duration);}
 get done(){return this.loadedTime>=this.duration-1e-9;}
 advance(dt,loadedDuration){
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(loadedDuration)||loadedDuration<0||loadedDuration>dt)throw Error('Advance contact braking with positive seconds and a loaded interval within that frame.');
  const loaded=loadedDuration?attackEntryVelocity(this.source,STOP,this.loadedTime,loadedDuration,this.duration):this.velocity;
  this.loadedTime=Math.min(this.duration,this.loadedTime+loadedDuration);this.time+=dt;
  const endVelocity=this.velocity,delta={x:loaded.x*loadedDuration+endVelocity.x*(dt-loadedDuration),z:loaded.z*loadedDuration+endVelocity.z*(dt-loadedDuration)};
  return {velocity:{x:delta.x/dt,z:delta.z/dt},endVelocity,delta,loadedDuration,done:this.done};
 }
 // Contact windows are predictions in real seconds from the start of this
 // brake. They do not authorize a force; advance() uses observed support.
 predict(dt,windows){
  if(!Number.isFinite(dt)||dt<0)throw Error('Predict braking over a finite nonnegative duration.');
  const copy=new ContactBraking(this.source,this.duration);copy.loadedTime=this.loadedTime;copy.time=this.time;
  const end=this.time+dt,delta={x:0,z:0},events=[this.time,end];
  for(const [a,b]of windows){
   if(!Number.isFinite(a)||!(Number.isFinite(b)||b===Infinity)||b<=a)throw Error('Predicted contacts need increasing finite starts and finite or infinite ends.');
   if(a>this.time&&a<end)events.push(a);if(b>this.time&&b<end)events.push(b);
  }
  events.sort((a,b)=>a-b);
  for(let i=1;i<events.length;i++){
   const a=events[i-1],b=events[i];if(b===a)continue;
   const mid=(a+b)/2,loaded=windows.some(([start,finish])=>mid>=start&&mid<finish);
   const frame=copy.advance(b-a,loaded?b-a:0);delta.x+=frame.delta.x;delta.z+=frame.delta.z;
  }
  return {delta,velocity:copy.velocity,done:copy.done};
 }
}
