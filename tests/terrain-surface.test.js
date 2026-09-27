import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTerrainSurfaceSampler} from '../src/terrain-surface.js';
import {landscapeHorizon} from '../src/landscape-horizon.js';
import {COURSE_SETS} from '../src/course.js';
test('Indexed and unindexed triangle sampling matches downward raycasts, including shared edges',()=>{
 const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute([-80,4,-60,80,18,-60,-80,12,60,80,3,60],3));indexed.setIndex([0,2,1,1,2,3]);
 for(const geometry of [indexed,indexed.toNonIndexed()]){
  const sample=createTerrainSurfaceSampler(geometry,{cellSize:20}),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);
  for(const [x,z]of [[0,0],[-80,-60],[80,60],[-40,-30],[40,30],[30,-40],[-10,50],[-60,0]]){ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert.ok(hit);assert.ok(Math.abs(sample(x,z)-hit.point.y)<1e-6);}
  assert.equal(sample(200,0),null);assert.equal(sample(NaN,0),null);geometry.dispose();mesh.material.dispose();
 }
});
test('The regional horizon index stays bounded and matches rendered triangles across its four patches',()=>{
 const region={size:2,heights:new Int16Array([150,750,400,1100]),u:.5,v:.5,span:12000,direction:1,datum:0,scale:1},c=COURSE_SETS[0].holes[0],geometry=landscapeHorizon(c,region),sample=createTerrainSurfaceSampler(geometry);
 assert.ok(sample.stats.references<500000);assert.ok(sample.stats.bins<50000);assert.ok(sample.stats.triangles>10000);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);
 for(const [x,z]of [[-460,100],[-919,431],[650,120],[1200,-770],[0,-370],[215,c.length+480],[-3100,1900],[4300,-3500]]){ray.set(new THREE.Vector3(x,10000,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert.ok(hit,`${x},${z}`);assert.ok(Math.abs(sample(x,z)-hit.point.y)<1e-5);}
 assert.equal(sample(0,100),null);geometry.dispose();mesh.material.dispose();
});
