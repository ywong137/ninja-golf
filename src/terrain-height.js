import {fairwayDistance} from './course-layout.js';
import {bunkerHeightOffset} from './bunkers.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const greenDistance=(c,x,z)=>Math.hypot((x-c.greenX)/1.05,z-c.length);
// Terrain before pond grading, including the designed coastal descent.
export function naturalHeightAt(c,x,z) {
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
  if(c.coastal===false)return y;
  const edge=138+Math.sin(z*.014)*28;
  // The visible sea and horizontal hazard boundary meet the same ground contour.
  if(x>=edge)return -1.1-10.9*smooth(edge,edge+25,x);
  const coast=smooth(edge-38,edge,x);
  return y*(1-coast)-1.1*coast;
}
