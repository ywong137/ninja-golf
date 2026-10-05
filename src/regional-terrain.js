import {heightAt,smooth} from './course.js';
const REGION_SETTINGS={
 japanese:{span:14000,scale:1.05,datum:0,u:.5,v:.5,direction:1},
 highlands:{span:16000,scale:.58,datum:0,u:.5,v:.5,direction:-1},
 desert:{span:14000,scale:.66,datum:1300,u:.5,v:.5,direction:-1},
};
export async function loadRegionalTerrain(base){
 const results=await Promise.allSettled(Object.keys(REGION_SETTINGS).map(async theme=>{
  const response=await fetch(`${base}terrain/${theme}.i16`);
  if(!response.ok)throw new Error(`Terrain ${theme}: HTTP ${response.status}`);
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength!==513*513*2)throw new Error(`Terrain ${theme}: invalid elevation grid`);
  // DataView makes the documented little-endian asset format independent of the host.
  const view=new DataView(buffer),heights=new Int16Array(513*513);
  for(let i=0;i<heights.length;i++)heights[i]=view.getInt16(i*2,true);
  return [theme,{size:513,heights,...REGION_SETTINGS[theme]}];
 }));
 const entries=[];for(const result of results){if(result.status==='fulfilled')entries.push(result.value);else console.warn(result.reason);}
 return Object.fromEntries(entries);
}
export function sampleElevation(region,u,v){
 const px=Math.max(0,Math.min(region.size-1.001,u*(region.size-1))),pz=Math.max(0,Math.min(region.size-1.001,v*(region.size-1)));
 const x=Math.floor(px),z=Math.floor(pz),tx=px-x,tz=pz-z,i=z*region.size+x,a=region.heights;
 return(a[i]*(1-tx)+a[i+1]*tx)*(1-tz)+(a[i+region.size]*(1-tx)+a[i+region.size+1]*tx)*tz;
}
export function landscapeDistance(c,x,z){return Math.hypot(Math.max(0,Math.abs(x)-375),Math.max(0,-165-z,z-c.length-165));}
export function landscapeHeight(c,region,x,z){
 if(!region)return heightAt(c,x,z);
 const distance=landscapeDistance(c,x,z);if(distance<=40)return heightAt(c,x,z);
 const elevation=sampleElevation(region,region.u+x/region.span,region.v+region.direction*(z-c.length*.5)/region.span);
 const adapted=Math.max(-28,(elevation-region.datum)*region.scale);
 // Keep the entire playable course and its edge unchanged. The surveyed landscape
 // takes over gradually, outside the ball and character movement limits.
 const blend=smooth(40,1550,distance);
 return blend===1?adapted:heightAt(c,x,z)*(1-blend)+adapted*blend;
}

// Images and elevations share geographic bounds. TextureLoader flips the image
// vertically, so image UV.y is the inverse of the north-to-south elevation row.
export function regionalTextureFrame(c,region){
 if(!region)return [0,0,0,0];
 return [region.u,1.-region.v+region.direction*c.length*.5/region.span,1/region.span,-region.direction/region.span];
}
