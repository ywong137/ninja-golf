import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,COURSE_BOUNDS} from '../src/course.js';
import {distantCityPlacements,buildDistantCity,DISTANT_CITY_LIMITS} from '../src/distant-city.js';

test('Every city hole has deterministic varied districts around all bearings outside play',()=>{
 for(const course of COURSE_SETS[3].holes){
  const records=distantCityPlacements(course),sectors=new Set();assert.deepEqual(records,distantCityPlacements(course));assert.ok(records.length>180&&records.length<=DISTANT_CITY_LIMITS.buildings);
  assert.equal(new Set(records.map(p=>p.form)).size,5);assert.equal(new Set(records.map(p=>p.band)).size,3);
  for(const p of records){
   const ex=(Math.abs(Math.cos(p.yaw))*p.width+Math.abs(Math.sin(p.yaw))*p.depth)/2,ez=(Math.abs(Math.sin(p.yaw))*p.width+Math.abs(Math.cos(p.yaw))*p.depth)/2,m=DISTANT_CITY_LIMITS.clearance;
   assert.ok(p.x+ex<=COURSE_BOUNDS.minX-m||p.x-ex>=COURSE_BOUNDS.maxX+m||p.z+ez<=COURSE_BOUNDS.minZ-m||p.z-ez>=course.length+COURSE_BOUNDS.endMargin+m);
   assert.ok(p.base>p.bottom);assert.ok(p.height>15);sectors.add(Math.floor((Math.atan2(p.z-course.length/2,p.x)+Math.PI)/(Math.PI/4))%8);
  }
  assert.equal(sectors.size,8);
 }
});

test('Distant city uses two static batches without collision records or texture dependencies',()=>{
 const root=new THREE.Group();root.userData.buildingObstacles=[{id:'unchanged'}];const result=buildDistantCity(root,COURSE_SETS[3].holes[0]);
 assert.equal(result.group.children.length,DISTANT_CITY_LIMITS.batches);assert.ok(result.group.userData.triangles<DISTANT_CITY_LIMITS.triangles);assert.deepEqual(root.userData.buildingObstacles,[{id:'unchanged'}]);
 for(const mesh of result.group.children){assert.equal(mesh.castShadow,false);assert.ok(!mesh.material.map);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}
 const haze=result.group.children.find(m=>m.name==='City horizon haze');assert.equal(haze.material.depthWrite,false);assert.equal(haze.renderOrder,-20);
 let disposedGeometry=0,disposedMaterial=0;for(const mesh of result.group.children){mesh.geometry.addEventListener('dispose',()=>disposedGeometry++);mesh.material.addEventListener('dispose',()=>disposedMaterial++);}
 result.dispose();assert.equal(root.children.length,0);assert.equal(disposedGeometry,2);assert.equal(disposedMaterial,2);
 const rebuilt=buildDistantCity(root,COURSE_SETS[3].holes[0]);assert.equal(root.children.length,1);rebuilt.dispose();
});

test('Daylight themes do not create distant city geometry or alter scene state',()=>{
 const root=new THREE.Group(),original={marker:true};root.userData=original;
 for(const set of COURSE_SETS.slice(0,3)){assert.deepEqual(distantCityPlacements(set.holes[0]),[]);assert.equal(buildDistantCity(root,set.holes[0]),null);}
 assert.equal(root.children.length,0);assert.equal(root.userData,original);
});
