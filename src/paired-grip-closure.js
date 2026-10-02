import {Matrix4,Quaternion,Vector3} from 'three';
import {closeSharedHilt} from './shared-hilt-closure.js';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy,armAuthoringViolations} from './arm-anatomy.js';

const position=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
function frame(axis,normal){
 const x=axis.clone().normalize(),z=normal.clone().addScaledVector(x,-normal.dot(x)).normalize();
 if(x.lengthSq()<.99||z.lengthSq()<.99)throw Error('Paired grip closure requires a measurable elbow hinge.');
 return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z));
}
function setRotation(b,q){b.quaternion.copy(rotation(b.parent).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}

// Compatible two-hand clips can have different carry poses. A bone-by-bone
// blend does not preserve a closed grip. Solve the common handle translation,
// retaining both wrist bends, the complete handle frame, and native arm lengths.
export class PairedGripClosure{
 constructor(bones){
  this.bones=bones;this.frames={};this.calibration={};
  for(const side of ['r','l']){
   const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
   if(!upper||!lower||!hand)throw Error('Paired grip closure requires a complete arm chain: '+side);
   const axis=position(lower).sub(position(upper)),forearm=position(hand).sub(position(lower));
   this.frames[side]=frame(axis,axis.clone().cross(forearm)).invert().multiply(rotation(upper));
   this.calibration[side]=calibrateArmAnatomy(captureArmPose(bones,side));
  }
 }
 apply(profiles,spacing,scale){
  if(!Number.isFinite(spacing)||spacing===0||!Number.isFinite(scale)||scale<=0)throw Error('Paired grip closure requires finite spacing and a positive scale.');
  const {bones}=this,weapon=rotation(bones.hand_r).multiply(profiles.r.frame).normalize();
  const shaft=new Vector3(0,1,0).applyQuaternion(weapon),target=bones.hand_r.localToWorld(profiles.r.center.clone());
  const hands={},shoulders={},lengths={},elbowTarget=new Vector3();
  for(const side of ['r','l']){
   const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
   const handQ=weapon.clone().multiply(profiles[side].frame.clone().invert()).normalize(),wristQ=hand.quaternion.clone().normalize();
   const forearmQ=handQ.clone().multiply(wristQ.clone().invert()).normalize();
   const wristOffset=profiles[side].center.clone().multiply(hand.getWorldScale(new Vector3())).applyQuaternion(handQ).negate()
    .addScaledVector(shaft,side==='r'?0:-spacing*scale);
   const elbowOffset=wristOffset.clone().sub(hand.position.clone().multiply(lower.getWorldScale(new Vector3())).applyQuaternion(forearmQ));
   hands[side]={upper,lower,hand,handQ,forearmQ,wristQ,wristOffset,elbowOffset};
   shoulders[side]=position(upper);lengths[side]=position(lower).distanceTo(shoulders[side]);
   elbowTarget.add(position(lower).sub(elbowOffset).multiplyScalar(.5));
  }
  const args={shoulders,upperArmLengths:lengths,elbowOffsets:Object.fromEntries(['r','l'].map(s=>[s,hands[s].elbowOffset])),target:elbowTarget};
  const chest=rotation(bones.spine_03);
  const evaluate=orbitRadians=>{
   const closure=closeSharedHilt({...args,orbitRadians});
   if(!closure.feasible)return closure;
   const upperRotations={},measurements={};let valid=true;
   for(const side of ['r','l']){
    const h=hands[side],elbow=closure.position.clone().add(h.elbowOffset),wrist=closure.position.clone().add(h.wristOffset);
    const upper=elbow.clone().sub(shoulders[side]),forearm=wrist.clone().sub(elbow);
    upperRotations[side]=frame(upper,upper.clone().cross(forearm)).multiply(this.frames[side]);
    measurements[side]=measureArmAnatomy(this.calibration[side],{shoulder:shoulders[side],elbow,wrist,
     upperArmQuaternion:upperRotations[side],forearmQuaternion:h.forearmQ,chestQuaternion:chest});
    // Keep a small numerical margin inside the existing authoring bounds.
    valid&&=armAuthoringViolations(measurements[side],{maxHumeralRollDegrees:69.95,maxForearmTwistDegrees:69.95,maxHingeDeviationDegrees:.01}).length===0;
   }
   return {...closure,valid,upperRotations,measurements,orbitRadians};
  };
  let closure=evaluate(0);
  if(!closure.feasible)return {...closure,translation:Infinity};
  if(!closure.valid){
   // The reach circle leaves one shared degree of freedom. Find its nearest
   // admissible point instead of opening a hand or twisting a wrist further.
   const alternatives=[];
   for(const sign of [-1,1])for(let step=1;step<=15;step++){
    const angle=step*4*Math.PI/180,candidate=evaluate(sign*angle);
    if(!candidate.valid)continue;
    let lo=angle-4*Math.PI/180,hi=angle,best=candidate;
    for(let i=0;i<12;i++){
     const mid=(lo+hi)/2,trial=evaluate(sign*mid);
     if(trial.valid){hi=mid;best=trial;}else lo=mid;
    }
    alternatives.push(best);break;
   }
   if(!alternatives.length)return{feasible:false,reason:'No shared handle position satisfies the native arm limits.',translation:Infinity};
   closure=alternatives.sort((a,b)=>Math.abs(a.orbitRadians)-Math.abs(b.orbitRadians))[0];
  }
  for(const side of ['r','l']){
   const h=hands[side];setRotation(h.upper,closure.upperRotations[side]);setRotation(h.lower,h.forearmQ);
   h.hand.quaternion.copy(h.wristQ);h.hand.updateWorldMatrix(false,true);
  }
  return {feasible:true,translation:closure.position.distanceTo(target),orbitDegrees:closure.orbitRadians*180/Math.PI,measurements:closure.measurements};
 }
}
