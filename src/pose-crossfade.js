// Preserve the complete displayed mixture when a new command interrupts a
// transition. Three.js falls back toward the bind pose when weights total < 1.
export function capturePoseWeights(actions){
 const active=[...new Set(actions)].filter(action=>action.isScheduled()&&action.getEffectiveWeight()>1e-8);
 const total=active.reduce((sum,action)=>sum+action.getEffectiveWeight(),0);
 return new Map(active.map(action=>[action,{weight:action.getEffectiveWeight()/total,time:action.time}]));
}

export function applyPoseWeights(sources,targets,blend){
 if(!Number.isFinite(blend)||blend<0||blend>1||[...targets.values()].some(weight=>!Number.isFinite(weight)||weight<0)
  ||Math.abs([...targets.values()].reduce((a,b)=>a+b,0)-1)>1e-6)
  throw Error('Blend normalized target animation weights with a fraction in [0,1].');
 const amount=sources.size?blend:1;
 for(const action of new Set([...sources.keys(),...targets.keys()])){
  action.stopFading().setEffectiveWeight((sources.get(action)?.weight??0)*(1-amount)+(targets.get(action)??0)*amount);
  if(amount===1&&!targets.has(action))action.stop();
 }
}
