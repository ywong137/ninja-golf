// Cadence is measured in cycles/second; phase is measured in cycles.
export const RUN_ENTRY_CADENCE=1/.48;
const ACCELERATION=4;
function ramp(current,wanted){
 if(!(current>0)||!(wanted>0)||!Number.isFinite(current)||!Number.isFinite(wanted))throw Error('Running cadence needs finite, positive current and target rates.');
 const acceleration=Math.sign(wanted-current)*ACCELERATION;
 const duration=Math.abs(wanted-current)/ACCELERATION;
 return{acceleration,duration,phase:(current+wanted)*duration/2};
}

export function advanceRunCadence(current,wanted,seconds){
 if(!(seconds>=0)||!Number.isFinite(seconds))throw Error('Cadence time must be finite and nonnegative.');
 const r=ramp(current,wanted),time=Math.min(seconds,r.duration);
 return{rate:current+r.acceleration*time,phase:current*time+.5*r.acceleration*time*time+wanted*(seconds-time)};
}

export function runPhaseTime(current,wanted,phase){
 if(!(phase>=0)||!Number.isFinite(phase))throw Error('Remaining run phase must be finite and nonnegative.');
 const r=ramp(current,wanted);
 if(phase>=r.phase)return{duration:r.duration+(phase-r.phase)/wanted,rate:wanted};
 const rate=Math.sqrt(current*current+2*r.acceleration*phase);
 return{duration:2*phase/(current+rate),rate};
}
