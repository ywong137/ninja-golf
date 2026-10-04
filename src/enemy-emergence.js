const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
// Source seconds. The first complete sole contact in NinjaJump_Land is 0.10 s.
export const NINJA_EMERGENCE=Object.freeze({start:29/30,flight:2,land:38/30,contact:.1});

/** Keep the flight path and the complete body performance on one explicit clock. */
export function enemyEmergenceFrame(time,{duration,kind}){
 if(!Number.isFinite(time)||!Number.isFinite(duration)||duration<=0)
  throw Error('Enemy emergence requires finite time and a positive flight duration.');
 const {start,flight,land,contact}=NINJA_EMERGENCE;
 const takeoff=kind==='tree'?0:start;
 const touchdown=Math.max(duration,takeoff+contact+.08);
 const landStart=touchdown-contact,total=landStart+land;
 const t=clamp(time,0,total);
 let clip,clipTime;
 if(t<takeoff){clip='Ninja_Emerge_Start';clipTime=t;}
 else if(t<landStart){clip='Ninja_Emerge_Flight';clipTime=(t-takeoff)%flight;}
 else{clip='Ninja_Emerge_Land';clipTime=Math.min(land,t-landStart);}
 return {clip,clipTime,progress:clamp(t/touchdown,0,1),landed:t>=touchdown,done:time>=total,touchdown,duration:total};
}
