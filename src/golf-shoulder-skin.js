// A shared lead-shoulder correction for takeaway, delivery and release. Joint transforms,
// hand targets and the club path stay in the authored animation.
const ramp=(time,start,end)=>{
 const x=Math.min(1,Math.max(0,(time-start)/(end-start)));
 return x*x*x*(10+x*(-15+6*x));
};
export function golfShoulderSkinWeight(time,actionWeight=1){
 if(!Number.isFinite(time)||!Number.isFinite(actionWeight)||actionWeight<0||actionWeight>1)
  throw new Error('Supply a finite clip time and an action weight between zero and one.');
 const takeaway=ramp(time,.30,.65)*(1-ramp(time,1.08,1.25));
 const release=ramp(time,1.26,1.44)*(1-ramp(time,1.55,1.82));
 return actionWeight*Math.max(takeaway,release);
}

// Start at the address value; release the cap correction before impact.
export function golfShoulderSwingWeight(time,actionWeight=1){
 if(!Number.isFinite(time)||!Number.isFinite(actionWeight)||actionWeight<0||actionWeight>1)
  throw new Error('Supply a finite clip time and an action weight between zero and one.');
 return actionWeight*(1-ramp(time,.95,1.30));
}
