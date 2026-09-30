import {Quaternion,Vector3} from 'three';
import {calibrateLegHinge} from './leg-hinge.js';

const position=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();
const degrees=180/Math.PI;
const axialAngle=(delta,axis)=>{
 const angle=2*Math.atan2(delta.x*axis.x+delta.y*axis.y+delta.z*axis.z,delta.w);
 return Math.atan2(Math.sin(angle),Math.cos(angle))*degrees;
};

// Capture in the imported bind pose, before the animation mixer runs.
export function calibrateLegAnatomy(thigh,calf,foot){
 thigh.updateWorldMatrix(true,true);
 return{
  hinge:calibrateLegHinge(thigh,calf,foot),
  parent:rotation(thigh.parent),thigh:rotation(thigh),
  upper:position(calf).sub(position(thigh)).normalize(),
  footInCalf:rotation(calf).invert().multiply(rotation(foot)),
 };
}

// A correct knee hinge alone can conceal excessive twist at either end.
// Measure the actual frames, independently of an authoring solver's targets.
export function measureLegAnatomy(calibration,thigh,calf,foot){
 thigh.updateWorldMatrix(true,true);
 const upper=position(calf).sub(position(thigh)).normalize();
 const lower=position(foot).sub(position(calf)).normalize();
 const thighQ=rotation(thigh),hinge=calibration.hinge.hingeInThigh.clone().applyQuaternion(thighQ);
 const reference=rotation(thigh.parent).multiply(calibration.parent.clone().invert()).multiply(calibration.thigh);
 const referenceAxis=calibration.upper.clone().applyQuaternion(calibration.thigh.clone().invert()).applyQuaternion(reference);
 const minimumSwing=new Quaternion().setFromUnitVectors(referenceAxis,upper).multiply(reference);
 const hipDelta=thighQ.clone().multiply(minimumSwing.invert());
 const ankleDelta=rotation(foot).multiply(rotation(calf).multiply(calibration.footInCalf).invert());
 const anklePitch=axialAngle(ankleDelta,hinge);
 const offPitch=new Quaternion().setFromAxisAngle(hinge,-anklePitch/degrees).multiply(ankleDelta).normalize();
 return{
  kneeDeviation:Math.asin(Math.min(1,Math.abs(hinge.dot(lower))))*degrees,
  kneeFlexion:Math.atan2(hinge.dot(upper.clone().cross(lower)),upper.dot(lower))*degrees,
  hipTwist:axialAngle(hipDelta,upper),ankleTwist:axialAngle(ankleDelta,lower),
  anklePitch,ankleOffPitch:offPitch.angleTo(new Quaternion())*degrees,
 };
}
