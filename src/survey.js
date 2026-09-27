import {Vector3,MathUtils} from 'three';

// The initial view includes both ends of the shot, with room for the HUD.
export function createSurvey(ball,landing,fov,aspect){
 const span=Math.max(24,ball.distanceTo(landing)),target=ball.clone().lerp(landing,.5);
 const distance=Math.max(65,span/(2*Math.tan(fov*Math.PI/360)*Math.min(1,aspect*.65)))*1.35;
 return{target,distance,yaw:.12,pitch:1.05};
}
export function moveSurvey(view,input,dt,course){
 view.yaw-=input.lookX*.004;view.pitch=MathUtils.clamp(view.pitch+input.lookY*.003,.45,1.48);
 view.distance=MathUtils.clamp(view.distance*Math.exp(input.zoom*.001),35,850);
 const panScale=view.distance*.0013,move=input.move;
 const right=-input.panX*panScale+move.x*dt*view.distance*.35;
 const forward=input.panY*panScale+move.y*dt*view.distance*.35;
 view.target.x=MathUtils.clamp(view.target.x-Math.cos(view.yaw)*right+Math.sin(view.yaw)*forward,-230,200);
 view.target.z=MathUtils.clamp(view.target.z+Math.sin(view.yaw)*right+Math.cos(view.yaw)*forward,-80,course.length+100);
}
export function surveyPosition(view){
 const horizontal=Math.cos(view.pitch)*view.distance;
 return new Vector3(view.target.x-Math.sin(view.yaw)*horizontal,view.target.y+Math.sin(view.pitch)*view.distance,view.target.z-Math.cos(view.yaw)*horizontal);
}
