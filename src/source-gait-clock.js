import {MathUtils} from 'three';

/** A non-looping contact interval uses seconds, including its fade. */
export function recordedContactWeight(time,interval,fade){
 const [start,end]=interval??[];
 if(![time,start,end,fade].every(Number.isFinite)||end<=start||fade<=0)
  throw Error('Recorded contact needs finite time, an ordered interval, and a positive fade.');
 // Smootherstep can exceed one by floating-point roundoff just before contact.
 // Both the offline fit and runtime must keep physical support inside [0,1].
 return MathUtils.clamp(MathUtils.smootherstep(time,start-fade,start)*(1-MathUtils.smootherstep(time,end,end+fade)),0,1);
}

/** Source phases can cross zero, for example [-.02, .18]. */
export function gaitContactWeight(phase,interval,fade=.04){
 const [start,end]=interval??[];
 if(!Number.isFinite(phase)||!Number.isFinite(start)||!Number.isFinite(end)
  ||!(end>start)||end-start>1||!Number.isFinite(fade)||fade<=0)
  throw Error('Supply a finite phase, a contact interval of at most one cycle, and a positive fade.');
 const p=MathUtils.euclideanModulo(phase-start,1);
 const length=end-start;
 const weight=Math.max(...[p-1,p,p+1].map(t=>MathUtils.smootherstep(t,-fade,0)*(1-MathUtils.smootherstep(t,length,length+fade))));
 return weight<1e-12?0:weight>1-1e-12?1:weight;
}

/** Fraction of a planted interval; null means the foot is outside support. */
export function gaitSupportProgress(phase,interval){
 gaitContactWeight(phase,interval);
 const elapsed=MathUtils.euclideanModulo(phase-interval[0],1),duration=interval[1]-interval[0];
 return elapsed<=duration?elapsed/duration:null;
}

/** A source clock owns a blend only when every contributing clip has metadata.
 * Strides use model metres per cycle. Directions are unit-vector components.
 * Legacy clips keep their existing clock; this never guesses their contacts.
 */
export function sourceGaitBlend(clips,directions,speed,scale){
 if(clips.length!==directions.length||directions.some(n=>!Number.isFinite(n)||n<0)
  ||!Number.isFinite(speed)||speed<0||!Number.isFinite(scale)||scale<=0)
  throw Error('Source gait needs matching clips and directions, nonnegative speed, and positive scale.');
 const active=clips.map((clip,i)=>({clip,i,amount:directions[i]})).filter(row=>row.amount>1e-8);
 if(!active.length||active.some(({clip})=>clip.userData?.sourceGaitClockVersion!==1))return null;
 for(const {clip}of active){
  const p=clip.userData.sourceGait;
  if(!p||!Number.isFinite(p.stride)||p.stride<=0||!(clip.duration>0)||!Number.isFinite(clip.duration))
   throw Error(`Invalid captured stride or duration in ${clip.name}.`);
  for(const side of ['r','l']){
   const interval=p.feet?.[side]?.supportInterval??p.feet?.[side]?.toeInterval;
   try{gaitContactWeight(0,interval);}catch{throw Error(`Invalid captured support interval ${side} in ${clip.name}.`);}
  }
 }
 const sum=active.reduce((n,{clip,amount})=>n+amount/clip.userData.sourceGait.stride,0);
 const weights=clips.map(()=>0);
 for(const {clip,i,amount}of active)weights[i]=amount/clip.userData.sourceGait.stride/sum;
 return {weights,phaseRate:speed*sum/scale,profiles:clips.map((clip,i)=>weights[i]>0?clip.userData.sourceGait:null)};
}

export function sourceGaitContacts(blend,phase){
 const contactWeights={r:0,l:0};
 for(const [i,p]of blend.profiles.entries())if(p)for(const side of ['r','l'])
  contactWeights[side]+=blend.weights[i]*gaitContactWeight(phase,p.feet[side].supportInterval??p.feet[side].toeInterval);
 return {contactWeights,stance:Object.fromEntries(['r','l'].map(side=>[side,contactWeights[side]>.95]))};
}

// A transfer may use only the support shared by every contributing source.
// Captures can differ slightly in takeoff timing. Intersect their intervals
// on the phase circle; never extend contact to cover an airborne source foot.
export function sourceSupportIntervals(blend){
 const active=blend.profiles.filter(Boolean),intervals={};
 if(!active.length)throw Error('Captured support requires an active source profile.');
 for(const side of ['r','l']){
  const interval=p=>p.feet[side].supportInterval??p.feet[side].toeInterval;
  intervals[side]=[...interval(active[0])];gaitContactWeight(0,intervals[side]);
  const midpoint=(intervals[side][0]+intervals[side][1])*.5;
  for(const profile of active.slice(1)){
   const other=interval(profile);gaitContactWeight(0,other);
   const shift=Math.round(midpoint-(other[0]+other[1])*.5);
   intervals[side][0]=Math.max(intervals[side][0],other[0]+shift);
   intervals[side][1]=Math.min(intervals[side][1],other[1]+shift);
  }
  if(intervals[side][1]-intervals[side][0]<=1e-6)
   throw Error('Captured contact transfer requires aligned support with a shared planted interval for '+side+'. Rephase the source clips.');
 }
 return intervals;
}
