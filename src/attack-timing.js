// Motion authors may specify gameplay timing. Use it in combat and previews.
export function withMotionTiming(definition,motion){
 if(motion?.combatDuration===undefined)return definition;
 if(!Number.isFinite(motion.duration)||motion.duration<=0||!Number.isFinite(motion.combatDuration)||motion.combatDuration<=0)
  throw Error('Authored attack timing requires positive native and combat durations.');
 if(!Array.isArray(motion.impacts)||!motion.impacts.length||motion.impacts.some((t,i)=>!Number.isFinite(t)||t<=0||t>=motion.duration||i>0&&t<=motion.impacts[i-1]))
  throw Error('Authored attack impacts must increase within the native duration.');
 return{...definition,duration:motion.combatDuration,hits:motion.impacts.map(t=>t/motion.duration*motion.combatDuration)};
}
