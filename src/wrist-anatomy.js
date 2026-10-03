import {Euler,Matrix4,Quaternion,Vector3} from 'three';

const D=Math.PI/180;
function vector(value,label){
 if(!value?.isVector3||!value.toArray().every(Number.isFinite))throw Error(label+' must be a finite Vector3.');
 return value.clone();
}
function rotation(value,label){
 if(!value?.isQuaternion||!value.toArray().every(Number.isFinite)||value.lengthSq()<1e-12)throw Error(label+' must be a finite nonzero Quaternion.');
 return value.clone().normalize();
}
function unit(value,label){
 if(value.lengthSq()<1e-12)throw Error(label+' is degenerate. Supply distinct native wrist and knuckle landmarks.');
 return value.normalize();
}

/** Capture the native hand before posing fingers or playing animation. */
export function captureWristPose(bones,side){
 if(!['r','l'].includes(side))throw Error('Choose wrist side r or l.');
 const bone=name=>{
  const value=bones?.[name+'_'+side];
  if(!value?.isBone)throw Error('Missing native wrist landmark '+name+'_'+side+'.');
  value.updateWorldMatrix(true,false);return value;
 };
 const hand=bone('hand'),lower=bone('lowerarm');
 return{
  side,wrist:hand.getWorldPosition(new Vector3()),forearm:lower.getWorldPosition(new Vector3()),
  indexKnuckle:bone('index_01').getWorldPosition(new Vector3()),
  middleKnuckle:bone('middle_01').getWorldPosition(new Vector3()),
  pinkyKnuckle:bone('pinky_01').getWorldPosition(new Vector3()),
  handQuaternion:hand.getWorldQuaternion(new Quaternion()),
  forearmQuaternion:lower.getWorldQuaternion(new Quaternion()),
 };
}

/**
 * Calibrate from visible hand landmarks, not imported bone-local X/Y/Z.
 * Zero means this reference hand. It is not a clinical anatomical zero.
 * Positive flexion bends toward the palm. Positive deviation bends toward
 * the little finger. Positive axial twist follows the distal hand axis.
 */
export function calibrateWristAnatomy(pose){
 if(!['r','l'].includes(pose?.side))throw Error('The wrist reference requires side r or l.');
 const wrist=vector(pose.wrist,'wrist'),forearm=vector(pose.forearm,'forearm');
 const longitudinal=unit(vector(pose.middleKnuckle,'middleKnuckle').sub(wrist),'Hand longitudinal axis');
 const radial=vector(pose.indexKnuckle,'indexKnuckle').sub(vector(pose.pinkyKnuckle,'pinkyKnuckle'));
 radial.addScaledVector(longitudinal,-radial.dot(longitudinal));unit(radial,'Hand radial axis');
 const flexion=radial.clone().multiplyScalar(pose.side==='r'?1:-1);
 const ulnar=radial.clone().cross(longitudinal).normalize();
 const third=flexion.clone().cross(ulnar).normalize();
 const hand=rotation(pose.handQuaternion,'handQuaternion'),lower=rotation(pose.forearmQuaternion,'forearmQuaternion');
 const worldBasis=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(flexion,ulnar,third));
 return{
  side:pose.side,reference:'native hand landmarks',
  basisInHand:hand.clone().invert().multiply(worldBasis).normalize(),
  referenceHandInForearm:lower.clone().invert().multiply(hand).normalize(),
  axialSign:Math.sign(third.dot(longitudinal)),
  referenceLongitudinalOffsetDegrees:unit(wrist.clone().sub(forearm),'Forearm longitudinal axis').angleTo(longitudinal)/D,
 };
}

function calibration(c){
 if(!c?.basisInHand?.isQuaternion||!c.referenceHandInForearm?.isQuaternion||![1,-1].includes(c.axialSign))throw Error('Supply calibration from calibrateWristAnatomy().');
 return c;
}
function angles(values){
 for(const key of ['flexionDegrees','ulnarDeviationDegrees','axialTwistDegrees'])
  if(!Number.isFinite(values[key]))throw Error(key+' must be finite.');
 // The documented decomposition uses the nonsingular XYZ branch.
 if(Math.abs(values.ulnarDeviationDegrees)>=89)throw Error('Keep wrist deviation below 89 degrees; this wrist frame becomes singular at 90 degrees.');
 if(Math.abs(values.flexionDegrees)>=180||Math.abs(values.axialTwistDegrees)>=180)throw Error('Keep wrist flexion and axial twist within the principal range below 180 degrees.');
}

/** Intrinsic flexion, deviation, then axial twist; returns the local hand rotation. */
export function wristRotationFromAngles(c,{flexionDegrees=0,ulnarDeviationDegrees=0,axialTwistDegrees=0}={}){
 calibration(c);angles({flexionDegrees,ulnarDeviationDegrees,axialTwistDegrees});
 const delta=new Quaternion().setFromEuler(new Euler(flexionDegrees*D,ulnarDeviationDegrees*D,axialTwistDegrees*c.axialSign*D,'XYZ'));
 return c.referenceHandInForearm.clone().multiply(c.basisInHand).multiply(delta).multiply(c.basisInHand.clone().invert()).normalize();
}

/** Forearm pronation and whole-body turns cancel out of this measurement. */
export function measureWristAnatomy(c,pose){
 calibration(c);
 const hand=rotation(pose?.handQuaternion,'handQuaternion'),lower=rotation(pose?.forearmQuaternion,'forearmQuaternion');
 const local=lower.invert().multiply(hand),delta=c.referenceHandInForearm.clone().invert().multiply(local);
 const canonical=c.basisInHand.clone().invert().multiply(delta).multiply(c.basisInHand).normalize();
 const e=new Euler().setFromQuaternion(canonical,'XYZ');
 if(Math.abs(e.y/D)>=89)throw Error('The posed wrist is outside the nonsingular deviation range.');
 return{flexionDegrees:e.x/D,ulnarDeviationDegrees:e.y/D,axialTwistDegrees:e.z/D*c.axialSign,totalDegrees:delta.angleTo(new Quaternion())/D};
}

/** Require explicit authoring ranges; do not infer human limits from a bind pose. */
export function wristAuthoringViolations(measurement,limits){
 const rules=[['flexionDegrees','minFlexionDegrees','minimum'],['flexionDegrees','maxFlexionDegrees','maximum'],['ulnarDeviationDegrees','minUlnarDeviationDegrees','minimum'],['ulnarDeviationDegrees','maxUlnarDeviationDegrees','maximum'],['axialTwistDegrees','maxAxialTwistDegrees','absolute maximum']];
 for(const [metric,key]of rules)if(!Number.isFinite(measurement?.[metric])||!Number.isFinite(limits?.[key]))throw Error('Supply finite '+metric+' and '+key+'.');
 if(limits.minFlexionDegrees>limits.maxFlexionDegrees||limits.minUlnarDeviationDegrees>limits.maxUlnarDeviationDegrees||limits.maxAxialTwistDegrees<0)throw Error('Wrist authoring ranges are reversed or have a negative axial limit.');
 const violations=[];
 for(const [metric,key,comparison]of rules){
  const value=measurement[metric],limit=limits[key],v=comparison==='absolute maximum'?Math.abs(value):value;
  if(comparison==='minimum'?v<limit-1e-7:v>limit+1e-7)violations.push({metric,value,limit,comparison});
 }
 return violations;
}
