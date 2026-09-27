import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scaleBoxUV} from '../src/architecture-uv.js';
import {architecturalSurface} from '../src/architecture-materials.js';
import {buildArchitecture} from '../src/architecture.js';
import {COURSE_SETS} from '../src/course.js';

test('Every box face has equal meter density and retains its UV orientation',()=>{
 for(const dimensions of [[.2,.4,.7],[20,6,15],[3,19,.3]]){
  const geometry=new THREE.BoxGeometry(),original=geometry.attributes.uv.array.slice();scaleBoxUV(geometry,...dimensions);geometry.scale(...dimensions);
  const p=geometry.attributes.position,uv=geometry.attributes.uv,index=geometry.index;
  for(let i=0;i<index.count;i+=3){
   const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
   const winding=values=>{const [a,b,c]=ids;return(values[b*2]-values[a*2])*(values[c*2+1]-values[a*2+1])-(values[b*2+1]-values[a*2+1])*(values[c*2]-values[a*2]);};
   assert.equal(Math.sign(winding(uv.array)),Math.sign(winding(original)));
   for(let edge=0;edge<3;edge++){
    const a=ids[edge],b=ids[(edge+1)%3],meters=Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b)),repeats=Math.hypot(uv.getX(a)-uv.getX(b),uv.getY(a)-uv.getY(b));
    assert.ok(Math.abs(meters/repeats-1.25)<1e-6);
   }
  }
  geometry.dispose();
 }
});

test('UV scaling survives rotation and merging without changing geometry or normals',()=>{
 const pieces=[];
 for(const [i,dimensions]of [[2,4,7],[9,.5,3]].entries()){
  const geometry=new THREE.BoxGeometry(),positions=geometry.attributes.position.array.slice(),normals=geometry.attributes.normal.array.slice();
  scaleBoxUV(geometry,...dimensions,2);assert.deepEqual(geometry.attributes.position.array,positions);assert.deepEqual(geometry.attributes.normal.array,normals);
  geometry.scale(...dimensions).rotateY(.73).translate(i*20,4,-30);pieces.push(geometry.toNonIndexed());geometry.dispose();
 }
 const merged=mergeGeometries(pieces);assert.ok([...merged.attributes.uv.array].every(Number.isFinite));pieces.forEach(g=>g.dispose());merged.dispose();
 assert.throws(()=>scaleBoxUV(new THREE.BoxGeometry(),2,0,3),/positive finite/);
});

test('Japanese finished stone uses local UV density and leaves cached textures unchanged',()=>{
 const color=new THREE.Texture(),normal=new THREE.Texture();color.repeat.set(2,3);normal.repeat.set(4,5);const root=new THREE.Group();
 buildArchitecture(root,COURSE_SETS[0].holes[0],{color,normal});
 const stone=root.children.find(m=>m.material.map===color);assert.ok(stone);assert.deepEqual(stone.material.normalScale.toArray(),[.2,.2]);assert.equal(stone.material.normalMap,normal);
 assert.deepEqual(color.repeat.toArray(),[2,3]);assert.deepEqual(normal.repeat.toArray(),[4,5]);assert.equal(color.wrapS,THREE.ClampToEdgeWrapping);
 assert.ok([...stone.geometry.attributes.uv.array].some(v=>v>10));assert.equal(root.children.length,6);
 for(const mesh of root.children){assert.ok([...mesh.geometry.attributes.uv.array].every(Number.isFinite));mesh.geometry.dispose();mesh.material.dispose();}
 color.dispose();normal.dispose();
});

test('Finish shader keeps separate wood and plaster programs with bounded color variation',()=>{
 const plaster=architecturalSurface('#d8c9a4'),wood=architecturalSurface('#4a2c1d',.82,0,true);
 const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};plaster.onBeforeCompile(shader);
 assert.ok(shader.fragmentShader.includes('architectureNoise'));assert.ok(shader.fragmentShader.includes('.026'));assert.equal(shader.fragmentShader.includes('patina'),false);assert.notEqual(plaster.customProgramCacheKey(),wood.customProgramCacheKey());
 assert.equal(plaster.roughness,.85);assert.equal(wood.roughness,.82);plaster.dispose();wood.dispose();
});
