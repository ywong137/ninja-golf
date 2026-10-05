import {wrapAngle} from './navigation.js';

// Input expires in wall-clock seconds, independently of impact slow motion.
export const ATTACK_BUFFER_SECONDS=.32;
export function attackControlWindow(action){
 if(!action||action.kind==='musou')return {cancel:false,steer:false,recovery:false};
 const before=action.kind==='heavy'?.14:.10,after=action.kind==='heavy'?.12:.085;
 const committed=action.hits.some(hit=>action.time>=hit-before&&action.time<hit+after);
 return {cancel:!committed,steer:action.time<action.hits[0]-before,
  recovery:action.time>=action.hits.at(-1)+after};
}
export function movementRedirected(initial,current){
 const length=Math.hypot(current.x,current.z),previous=Math.hypot(initial.x,initial.z);
 if(length<.15)return false;
 return previous<.15||(initial.x*current.x+initial.z*current.z)/(length*previous)<Math.cos(Math.PI/3);
}
export function steerAttack(yaw,target,dt){
 const step=Math.max(-Math.PI*2*dt,Math.min(Math.PI*2*dt,wrapAngle(target-yaw)));
 return yaw+step;
}
export function swingSoundTimes(action){
 return action.hits.map(hit=>Math.max(0,hit-(action.kind==='light'?.13:.19)));
}
