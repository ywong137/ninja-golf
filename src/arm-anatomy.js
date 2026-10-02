// Native arm measurements use the bind rig's signed hinge and rotation frames.
// These bounds constrain this authoring task. They are not universal human limits.
import {Quaternion,Vector3} from 'three';

const DEGREES=180/Math.PI;
const EPSILON=1e-10;
export const ARM_AUTHORING_BOUNDS=Object.freeze({
 minFlexionDegrees:0,
 maxFlexionDegrees:130,
 maxHumeralRollDegrees:70,
 maxForearmTwistDegrees:70,
});

function vector(value,label){
 if(!value?.isVector3||![value.x,value.y,value.z].every(Number.isFinite))
  throw new TypeError(`${label} must be a finite THREE.Vector3.`);
 return value.clone();
}

function quaternion(value,label){
 if(!value?.isQuaternion||![value.x,value.y,value.z,value.w].every(Number.isFinite)||value.lengthSq()<EPSILON)
  throw new TypeError(`${label} must be a finite, nonzero THREE.Quaternion.`);
 return value.clone().normalize();
}

function normalized(value,label){
 if(value.lengthSq()<EPSILON)throw new Error(`${label} is degenerate. Check the arm joint positions.`);
 return value.normalize();
}

function poseFrame(pose){
 if(!pose)throw new TypeError('Supply an arm pose. Use captureArmPose() for native bones.');
 const shoulder=vector(pose.shoulder,'shoulder');
 const elbow=vector(pose.elbow,'elbow');
 const wrist=vector(pose.wrist,'wrist');
 return{
  upper:normalized(elbow.clone().sub(shoulder),'Upper-arm segment'),
  forearm:normalized(wrist.clone().sub(elbow),'Forearm segment'),
  upperArmQuaternion:quaternion(pose.upperArmQuaternion,'upperArmQuaternion'),
  forearmQuaternion:quaternion(pose.forearmQuaternion,'forearmQuaternion'),
  chestQuaternion:quaternion(pose.chestQuaternion,'chestQuaternion'),
 };
}

function signedAngle(from,to,axis){
 const projectedFrom=normalized(from.clone().addScaledVector(axis,-from.dot(axis)),'Hinge reference');
 const projectedTo=normalized(to.clone().addScaledVector(axis,-to.dot(axis)),'Forearm hinge projection');
 return Math.atan2(axis.dot(projectedFrom.clone().cross(projectedTo)),projectedFrom.dot(projectedTo));
}

function axialAngle(rotation,axis){
 // Project the quaternion vector onto the axis to separate twist from swing.
 const projected=rotation.x*axis.x+rotation.y*axis.y+rotation.z*axis.z;
 if(projected*projected+rotation.w*rotation.w<EPSILON)
  throw new Error('Axial rotation is undefined at a 180-degree perpendicular swing. Check the arm frame.');
 let angle=2*Math.atan2(projected,rotation.w);
 while(angle>Math.PI)angle-=2*Math.PI;
 while(angle<=-Math.PI)angle+=2*Math.PI;
 return angle;
}

/** Capture world positions and rotations without retaining live bone references. */
export function captureArmPose(bones,side,{chest='spine_03'}={}){
 if(!['r','l'].includes(side))throw new Error('Choose arm side "r" or "l".');
 const bone=name=>{
  const result=bones?.[name];
  if(!result?.isObject3D)throw new Error(`Missing native bone ${name}.`);
  result.updateWorldMatrix(true,false);
  return result;
 };
 const upper=bone('upperarm_'+side),lower=bone('lowerarm_'+side),hand=bone('hand_'+side),torso=bone(chest);
 return{
  shoulder:upper.getWorldPosition(new Vector3()),
  elbow:lower.getWorldPosition(new Vector3()),
  wrist:hand.getWorldPosition(new Vector3()),
  upperArmQuaternion:upper.getWorldQuaternion(new Quaternion()),
  forearmQuaternion:lower.getWorldQuaternion(new Quaternion()),
  chestQuaternion:torso.getWorldQuaternion(new Quaternion()),
 };
}

/**
 * Capture calibration before playing animation clips.
 * A straight bind arm needs an explicit signed hingeAxisLocal in the upper-arm frame.
 */
