import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,COURSE_BOUNDS} from '../src/course.js';
import {landscapeHeight} from '../src/regional-terrain.js';
import {distantForestPlacements,buildDistantForest,DISTANT_FOREST_LIMITS} from '../src/distant-forest.js';
import {forestSpecies} from '../src/nature-species.js';
import {treeImpostor} from '../src/foliage-materials.js';
const region={size:2,heights:new Int16Array([100,180,100,180]),u:.5,v:.5,span:12000,direction:1,datum:0,scale:1};
test('Distant groves are deterministic, bounded, grounded, and outside all playable limits',()=>{
 for(const set of COURSE_SETS.slice(0,2))for(const c of set.holes){
  const records=distantForestPlacements(c,region);assert.ok(records.length>200);assert.ok(records.length<=DISTANT_FOREST_LIMITS[c.theme]);assert.deepEqual(records,distantForestPlacements(c,region));
  for(const p of records){assert.ok(p.x<=COURSE_BOUNDS.minX-65||p.x>=COURSE_BOUNDS.maxX+65||p.z<=COURSE_BOUNDS.minZ-65||p.z>=c.length+COURSE_BOUNDS.endMargin+65);assert.equal(p.y,landscapeHeight(c,region,p.x,p.z)-.12);if(c.theme==='japanese')assert.ok(p.x<=75);}
 }
 assert.deepEqual(distantForestPlacements(COURSE_SETS[2].holes[0],region),[]);
});
test('Forest belts use one atlas draw and one merged ground silhouette draw',()=>{
 const root=new THREE.Group(),map=new THREE.Texture(),source={map,normalMap:map,shadowMap:map,...JSON.parse(fs.readFileSync(new URL('../src/nature-views.json',import.meta.url)))['forest-canopy']};
 const result=buildDistantForest(root,COURSE_SETS[0].holes[0],region,source,null,()=>new THREE.MeshBasicMaterial({map}));
 assert.equal(root.children.length,2);assert.equal(result.shadow.castShadow,false);assert.equal(result.shadow.material.depthWrite,false);assert.equal(result.mesh.count,result.records.length);assert.equal(result.mesh.castShadow,false);assert.equal(result.mesh.receiveShadow,false);assert.equal(result.mesh.geometry.attributes.position.count,4);
 result.shadow.geometry.dispose();result.shadow.material.dispose();result.mesh.geometry.dispose();result.mesh.material.dispose();assert.ok(map.isTexture);map.dispose();
});

test('A rendered surface callback grounds every crown below the triangle height',()=>{
 const sample=(x,z)=>45+x*.001+z*.002,records=distantForestPlacements(COURSE_SETS[0].holes[0],region,sample);
 assert.ok(records.length>500);for(const p of records)assert.equal(p.y,sample(p.x,p.z)-.12);
});

test('Mixed forest belts preserve every species, instance transform, and terrain shadow',()=>{
 const metadata=JSON.parse(fs.readFileSync(new URL('../src/nature-views.json',import.meta.url)));
 const map=new THREE.Texture(),sourceFor=name=>({map,normalMap:map,shadowMap:map,...metadata[name]});
 for(const set of COURSE_SETS.slice(0,2)){
  const c=set.holes[0],root=new THREE.Group(),source={...sourceFor('forest-canopy'),species:forestSpecies(c.theme).map(entry=>({...entry,source:sourceFor(entry.name)}))};
  const sample=(x,z)=>40+x*.001+z*.002,result=buildDistantForest(root,c,region,source,sample,()=>new THREE.MeshBasicMaterial({map}));
  assert.equal(result.meshes.length,source.species.length);assert.equal(result.shadows.length,source.species.length);assert.equal(root.children.length,source.species.length*2);
  assert.equal(result.meshes.reduce((n,m)=>n+m.count,0),result.records.length);
  for(const mesh of result.meshes){
   const expected=result.records.filter(p=>p.species===mesh.userData.species);assert.equal(mesh.count,expected.length);
   assert.equal(mesh.geometry.parameters.width,metadata[mesh.userData.species].span);
   for(let i=0;i<mesh.count;i++){const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);const p=expected[i];for(const [axis,value]of [[12,p.x],[13,p.y],[14,p.z]])assert.ok(Math.abs(matrix.elements[axis]-value)<.001);}
  }
  for(const shadow of result.shadows){assert.equal(shadow.material.depthWrite,false);assert.ok(shadow.geometry.attributes.position.count>0);}
  for(const child of root.children){child.geometry.dispose();child.material.dispose();}
 }
 map.dispose();
});

test('Shared tree atlas programs keep each species center as independent material data',()=>{
 const map=new THREE.Texture(),materials=[4.1,9.5].map(center=>treeImpostor({map,normalMap:map,center}));
 const shaders=materials.map(material=>{const shader={uniforms:{},vertexShader:'#include <project_vertex>\n#include <worldpos_vertex>',fragmentShader:'#include <map_fragment>\n#include <alphatest_fragment>\n#include <normal_fragment_maps>'};material.onBeforeCompile(shader);return shader;});
 assert.equal(materials[0].customProgramCacheKey(),materials[1].customProgramCacheKey());
 assert.equal(shaders[0].vertexShader,shaders[1].vertexShader,'A shared cache key must compile the same vertex program');
 assert.equal(shaders[0].uniforms.treeCenterHeight.value,4.1);assert.equal(shaders[1].uniforms.treeCenterHeight.value,9.5);
 assert.notEqual(shaders[0].uniforms.treeCenterHeight,shaders[1].uniforms.treeCenterHeight);
 for(const material of materials)material.dispose();map.dispose();
});

test('Forest spacing protects trunks without leaving an empty cell around every tree',()=>{
 for(const set of COURSE_SETS.slice(0,2)){
  const c=set.holes[0],spacing=c.theme==='japanese'?13:17,records=distantForestPlacements(c,region,()=>40),nearest=records.map(()=>Infinity);
  // Measure actual nearest neighbors independently of the placement grid.
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
   const d=Math.hypot(records[i].x-records[j].x,records[i].z-records[j].z);
   assert.ok(d>=spacing,`${c.theme} trees overlap their ${spacing} metre spacing`);
   nearest[i]=Math.min(nearest[i],d);nearest[j]=Math.min(nearest[j],d);
  }
  assert.ok(nearest.filter(d=>d<spacing*1.3).length/nearest.length>.3,`${c.theme} groves are too sparse to join their crowns`);
 }
});
