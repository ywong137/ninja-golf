import {waterBasins,dryLandDistance,waterAt} from './course-layout.js';
import {naturalHeightAt} from './terrain-height.js';
const profiles=new WeakMap();
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const ellipse=(x,z,b)=>Math.hypot((x-b[0])/b[2],(z-b[1])/b[3]);
// First-order metric distance to the ellipse; exact at the shoreline.
export function basinDistance(x,z,b){
 const dx=x-b[0],dz=z-b[1],e=Math.hypot(dx/b[2],dz/b[3]);
 return e<1e-8?-Math.min(b[2],b[3]):(e-1)/Math.hypot(dx/(b[2]*b[2]*e),dz/(b[3]*b[3]*e));
}
export function pondProfiles(c){
 const cached=profiles.get(c);if(cached&&cached.waters===c.waters&&cached.layout===c.layout)return cached.value;
 const basins=waterBasins(c).filter(Boolean),value=basins.map(basin=>{
  const heights=[];for(let i=0;i<128;i++){const a=i/128*Math.PI*2,x=basin[0]+Math.cos(a)*basin[2],z=basin[1]+Math.sin(a)*basin[3];if(dryLandDistance(c,x,z)>0)heights.push(naturalHeightAt(c,x,z));}
  if(!heights.length)heights.push(naturalHeightAt(c,basin[0],basin[1]));heights.sort((a,b)=>a-b);
  let surface=heights[Math.floor(heights.length*.5)]-.8;
  // Keep a shallow collar beside a green; preserve the island's playable interior.
  if(basinDistance(c.greenX,c.length,basin)<35)surface=Math.max(surface,naturalHeightAt(c,c.greenX,c.length)-1.4);
  for(const island of c.layout?.islands||[])if(basinDistance(island[0],island[1],basin)<Math.max(island[2],island[3])){
   for(let i=0;i<17;i++){const a=i/16*Math.PI*2,r=i===16?0:.55,x=island[0]+Math.cos(a)*island[2]*r,z=island[1]+Math.sin(a)*island[3]*r;surface=Math.min(surface,naturalHeightAt(c,x,z)-.6);}
  }
  return {basin,surface,depth:1.8,bankWidth:Math.max(10,Math.max(heights.at(-1)-surface,surface-heights[0])*3.4),rimMin:heights[0],rimMax:heights.at(-1)};
 });
 // Connected ellipses describe a single body of water and need one flat plane.
 const groups=value.map((_,i)=>i),root=i=>groups[i]===i?i:(groups[i]=root(groups[i]));
 for(let i=0;i<value.length;i++)for(let j=0;j<i;j++){
  const a=value[i].basin,b=value[j].basin;let overlap=ellipse(a[0],a[1],b)<1||ellipse(b[0],b[1],a)<1;
  for(let k=0;k<128&&!overlap;k++){const t=k/128*Math.PI*2;overlap=ellipse(a[0]+Math.cos(t)*a[2],a[1]+Math.sin(t)*a[3],b)<1;}
  if(overlap)groups[root(i)]=root(j);
 }
 for(let i=0;i<value.length;i++){const members=value.filter((_,j)=>root(i)===root(j)),surface=Math.min(...members.map(p=>p.surface));value[i].surface=surface;value[i].bankWidth=Math.max(10,Math.max(value[i].rimMax-surface,surface-value[i].rimMin)*3.4);}
 profiles.set(c,{waters:c.waters,layout:c.layout,value});return value;
}
export function waterSurfaceAt(c,x,z){
 if(waterAt(c,x,z)){for(const p of pondProfiles(c))if(ellipse(x,z,p.basin)<1)return p.surface;}
 if(c.coastal!==false&&x>138+Math.sin(z*.014)*28)return -1.1;
 return null;
}
export function gradePonds(c,x,z,natural){
 const dry=dryLandDistance(c,x,z),basins=pondProfiles(c);
 let total=0,delta=0,influence=0,dryFloor=-Infinity,wet=Infinity;
 for(const p of basins){
  const distance=basinDistance(x,z,p.basin);if(distance>=p.bankWidth)continue;
  const d=Math.max(distance,-dry);
  if(d<=0){wet=Math.min(wet,p.surface-p.depth*smooth(-d/8));continue;}
  if(distance<0)dryFloor=Math.max(dryFloor,p.surface+.35*smooth(d/2));
  const green=Math.hypot((x-c.greenX)/1.05,z-c.length),tee=Math.hypot(x,z);
  // Shorten the grade before a putting surface or tee, with zero derivative at the join.
  const coast=c.coastal===false?Infinity:Math.max(.5,d+138+Math.sin(z*.014)*28-x);
  const width=Math.min(p.bankWidth,Math.max(.5,d+green-17),Math.max(.5,d+tee-9),coast);
  if(d>=width)continue;
  const strength=1-smooth(d/width),weight=strength/Math.max(1e-12,d*d*d*d);
  const shoulder=.45*smooth(d/2),target=p.surface+shoulder;
  total+=weight;delta+=(target-natural)*weight;influence=Math.max(influence,strength);
 }
 return Number.isFinite(wet)?wet:Math.max(dryFloor,total?natural+delta/total*influence:natural);
}
