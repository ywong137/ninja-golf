import {Quaternion,Vector3,MathUtils} from 'three';
import {headingKnee} from './knee-alignment.js';
import {solveLeg} from './foot-placement.js';
import {alignLegHinge} from './leg-hinge.js';

const point=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();

// Store the geometric bend plane independently of the foot's orientation.
// A folded recovery foot can face backward while its knee still bends forward.
export function captureLegPole(thigh,calf,foot,hinge){
 const hip=point(thigh),axis=point(foot).sub(hip).normalize();
 const bend=point(calf).sub(hip);bend.addScaledVector(axis,-bend.dot(axis));
 if(bend.lengthSq()<1e-8){
  const normal=hinge.hingeInThigh.clone().applyQuaternion(rotation(thigh));
  bend.copy(axis).cross(normal);
 }
 if(axis.lengthSq()<.99||bend.lengthSq()<1e-12)throw Error('Cannot capture the knee plane: leg has no usable length or hinge.');
 return{axis,bend:bend.normalize()};
}

// Parallel transport avoids interpreting a moving hip-to-ankle axis as a twist.
// The antipodal case retains the old bend instead of choosing an arbitrary axis.
export function transportLegPole(pole,axis){
 const next=axis.clone().normalize();
 if(next.lengthSq()<.99)throw Error('Cannot transport the knee plane to a zero-length leg.');
 const turn=pole.axis.dot(next)<-1+1e-8
  ?new Quaternion().setFromAxisAngle(pole.bend,Math.PI)
  :new Quaternion().setFromUnitVectors(pole.axis,next);
 const bend=pole.bend.clone().applyQuaternion(turn);
 return bend.addScaledVector(next,-bend.dot(next)).normalize();
}

export function blendLegPole(from,to,axis,weight,continuity){
 if(!continuity)throw Error('Knee-plane blending needs a persistent continuity object for the transition.');
 const a=transportLegPole(from,axis),b=transportLegPole(to,axis),normal=axis.clone().normalize();
 let angle=Math.atan2(normal.dot(a.clone().cross(b)),MathUtils.clamp(a.dot(b),-1,1));
 // Keep the same turn direction when an animated target crosses the antipode.
 // Choosing the shortest signed angle independently would reverse mid-blend.
 if(Number.isFinite(continuity.angle))angle=continuity.angle+Math.atan2(Math.sin(angle-continuity.angle),Math.cos(angle-continuity.angle));
 continuity.angle=angle;
 return a.applyAxisAngle(normal,angle*MathUtils.clamp(weight,0,1));
}

export function solveLegWithPole(thigh,calf,foot,target,shoe,hinge,pole){
 const axis=target.clone().sub(point(thigh)).normalize(),bend=transportLegPole(pole,axis);
 const error=solveLeg(thigh,calf,foot,target,shoe,{maxReach:.999,
  kneeSolver:(hip,ankle,upper,lower)=>headingKnee(hip,ankle,upper,lower,bend)});
 alignLegHinge(thigh,calf,foot,hinge);
 return error;
}
