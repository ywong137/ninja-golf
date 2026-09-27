import {heightAt,lieAt,COURSE_BOUNDS} from './course.js';
const dry=(course,x,z)=>!['Water','Out of bounds'].includes(lieAt(course,x,z));
// Keep the last valid position before collision correction, including beside water.
export function moveOnLand(position,from,course,collision,radius=.38,lift=0){
 const dx=position.x-from.x,dz=position.z-from.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.25));
 let x=from.x,z=from.z,y=heightAt(course,x,z)+lift;
 for(let i=0;i<steps;i++){
  const nx=Math.max(COURSE_BOUNDS.minX,Math.min(COURSE_BOUNDS.maxX,x+dx/steps)),nz=Math.max(COURSE_BOUNDS.minZ,Math.min(course.length+COURSE_BOUNDS.endMargin,z+dz/steps));
  const attempts=[[nx,nz],[nx,z],[x,nz]];let moved=false;
  for(const [tx,tz]of attempts){
   if(!dry(course,tx,tz))continue;
   const candidate={x:tx,y:heightAt(course,tx,tz)+lift,z:tz};
   collision.slide(candidate,radius,{x,y,z},2);
   if(!dry(course,candidate.x,candidate.z))continue;
   candidate.y=heightAt(course,candidate.x,candidate.z)+lift;
   if(collision.blocked(candidate,radius-.0001,2))continue;
   x=candidate.x;y=candidate.y;z=candidate.z;moved=true;break;
  }
  if(!moved)break;
 }
 position.x=x;position.y=y;position.z=z;return position;
}
