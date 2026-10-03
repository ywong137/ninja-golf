import {MathUtils,Quaternion,Vector3} from 'three';

// Keep the elbow plane continuous when the source nearly straightens its arm.
// At full extension the cross product has no stable direction. Carry the last
// plane along the shoulder-to-wrist axis, then turn toward the new source plane.
export function stabilizeSourceArmPole({upper,lower,hand,state,dt,hinge,minFlexion=8,maxTurnRate=720}){
 if(!(dt>0&&Number.isFinite(dt))||!state)throw Error('Supply a positive step and one persistent arm state.');
 if(!Number.isFinite(minFlexion)||minFlexion<=0||minFlexion>=90||!Number.isFinite(maxTurnRate)||maxTurnRate<=0)throw Error('Use a positive turn rate and minimum flexion between 0 and 90 degrees.');
 const point=b=>b.getWorldPosition(new Vector3()),rotation=b=>b.getWorldQuaternion(new Quaternion());
 const shoulder=point(upper),elbow=point(lower),wrist=point(hand),handQ=rotation(hand);
 const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),axis=wrist.clone().sub(shoulder).normalize();
 let bend=elbow.clone().sub(shoulder);bend.addScaledVector(axis,-bend.dot(axis));
 if(bend.lengthSq()<1e-10)bend=hinge.clone().applyQuaternion(rotation(upper)).cross(axis);
 bend.normalize();
 if(state.axis){
  const carried=state.bend.clone().applyQuaternion(new Quaternion().setFromUnitVectors(state.axis,axis));
  carried.addScaledVector(axis,-carried.dot(axis)).normalize();
  const turn=Math.atan2(axis.dot(carried.clone().cross(bend)),carried.dot(bend));
  bend=carried.applyAxisAngle(axis,MathUtils.clamp(turn,-MathUtils.degToRad(maxTurnRate)*dt,MathUtils.degToRad(maxTurnRate)*dt));
 }
 const reach=Math.min(shoulder.distanceTo(wrist),Math.sqrt(a*a+b*b+2*a*b*Math.cos(MathUtils.degToRad(minFlexion))));
 const along=(a*a-b*b+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,a*a-along*along));
 const wantedElbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height),wantedWrist=shoulder.clone().addScaledVector(axis,reach);
 const setWorld=(bone,q)=>{bone.quaternion.copy(rotation(bone.parent).invert().multiply(q));bone.updateWorldMatrix(false,true);};
 setWorld(upper,new Quaternion().setFromUnitVectors(elbow.clone().sub(shoulder).normalize(),wantedElbow.clone().sub(shoulder).normalize()).multiply(rotation(upper)));
 const elbowNow=point(lower);
 setWorld(lower,new Quaternion().setFromUnitVectors(point(hand).sub(elbowNow).normalize(),wantedWrist.clone().sub(elbowNow).normalize()).multiply(rotation(lower)));
 setWorld(hand,handQ);state.axis=axis;state.bend=bend;
 return {wristCorrection:wantedWrist.distanceTo(wrist),elbowCorrection:wantedElbow.distanceTo(elbow)};
}
