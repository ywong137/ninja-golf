// Two-hand closure. Each elbow equals the common hilt position plus
// its offset, derived from the weapon frame, grip frame and forearm rotation.
import {Vector3} from 'three';

function finiteVector(value,name){
 if(!value?.isVector3||![value.x,value.y,value.z].every(Number.isFinite))
  throw new TypeError(`${name} must be a finite THREE.Vector3.`);
 return value.clone();
}

/**
 * Find a common hilt position while preserving both upper-arm lengths.
 * orbitRadians chooses a point on the feasible circle relative to target.
 * Infeasible geometry returns a reason and gap; it never changes arm lengths.
 * This checks closure only, not joint limits, skin, grip contact or blade motion.
 */
export function closeSharedHilt({shoulders,upperArmLengths,elbowOffsets,target,orbitRadians=0}){
 if(!Number.isFinite(orbitRadians))throw new TypeError('orbitRadians must be finite.');
 const wanted=finiteVector(target,'target'),centers={},radii={};
 for(const side of ['r','l']){
  const radius=upperArmLengths?.[side];
  if(!Number.isFinite(radius)||radius<=0)throw new RangeError(`upperArmLengths.${side} must be positive metres.`);
  radii[side]=radius;
  centers[side]=finiteVector(shoulders?.[side],`shoulders.${side}`)
   .sub(finiteVector(elbowOffsets?.[side],`elbowOffsets.${side}`));
 }
 const axis=centers.l.clone().sub(centers.r),distance=axis.length();
 const minimum=Math.abs(radii.r-radii.l),maximum=radii.r+radii.l;
 const tolerance=1e-12*Math.max(1,maximum);
 if(distance>maximum+tolerance)return{feasible:false,reason:'separated',gap:distance-maximum};
 if(distance<minimum-tolerance)return{feasible:false,reason:'contained',gap:minimum-distance};
 if(distance<tolerance)throw new RangeError('The reach spheres coincide. Add a positional constraint before choosing an orbit.');
 axis.multiplyScalar(1/distance);
 const along=(radii.r*radii.r-radii.l*radii.l+distance*distance)/(2*distance);
 const center=centers.r.clone().addScaledVector(axis,along);
 // Only remove floating-point error at tangency. A disjoint pair was rejected.
 const radius=Math.sqrt(Math.max(0,radii.r*radii.r-along*along));
 const radial=wanted.clone().sub(center);radial.addScaledVector(axis,-radial.dot(axis));
 if(radial.lengthSq()<1e-20){
  // Choose the least parallel Cartesian axis when the target is on the axis.
  const components=[Math.abs(axis.x),Math.abs(axis.y),Math.abs(axis.z)];
  radial.set(0,0,0).setComponent(components.indexOf(Math.min(...components)),1);
  radial.addScaledVector(axis,-radial.dot(axis));
 }
 radial.normalize();
 const tangent=new Vector3().crossVectors(axis,radial);
 const position=center.clone().addScaledVector(radial,radius*Math.cos(orbitRadians))
  .addScaledVector(tangent,radius*Math.sin(orbitRadians));
 return{feasible:true,position,center,axis,radius};
}

/** Reject direction compromises independently of the fitter's weighted cost. */
export function measureBladeFrameError(actual,requested){
 const checked=(frame,name)=>{
  if(!frame?.isQuaternion||![frame.x,frame.y,frame.z,frame.w].every(Number.isFinite)||frame.lengthSq()<1e-20)
   throw new TypeError(`${name} must be a finite, nonzero THREE.Quaternion.`);
  return frame.clone().normalize();
 };
 const a=checked(actual,'actual'),b=checked(requested,'requested'),degrees=180/Math.PI;
 const difference=axis=>axis.clone().applyQuaternion(a).angleTo(axis.clone().applyQuaternion(b))*degrees;
 return{rotationDegrees:a.angleTo(b)*degrees,shaftDegrees:difference(new Vector3(0,1,0)),edgeDegrees:difference(new Vector3(1,0,0))};
}
