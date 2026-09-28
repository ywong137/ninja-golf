import {shorelineDistance,shorelinePoint} from './shoreline.js';
import {heightAt,lieAt,pondProfiles,waterSurfaceAt} from './course.js';

export const WATER_EMERGENCE={maxDistance:16,maxSlope:.65,maxArc:5,radius:.31};
export function waterEmergencePosition(site,landing,arcHeight,t,startY=site.y-.8){
 return{x:site.x+(landing.x-site.x)*t,y:startY+(landing.y-startY)*t+Math.sin(t*Math.PI)*arcHeight,z:site.z+(landing.z-site.z)*t};
}
function safeLanding(course,collision,x,z){
 const y=heightAt(course,x,z),position={x,y,z};
 if(!Number.isFinite(y)||collision?.blocked(position,WATER_EMERGENCE.radius,2))return null;
 for(const [dx,dz]of [[0,0],[.4,0],[-.4,0],[0,.4],[0,-.4]]){
  if(['Water','Out of bounds','Bunker'].includes(lieAt(course,x+dx,z+dz)))return null;
  const slope=Math.hypot((heightAt(course,x+dx+.2,z+dz)-heightAt(course,x+dx-.2,z+dz))/.4,(heightAt(course,x+dx,z+dz+.2)-heightAt(course,x+dx,z+dz-.2))/.4);
  if(slope>WATER_EMERGENCE.maxSlope)return null;
 }
 return position;
}
function clearArc(course,collision,site,landing,startY){
 let arcHeight=1.2;
 for(let i=1;i<48;i++){
  const t=i/48,p=waterEmergencePosition(site,landing,0,t,startY),ground=heightAt(course,p.x,p.z),clearance=waterSurfaceAt(course,p.x,p.z)==null?.07:0;
  arcHeight=Math.max(arcHeight,(ground+clearance-p.y)/Math.sin(t*Math.PI));
 }
 arcHeight+=.05;if(arcHeight>WATER_EMERGENCE.maxArc)return null;
 let before=waterEmergencePosition(site,landing,arcHeight,0,startY);
 for(let i=1;i<=96;i++){
  const p=waterEmergencePosition(site,landing,arcHeight,i/96,startY);
  if(p.y<heightAt(course,p.x,p.z)-.025||collision&&!collision.segmentClear(before,p,WATER_EMERGENCE.radius,2,true))return null;
  before=p;
 }
 return arcHeight;
}
// Search close shoreline exits first. Reject long flights instead of crossing a whole graded bank.
export function findWaterEmergence(course,site,target,collision=null){
 if(waterSurfaceAt(course,site.x,site.z)==null)return null;
 const profile=pondProfiles(course).reduce((best,p)=>{const b=p.basin,e=shorelineDistance(site.x,site.z,b);return !best||Math.abs(e)<best.distance?{profile:p,distance:Math.abs(e)}:best;},null)?.profile;
 if(!profile)return null;
 const startY=Math.max(site.y-.8,heightAt(course,site.x,site.z)+.04);if(startY>=site.y)return null;
 const [cx,cz,rx,rz]=profile.basin,angle=Math.atan2((site.z-cz)/rz,(site.x-cx)/rx),candidates=[];
 for(const offset of [0,-.12,.12,-.25,.25,-.45,.45]){
  const a=angle+offset,[sx,sz]=shorelinePoint(profile.basin,a),gx=shorelineDistance(sx+.01,sz,profile.basin)-shorelineDistance(sx-.01,sz,profile.basin),gz=shorelineDistance(sx,sz+.01,profile.basin)-shorelineDistance(sx,sz-.01,profile.basin),length=Math.hypot(gx,gz),nx=gx/length,nz=gz/length;
  for(const distance of [.65,1,1.5,2.2,3.2,4.5,6,8]){
   const x=sx+nx*distance,z=sz+nz*distance,travel=Math.hypot(x-site.x,z-site.z);if(travel>WATER_EMERGENCE.maxDistance)continue;
   candidates.push({x,z,score:travel+.04*Math.hypot(x-target.x,z-target.z)});
  }
 }
 candidates.sort((a,b)=>a.score-b.score);
 for(const p of candidates){const landing=safeLanding(course,collision,p.x,p.z);if(!landing)continue;const arcHeight=clearArc(course,collision,site,landing,startY);if(arcHeight==null)continue;return{landing,arcHeight,startY,duration:Math.max(.85,Math.hypot(landing.x-site.x,landing.z-site.z)/9)};}
 return null;
}
