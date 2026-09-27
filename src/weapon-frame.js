import {Matrix4,Quaternion,Vector3} from 'three';

const axisY=new Vector3(0,1,0),axisX=new Vector3(1,0,0);
const currentAxis=new Vector3(),crossAxis=new Vector3(),correction=new Quaternion();

// The shaft crosses the closed palm. The wrist-to-knuckle direction fixes its
// second axis, so the blade face follows the hand through downward strokes.
export function palmWeaponBasis(shaft,wristToKnuckle){
  const y=shaft.clone().normalize();
  const forward=wristToKnuckle.clone().addScaledVector(y,-wristToKnuckle.dot(y));
  if(forward.lengthSq()<1e-8)throw new Error('Weapon grip needs a knuckle direction perpendicular to its shaft.');
  forward.normalize();
  const x=new Vector3().crossVectors(forward,y).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,forward.negate()));
}

// Rotate the entire palm frame by the smallest swing needed to retain the
// authored shaft path. Do not reconstruct the frame from a fixed world axis.
export function alignWeaponShaft(rotation,target){
  currentAxis.copy(axisY).applyQuaternion(rotation);
  const dot=Math.max(-1,Math.min(1,currentAxis.dot(target)));
  if(dot<-1+1e-10){
    // A half-turn has no unique shortest axis. Keep the hand's transverse axis.
    crossAxis.copy(axisX).applyQuaternion(rotation);
    correction.setFromAxisAngle(crossAxis,Math.PI);
  }else{
    crossAxis.crossVectors(currentAxis,target);
    correction.set(crossAxis.x,crossAxis.y,crossAxis.z,1+dot).normalize();
  }
  return rotation.premultiply(correction).normalize();
}
