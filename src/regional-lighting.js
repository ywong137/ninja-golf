import {SUN_DIRECTION} from './lighting.js';
import {smooth} from './course.js';

// The fixed sun points diagonally across each geographic grid. A horizon scan
// finds terrain occluders in O(n²), without distant cascades or extra samplers.
export function regionalSunVisibility(region,sun=SUN_DIRECTION){
 const {size:n,heights,span,scale,datum,direction}=region;
 if(Math.abs(sun[0])<1e-8||Math.abs(Math.abs(sun[0])-Math.abs(sun[2]))>1e-6||sun[1]<=0)throw new Error('Regional horizon lighting requires an elevated diagonal sun.');
 const towardX=Math.sign(sun[0]),towardZ=Math.sign(sun[2])*direction;
 const rise=span/(n-1)*Math.SQRT2*sun[1]/Math.hypot(sun[0],sun[2]);
 const previous=new Float32Array(n),next=new Float32Array(n),visibility=new Uint8Array(n*n);previous.fill(-Infinity);
 for(let column=0;column<n;column++){
  const x=towardX<0?column:n-1-column;
  for(let z=0;z<n;z++){
   const from=z+towardZ,ceiling=from>=0&&from<n?previous[from]-rise:-Infinity;
   const height=Math.max(-28,(heights[z*n+x]-datum)*scale);
   // A small height band softens quantization at the source sample spacing.
   visibility[z*n+x]=Math.round(255*(1-smooth(-.5,1.5,ceiling-height)));
   next[z]=Math.max(height,ceiling);
  }
  previous.set(next);
 }
 return {size:n,heights:visibility};
}
