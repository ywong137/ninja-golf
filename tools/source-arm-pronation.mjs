import {MathUtils,Vector3} from 'three';
import {captureArmPose} from '../src/arm-anatomy.js';
import {captureWristPose} from '../src/wrist-anatomy.js';

/** Palm rotation about the elbow-to-wrist line, independent of roll-bone layout. */
export function measurePalmPronation(calibration,armPose,handPose){
 const axis=armPose.wrist.clone().sub(armPose.elbow).normalize();
 const hinge=calibration.hingeAxisLocal.clone().applyQuaternion(armPose.upperArmQuaternion);
 const radial=handPose.indexKnuckle.clone().sub(handPose.pinkyKnuckle);
 const project=v=>v.addScaledVector(axis,-v.dot(axis));
 project(hinge);project(radial);
 if(axis.lengthSq()<.99||hinge.lengthSq()<1e-12||radial.lengthSq()<1e-12)throw Error('Cannot measure pronation from coincident or axial palm landmarks.');
 hinge.normalize();radial.normalize();
 return MathUtils.radToDeg(Math.atan2(axis.dot(new Vector3().crossVectors(hinge,radial)),hinge.dot(radial)));
}

export function capturePalmPronation(bones,side,calibration){
 return measurePalmPronation(calibration,captureArmPose(bones,side),captureWristPose(bones,side));
}
