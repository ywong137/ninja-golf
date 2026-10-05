import {validatePlanarRoot} from './attack-root-motion.js';
import {shadowSequenceFrame} from './shadow-sequence.js';

// Play complete captured performances, including their recoveries. Only the
// small entry blend joins clips; no generated arm or leg poses replace them.
export function buildMusouSequence(records,steps){
 if(!Array.isArray(steps)||steps.length<2)throw Error('Musou needs at least two captured performances.');
 const segments=[],hits=[],headings=[],impactHands=[],rows=[{time:0,x:0,z:0}];
 let time=0,x=0,z=0;
 for(const [index,clip]of steps.entries()){
  const motion=records[clip];
  if(!motion?.nativeSourceMotion||!motion.nativeAttachment||!(motion.combatDuration>0)||!motion.impacts?.length)throw Error('Musou requires a fitted captured motion: '+clip);
  const duration=motion.combatDuration,start=time,end=start+duration;
  segments.push({index,clip,start,end,duration,motion});
  motion.impacts.forEach((t,i)=>{
   if(!(t>0&&t<motion.duration))throw Error('Musou contact lies outside its capture: '+clip);
   hits.push(start+t/motion.duration*duration);headings.push(motion.headings?.[i]??0);impactHands.push(motion.impactHands?.[i]??'r');
  });
  if(motion.planarRoot){
   validatePlanarRoot(motion.planarRoot);
   if(Math.abs(motion.planarRoot.duration-motion.duration)>1e-5)throw Error('Musou root and body clocks disagree: '+clip);
   for(const p of motion.planarRoot.rows.slice(1))rows.push({time:start+p.time/motion.duration*duration,x:x+p.x,z:z+p.z});
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
 return{index:part.index,heading:0,hidden:false,action:{...action,sequence:undefined,motionName:part.clip,time:Math.max(0,time-part.start),duration:part.duration,token:action.token+':performance:'+part.index,entryBlend:part.index?.18:part.motion.entryBlend??.14,planarRoot:part.motion.planarRoot,syncMotion:true}};
}
