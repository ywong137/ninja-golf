import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,waterAt,waterBasins,heightAt,pondProfiles} from '../src/course.js';
import {shorelineOutline,shorelineDistance,shorelineProfile,shorelineRadius} from '../src/shoreline.js';
import {courseMapGeometry} from '../src/course-map.js';
import {pondUniforms} from '../src/water-uniforms.js';
import {createPond} from '../src/water.js';
const courses=COURSE_SETS.flatMap(s=>s.holes);
function contains(polygon,x,z){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
test('Every pond has a broad concave inlet and asymmetric shoulders, with no new flooded envelope',()=>{
 let count=0;
 for(const c of courses)for(const b of waterBasins(c)){
  const p=shorelineOutline(b),profile=shorelineProfile(b),radii=p.map(([x,z])=>Math.hypot((x-b[0])/b[2],(z-b[1])/b[3]));
  assert.ok(Math.max(...radii)<=1.00001);assert.ok(Math.max(...radii)-Math.min(...radii)>.20,`${c.name}: trivial ellipse distortion`);
  let concave=0;for(let i=0;i<p.length;i++){const a=p[i],v=p[(i+1)%p.length],w=p[(i+2)%p.length];if((v[0]-a[0])*(w[1]-v[1])-(v[1]-a[1])*(w[0]-v[0])<0)concave++;}
  assert.ok(concave>=8,`${c.name}: missing broad inlet`);
  for(let i=0;i<192;i++)assert.ok(Math.abs(shorelineDistance(...p[i],b))<1e-10);
  // The two opposite shores must differ; a translated or stretched circular disk is insufficient.
  assert.ok(Array.from({length:24},(_,i)=>Math.abs(shorelineRadius(i*Math.PI/12,profile)-shorelineRadius(i*Math.PI/12+Math.PI,profile))).some(d=>d>.06));count++;
 }assert.equal(count,38);
});
test('Map polygons, CPU hazards, and water mesh vertices agree across all ponds and islands',()=>{
 for(const c of courses){
  const map=courseMapGeometry(c),uniforms=pondUniforms(c),group=createPond(c,{time:{value:0},skyMap:{value:null},hasSky:{value:0}});
  for(const [i,b]of waterBasins(c).entries()){
   assert.deepEqual(uniforms.shoreShapes.value[i].toArray(),shorelineProfile(b));
   const positions=group.children[i].geometry.attributes.position;
   for(let j=0;j<positions.count;j++)assert.ok(Math.abs(shorelineDistance(b[0]+positions.getX(j),b[1]-positions.getY(j),b))<.00003,'Rendered rim leaves its analytic contour');
   for(let z=b[1]-b[3];z<=b[1]+b[3];z+=3.1)for(let x=b[0]-b[2];x<=b[0]+b[2];x+=3.1){
    if(Math.abs(shorelineDistance(x,z,b))<.06||c.layout.islands.some(e=>Math.abs(shorelineDistance(x,z,e,true))<.06))continue;
    const polygonWater=map.waters.some(p=>contains(p,x,z))&&!map.islands.some(p=>contains(p,x,z))&&!map.bridges.some(p=>contains(p,x,z));
    // Bridge outlines are coarser semicircles; exclude their immediate rims.
    if(map.bridges.some(p=>p.some(q=>Math.hypot(q[0]-x,q[1]-z)<.1)))continue;
    assert.equal(waterAt(c,x,z),polygonWater,`${c.name}: map and hazard disagree at ${x},${z}`);
   }
  }
  for(const [i,b]of c.layout.islands.entries()){
   assert.deepEqual(uniforms.islandShapes.value[i].toArray(),shorelineProfile(b,true));
   for(let a=0;a<Math.PI*2;a+=.05)assert.ok(shorelineRadius(a,shorelineProfile(b,true))>=1,'Original dry island footprint must remain dry');
  }
  group.dispose();group.children.forEach(m=>m.geometry.dispose());
 }
});

test('Pond interiors retain a deep floor without a polar center spike',()=>{
 let checked=0;for(const c of courses)for(const p of pondProfiles(c))for(let i=0;i<24;i++){
  const a=i*Math.PI/12,x=p.basin[0]+Math.cos(a)*p.basin[2]*.025,z=p.basin[1]+Math.sin(a)*p.basin[3]*.025;
  if(!waterAt(c,x,z))continue;
  // Islands and bridges can intentionally produce a nearby shallow collar.
  if(c.layout.islands.length||c.layout.bridgeSegments.length)continue;
  assert.ok(heightAt(c,x,z)<=p.surface-p.depth*.99,`${c.name}: artificial shallow apex at pond center`);checked++;
 }assert.ok(checked>500);
});
