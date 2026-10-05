import {createAttackPerformance} from './attack-performance.js';
import {attackRootDelta} from './attack-root-motion.js';
import {combatSequenceFrame} from './musou-sequence.js';

// A light chain follows the same authored continuation times as buffered input.
export function buildShowcaseAttacks(warrior,records,resolveClip){
 const create=(kind,step)=>createAttackPerformance(warrior,kind,step,resolveClip(warrior,kind,step),records);
 const lights=Array.from({length:warrior.lightComboLength??4},(_,i)=>create('light',i));
 const heavies=lights.map((_,i)=>create('heavy',i)),musou=create('musou',0);
 let time=0;const combo=lights.map((action,i)=>{
  const record=records[action.motionName],branch=Object.values(record.continuations??{}).find(b=>b.clip===lights[i+1]?.motionName);
  const duration=branch?branch.at/record.duration*action.duration:action.duration;
  const part={action,start:time,end:time+duration,duration};time=part.end;return part;
 });
 const single=action=>({duration:action.duration,parts:[{action,start:0,end:action.duration,duration:action.duration}]});
 const performances={light:{duration:time,parts:combo},heavy:single(heavies[0]),musou:single(musou)};
 const inspection=[...lights.map((action,i)=>({id:'light-'+(i+1),label:`Light attack ${i+1} · ${action.name}`,duration:action.duration})),
  ...heavies.slice(1).map((action,i)=>({id:'heavy-'+(i+2),label:`Heavy · after ${i+2} light attacks`,duration:action.duration})),
  {id:'musou',label:'Musou · '+musou.name,duration:musou.duration}];
 lights.forEach((action,i)=>{performances['light-'+(i+1)]=single(action);});
 heavies.slice(1).forEach((action,i)=>{performances['heavy-'+(i+2)]=single(action);});
 return{performances,inspection};
}
export function showcaseAttackFrame(performance,time,token){
 const t=Math.max(0,Math.min(performance.duration,time)),part=performance.parts.find(p=>t<p.end)??performance.parts.at(-1),index=performance.parts.indexOf(part);
 const action={...part.action,time:t-part.start,token:token+':'+index,syncMotion:true};
 return combatSequenceFrame(action)??{index,heading:0,hidden:false,action};
}
export function showcaseAttackTravel(performance,time,yaw,scale){
 const total={x:0,z:0};
 for(const part of performance.parts){
  if(time<=part.start)break;
  if(!part.action.planarRoot)continue;
  const delta=attackRootDelta(part.action.planarRoot,0,Math.min(part.duration,time-part.start),part.action.duration,yaw,scale);
  total.x+=delta.x;total.z+=delta.z;
 }
 return total;
}
