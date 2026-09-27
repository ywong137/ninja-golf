import {heightAt,lieAt} from './course.js';

// Building surfaces are solid but do not become playable terrain.
export function resolveBuildingBall(collision,before,position,velocity){
 const hit=collision?.sweepSphere(before,position,.13,true);
 if(!hit)return null;
 const n=hit.normal,inward=-(velocity.x*n.x+velocity.y*n.y+velocity.z*n.z);
 // A ball can start exactly on a surface after the previous bounce.
 if(inward<=1e-7)return null;
 const t=Math.max(0,Math.min(1,hit.t));
 position.x=before.x+(position.x-before.x)*t+n.x*.003;
 position.y=before.y+(position.y-before.y)*t+n.y*.003;
 position.z=before.z+(position.z-before.z)*t+n.z*.003;
 // Keep most tangential travel while losing energy against stone or timber.
 const restitution=.48,tangentRetention=.88;
 const vx=velocity.x+n.x*inward,vy=velocity.y+n.y*inward,vz=velocity.z+n.z*inward;
 velocity.x=vx*tangentRetention+n.x*inward*restitution;
 velocity.y=vy*tangentRetention+n.y*inward*restitution;
 velocity.z=vz*tangentRetention+n.z*inward*restitution;
 return{hit:true,unplayableRoof:n.y>.6&&inward<1.7};
}

// Leave room for the 1.04m address offset and the golfer's body at every aim angle.
// Artificial structures grant a free drop; the drop cannot move closer to the cup.
export function buildingRelief(course,collision,ball){
 const ground={x:ball.x,y:heightAt(course,ball.x,ball.z),z:ball.z},clear=p=>!collision?.blocked(p,1.5,2.2,true);
 if(clear(ground))return {status:'clear'};
 const pinDistance=Math.hypot(ball.x-course.greenX,ball.z-course.length),away=Math.atan2(ball.x-course.greenX,ball.z-course.length);
 for(let radius=.25;radius<=12;radius+=.25)for(let i=0;i<48;i++){
  const angle=away+(i%2?1:-1)*Math.ceil(i/2)*Math.PI/24,x=ball.x+Math.sin(angle)*radius,z=ball.z+Math.cos(angle)*radius;
  if(Math.hypot(x-course.greenX,z-course.length)<pinDistance-1e-6||['Water','Out of bounds','Bunker','Green'].includes(lieAt(course,x,z)))continue;
  const p={x,y:heightAt(course,x,z),z};if(!clear(p)||!collision.segmentClear(ground,p,.13,0,true))continue;
  return {status:'relief',position:{x,y:p.y+.13,z}};
 }
 return {status:'unplayable'};
}
