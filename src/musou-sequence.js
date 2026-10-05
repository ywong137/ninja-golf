import {validatePlanarRoot,samplePlanarRoot} from './attack-root-motion.js';
import {shadowSequenceFrame} from './shadow-sequence.js';

import {musouPerformanceClock,samplePerformanceClock} from './performance-clock.js';
export {musouPerformanceClock,samplePerformanceClock} from './performance-clock.js';
const continuationTo=(motion,clip)=>Object.values(motion?.continuations??{}).find(branch=>branch.clip===clip);
export function buildMusouSequence(records,steps){
 if(!Array.isArray(steps)||steps.length<2)throw Error('Musou needs at least two captured performances.');
 const segments=[],hits=[],headings=[],impactHands=[],rows=[{time:0,x:0,z:0}];
 let time=0,x=0,z=0;
 // Finish a connected combination before ending the ultimate.
 for(let index=0;index<steps.length||time<7||segments.at(-1)?.continues;index++){
  if(index>=32)throw Error('Musou source cuts cannot produce a valid sequence.');
  const clip=steps[index%steps.length],motion=records[clip];
  if(!motion?.nativeSourceMotion||!motion.nativeAttachment||!(motion.combatDuration>0)||!motion.impacts?.length)throw Error('Musou requires a fitted captured motion: '+clip);
  const next=steps[(index+1)%steps.length],branch=continuationTo(motion,next);
  // Matching combos join at the authored branch, before recovery begins.
  // Other attacks retain the complete body preparation and recovery.
  const clock=musouPerformanceClock(motion,{start:0,end:branch?.at??motion.duration,acceleration:0}),duration=clock.duration,start=time,end=start+duration;
  const entryBlend=segments.at(-1)?.continues?.clip===clip? .025 : motion.entryBlend??.18;
  segments.push({index,clip,start,end,duration,motion,clock,entryBlend,continues:branch});
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
 return{index:part.index,heading:0,hidden:false,action:{...action,sequence:undefined,motionName:part.clip,time:source/part.motion.duration*part.motion.combatDuration,duration:part.motion.combatDuration,token:action.token+':performance:'+part.index,entryBlend:part.entryBlend,planarRoot:part.motion.planarRoot,syncMotion:true}};
}
