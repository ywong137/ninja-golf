import {Quaternion,Vector3,MathUtils} from 'three';
import {captureLegPole,transportLegPole,solveLegWithPole} from './leg-pole.js';
import {measureLegAnatomy} from './leg-anatomy.js';

const radians=Math.PI/180;
const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const excess=(value,limit)=>Math.max(0,Math.abs(value)-limit);

// The ankle target fixes leg extension but leaves one knee-plane angle free.
// Use that angle to share twist between both joints after terrain has moved the
// pelvis. A supporting shoe remains an exact position-and-rotation constraint.
export function balanceLegJoints({thigh,calf,foot,calibration,contacts,surface,groundHeight,supported,state={}}){
 const original=measureLegAnatomy(calibration,thigh,calf,foot),target=point(foot),shoe=rotation(foot);
 const sole=surface?.points()??contacts;
 const gap=q=>Math.min(...sole.map(v=>{const p=v.clone().applyQuaternion(q).add(target);return p.y-groundHeight(p.x,p.z);}));
 const initialGap=gap(shoe),freedom=supported?0:MathUtils.smootherstep(initialGap,.025,.12);
 // Converge to the supporting bound before touchdown. Switching bounds on
 // the landing frame alone produces an abrupt knee turn at high frame rates.
 const hipLimit=27.5+5*freedom,ankleLimit=17.5,shoeBudget=6*freedom;
 const saved=[thigh,calf,foot].map(b=>b.quaternion.clone()),pole=captureLegPole(thigh,calf,foot,calibration.hinge);
 const previous=state.pole?transportLegPole(state.pole,pole.axis):pole.bend;
 const previousDegrees=Math.atan2(pole.axis.dot(pole.bend.clone().cross(previous)),MathUtils.clamp(pole.bend.dot(previous),-1,1))/radians;
 const correctionNeed=Math.max(excess(original.hipTwist,hipLimit),excess(original.ankleTwist,ankleLimit+shoeBudget));
 const continuityWeight=.008*MathUtils.smoothstep(correctionNeed,0,4);
 let evaluations=0;
 const restore=()=>{[thigh,calf,foot].forEach((b,i)=>b.quaternion.copy(saved[i]));thigh.updateWorldMatrix(true,true);};
 // First keep both joints within the outer working range. A softer hip
 // preference must not spend the remaining ankle range merely to look closer
 // to neutral. The limits do not switch when support begins.
 const cost=(a,degrees)=>1000*(excess(a.hipTwist,35)**2+excess(a.ankleTwist,20+shoeBudget)**2)
  +excess(a.hipTwist,hipLimit)**2+excess(a.ankleTwist,ankleLimit+shoeBudget)**2
  +.01*degrees**2+continuityWeight*(degrees-previousDegrees)**2;
 const evaluate=degrees=>{
  restore();evaluations++;
  solveLegWithPole(thigh,calf,foot,target,shoe,calibration.hinge,{axis:pole.axis,bend:pole.bend.clone().applyAxisAngle(pole.axis,degrees*radians)});
  const anatomy=measureLegAnatomy(calibration,thigh,calf,foot);
  return{degrees,cost:cost(anatomy,degrees),anatomy};
 };
 let best={degrees:0,cost:cost(original,0),anatomy:original};
 if(correctionNeed){
  // Search a local interval only. A distant branch could flip the knee despite
  // satisfying the scalar twist checks. Coarse samples bracket the local basin.
  const samples=[best,...[-24,-16,-8,8,16,24].map(evaluate)].sort((a,b)=>a.degrees-b.degrees);
  best=samples.reduce((a,b)=>a.cost<=b.cost?a:b);
  const index=samples.indexOf(best);let lo=samples[Math.max(0,index-1)].degrees,hi=samples[Math.min(samples.length-1,index+1)].degrees;
  const ratio=(Math.sqrt(5)-1)/2;
  let a=evaluate(hi-ratio*(hi-lo)),b=evaluate(lo+ratio*(hi-lo));
  for(let i=0;i<8;i++){
   if(a.cost<b.cost){hi=b.degrees;b=a;a=evaluate(hi-ratio*(hi-lo));}
   else{lo=a.degrees;a=b;b=evaluate(lo+ratio*(hi-lo));}
  }
  for(const candidate of [a,b])if(candidate.cost<best.cost)best=candidate;
 }
 restore();
 if(Math.abs(best.degrees)>1e-6)solveLegWithPole(thigh,calf,foot,target,shoe,calibration.hinge,{axis:pole.axis,bend:pole.bend.clone().applyAxisAngle(pole.axis,best.degrees*radians)});
 let shoeDegrees=MathUtils.clamp(MathUtils.clamp(best.anatomy.ankleTwist,-ankleLimit,ankleLimit)-best.anatomy.ankleTwist,-shoeBudget,shoeBudget);
 if(Math.abs(shoeDegrees)>1e-6){
  const axis=point(foot).sub(point(calf)).normalize(),changed=degrees=>new Quaternion().setFromAxisAngle(axis,degrees*radians).multiply(shoe);
  // A small free-ankle relaxation may lower a toe or heel contact probe.
  // Reduce it if those probes lose clearance; never translate support.
  if(gap(changed(shoeDegrees))<Math.min(.005,initialGap)){
   let lo=0,hi=1;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(gap(changed(shoeDegrees*mid))>=Math.min(.005,initialGap))lo=mid;else hi=mid;}shoeDegrees*=lo;
  }
  foot.quaternion.copy(rotation(foot.parent).invert().multiply(changed(shoeDegrees))).normalize();foot.updateWorldMatrix(false,true);
 }
 state.pole=captureLegPole(thigh,calf,foot,calibration.hinge);
 const final=measureLegAnatomy(calibration,thigh,calf,foot),actual=point(foot),actualQ=rotation(foot);
 return{before:original,after:final,planeDegrees:best.degrees,shoeDegrees,supported,evaluations,
  targetError:actual.distanceTo(target),shoeError:actualQ.angleTo(shoe)/radians,minimumGap:gap(actualQ)};
}

export class LegJointBalance{
 constructor(bones,anatomy,contacts){this.bones=bones;this.anatomy=anatomy;this.contacts=contacts;this.owner=null;this.states={};this.report=null;}
 apply(owner,contactWeights,groundHeight){
  if(!owner||!groundHeight){this.owner=null;this.states={};this.report=null;return;}
  if(owner!==this.owner){this.owner=owner;this.states={r:{},l:{}};}
  this.report=['r','l'].map(side=>({side,...balanceLegJoints({thigh:this.bones['thigh_'+side],calf:this.bones['calf_'+side],foot:this.bones['foot_'+side],
   calibration:this.anatomy[side],contacts:this.contacts[side].contacts,surface:this.contacts[side].surface,groundHeight,supported:(contactWeights?.[side]??0)>.05,state:this.states[side]})}));
 }
}
