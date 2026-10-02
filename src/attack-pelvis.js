import {MathUtils,Quaternion,Vector3} from 'three';

const UP=new Vector3(0,1,0);
// These are animation limits, not medical limits. The 18-degree residual keeps
// the shared leg solve within its hip/ankle budget during wide moving cuts.
const YAW_LIMIT=MathUtils.degToRad(18),YAW_BAND=MathUtils.degToRad(4);

function relativeYaw(from,to,up){
 const q=to.clone().multiply(from.clone().invert()).normalize();
 const projected=q.x*up.x+q.y*up.y+q.z*up.z;
 if(Math.hypot(projected,q.w)<1e-10)return 0;
 const angle=2*Math.atan2(projected,q.w);
 return Math.atan2(Math.sin(angle),Math.cos(angle));
}

// Integrate smootherstep across a finite band. Value, speed, and acceleration
// stay continuous; outside the band this is exactly the required excess yaw.
function excessYaw(magnitude){
 const x=(magnitude-(YAW_LIMIT-YAW_BAND))/(2*YAW_BAND);
 if(x<=0)return 0;
 if(x>=1)return magnitude-YAW_LIMIT;
 return 2*YAW_BAND*(x**6-3*x**5+2.5*x**4);
}

export function blendAttackPelvis(authored,gait,{turnWeight,walkWeight,up=UP}){
 const rotation=authored.clone().slerp(gait,MathUtils.clamp(turnWeight,0,1)).normalize();
 const beforeYaw=relativeYaw(rotation,gait,up);
 const extraYaw=Math.sign(beforeYaw)*excessYaw(Math.abs(beforeYaw))*MathUtils.clamp(walkWeight,0,1)||0;
 // Additional correction changes heading only. Preserve the existing lean.
 if(extraYaw)rotation.premultiply(new Quaternion().setFromAxisAngle(up,extraYaw)).normalize();
 return {rotation,beforeYaw,extraYaw,afterYaw:relativeYaw(rotation,gait,up)};
}
