import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,heightAt,ellipse,dryLandDistance,waterBasins} from '../src/course.js';
import {pondProfiles,basinDistance} from '../src/ponds.js';
import {shorelinePoint} from '../src/shoreline.js';
import {bunkerOutline} from '../src/bunkers.js';
import {courseGeometry,courseSurfaceHeight,createCourseSurfaceSampler} from '../src/terrain.js';

// Independent uncached lookup, with the current quarter-metre bunker grid.
// Rendered-mesh checks below provide a separate source of geometric truth.
function originalCell(c,cx,cz){
 if(c.bunkers.some(b=>ellipse(cx,cz,b)<1.3))return 12;
 let detail=Math.hypot(cx-c.greenX,cz-c.length)<26?3:1;
 for(const p of pondProfiles(c)){
  const distance=basinDistance(cx,cz,p.basin);if(distance>=p.bankWidth+2)continue;
  if(Math.abs(Math.max(distance,-dryLandDistance(c,cx,cz)))<3)return 6;
  detail=3;
 }
 return detail;
}
function originalHeight(c,x,z){
 const extent=c.length+330,nz=Math.round(extent/3),dz=extent/nz,ix=Math.floor((x+375)/3),iz=Math.floor((z+165)/dz);
 if(ix<0||ix>=250||iz<0||iz>=nz)return heightAt(c,x,z);
 const x0=-375+ix*3,z0=-165+iz*dz,n=originalCell(c,x0+1.5,z0+dz*.5);
 const u=(x-x0)/3*n,v=(z-z0)/dz*n,cellX=Math.min(n-1,Math.floor(u)),cellZ=Math.min(n-1,Math.floor(v)),fx=u-cellX,fz=v-cellZ;
 const xa=x0+cellX/n*3,za=z0+cellZ/n*dz,xb=xa+3/n,zb=za+dz/n,h10=heightAt(c,xb,za),h01=heightAt(c,xa,zb);
 if(fx+fz<=1){const h00=heightAt(c,xa,za);return h00+(h10-h00)*fx+(h01-h00)*fz;}
 const h11=heightAt(c,xb,zb);return h11+(h01-h11)*(1-fx)+(h10-h11)*(1-fz);
}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

test('Cached triangles match direct and uncached reference heights across all 36 holes and subdivision boundaries',()=>{
 let total=0,largestOriginalDifference=0;
 for(const [courseIndex,set]of COURSE_SETS.entries())for(const [holeIndex,c]of set.holes.entries()){
  const sample=createCourseSurfaceSampler(c,heightAt,ellipse),rng=random(courseIndex*100+holeIndex+1),extent=c.length+330,nz=Math.round(extent/3),dz=extent/nz;
  const points=Array.from({length:300},()=>[-375+rng()*750,-165+rng()*extent]);
  const features=[[0,0],[c.greenX,c.length],...c.bunkers.flatMap(b=>bunkerOutline(b,12)),...waterBasins(c).filter(Boolean).flatMap(b=>Array.from({length:12},(_,i)=>shorelinePoint(b,i*Math.PI/6)))];
  points.push(...features);
  for(const [x,z]of features){
   const ix=Math.floor((x+375)/3),iz=Math.floor((z+165)/dz),x0=-375+ix*3,z0=-165+iz*dz,n=originalCell(c,x0+1.5,z0+dz*.5);
   for(let row=0;row<n;row++)for(let col=0;col<n;col++){
    // Probe the local diagonal, subdivision edges, and each side of the joins.
    for(const [u,v]of [[0,0],[.5,.5],[1,0],[0,1],[1,1]])for(const e of [-1e-9,0,1e-9])points.push([x0+(col+u)/n*3+e,z0+(row+v)/n*dz-e]);
   }
  }
  points.push([-375,-165],[375,-165],[-375,c.length+165],[375,c.length+165],[-376,0],[376,0],[0,-166],[0,c.length+166]);
  for(const [x,z]of points){
   const actual=sample(x,z),direct=courseSurfaceHeight(c,x,z,heightAt,ellipse),original=originalHeight(c,x,z);
   assert.equal(actual,direct,`${set.id}/${holeIndex}: cached/direct mismatch at ${x},${z}`);
   const difference=Math.abs(actual-original);largestOriginalDifference=Math.max(largestOriginalDifference,difference);
   assert.ok(difference<1e-10,`${set.id}/${holeIndex}: changed uncached reference height by ${difference}`);total++;
  }
  assert.ok(sample.stats.cells<=sample.stats.maxCells);
  assert.ok(sample.stats.vertexSlots<=169*sample.stats.cells);
  assert.equal(sample.stats.typedArrayBytes,sample.stats.vertexSlots*9);
 }
 assert.equal(COURSE_SETS.reduce((n,set)=>n+set.holes.length,0),36);
 assert.ok(total>30000);
 console.log(`course cache: ${total} queries, maximum uncached reference difference ${largestOriginalDifference} m`);
});

test('Cached heights match rendered Float32 triangles in all four course themes',()=>{
 for(const set of COURSE_SETS){
  const c=set.holes[0],geometry=courseGeometry(c,heightAt,ellipse),position=geometry.attributes.position,index=geometry.index,sample=createCourseSurfaceSampler(c,heightAt,ellipse),rng=random(81);
  for(let i=0;i<250;i++){
   const start=Math.floor(rng()*index.count/3)*3,ids=[0,1,2].map(k=>index.getX(start+k)),weights=[.2,.35,.45];
   const point=[0,1,2].map(axis=>ids.reduce((sum,id,k)=>sum+position.getComponent(id,axis)*weights[k],0));
   assert.ok(Math.abs(sample(point[0],point[2])-point[1])<.00005,`${set.id}: cached surface differs from rendered triangle`);
  }
  geometry.dispose();
 }
});

test('Lazy vertex storage reuses exact values and preserves outside fallback',()=>{
 const c={length:60,greenX:1000,bunkers:[],waters:[],coastal:false};let calls=0;
 const analytic=(_c,x,z)=>{calls++;return x*2+z*3+7;},sample=createCourseSurfaceSampler(c,analytic,ellipse);
 assert.deepEqual(sample.stats,{cells:0,vertices:0,vertexSlots:0,typedArrayBytes:0,maxCells:32500});
 const first=sample(-374.8,-164.8);assert.equal(calls,3);assert.equal(sample.stats.vertices,3);
 for(let i=0;i<100;i++)assert.equal(sample(-374.8,-164.8),first);
 assert.equal(calls,3);sample(-372.2,-162.2);assert.equal(calls,4);assert.equal(sample.stats.vertices,4);
 assert.equal(sample.stats.cells,1);assert.equal(sample.stats.typedArrayBytes,36);
 for(const [x,z]of [[-375-1e-6,0],[375,0],[0,-165-1e-6],[0,225],[0,226]]){
  const before=calls;assert.equal(sample(x,z),x*2+z*3+7);assert.equal(calls,before+1);
 }
 assert.equal(sample.stats.cells,1,'Outside fallback must not grow the cache');
 let nanCalls=0;const nanSampler=createCourseSurfaceSampler(c,()=>{nanCalls++;return NaN;},ellipse);
 assert.ok(Number.isNaN(nanSampler(-374.8,-164.8)));assert.ok(Number.isNaN(nanSampler(-374.8,-164.8)));assert.equal(nanCalls,3);
 assert.throws(()=>createCourseSurfaceSampler({...c,length:NaN},analytic,ellipse),/positive finite/);
 assert.throws(()=>createCourseSurfaceSampler(c,null,ellipse),/heightAt and ellipse/);
});
