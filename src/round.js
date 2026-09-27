export function readRoundSave(raw,courses,warriors){
 try{
  const s=JSON.parse(raw);if(!s||![1,2].includes(s.version))return null;
  const courseIndex=s.version===1?0:courses.findIndex(c=>c.id===s.courseId),course=courses[courseIndex];
  if(!course||!warriors[s.playerIndex]||!Array.isArray(s.scores))return null;
  const limit=s.version===1?3:course.holes.length;
  if(!Number.isInteger(s.nextHole)||s.nextHole<=0||s.nextHole>=limit||s.scores.length!==s.nextHole||!s.scores.every(x=>Number.isInteger(x)&&x>0))return null;
  return{...s,courseIndex,penalties:Array.isArray(s.penalties)?s.penalties.map(x=>Number.isInteger(x)&&x>=0?x:0):s.scores.map(()=>0)};
 }catch{return null;}
}
