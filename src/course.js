import {bunkerDistance,bunkerHeightOffset} from './bunkers.js';
import {fairwayDistance,dryLandDistance,waterAt,waterBasins} from './course-layout.js';
export {fairwayDistance,dryLandDistance,waterAt,waterBasins,routeNearest,routePoint,fairwayPrimitives,mapOutlines} from './course-layout.js';
export { COURSE_SETS, COURSES } from './course-data.js';
export { WARRIORS } from './warriors.js';
export const CLUBS = [
  { name: 'Driver', short: 'DR', carry: 232, loft: 16, roll: .78 },
  { name: '3 Wood', short: '3W', carry: 203, loft: 23, roll: .65 },
  { name: '5 Iron', short: '5I', carry: 161, loft: 32, roll: .46 },
  { name: '7 Iron', short: '7I', carry: 131, loft: 40, roll: .36 },
  { name: '9 Iron', short: '9I', carry: 103, loft: 47, roll: .3 },
  { name: 'Pitching wedge', short: 'PW', carry: 72, loft: 53, roll: .23 },
  { name: 'Sand wedge', short: 'SW', carry: 43, loft: 62, roll: .15 },
  { name: 'Putter', short: 'PT', carry: 27, loft: 0, roll: 1 },
];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t*t*(3-2*t); };
export function random(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function center(c,z){if(c.layout){const p=c.layout.route;let x=p[0][0],best=Infinity;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],t=clamp((z-a[1])/(b[1]-a[1]||1),0,1),zz=a[1]+(b[1]-a[1])*t,d=Math.abs(z-zz);if(d<best){best=d;x=a[0]+(b[0]-a[0])*t;}}return x;}const t=clamp(z/c.length,0,1);return Math.sin(t*Math.PI)*c.bend+c.greenX*t;}
export function greenDistance(c, x, z) { return Math.hypot((x-c.greenX)/1.05, z-c.length); }
export function ellipse(x, z, e) { return Math.hypot((x-e[0])/e[2], (z-e[1])/e[3]); }
export const COURSE_BOUNDS={minX:-240,maxX:240,minZ:-90,endMargin:120};
export function lieAt(c, x, z) {
  if (x < COURSE_BOUNDS.minX || x > COURSE_BOUNDS.maxX || z < COURSE_BOUNDS.minZ || z > c.length + COURSE_BOUNDS.endMargin) return 'Out of bounds';
  if (waterAt(c,x,z) || c.coastal !== false && x > 138 + Math.sin(z*.014)*28) return 'Water';
  if (c.bunkers.some(b => bunkerDistance(x,z,b) < 0)) return 'Bunker';
  if (greenDistance(c,x,z) < 17) return 'Green';
  if (Math.abs(x) < 5 && Math.abs(z) < 7) return 'Tee';
  if (fairwayDistance(c,x,z)<0) return 'Fairway';
  return 'Rough';
}
export function heightAt(c,x,z) {
  const d = fairwayDistance(c,x,z);
  const g = greenDistance(c,x,z);
  const t=clamp(z/c.length,0,1),elevation=(c.rise||0)*t+(c.swell||0)*Math.sin(t*Math.PI);
  const base = 7.5 + Math.sin(z*.012)*2.2 + z*.003 + elevation;
  const hill = (c.relief || 1) * (Math.sin(x*.031+z*.008)*5 + Math.cos(z*.023-x*.009)*3 + Math.sin(x*.079+z*.05)*.6);
  const greenBase = 7.5 + Math.sin(c.length*.012)*2.2 + c.length*.003 + (c.rise||0);
  const green = greenBase + (x-c.greenX)*.011 + (z-c.length)*.008;
  let y = base + hill*smooth(-3,42,d);
  y = y*(smooth(16,26,g)) + green*(1-smooth(16,26,g));
  for (const b of c.bunkers) y += bunkerHeightOffset(x,z,b);
  // Inland hollows stay above sea level. Only the designed coast descends into the ocean.
  y=.8+Math.log1p(Math.exp(y-.8));
  const dry=dryLandDistance(c,x,z),landBlend=dry<=0?1:0;
  let wetY=y;
  for(const basin of waterBasins(c)){const e=ellipse(x,z,basin);if(e<1.16){const bed=e<1?1.8+1.3*smooth(.88,1,e):3.1+(y-3.1)*smooth(1,1.16,e);wetY=Math.min(wetY,bed);}}
  y=wetY*(1-landBlend)+Math.max(4.3,y)*landBlend;
  const coast = c.coastal === false ? 0 : smooth(112+Math.sin(z*.014)*28,163+Math.sin(z*.014)*28,x);
  y = y*(1-coast)-12*coast;
  return y;
}
export function carryFor(club, warrior, lie, power = 1) {
  const penalty = lie==='Rough' ? .79 : lie==='Bunker' ? (club.short==='SW' ? .87 : .55) : 1;
  return club.carry*(club.short==='PT'?1:warrior.power)*penalty*power*power;
}
export function launchShot(club, warrior, lie, power, angle, shape = 0) {
  const carry = carryFor(club,warrior,lie,power);
  if (club.short==='PT') { const speed = Math.sqrt(2*.95*carry); return {x:Math.sin(angle)*speed,y:0,z:Math.cos(angle)*speed,spin:0}; }
  const loft = (club.loft + shape*5)*Math.PI/180;
  const speed = Math.sqrt(carry*9.81 / Math.sin(2*loft));
  return { x: Math.sin(angle)*speed*Math.cos(loft), y: speed*Math.sin(loft), z: Math.cos(angle)*speed*Math.cos(loft), spin:shape };
}
export function scoreName(strokes, par) {
  const d=strokes-par;
  return strokes===1?'Hole in one!':d<=-3?'Albatross':d===-2?'Eagle':d===-1?'Birdie':d===0?'Par':d===1?'Bogey':d===2?'Double bogey':`+${d} · A scenic route`;
}
