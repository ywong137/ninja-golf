import {MathUtils,Matrix4,Quaternion,Vector3} from 'three';
import {headingKnee} from '../src/knee-alignment.js';
export {gaitContactWeight} from '../src/source-gait-clock.js';
export {captureFootSoles as captureGaitSoles,sampleFootSole as sampleGaitSole} from '../src/foot-sole.js';

const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const frame=(direction,normal)=>{
 const x=direction.clone().normalize(),z=normal.clone().addScaledVector(x,-normal.dot(x)).normalize();
 if(x.lengthSq()<.99||z.lengthSq()<.99)throw Error('A gait contact needs a measurable source knee plane.');
 return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z));
};
function setRotation(b,q){b.quaternion.copy(rotation(b.parent).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}

/** Highest body offset that retains leg reach during contact release.
 * An unloaded foot follows the body until its sole reaches the floor.
 * These two branches must use the same clearance rule as the foot solve.
 */
export function gaitBodyOffsetCeiling({hipY,targetY,horizontal,upper,lower,pressure,soleGap},reserve=.00001){
 if(![hipY,targetY,horizontal,upper,lower,pressure,soleGap,reserve].every(Number.isFinite)
  ||upper<=0||lower<=0||horizontal<0||pressure<0||pressure>1||soleGap<-.000001||reserve<0)
  throw Error('Supply finite native leg dimensions, contact pressure, and nonnegative sole clearance.');
 if(pressure===0)return Infinity;
 const reach=upper+lower-reserve;
 if(horizontal>=reach)throw Error('The support target exceeds horizontal leg reach.');
 const verticalRoom=targetY+Math.sqrt(reach*reach-horizontal*horizontal)-hipY;
 return Math.max(verticalRoom/pressure,verticalRoom-soleGap);
}

/** Move the ankle while retaining the source bend plane and full bone roll.
 * A small terrain/contact correction must not replace the source joint frames.
 */
export function moveSourceGaitFoot(thigh,calf,foot,target,{hinge}={}){
 const hip=point(thigh),knee=point(calf),ankle=point(foot),upper=knee.clone().sub(hip),lower=ankle.clone().sub(knee);
 const upperQ=rotation(thigh),lowerQ=rotation(calf),shoe=rotation(foot),normal=upper.clone().cross(lower);
 // Near extension, segment roundoff cannot establish the knee's bend side.
 // The bind calibration remains defined even when both segments align.
 if(normal.lengthSq()<1e-12){
  if(!hinge?.hingeInThigh)throw Error('A straight gait knee requires its calibrated hinge.');
  normal.copy(hinge.hingeInThigh).applyQuaternion(upperQ);
 }
 normal.normalize();
 const axis=ankle.clone().sub(hip).normalize(),nextAxis=target.clone().sub(hip).normalize();
 if(normal.lengthSq()<.99)throw Error('Cannot correct a gait contact with an undefined source knee plane.');
 const bend=axis.clone().cross(normal).normalize().applyQuaternion(new Quaternion().setFromUnitVectors(axis,nextAxis));
 const u=upper.length(),l=lower.length(),distance=target.distanceTo(hip),reachable=MathUtils.clamp(distance,Math.abs(u-l)+1e-6,u+l-1e-6);
 const actual=hip.clone().addScaledVector(nextAxis,reachable),newKnee=headingKnee(hip,actual,u,l,bend);
 const newUpper=newKnee.clone().sub(hip),newLower=actual.clone().sub(newKnee),newNormal=newUpper.clone().cross(newLower).normalize();
 setRotation(thigh,frame(newUpper,newNormal).multiply(frame(upper,normal).invert()).multiply(upperQ));
 setRotation(calf,frame(newLower,newNormal).multiply(frame(lower,normal).invert()).multiply(lowerQ));
 setRotation(foot,shoe);
 return Math.abs(distance-reachable);
}
