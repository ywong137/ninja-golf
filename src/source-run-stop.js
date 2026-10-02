import {attackRootDelta,samplePlanarRoot,validatePlanarRoot} from './attack-root-motion.js';
import {recordedContactWeight} from './source-gait-clock.js';
import {advanceRecordedClock} from './recorded-motion-clock.js';

const SIDES=['r','l'];
// Native-model metres per source second. Use the same path for selection,
// playback speed, and displacement; a separate deceleration curve would drift.
export function recordedStopVelocity(profile,time){
 if(!Number.isFinite(time)||time<0||time>profile.duration)throw Error('Sample stop velocity inside the recorded duration.');
 const a=Math.max(0,time-.02),b=Math.min(profile.duration,time+.02);
 const p=samplePlanarRoot(profile.root,a),q=samplePlanarRoot(profile.root,b);
 return{x:(q.x-p.x)/(b-a),z:(q.z-p.z)/(b-a)};
}
export function validateRunStop(profile){
 if(profile?.version!==1||profile.poseFrame!=='fixed-heading'||![profile.duration,profile.contactFade].every(x=>Number.isFinite(x)&&x>0))
  throw Error('A recorded stop needs version 1, a fixed-heading pose, positive duration and contact fade.');
 validatePlanarRoot(profile.root);
 if(Math.abs(profile.root.duration-profile.duration)>1e-7)throw Error('Recorded stop pose and travel durations must match.');
 if(!Number.isFinite(profile.exitTime)||profile.exitTime<=0||profile.exitTime>profile.duration)throw Error('A recorded stop needs an exit time inside its duration.');
 const range=profile.entryRange;
 if(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]<0||range[1]<=range[0]||range[1]>=profile.exitTime)
  throw Error('A recorded stop needs an ordered entry range inside its duration.');
 for(const side of SIDES){
  const intervals=profile.contacts?.[side];
  if(!Array.isArray(intervals)||!intervals.length)throw Error('Recorded stop contacts are missing for '+side);
  for(const [i,interval]of intervals.entries()){
   recordedContactWeight(0,interval,profile.contactFade);
   if(interval[0]<0||interval[1]>profile.duration+1e-7||(i&&interval[0]<intervals[i-1][1]))
    throw Error('Recorded stop contacts must be ordered and remain inside its duration.');
  }
  if(!intervals.some(([a,b])=>a<=profile.exitTime&&b>=profile.exitTime))throw Error('A recorded stop must finish with both feet supported.');
 }
 const v=recordedStopVelocity(profile,profile.exitTime);
 if(Math.hypot(v.x,v.z)>.5)throw Error('The recorded stop must hand off below 0.5 native metres per second.');
 return profile;
}

// Enter the same support phase at a suitable recorded speed. Flight cannot
// authorize an entry. The caller keeps the outgoing stride until touchdown.
export function selectRunStop(profile,{speed,scale=1,support,grounded,supportProgress=.5}){
 validateRunStop(profile);
 if(![speed,scale,supportProgress].every(Number.isFinite)||speed<=0||scale<=0||supportProgress<0||supportProgress>1||!SIDES.includes(support))
  throw Error('Select a stop with positive speed/scale, a known support, and progress in [0,1].');
 if(!grounded)return null;
 let best=null;
 for(const [a,b]of profile.contacts[support]){
  const time=a+(b-a)*supportProgress;
  if(time<profile.entryRange[0]||time>profile.entryRange[1])continue;
  const velocity=recordedStopVelocity(profile,time),sourceSpeed=Math.hypot(velocity.x,velocity.z);
  const rate=speed/(sourceSpeed*scale);
  if(!Number.isFinite(rate)||rate<.85||rate>1.15)continue;
  const error=Math.abs(Math.log(rate));
  if(!best||error<best.error)best={time,rate,sourceSpeed,error,support};
 }
 return best;
}

// Pose and root motion share the captured clock. Do not accelerate this clock
// toward the requested velocity: the capture already contains the stop.
export class SourceRunStop{
 constructor(profile,scale){
  this.profile=validateRunStop(profile);
  if(!Number.isFinite(scale)||scale<=0)throw Error('A recorded stop needs positive actor scale.');
  this.scale=scale;this.state=null;
 }
 get active(){return!!this.state&&!this.state.done;}
 reset(){this.state=null;}
 begin(speed,yaw,time){
  if(!Number.isFinite(speed)||speed<=0||!Number.isFinite(yaw)||!Number.isFinite(time)||time<this.profile.entryRange[0]||time>this.profile.entryRange[1])
   throw Error('Begin a recorded stop with positive speed, finite heading, and a time inside its entry range.');
  const v=recordedStopVelocity(this.profile,time),sourceSpeed=Math.hypot(v.x,v.z),rate=speed/(sourceSpeed*this.scale);
  if(!Number.isFinite(rate)||rate<.85||rate>1.15)throw Error('The stop entry requires a playback rate between 0.85 and 1.15.');
  this.state={time,entryTime:time,rate,targetRate:rate,yaw:yaw-Math.atan2(v.x,v.z),done:false};
 }
 advance(dt){
  if(!Number.isFinite(dt)||dt<=0)throw Error('Advance a recorded stop by positive seconds.');
  const s=this.state;if(!s||s.done)return null;
  const frame=advanceRecordedClock(s,dt,this.profile.exitTime);
  const delta=attackRootDelta(this.profile.root,frame.previousTime,s.time,this.profile.duration,s.yaw,this.scale);
  const contactWeights=Object.fromEntries(SIDES.map(side=>[side,Math.max(...this.profile.contacts[side].map(interval=>recordedContactWeight(s.time,interval,this.profile.contactFade)))]));
  const local=recordedStopVelocity(this.profile,s.time),c=Math.cos(s.yaw),sin=Math.sin(s.yaw),k=this.scale*s.rate;
  // Preserve residual momentum at the guard handoff. The caller must absorb
  // it through the planted stance; stopping the clock cannot delete velocity.
  const endVelocity={x:(local.x*c+local.z*sin)*k,z:(local.z*c-local.x*sin)*k};
  return{...frame,kind:'stop',yaw:s.yaw,delta,endVelocity,...(frame.done?{exitVelocity:endVelocity}:{}),contactWeights,
   stance:Object.fromEntries(SIDES.map(side=>[side,contactWeights[side]>.95]))};
 }
}
