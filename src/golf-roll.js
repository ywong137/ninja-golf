import {heightAt,lieAt,waterSurfaceAt} from './course.js';
import {resolveBuildingBall,obstructionRelief} from './building-ball.js';
import {BALL_RADIUS} from './golf-equipment.js';
export {BALL_RADIUS} from './golf-equipment.js';

export const BALL_STEP=1/120;
export function ballSurface(course,p){return{ground:heightAt(course,p.x,p.z)+BALL_RADIUS,lie:lieAt(course,p.x,p.z),water:waterSurfaceAt(course,p.x,p.z)};}
export function ballHazard(p,surface,time){
 if(surface.lie==='Water'&&surface.water!=null&&p.y<=surface.water+BALL_RADIUS)return'Water';
 if(surface.lie==='Out of bounds'&&(p.y<surface.ground+2||time>12))return'Out of bounds';
 return null;
}
// The position has already advanced. Keep the live friction/slope ordering intact.
export function applyRollingResistance(course,p,v,surface,dt,stillTime=0){
 p.y=surface.ground;v.y=0;
 const friction=surface.lie==='Green'?.95:surface.lie==='Fairway'||surface.lie==='Tee'?1.5:surface.lie==='Bunker'?5.5:3.6;
 const speed=Math.hypot(v.x,v.z),next=Math.max(0,speed-friction*dt);
 if(speed>0){v.x*=next/speed;v.z*=next/speed;}
 if(next>.2){
  v.x-=(heightAt(course,p.x+.3,p.z)-heightAt(course,p.x-.3,p.z))/.6*5*dt;
  v.z-=(heightAt(course,p.x,p.z+.3)-heightAt(course,p.x,p.z-.3))/.6*5*dt;
 }
 if(next<.12){v.x=0;v.y=0;v.z=0;return stillTime+dt;}
 return 0;
}
export function capturesCup(before,p,v,cup){
 if(p.y>=cup.y+.5||Math.hypot(v.x,v.y,v.z)>=6)return false;
 const dx=p.x-before.x,dz=p.z-before.z,t=Math.max(0,Math.min(1,((cup.x-before.x)*dx+(cup.z-before.z)*dz)/Math.max(dx*dx+dz*dz,1e-8)));
 return Math.hypot(before.x+dx*t-cup.x,before.z+dz*t-cup.z)<.32;
}
export function rollingFinished(stillTime,time){return stillTime>.32||time>30;}

// Preview adapter uses the same post-movement operations as Game.updateBall.
export function stepRollingBall(course,state,dt,cup,collision=null){
 const p=state.position,v=state.velocity,before={...p};state.time+=dt;
 p.x+=v.x*dt;p.y+=v.y*dt;p.z+=v.z*dt;
 const buildingHit=resolveBuildingBall(collision,before,p,v);if(buildingHit?.unplayableRoof){state.lie='Building';return state.outcome='Unplayable roof';}
 const surface=ballSurface(course,p),hazard=ballHazard(p,surface,state.time);state.lie=surface.lie;
 if(hazard)return state.outcome=hazard;
 state.stillTime=applyRollingResistance(course,p,v,surface,dt,state.stillTime);
 if(capturesCup(before,p,v,cup))return state.outcome='Holed';
 if(rollingFinished(state.stillTime,state.time)){
  const relief=obstructionRelief(course,collision,p);
  if(relief.status==='unplayable')return state.outcome='Unplayable building lie';
  if(relief.status==='relief'){Object.assign(p,relief.position);state.lie=lieAt(course,p.x,p.z);}
  return state.outcome='Stopped';
 }
 return null;
}
