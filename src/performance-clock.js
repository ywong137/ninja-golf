const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Preserve each captured strike. Spend less time returning to ready between cuts.
// One monotonic clock drives body poses, ground travel, and damage contacts.
export function musouPerformanceClock(motion){
 if(!Number.isFinite(motion?.duration)||motion.duration<=0||!Number.isFinite(motion.combatDuration)||motion.combatDuration<=0||!motion.impacts?.length||motion.impacts.some((t,i)=>!Number.isFinite(t)||t<=0||t>=motion.duration||i>0&&t<=motion.impacts[i-1]))throw Error('Performance clocks need increasing source contacts and positive durations.');
 const start=Math.max(0,motion.impacts[0]-.55),end=Math.min(motion.duration,motion.impacts.at(-1)+.34);
 const rows=[{source:start,time:0}],step=1/120,baseRate=motion.duration/motion.combatDuration;
 for(let source=start;source<end-1e-8;){
  const next=Math.min(end,source+step),middle=(source+next)/2;
  let strikeWeight=0;
  for(const hit of motion.impacts)strikeWeight=Math.max(strikeWeight,smooth(hit-.42,hit-.22,middle)*(1-smooth(hit+.17,hit+.36,middle)));
  const rate=baseRate*(1+2.2*(1-strikeWeight));
  rows.push({source:next,time:rows.at(-1).time+(next-source)/rate});source=next;
 }
 return {rows,duration:rows.at(-1).time,start,end};
}
export function samplePerformanceClock(clock,value,sourceToTime=false){
 const from=sourceToTime?'source':'time',to=sourceToTime?'time':'source',rows=clock.rows;
 const t=Math.max(rows[0][from],Math.min(rows.at(-1)[from],value));let lo=0,hi=rows.length-1;
 while(hi-lo>1){const mid=(hi+lo)>>1;if(rows[mid][from]>t)hi=mid;else lo=mid;}
 const a=rows[lo],b=rows[hi],u=(t-a[from])/(b[from]-a[from]);return a[to]+(b[to]-a[to])*u;
}
