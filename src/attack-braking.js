// Integral of 1 - smootherstep(t / duration). Integrating the frame interval
// keeps the braking distance independent of render rate and short final frames.
function remainingTravel(time,duration){
 if(time<0)return time;
 const u=Math.min(1,Math.max(0,time/duration));
 return duration*(u-2.5*u**4+3*u**5-u**6);
}

export function attackEntryVelocity(source,wanted,time,dt,duration=.18){
 if(!(dt>0)||!(duration>0)||!Number.isFinite(time))throw Error('Attack braking needs positive dt and duration, and a finite action time.');
 const weight=(remainingTravel(time+dt,duration)-remainingTravel(time,duration))/dt;
 return{x:source.x*weight+wanted.x*(1-weight),z:source.z*weight+wanted.z*(1-weight)};
}

export function attackEntryVelocityAt(source,wanted,time,duration=.18){
 if(!(duration>0)||!Number.isFinite(time))throw Error('Velocity prediction needs positive duration and finite time.');
 const u=Math.min(1,Math.max(0,time/duration)),weight=1-u**3*(10-15*u+6*u*u);
 return{x:source.x*weight+wanted.x*(1-weight),z:source.z*weight+wanted.z*(1-weight)};
}
