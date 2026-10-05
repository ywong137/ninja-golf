import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,lieAt,routePoint,greenDistance} from '../src/course.js';
import {bunkerDistance} from '../src/bunkers.js';
import {ROUGH_GRASS,roughGrassGeometry,roughGrassGrowth,grassCellSample,placeGrassPatch} from '../src/rough-grass.js';
import templates from '../src/rough-grass-templates.json' with {type:'json'};

test('Authored grass retains twelve distinct leaf groups with finite photographic UVs',()=>{
 assert.equal(templates.length,12);assert.equal(new Set(templates.map(t=>t.name)).size,12);
 for(const t of templates){
  assert.equal(t.position.length,t.normal.length);assert.equal(t.uv.length/2,t.position.length/3);
  assert.ok(t.position.every(Number.isFinite)&&t.normal.every(Number.isFinite));assert.ok(t.uv.every(v=>v>=0&&v<=1));
 }
 const geometry=roughGrassGeometry('japanese');
 assert.ok(geometry.attributes.position.count/3<=450,'Dense patch geometry exceeds its budget');
 const normals=geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<1e-6,'Nonuniform leaf scaling must retain unit normals');
 geometry.computeBoundingBox();assert.ok(geometry.boundingBox.max.y<.11&&geometry.boundingBox.min.y===0);
 assert.ok(Math.max(Math.abs(geometry.boundingBox.min.x),Math.abs(geometry.boundingBox.max.x),Math.abs(geometry.boundingBox.min.z),Math.abs(geometry.boundingBox.max.z))<.5);
 geometry.dispose();
});

test('All courses keep grass outside playing surfaces, green collars, and bunker margins',()=>{
 let accepted=0,checked=0;
 for(const course of COURSE_SETS.flatMap(c=>c.holes)){
  const stations=[{x:0,z:0},{x:course.greenX,z:course.length},...course.bunkers.map(b=>({x:b[0],z:b[1]})),...Array.from({length:5},(_,i)=>routePoint(course,(i+1)/6))];
  for(const p of stations)for(let z=p.z-22;z<=p.z+22;z+=2.3)for(let x=p.x-24;x<=p.x+24;x+=2.3){
   checked++;const growth=roughGrassGrowth(course,x,z);assert.ok(Number.isFinite(growth)&&growth>=0&&growth<1.6);
   if(!growth)continue;accepted++;assert.equal(lieAt(course,x,z),'Rough');assert.ok(greenDistance(course,x,z)>=19.2);
   for(const b of course.bunkers)assert.ok(bunkerDistance(x,z,b)>=.8);
  }
 }
 assert.ok(checked>100000&&accepted>1000);
});

test('Grass patches follow sloping ground without rotating roots off the surface',()=>{
 const ground=(x,z)=>7+x*.21-z*.13,object=new THREE.Object3D(),point=new THREE.Vector3();
 for(const yaw of [0,.8,2.1,4.7]){
  placeGrassPatch(object,{x:12,z:-5,angle:yaw,scale:1.1},1.3,ground);
  for(const x of [-.4,0,.4])for(const z of [-.4,0,.4]){
   point.set(x,0,z).applyMatrix4(object.matrix);assert.ok(Math.abs(point.y-ground(point.x,point.z)+.004)<1e-10);
  }
 }
});

test('The streaming window hides its boundary and stable grass cells do not depend on player position',()=>{
 assert.ok(ROUGH_GRASS.radius-5>ROUGH_GRASS.fadeEnd);
 assert.ok(ROUGH_GRASS.streamRadius-Math.SQRT2*(2.5+.32*ROUGH_GRASS.step)>ROUGH_GRASS.fadeEnd);
 for(const [x,z]of [[1,2],[-11,9],[-6,-8],[340,500]]){
  const a=grassCellSample(x,z),b=grassCellSample(x,z);assert.deepEqual(a,b);
  assert.ok(a.x>x*ROUGH_GRASS.step&&a.x<(x+1)*ROUGH_GRASS.step);
  assert.ok(a.z>z*ROUGH_GRASS.step&&a.z<(z+1)*ROUGH_GRASS.step);
 }
});
