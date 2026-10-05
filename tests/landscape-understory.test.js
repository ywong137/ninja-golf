import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {COURSE_SETS,COURSE_BOUNDS} from '../src/course.js';
import {landscapeUnderstoryPlacements,buildLandscapeUnderstory,UNDERSTORY_LIMITS} from '../src/landscape-understory.js';
const ground=(x,z)=>35+x*.004+z*.009;
test('Shrub patches remain deterministic, grounded, bounded and outside every playable hole',()=>{
 for(const set of COURSE_SETS.slice(1,3))for(const c of set.holes){
  const records=landscapeUnderstoryPlacements(c,ground);assert.ok(records.length>1000);assert.ok(records.length<=UNDERSTORY_LIMITS[c.theme]);assert.deepEqual(records,landscapeUnderstoryPlacements(c,ground));
  for(const p of records){assert.equal(p.y,ground(p.x,p.z)-.045);assert.ok(p.x<=COURSE_BOUNDS.minX-65||p.x>=COURSE_BOUNDS.maxX+65||p.z<=COURSE_BOUNDS.minZ-65||p.z>=c.length+COURSE_BOUNDS.endMargin+65);assert.ok(p.scale>0&&p.scale<2);}
  assert.equal(new Set(records.map(p=>p.species)).size,c.theme==='desert'?2:1);
 }
 for(const set of [COURSE_SETS[0],COURSE_SETS[3]])assert.deepEqual(landscapeUnderstoryPlacements(set.holes[0],ground),[]);
});
test('Shrubs leave water, cliffs, high summits and invalid terrain empty',()=>{
 for(const set of COURSE_SETS.slice(1,3)){
  const c=set.holes[0];for(const height of [()=>0,()=>NaN,()=>1000,(x,z)=>1000+x*2+z*2])assert.deepEqual(landscapeUnderstoryPlacements(c,height),[]);
 }
});
test('Background shrubs use two triangles and one ground quad per plant with shared atlas textures',()=>{
 const map=new THREE.Texture(),metadata=JSON.parse(fs.readFileSync(new URL('../src/nature-views.json',import.meta.url))),sources=Object.fromEntries(['woody-scrub','desert-scrub'].map(n=>[n,{map,normalMap:map,shadowMap:map,...metadata[n]}]));
 for(const set of COURSE_SETS.slice(1,3)){
  const root=new THREE.Group(),result=buildLandscapeUnderstory(root,set.holes[0],sources,ground);
  assert.equal(result.meshes.length,set.holes[0].theme==='desert'?2:1);assert.equal(root.children.length,result.meshes.length*2);
  assert.equal(result.meshes.reduce((n,m)=>n+m.count,0),result.records.length);
  for(const mesh of result.meshes){assert.equal(mesh.geometry.index.count,6);assert.equal(mesh.castShadow,false);assert.equal(mesh.material.map,map);assert.ok(mesh.boundingSphere.radius>0);}
  assert.equal(result.shadows.reduce((n,m)=>n+m.geometry.index.count,0),result.records.length*6);
  for(const mesh of root.children){assert.equal(mesh.castShadow,false);mesh.geometry.dispose();mesh.material.dispose();if(mesh.isInstancedMesh)mesh.dispose();}
 }
 assert.throws(()=>buildLandscapeUnderstory(new THREE.Group(),COURSE_SETS[2].holes[0],{'desert-scrub':{}},ground),/Missing desert-scrub shrub atlas/);map.dispose();
});
