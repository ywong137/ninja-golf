// Authored routes drive lies, terrain, shaders, maps, and scenery placement.
export const MAX_FAIRWAY_SEGMENTS=40;
export const MAX_WATERS=4;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function segments(paths=[]){const out=[];for(const path of paths){if(path.length===1){const [x,z,w]=path[0];out.push([x,z,x,z,w,w]);}else for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];out.push([a[0],a[1],b[0],b[1],a[2],b[2]]);}}return out;}
export function segmentDistance(x,z,s){const dx=s[2]-s[0],dz=s[3]-s[1],t=clamp(((x-s[0])*dx+(z-s[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-s[0]-dx*t,z-s[1]-dz*t)-(s[4]+(s[5]-s[4])*t);}
export function fairwayPrimitives(c){return c.layout?.segments||[];}
export function fairwayDistance(c,x,z){let d=1e6;for(const s of fairwayPrimitives(c))d=Math.min(d,segmentDistance(x,z,s));return d;}
export function dryLandDistance(c,x,z){let d=1e6;for(const s of c.layout?.bridgeSegments||[])d=Math.min(d,segmentDistance(x,z,s));for(const e of c.layout?.islands||[])d=Math.min(d,(Math.hypot((x-e[0])/e[2],(z-e[1])/e[3])-1)*Math.min(e[2],e[3]));return d;}
export function waterBasins(c){return c.waters||[c.pond];}
export function waterAt(c,x,z){return dryLandDistance(c,x,z)>0&&waterBasins(c).some(e=>Math.hypot((x-e[0])/e[2],(z-e[1])/e[3])<1);}
export function routeNearest(c,x,z){const route=c.layout?.route||[[0,0,c.width],[c.greenX,c.length,c.width]];let best={distance:Infinity,x:0,z:0,width:c.width,tangentX:0,tangentZ:1,progress:0};let run=0,total=0;for(let i=1;i<route.length;i++)total+=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(len*len||1),0,1),xx=a[0]+dx*t,zz=a[1]+dz*t,d=Math.hypot(x-xx,z-zz);if(d<best.distance)best={distance:d,x:xx,z:zz,width:a[2]+(b[2]-a[2])*t,tangentX:dx/(len||1),tangentZ:dz/(len||1),progress:(run+t*len)/(total||1)};run+=len;}return best;}
export function routePoint(c,fraction){const p=c.layout.route;let total=0;for(let i=1;i<p.length;i++)total+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);let remaining=clamp(fraction,0,1)*total;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(remaining<=len||i===p.length-1){const t=remaining/(len||1);return{x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,width:a[2]+(b[2]-a[2])*t,tangentX:(b[0]-a[0])/(len||1),tangentZ:(b[1]-a[1])/(len||1)};}remaining-=len;}}
// Each outline represents one tapered capsule. Drawing all outlines gives exactly the fairway union.
export function mapOutlines(c){return fairwayPrimitives(c).map(s=>{const points=[],angle=Math.atan2(s[3]-s[1],s[2]-s[0]);for(let i=0;i<=16;i++){const a=angle+Math.PI/2+i*Math.PI/16;points.push([s[0]+Math.cos(a)*s[4],s[1]+Math.sin(a)*s[4]]);}for(let i=0;i<=16;i++){const a=angle-Math.PI/2+i*Math.PI/16;points.push([s[2]+Math.cos(a)*s[5],s[3]+Math.sin(a)*s[5]]);}return points;});}
export const FAIRWAY_GLSL=`uniform vec4 routeSegments[${MAX_FAIRWAY_SEGMENTS}];uniform vec2 routeWidths[${MAX_FAIRWAY_SEGMENTS}];uniform int routeCount;
float routeDistance(vec2 p){float d=1000000.;for(int i=0;i<${MAX_FAIRWAY_SEGMENTS};i++){if(i>=routeCount)break;vec4 s=routeSegments[i];vec2 v=s.zw-s.xy;float t=clamp(dot(p-s.xy,v)/max(dot(v,v),1.),0.,1.);d=min(d,length(p-s.xy-v*t)-mix(routeWidths[i].x,routeWidths[i].y,t));}return d;}`;
export const MAX_BRIDGES=24,MAX_ISLANDS=8;
export const DRY_LAND_GLSL=`uniform vec4 bridgeSegments[${MAX_BRIDGES}];uniform vec2 bridgeWidths[${MAX_BRIDGES}];uniform int bridgeCount;uniform vec4 dryIslands[${MAX_ISLANDS}];uniform int islandCount;
float dryDistance(vec2 p){float d=1000000.;for(int i=0;i<${MAX_BRIDGES};i++){if(i>=bridgeCount)break;vec4 s=bridgeSegments[i];vec2 v=s.zw-s.xy;float t=clamp(dot(p-s.xy,v)/max(dot(v,v),1.),0.,1.);d=min(d,length(p-s.xy-v*t)-mix(bridgeWidths[i].x,bridgeWidths[i].y,t));}for(int i=0;i<${MAX_ISLANDS};i++){if(i>=islandCount)break;vec4 e=dryIslands[i];d=min(d,(length((p-e.xy)/e.zw)-1.)*min(e.z,e.w));}return d;}`;

