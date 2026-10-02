import {MathUtils} from 'three';
import {attackRootDelta,samplePlanarRoot,validatePlanarRoot} from './attack-root-motion.js';
import {recordedContactWeight} from './source-gait-clock.js';
import {advanceRecordedClock} from './recorded-motion-clock.js';

export function validateRunTurn(profile){
 if(profile?.version!==2||profile.poseFrame!=='travel-heading'||![profile.duration,profile.entry?.speed,profile.exit?.speed,profile.contactFade].every(x=>Number.isFinite(x)&&x>0))
  throw Error('A recorded turn needs version 2, a travel-heading pose, positive duration, speeds, and contact fade.');
 validatePlanarRoot(profile.root);
 if(Math.abs(profile.duration-profile.root.duration)>1e-7||profile.root.rows.some((r,i)=>!Number.isFinite(r.heading)||i&&Math.abs(r.heading-profile.root.rows[i-1].heading)>Math.PI))
  throw Error('The recorded turn needs synchronized pose, travel, and heading samples.');
 for(const side of ['r','l']){
  const intervals=profile.contacts?.[side];
  if(!Array.isArray(intervals)||!intervals.length)throw Error('Recorded turn contacts are missing for '+side);
  for(const [i,interval]of intervals.entries()){
   recordedContactWeight(0,interval,profile.contactFade);
   if(i&&interval[0]<intervals[i-1][1])throw Error('Recorded turn contacts must remain ordered and separate.');
  }
 }
 return profile;
}

export function turnHeading(profile,time){
 if(!Number.isFinite(time))throw Error('Sample the recorded heading at finite animation seconds.');
 const rows=profile.root.rows,t=MathUtils.clamp(time,0,profile.duration);let lo=0,hi=rows.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].time>t)hi=mid;else lo=mid;}
 const a=rows[lo],b=rows[hi];return MathUtils.lerp(a.heading,b.heading,(t-a.time)/(b.time-a.time));
}

export function selectRunTurn(entries,{angle,support,grounded=true,supportProgress=.25}){
 if(!Number.isFinite(angle)||!['r','l'].includes(support))throw Error('Select a turn with a finite angle and a known support side.');
 if(!grounded)return null;
 let best=null;
 for(const {clip,profile}of entries){
  const [a,b]=profile.contacts[support][0];
  const entryTime=Math.max(0,a+(b-a)*MathUtils.clamp(supportProgress??.25,.1,.8));
  const remaining=turnHeading(profile,profile.duration)-turnHeading(profile,entryTime);
  const error=Math.abs(Math.atan2(Math.sin(angle-remaining),Math.cos(angle-remaining)));
  if(Math.sign(angle)!==Math.sign(remaining)||error>.35||profile.duration-entryTime<.25)continue;
  if(!best||error<best.error)best={clip,profile,entryTime,error};
 }
 return best;
}

// One source time controls pose, travel, heading, and supporting contacts.
// The caller owns collision handling and transitions into other movements.
export class SourceRunTurn{
 constructor(profile,scale){
  this.profile=validateRunTurn(profile);
  if(!Number.isFinite(scale)||scale<=0)throw Error('A recorded turn needs positive actor scale.');
  this.scale=scale;this.state=null;
 }
 get active(){return!!this.state&&!this.state.done;}
 reset(){this.state=null;}
 begin(speed,yaw,time=0){
  if(!Number.isFinite(speed)||speed<=0||!Number.isFinite(yaw)||!Number.isFinite(time)||time<0||time>=this.profile.duration)
   throw Error('Begin a recorded turn with positive speed, finite heading, and an entry time inside the capture.');
  const a=Math.max(0,time-.02),b=Math.min(this.profile.duration,time+.02),p=samplePlanarRoot(this.profile.root,a),q=samplePlanarRoot(this.profile.root,b);
  const entrySpeed=time===0?this.profile.entry.speed:Math.hypot(q.x-p.x,q.z-p.z)/(b-a);
  if(entrySpeed<.1)throw Error('The selected turn entry is not moving.');
  const rate=speed/(entrySpeed*this.scale);
  this.state={time,entryTime:time,entrySpeed,rate,targetRate:rate,baseYaw:yaw-turnHeading(this.profile,time),done:false};
 }
 setSpeed(speed){
  if(!this.active||!Number.isFinite(speed)||speed<=0)throw Error('Change turn speed only during active playback, using positive metres per second.');
  this.state.targetRate=speed/(this.state.entrySpeed*this.scale);
 }
 advance(dt){
  if(!Number.isFinite(dt)||dt<=0)throw Error('Advance a recorded turn by positive seconds.');
  const s=this.state;if(!s||s.done)return null;
  const frame=advanceRecordedClock(s,dt,this.profile.duration);
  const delta=attackRootDelta(this.profile.root,frame.previousTime,s.time,this.profile.duration,s.baseYaw,this.scale);
  const contactWeights=Object.fromEntries(['r','l'].map(side=>[side,Math.max(...this.profile.contacts[side].map(interval=>recordedContactWeight(s.time,interval,this.profile.contactFade)))]));
  const yaw=s.baseYaw+turnHeading(this.profile,s.time),exitSpeed=this.profile.exit.speed*this.scale*s.rate;
  return{...frame,yaw,delta,contactWeights,...(frame.done?{exitVelocity:{x:Math.sin(yaw)*exitSpeed,z:Math.cos(yaw)*exitSpeed}}:{}),
   stance:Object.fromEntries(['r','l'].map(side=>[side,contactWeights[side]>.95]))};
 }
}