export function calibrateArmAnatomy(bindPose,{hingeAxisLocal}={}){
 const bind=poseFrame(bindPose),inverseUpper=bind.upperArmQuaternion.clone().invert();
 let hinge;
 if(hingeAxisLocal){
  hinge=normalized(vector(hingeAxisLocal,'hingeAxisLocal'),'Native hinge axis')
   .applyQuaternion(bind.upperArmQuaternion);
 }else{
  hinge=bind.upper.clone().cross(bind.forearm);
  if(hinge.lengthSq()<EPSILON)
   throw new Error('The bind arm is straight. Supply its signed hingeAxisLocal instead of inferring a bend plane.');
  hinge.normalize();
 }
 if(Math.abs(hinge.dot(bind.upper))>1e-5)
  throw new Error('hingeAxisLocal must be perpendicular to the native upper-arm segment.');
 const bindFlexion=signedAngle(bind.upper,bind.forearm,hinge);
 if(bindFlexion<-1e-7)throw new Error('The supplied hinge sign opposes the bind bend. Use the positive native flexion direction.');
 return{
  hingeAxisLocal:hinge.clone().applyQuaternion(inverseUpper),
  upperAxisLocal:bind.upper.clone().applyQuaternion(inverseUpper),
  forearmAxisLocal:bind.forearm.clone().applyQuaternion(bind.forearmQuaternion.clone().invert()),
  bindUpperArmQuaternion:bind.upperArmQuaternion,
  bindForearmQuaternion:bind.forearmQuaternion,
  bindChestQuaternion:bind.chestQuaternion,
  bindFlexionRadians:bindFlexion,
  bindFlexionDegrees:bindFlexion*DEGREES,
 };
}

/** All returned angles use degrees. Measurements do not certify visual quality. */
export function measureArmAnatomy(calibration,pose){
 if(!calibration?.hingeAxisLocal)throw new TypeError('Supply bind calibration from calibrateArmAnatomy().');
 const current=poseFrame(pose);
 const hinge=calibration.hingeAxisLocal.clone().applyQuaternion(current.upperArmQuaternion).normalize();
 const flexion=signedAngle(current.upper,current.forearm,hinge);
 const deviation=Math.asin(Math.min(1,Math.abs(current.forearm.dot(hinge))));

 // Transport the native upper arm with the chest, then use the shortest aiming swing.
 const chestDelta=current.chestQuaternion.clone().multiply(calibration.bindChestQuaternion.clone().invert());
 const transportedUpper=chestDelta.multiply(calibration.bindUpperArmQuaternion);
 const transportedDirection=calibration.upperAxisLocal.clone().applyQuaternion(transportedUpper);
 const upperSwing=new Quaternion().setFromUnitVectors(transportedDirection,current.upper);
 const minimumUpper=upperSwing.multiply(transportedUpper);
 const upperDelta=current.upperArmQuaternion.clone().multiply(minimumUpper.invert());
 const humeralRoll=axialAngle(upperDelta,current.upper);

 // Keep the native forearm frame, then change only signed hinge flexion.
 const nativeRelative=calibration.bindUpperArmQuaternion.clone().invert().multiply(calibration.bindForearmQuaternion);
 const noTwist=current.upperArmQuaternion.clone().multiply(nativeRelative);
 const hingeChange=new Quaternion().setFromAxisAngle(hinge,flexion-calibration.bindFlexionRadians);
 noTwist.premultiply(hingeChange);
 // Separate off-hinge aiming from axial twist. Report that aiming as deviation.
 const predictedDirection=calibration.forearmAxisLocal.clone().applyQuaternion(noTwist);
 noTwist.premultiply(new Quaternion().setFromUnitVectors(predictedDirection,current.forearm));
 const forearmDelta=current.forearmQuaternion.clone().multiply(noTwist.invert());
 const forearmTwist=axialAngle(forearmDelta,current.forearm);

 return{
  signedFlexionDegrees:flexion*DEGREES,
  humeralRollDegrees:humeralRoll*DEGREES,
  forearmTwistDegrees:forearmTwist*DEGREES,
  hingeDeviationDegrees:deviation*DEGREES,
 };
}

/**
 * Return actionable task-bound violations. Add maxHingeDeviationDegrees when needed.
 * The default limits constrain flexion and axial rotation, not anatomical capability.
 */
export function armAuthoringViolations(measurement,bounds={}){
 const limits={...ARM_AUTHORING_BOUNDS,...bounds},violations=[];
 const rules=[
  ['signedFlexionDegrees','minFlexionDegrees',false,'minimum'],
  ['signedFlexionDegrees','maxFlexionDegrees',false,'maximum'],
  ['humeralRollDegrees','maxHumeralRollDegrees',true,'maximum'],
  ['forearmTwistDegrees','maxForearmTwistDegrees',true,'maximum'],
 ];
 if(limits.maxHingeDeviationDegrees!==undefined)
  rules.push(['hingeDeviationDegrees','maxHingeDeviationDegrees',true,'maximum']);
 for(const [metric,bound,absolute,comparison]of rules){
  const value=measurement?.[metric],limit=limits[bound];
  if(!Number.isFinite(value))throw new TypeError(`${metric} must be finite.`);
  if(!Number.isFinite(limit))throw new TypeError(`${bound} must be finite.`);
  const compared=absolute?Math.abs(value):value;
  const exceeded=comparison==='minimum'?compared<limit-1e-7:compared>limit+1e-7;
  if(exceeded)violations.push({metric,value,limit,comparison,
   message:`${metric} is ${value.toFixed(2)} degrees; authoring ${absolute?'absolute ':''}${comparison} is ${limit.toFixed(2)} degrees.`});
 }
 return violations;
}