// Smooth interpolating routes preserve authored landing anchors and disconnected paths.
// Only the shared baked primitives change; bridges retain their straight dry corridors.
export function sculptFairways(c){
 const descriptors=[],flowing=c.layout.fairways.length===1;
 c.layout.fairways.forEach((authored,pathIndex)=>{
  const phase=(c.seed*.731+pathIndex*2.17),axis=phase%Math.PI;
  const points=authored.length===1?(()=>{const [x,z,w]=authored[0],dx=Math.cos(axis)*w*.32,dz=Math.sin(axis)*w*.32;return[[x-dx,z-dz,w*.76],[x,z,w*.9],[x+dx,z+dz,w*.71]];})():authored.map(p=>p.slice());
  // Spread short elbow connectors inside their landing areas. Exact anchor
  // interpolation makes the inner bank fold when its radius is below the width.
  const relievedEdges=new Set();
  if(flowing)for(let i=1;i<authored.length-2;i++){
   const a=authored[i],b=authored[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   if(len>=Math.min(a[2],b[2])*3.5)continue;
   const shift=Math.min(a[2],b[2])*.24,prev=authored[i-1],next=authored[i+2],la=Math.hypot(a[0]-prev[0],a[1]-prev[1]),lb=Math.hypot(next[0]-b[0],next[1]-b[1]);
   if(Math.abs((dx*(a[0]-prev[0])+dz*(a[1]-prev[1]))/(len*la||1))>.25||Math.abs((dx*(next[0]-b[0])+dz*(next[1]-b[1]))/(len*lb||1))>.25)continue;
   relievedEdges.add(i+1);
   points[i][0]-=shift*(dx/(len||1)+(a[0]-prev[0])/(la||1));points[i][1]-=shift*(dz/(len||1)+(a[1]-prev[1])/(la||1));
   points[i+1][0]+=shift*(dx/(len||1)+(next[0]-b[0])/(lb||1));points[i+1][1]+=shift*(dz/(len||1)+(next[1]-b[1])/(lb||1));
  }
  const tangent=i=>{
   if(i===0)return[points[1][0]-points[0][0],points[1][1]-points[0][1]];
   if(i===points.length-1)return[points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]];
   const a=points[i-1],p=points[i],b=points[i+1],la=Math.hypot(p[0]-a[0],p[1]-a[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]),length=Math.min(la,lb)*(flowing?.95:.7);
   return[((p[0]-a[0])/(la||1)+(b[0]-p[0])/(lb||1))*length,((p[1]-a[1])/(la||1)+(b[1]-p[1])/(lb||1))*length];
  };
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),m0=tangent(i-1),m1=tangent(i);
   const broadConnector=relievedEdges.has(i);
   const bow=broadConnector?0:Math.min(length*.13,Math.min(a[2],b[2])*(flowing?.7:.38))*Math.sin(phase+i*1.71),waist=Math.min(a[2],b[2])*(.06+.05*(.5+.5*Math.cos(phase+i)));
   const sample=t=>{const t2=t*t,t3=t2*t,ease=t2*(3-2*t),arch=Math.sin(t*Math.PI)**2;return[(2*t3-3*t2+1)*a[0]+(t3-2*t2+t)*m0[0]+(-2*t3+3*t2)*b[0]+(t3-t2)*m1[0]-dz/(length||1)*bow*arch,(2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*m0[1]+(-2*t3+3*t2)*b[1]+(t3-t2)*m1[1]+dx/(length||1)*bow*arch,a[2]+(b[2]-a[2])*ease-waist*arch];};
   descriptors.push({pathIndex,length,sample,count:2});
  }
 });
 const total=descriptors.reduce((n,d)=>n+d.length,0),budget=Math.min(MAX_FAIRWAY_SEGMENTS,Math.max(descriptors.length*2,12,Math.ceil(total/18+descriptors.length*1.4)));
 if(descriptors.length*2>MAX_FAIRWAY_SEGMENTS)throw new Error(`Fairway curve budget exceeded for ${c.name}`);
 for(let allocated=descriptors.length*2;allocated<budget;allocated++){let best=descriptors[0];for(const d of descriptors)if(d.length/d.count>best.length/best.count)best=d;best.count++;}
 const baked=[],paths=c.layout.fairways.map(()=>[]);
 for(const d of descriptors){const points=Array.from({length:d.count+1},(_,i)=>d.sample(i/d.count));baked.push(...segments([points]));paths[d.pathIndex].push(...(paths[d.pathIndex].length?points.slice(1):points));}
 c.layout.segments=baked;c.layout.curvedPaths=paths;return baked;
}
