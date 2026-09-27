import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {forestShadowGeometry,buildForestShadows,FOREST_SHADOW_GRID} from '../src/forest-shadows.js';
const source={...JSON.parse(fs.readFileSync(new URL('../src/nature-views.json',import.meta.url)))['forest-canopy'],shadowMap:new THREE.Texture()};
test('Projected tree silhouettes keep the baked sun orientation and conform to supplied terrain',()=>{
 const height=(x,z)=>12+x*.2-z*.1,records=[{x:40,z:-30,scale:1.3,angle:Math.PI/2}],geometry=forestShadowGeometry(records,source,height);
 const position=geometry.attributes.position,uv=geometry.attributes.uv,bounds=geometry.attributes.atlasBounds;
 const [minX,minZ,maxX,maxZ]=source.shadowViews[2];
 assert.equal(position.count,(FOREST_SHADOW_GRID+1)**2);
 assert.ok(Math.abs(position.getX(0)-(40+minX*1.3))<1e-5);
 assert.ok(Math.abs(position.getZ(0)-(-30+minZ*1.3))<1e-5);
 const last=position.count-1;
 assert.ok(Math.abs(position.getX(last)-(40+maxX*1.3))<1e-5);
 assert.ok(Math.abs(position.getZ(last)-(-30+maxZ*1.3))<1e-5);
 for(let i=0;i<position.count;i++){
  assert.ok(Math.abs(position.getY(i)-height(position.getX(i),position.getZ(i))-.055)<4e-6);
  assert.ok(uv.getX(i)>=.5&&uv.getX(i)<=.75);assert.ok(uv.getY(i)>=.5&&uv.getY(i)<=1);
  assert.ok(bounds.getX(i)>.5&&bounds.getZ(i)<.75);
 }
 geometry.dispose();
});
test('Shadow batching preserves one draw and rejects invalid atlas or terrain data',()=>{
 const records=Array.from({length:100},(_,i)=>({x:i*30,z:i*20,scale:1,angle:i}));
 const mesh=buildForestShadows(records,source,()=>10);
 assert.equal(mesh.geometry.groups.length,0);assert.equal(mesh.geometry.index.count,100*FOREST_SHADOW_GRID**2*6);
 assert.equal(mesh.material.uniforms.map.value,source.shadowMap);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);
 assert.equal(mesh.material.fog,true);assert.equal(mesh.material.depthWrite,false);
 assert.throws(()=>forestShadowGeometry(records,{},()=>10),/eight baked/);
 assert.throws(()=>forestShadowGeometry(records,source,()=>NaN),/non-finite/);
 mesh.geometry.dispose();mesh.material.dispose();
});

test('Distant-only impostors retain coverage near survey cameras while regular tree LOD remains unchanged',async()=>{
 const {treeImpostor}=await import('../src/foliage-materials.js');
 const atlas={...source,map:new THREE.Texture(),normalMap:new THREE.Texture()},normal=treeImpostor(atlas),distant=treeImpostor(atlas,{nearFade:false});
 const compile=material=>{const shader={uniforms:{},vertexShader:'#include <project_vertex>\n#include <worldpos_vertex>',fragmentShader:'#include <map_fragment>\n#include <alphatest_fragment>\n#include <normal_fragment_maps>'};material.onBeforeCompile(shader);return shader;};
 assert.match(compile(normal).fragmentShader,/screenNoise/);assert.doesNotMatch(compile(distant).fragmentShader,/screenNoise/);
 assert.notEqual(normal.customProgramCacheKey(),distant.customProgramCacheKey());
 normal.dispose();distant.dispose();
});
