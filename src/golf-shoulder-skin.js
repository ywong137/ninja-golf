// A local skin correction for the Ace's delivery and release. Joint transforms,
// hand targets and the club path stay in the authored animation.
const ramp=(time,start,end)=>{
 const x=Math.min(1,Math.max(0,(time-start)/(end-start)));
 return x*x*x*(10+x*(-15+6*x));
};
export function golfShoulderSkinWeight(time,actionWeight=1){
 if(!Number.isFinite(time)||!Number.isFinite(actionWeight)||actionWeight<0||actionWeight>1)
  throw new Error('Supply a finite clip time and an action weight between zero and one.');
 return actionWeight*ramp(time,1.26,1.44)*(1-ramp(time,1.55,1.82));
}
