import {Matrix4,Quaternion,Vector3} from 'three';

const point=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();
function frame(direction,normal){
 const x=direction.clone().normalize(),z=normal.clone().addScaledVector(x,-normal.dot(x)).normalize();
 if(x.lengthSq()<.99||z.lengthSq()<.99)throw Error('Cannot construct a knee frame from a straight or zero-length reference leg.');
 return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z));
}
function setWorld(bone,q){
 bone.quaternion.copy(rotation(bone.parent).invert().multiply(q)).normalize();
 bone.updateWorldMatrix(false,true);
}

/** Capture the native knee hinge before playing animations. */
export function calibrateLegHinge(thigh,calf,foot){
 thigh.updateWorldMatrix(true,true);
 const upper=point(calf).sub(point(thigh)).normalize(),lower=point(foot).sub(point(calf)).normalize();
 const normal=upper.clone().cross(lower).normalize(),upperQ=rotation(thigh),lowerQ=rotation(calf);
 return{
  frameToThigh:frame(upper,normal).invert().multiply(upperQ),
  calfInThigh:upperQ.clone().invert().multiply(lowerQ),
  hingeInThigh:normal.applyQuaternion(upperQ.clone().invert()),
  bindFlexion:upper.angleTo(lower),
 };
}

/** Preserve solved joint positions and the shoe rotation, while removing knee side-bend.
 * A direction-only IK solve can aim both segments correctly but leave the mesh
 * twisted across its native hinge. Rotate the complete bone frames together.
 */
export function alignLegHinge(thigh,calf,foot,calibration){
 if(!calibration?.frameToThigh)throw Error('Capture the native leg with calibrateLegHinge() before animation.');
 thigh.updateWorldMatrix(true,true);
 const upper=point(calf).sub(point(thigh)).normalize(),lower=point(foot).sub(point(calf)).normalize();
 const normal=upper.clone().cross(lower),shoe=rotation(foot);
 if(normal.lengthSq()<1e-12)normal.copy(calibration.hingeInThigh).applyQuaternion(rotation(thigh));
 normal.normalize();
 const upperQ=frame(upper,normal).multiply(calibration.frameToThigh);
 setWorld(thigh,upperQ);
 const lowerQ=new Quaternion().setFromAxisAngle(normal,upper.angleTo(lower)-calibration.bindFlexion)
  .multiply(upperQ).multiply(calibration.calfInThigh);
 setWorld(calf,lowerQ);setWorld(foot,shoe);
}
