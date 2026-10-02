import {MathUtils} from 'three';

// Integrate a bounded playback-rate ramp and split the exact exit frame.
// Running starts and turns share this clock so neither loses pose or travel.
export function advanceRecordedClock(state,dt,exitTime){
 if(!state||![state.time,state.rate,state.targetRate,dt,exitTime].every(Number.isFinite)
  ||state.time<0||state.rate<0||state.targetRate<=0||dt<=0||exitTime<=state.time)
  throw Error('Advance an active recorded clock with a nonnegative current rate, positive target rate/time, and a later exit.');
 const difference=state.targetRate-state.rate,acceleration=Math.sign(difference)*3;
 const rampTime=Math.min(dt,Math.abs(difference)/3);
 const elapsed=state.rate*dt+acceleration*rampTime*rampTime/2+acceleration*rampTime*(dt-rampTime);
 const previous=state.time,remaining=exitTime-previous;let duration=dt;
 if(elapsed>=remaining){
  const rampDistance=state.rate*rampTime+acceleration*rampTime*rampTime/2;
  duration=remaining<=rampDistance
   ?2*remaining/(state.rate+Math.sqrt(state.rate*state.rate+2*acceleration*remaining))
   :rampTime+(remaining-rampDistance)/state.targetRate;
  duration=MathUtils.clamp(duration,0,dt);
 }
 state.rate+=acceleration*Math.min(duration,rampTime);
 state.time=Math.min(exitTime,previous+elapsed);state.done=state.time>=exitTime;
 return{time:state.time,previousTime:previous,duration,remainingDt:Math.max(0,dt-duration),rate:state.rate,done:state.done};
}
