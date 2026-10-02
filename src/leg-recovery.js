import {MathUtils,Quaternion} from 'three';
import {headingKnee} from './knee-alignment.js';
import {solveLeg} from './foot-placement.js';
import {alignLegHinge} from './leg-hinge.js';
import {blendLegPole,setFootWorldRotation} from './leg-pole.js';

// Smooth limits avoid a change in angular velocity when the shoe reaches its
// recovery range. These are authored motion choices, not medical limits.
const softPositive=(value,width)=>(value+Math.sqrt(value*value+width*width))*.5;
const softClamp=(value,lo,hi,width)=>lo+softPositive(value-lo,width)-softPositive(value-hi,width);
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();

// The source run supports the foot through phase .28. Return to the source
// shoe direction before the next contact; a planted shoe must not swivel.
export function recoveryWeight(phase,blend=1){
 const u=((phase%1)+1)%1;
 return MathUtils.smootherstep(u,.28,.44)*(1-MathUtils.smootherstep(u,.82,.98))*blend;
}

export function recoveryShoeRotation(thigh,calf,shoe,calibration,weight){
 const neutral=rotation(calf).multiply(calibration.footInCalf);
 const delta=shoe.clone().multiply(neutral.clone().invert()).normalize();
 const hinge=calibration.hinge.hingeInThigh.clone().applyQuaternion(rotation(thigh));
 const angle=2*Math.atan2(delta.x*hinge.x+delta.y*hinge.y+delta.z*hinge.z,delta.w);
 const pitch=Math.atan2(Math.sin(angle),Math.cos(angle));
 const pitchQ=new Quaternion().setFromAxisAngle(hinge,pitch);
 const residual=pitchQ.clone().invert().multiply(delta).normalize();
 const residualAngle=residual.angleTo(new Quaternion());
 residual.slerp(new Quaternion(),1-Math.pow(1+(residualAngle/(10*Math.PI/180))**4,-.25));
 const wanted=new Quaternion().setFromAxisAngle(hinge,softClamp(pitch,-25*Math.PI/180,35*Math.PI/180,7*Math.PI/180))
  .multiply(residual).multiply(neutral);
 return shoe.clone().slerp(wanted,weight);
}

export function solveRecoveryLeg(thigh,calf,foot,target,shoe,calibration,weight,{sourcePole=null,sourceWeight=sourcePole?1:0,sourceContinuity={},entryPole=null,entryWeight=1,entryContinuity={}}={}){
 if(!Number.isFinite(sourceWeight)||sourceWeight<0||sourceWeight>1)throw Error('Captured knee weight must be between zero and one.');
 if(!Number.isFinite(entryWeight)||entryWeight<0||entryWeight>1)throw Error('Knee transition weight must be between zero and one.');
 let kneeSolver;
 {
  const reference=rotation(thigh.parent).multiply(calibration.parent.clone().invert()).multiply(calibration.thigh);
  const normal=calibration.hinge.hingeInThigh.clone().applyQuaternion(reference);
  kneeSolver=(hip,ankle,upper,lower)=>{
   const axis=ankle.clone().sub(hip).normalize();
   const neutral=axis.clone().cross(normal).normalize();
   // A recovering shoe can cross vertical during a turn. Keep the anatomical
   // knee branch; the shoe must not reverse the calibrated thigh hinge.
   const bend=neutral;
   if(sourcePole&&sourceWeight>0){
    bend.copy(blendLegPole({axis,bend},sourcePole,axis,sourceWeight,sourceContinuity));
   }
   if(entryPole&&entryWeight<1){
    bend.copy(blendLegPole(entryPole,{axis,bend},axis,entryWeight,entryContinuity));
   }
   return headingKnee(hip,ankle,upper,lower,bend);
  };
 }
 const error=solveLeg(thigh,calf,foot,target,shoe,{maxReach:.999,kneeSolver});
 alignLegHinge(thigh,calf,foot,calibration.hinge);
 if(weight>1e-8){
  // An axial-only correction leaves the source shoe folded against the shin.
  // Let the free shoe follow the shin, with pitch and sideways rotation separate.
  const wanted=recoveryShoeRotation(thigh,calf,shoe,calibration,weight);
  setFootWorldRotation(foot,wanted);
 }else setFootWorldRotation(foot,shoe);
 return error;
}
