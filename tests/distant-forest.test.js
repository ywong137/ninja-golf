import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,COURSE_BOUNDS} from '../src/course.js';
import {landscapeHeight} from '../src/regional-terrain.js';
import {distantForestPlacements,buildDistantForest,DISTANT_FOREST_LIMITS} from '../src/distant-forest.js';
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
