import {musouPerformanceClock,samplePerformanceClock} from './performance-clock.js';
import {validatePlanarRoot,samplePlanarRoot} from './attack-root-motion.js';

// Explicit disappearances join complete performances. No interpolated body pose
// spans the different starting stances, and each source keeps its own mount.
export function buildShadowSequence(records,steps,{gap=.24,continuous=false,minDuration=0}={}){
 if(!Array.isArray(steps)||steps.length<2||!Number.isFinite(gap)||gap<=0)throw Error('A shadow sequence needs at least two cuts and a positive disappearance duration.');
 const segments=[],hits=[],headings=[],impactHands=[],rows=[{time:0,x:0,z:0}],events=[];
 let time=0,x=0,z=0;
 for(let index=0;index<steps.length||time<minDuration;index++){
  if(index>=32)throw Error('Shadow sequence exceeds 32 cuts.');
  const step=steps[index%steps.length];
  const motion=records[step.clip],heading=step.heading??0;
  if(!motion?.nativeSourceMotion||!motion.nativeAttachment||!Number.isFinite(motion.duration)||motion.duration<=0||!Number.isFinite(motion.combatDuration)||motion.combatDuration<=0||!Number.isFinite(heading))throw Error('Use a complete native source cut with explicit timing: '+step.clip);
  if(!motion.impacts?.length||motion.impactHands?.length!==motion.impacts.length||motion.impactHands.some(hand=>!['r','l','both'].includes(hand)))throw Error('Each cut needs a named attacking hand for each contact: '+step.clip);
  const clock=continuous?musouPerformanceClock(motion):null;
  const duration=clock?.duration??motion.combatDuration,start=time,end=start+duration;
  segments.push({index,clip:step.clip,start,end,duration,heading,motion,clock});
  for(const [i,impact]of motion.impacts.entries()){
   if(!Number.isFinite(impact)||impact<=0||impact>=motion.duration)throw Error('Strike time must be inside the source performance.');
   hits.push(start+(clock?samplePerformanceClock(clock,impact,true):impact/motion.duration*duration));headings.push(heading+(motion.headings?.[i]??0));impactHands.push(motion.impactHands[i]);
  }
  const c=Math.cos(heading),s=Math.sin(heading),path=motion.planarRoot;
  if(path){validatePlanarRoot(path);if(Math.abs(path.duration-motion.duration)>1e-5)throw Error('Root and skeleton durations differ: '+step.clip);const origin=clock?samplePlanarRoot(path,clock.start):{x:0,z:0};const samples=clock?clock.rows.slice(1).map(k=>({...samplePlanarRoot(path,k.source),time:k.time})):path.rows.slice(1).map(p=>({...p,time:p.time/path.duration*duration}));for(const p of samples){const px=p.x-origin.x,pz=p.z-origin.z;rows.push({time:start+p.time,x:x+px*c+pz*s,z:z+pz*c-px*s});}}
  else rows.push({time:end,x,z});
  ({x,z}=rows.at(-1));time=end;
  if(index<steps.length-1||time<minDuration){events.push({time,kind:'vanish',index});const next=steps[(index+1)%steps.length],distance=next.shadowTravel??0;if(!Number.isFinite(distance)||distance<0)throw Error('Shadow travel must be a nonnegative distance in model metres.');time+=gap;x+=Math.sin(next.heading??0)*distance;z+=Math.cos(next.heading??0)*distance;rows.push({time,x,z});events.push({time,kind:'appear',index:index+1});}
 }
 const planarRoot=validatePlanarRoot({duration:time,rows});
 return {duration:time,segments,hits,headings,impactHands,planarRoot,events};
}

export function shadowSequenceFrame(action){
 const sequence=action?.sequence;if(!sequence)return null;
 if(!Number.isFinite(action.time))throw Error('A shadow sequence requires a finite action time.');
 const time=Math.max(0,Math.min(sequence.duration,action.time));
 let index=sequence.segments.findIndex(s=>time<s.end);if(index<0)index=sequence.segments.length-1;
 const part=sequence.segments[index],hidden=time<part.start;
 // Switch to the next complete starting pose while hidden. The new source
 // runs only after the appearance beat, with no crossfade from the old limbs.
 const localTime=Math.max(0,Math.min(part.duration,time-part.start));
 return{index,heading:part.heading,hidden,action:{...action,sequence:undefined,motionName:part.clip,time:part.clock?samplePerformanceClock(part.clock,localTime)/part.motion.duration*part.motion.combatDuration:localTime,duration:part.clock?part.motion.combatDuration:part.duration,token:action.token+':shadow:'+index,entryBlend:index===0?part.motion.entryBlend??.14:0,planarRoot:part.motion.planarRoot,syncMotion:true}};
}

export function crossedShadowEvents(sequence,previous,time){
 if(!sequence)return[];
 if(!Number.isFinite(previous)||!Number.isFinite(time)||time<previous)throw Error('Shadow events require forward finite times.');
 return sequence.events.filter(e=>e.time>previous&&e.time<=time);
}
