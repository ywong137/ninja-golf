import {Vector3} from 'three';

const UP=new Vector3(0,1,0);

// The knee lies on the intersection circle of the two rigid leg segments.
// Select its forward point in the ankle/toe plane, never an actor-origin pole.
export function alignedKnee(hip,ankle,upper,lower,forward,medialAllowance=0){
 const axis=ankle.clone().sub(hip),distance=Math.max(1e-8,axis.length());axis.multiplyScalar(1/distance);
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
 const center=hip.clone().addScaledVector(axis,along),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
 const normal=UP.clone().cross(forward).normalize();
 // Offset the tracking plane toward the hip only for a nearly straight leg.
 const offset=Math.sign(hip.clone().sub(ankle).dot(normal))*medialAllowance;
 const lateral=normal.clone().addScaledVector(axis,-normal.dot(axis)),length=lateral.length();
 if(radius<1e-8||length<1e-8)return center;
 lateral.multiplyScalar(1/length);
 const required=(offset-center.clone().sub(ankle).dot(normal))/(radius*length);
 // Keep a small forward component at the feasibility boundary. Without it,
 // square-root tangencies produce an abrupt knee turn between sampled frames.
 const side=Math.abs(required)>2?Math.sign(required)*.995:required/Math.pow(1+Math.pow(Math.abs(required)/.995,16),1/16);
 const tangent=new Vector3().crossVectors(axis,lateral).normalize();
 if(tangent.dot(forward)<0)tangent.negate();
 return center.addScaledVector(lateral,radius*side).addScaledVector(tangent,radius*Math.sqrt(1-side*side));
}

export function footForward(foot,rotation){
 const toe=foot.children.find(child=>/^ball_[rl]$/.test(child.name));
 if(!toe)throw Error(`Missing toe bone beneath ${foot.name}`);
 const forward=toe.position.clone().applyQuaternion(rotation).setY(0);
 // During a vertical toe-off, use the shoe's transverse axis for its heading.
 if(forward.lengthSq()<1e-10)forward.copy(new Vector3(1,0,0).applyQuaternion(rotation).cross(UP)).setY(0);
 return forward.normalize();
}

// During running, the hip can lie outside the shoe's vertical plane. Keep the
// knee bend directed along the shoe instead of twisting the hip to reach that
// plane. Both rigid segment lengths still define the same knee-circle radius.
export function headingKnee(hip,ankle,upper,lower,forward,bendOffset=0){
 const axis=ankle.clone().sub(hip),distance=Math.max(1e-8,axis.length());axis.multiplyScalar(1/distance);
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
 const center=hip.clone().addScaledVector(axis,along),radius=Math.sqrt(Math.max(0,upper*upper-along*along));
 const bend=forward.clone().addScaledVector(axis,-forward.dot(axis));
 if(radius<1e-8||bend.lengthSq()<1e-8)return alignedKnee(hip,ankle,upper,lower,forward);
 return center.addScaledVector(bend.normalize().applyAxisAngle(axis,bendOffset),radius);
}

// Retain an authored knee plane when terrain changes the ankle target.
export function kneeBendOffset(hip,knee,ankle,forward){
 const upper=knee.distanceTo(hip),lower=ankle.distanceTo(knee);
 const axis=ankle.clone().sub(hip).normalize();
 const center=hip.clone().addScaledVector(axis,knee.clone().sub(hip).dot(axis));
 const source=knee.clone().sub(center),reference=headingKnee(hip,ankle,upper,lower,forward).sub(center);
 if(source.lengthSq()<1e-10||reference.lengthSq()<1e-10)return 0;
 source.normalize();reference.normalize();
 return Math.atan2(axis.dot(reference.clone().cross(source)),reference.dot(source));
}
