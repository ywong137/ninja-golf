import {validatePlanarRoot,samplePlanarRoot} from './attack-root-motion.js';
import {shadowSequenceFrame} from './shadow-sequence.js';

import {musouPerformanceClock,samplePerformanceClock} from './performance-clock.js';
export {musouPerformanceClock,samplePerformanceClock} from './performance-clock.js';
export function buildMusouSequence(records,steps){
 if(!Array.isArray(steps)||steps.length<2)throw Error('Musou needs at least two captured performances.');
 const segments=[],hits=[],headings=[],impactHands=[],rows=[{time:0,x:0,z:0}];
 let time=0,x=0,z=0;
 // Continue the captured combination until the ultimate has a substantial duration.
 // This replaces long idle recoveries with more cuts, rather than shortening it.
 for(let index=0;index<steps.length||time<7;index++){
  if(index>=32)throw Error('Musou source cuts cannot produce a valid sequence.');
  const clip=steps[index%steps.length],motion=records[clip];
  if(!motion?.nativeSourceMotion||!motion.nativeAttachment||!(motion.combatDuration>0)||!motion.impacts?.length)throw Error('Musou requires a fitted captured motion: '+clip);
  const clock=musouPerformanceClock(motion),duration=clock.duration,start=time,end=start+duration;
  segments.push({index,clip,start,end,duration,motion,clock});
  motion.impacts.forEach((t,i)=>{
   if(!(t>0&&t<motion.duration))throw Error('Musou contact lies outside its capture: '+clip);
   hits.push(start+samplePerformanceClock(clock,t,true));headings.push(motion.headings?.[i]??0);impactHands.push(motion.impactHands?.[i]??'r');
  });
  if(motion.planarRoot){
   validatePlanarRoot(motion.planarRoot);
   if(Math.abs(motion.planarRoot.duration-motion.duration)>1e-5)throw Error('Musou root and body clocks disagree: '+clip);
   const origin=samplePlanarRoot(motion.planarRoot,clock.start);
   for(const p of clock.rows.slice(1)){const root=samplePlanarRoot(motion.planarRoot,p.source);rows.push({time:start+p.time,x:x+root.x-origin.x,z:z+root.z-origin.z});}
  }else rows.push({time:end,x,z});
  ({x,z}=rows.at(-1));time=end;
 }
 return{kind:'performance',duration:time,segments,hits,headings,impactHands,events:[],planarRoot:validatePlanarRoot({duration:time,rows})};
}
export function combatSequenceFrame(action){
 const sequence=action?.sequence;
 if(sequence?.kind!=='performance')return shadowSequenceFrame(action);
 if(!Number.isFinite(action.time))throw Error('Musou requires a finite playback time.');
 const time=Math.max(0,Math.min(sequence.duration,action.time));
 const part=sequence.segments.find(s=>time<s.end)??sequence.segments.at(-1);
 const source=samplePerformanceClock(part.clock,time-part.start);
 return{index:part.index,heading:0,hidden:false,action:{...action,sequence:undefined,motionName:part.clip,time:source/part.motion.duration*part.motion.combatDuration,duration:part.motion.combatDuration,token:action.token+':performance:'+part.index,entryBlend:part.index?.10:part.motion.entryBlend??.14,planarRoot:part.motion.planarRoot,syncMotion:true}};
}
