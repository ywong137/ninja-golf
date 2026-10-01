// Authored branches replace recovery only when the requested follow-up has a
// matching entry pose. Native clip seconds and combat seconds remain distinct.
export function attackContinuation(action,queued,time,dt,motions){
 if(!action||!queued||queued.expires<time)return null;
 const source=motions[action.motionName],branch=source?.continuations?.[queued.kind];
 if(!branch)return null;
 const target=motions[branch.clip];
 if(!Number.isFinite(source.duration)||source.duration<=0||!Number.isFinite(branch.at)||branch.at<=0||branch.at>=source.duration
   ||!Array.isArray(source.impacts)||source.impacts.some(hit=>!Number.isFinite(hit)||hit<0)
   ||!target||!Number.isFinite(target.duration)||target.duration<=0||!Number.isFinite(target.combatDuration)||target.combatDuration<=0
   ||!Array.isArray(target.impacts)||target.impacts.some(hit=>!Number.isFinite(hit)||hit<0||hit>=target.duration)
   ||!Number.isInteger(branch.step)||branch.step<0||branch.step>3)
  throw Error('Invalid attack continuation from '+action.motionName+' to '+branch.clip+'. Check native time, target clip, combat duration, and step.');
 const at=branch.at/source.duration*action.duration;
 if(source.impacts.some(hit=>hit>=branch.at))throw Error('Attack continuation precedes the last authored impact: '+action.motionName);
 if(action.time>at+1e-9||action.time+dt<at-1e-9)return null;
 return{clip:branch.clip,step:branch.step,kind:queued.kind,at};
}

export function matchesContinuationBoundary(source,targetName,nativeTime){
 return Object.values(source?.continuations??{}).some(branch=>branch.clip===targetName&&Number.isFinite(branch.at)&&Math.abs(nativeTime-branch.at)<=1e-6);
}
