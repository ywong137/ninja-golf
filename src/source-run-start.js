import {attackRootDelta,validatePlanarRoot} from './attack-root-motion.js';
import {recordedContactWeight} from './source-gait-clock.js';
import {advanceRecordedClock} from './recorded-motion-clock.js';

const SIDES=['r','l'];
export function validateRunStart(profile){
 if(!profile||profile.version!==1||!(profile.duration>0)||!(profile.exitSpeed>0)||!(profile.contactFade>0)||!(profile.exitTime>0)||!(profile.exitTime<profile.duration))
  throw Error('A recorded running start needs version 1, positive duration/speed/fade, and an exit time before the capture ends.');
 validatePlanarRoot(profile.root);
 if(Math.abs(profile.root.duration-profile.duration)>1e-7)throw Error('Recorded start pose and travel durations must match.');
 for(const side of SIDES){
  const rows=profile.contacts?.[side];
  if(!Array.isArray(rows)||!rows.length||rows.some(([a,b],i)=>!Number.isFinite(a)||!Number.isFinite(b)||b<=a||(i&&a<rows[i-1][1])))
   throw Error('Recorded start contacts need ordered, separate intervals for '+side);
 }
 return profile;
}

export function runStartContacts(profile,time){
 const contactWeights={},stance={};
 for(const side of SIDES){
  contactWeights[side]=Math.max(...profile.contacts[side].map(interval=>recordedContactWeight(time,interval,profile.contactFade)));
  stance[side]=contactWeights[side]>.95;
 }
 return{contactWeights,stance};
}

// The existing braking planner consumes the current and next support window.
// This adapter preserves the start's actual schedule instead of alternating
// feet by half a loop. Later intervals can extend beyond the start's endpoint.
export function runStartBrakingProfile(profile,time){
 const feet=Object.fromEntries(SIDES.map(side=>{
  const interval=profile.contacts[side].find(([,end])=>end>=time)??profile.contacts[side].at(-1);
  return[side,{supportInterval:[Math.max(0,interval[0])/profile.duration,interval[1]/profile.duration]}];
 }));
 return{weights:[1],profiles:[{feet}]};
}

// A turning character is already loaded. Match that compression inside the
// source's first push, rather than returning to its earlier upright stance.
export function selectRunStartLoadingTime(profile,samples,pelvisHeight){
 if(!Number.isFinite(pelvisHeight)||!samples?.count||samples.rows?.length!==samples.count+1)
  throw Error('Match a running-start entry to a finite pelvis height and complete source samples.');
 const initial=SIDES.map(side=>profile.contacts[side].find(([a,b])=>a<=0&&b>0));
 if(initial.some(interval=>!interval))throw Error('A loaded restart needs source double support at the beginning.');
 const firstTakeoff=Math.min(...initial.map(([,b])=>b));
 const nextLanding=Math.min(...SIDES.flatMap(side=>profile.contacts[side].filter(([a])=>a>firstTakeoff).map(([a])=>a)));
 const end=Math.min(...initial.map(([,b])=>b).filter(b=>b>firstTakeoff),nextLanding,profile.exitTime);
 let best=null;
 for(let i=0;i<samples.count;i++){
  const time=i/samples.count*profile.duration;if(time<firstTakeoff||time>=end)continue;
  const error=Math.abs(samples.rows[i].pelvis.y-pelvisHeight);
  if(!best||error<best.error)best={time,error};
 }
 if(!best)throw Error('The running-start source has no loading interval before its next landing.');
 return best.time;
}

/** One clock drives recorded root displacement and the skeletal pose.
 * It never loops a start or replaces measured acceleration with constant speed.
 */
export class SourceRunStart{
 constructor(profile,scale){
  this.profile=validateRunStart(profile);
  if(!Number.isFinite(scale)||scale<=0)throw Error('A recorded start needs a positive actor scale.');
  this.scale=scale;this.state=null;
 }
 get active(){return!!this.state&&!this.state.done;}
 reset(){this.state=null;}
 begin(speed,yaw,{time=0,fromRest=false}={}){
  if(!Number.isFinite(speed)||speed<=0||!Number.isFinite(yaw))throw Error('Start running with a positive speed and finite heading.');
  if(!Number.isFinite(time)||time<0||time>=this.profile.exitTime)throw Error('Start inside the recorded sequence before its exit.');
  const targetRate=speed/(this.profile.exitSpeed*this.scale),rate=fromRest?0:targetRate;
  this.state={time,entryTime:time,rate,targetRate,speed,yaw,done:false};
 }
 setSpeed(speed){
  if(!this.active||!Number.isFinite(speed)||speed<=0)throw Error('Change speed only during an active recorded start, using positive metres per second.');
  this.state.speed=speed;this.state.targetRate=speed/(this.profile.exitSpeed*this.scale);
 }
 advance(dt){
  if(!Number.isFinite(dt)||dt<=0)throw Error('Advance a recorded start by positive seconds.');
  const s=this.state;if(!s||s.done)return null;
  const frame=advanceRecordedClock(s,dt,this.profile.exitTime);
  const delta=attackRootDelta(this.profile.root,frame.previousTime,s.time,this.profile.duration,s.yaw,this.scale);
  return{...frame,yaw:s.yaw,delta,...runStartContacts(this.profile,s.time)};
 }
}
