import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TEE_MARKER_SIZE,teeMarkerFrames,buildTeeMarkers} from '../src/tee-markers.js';
import {COURSE_SETS,heightAt,ellipse,routePoint} from '../src/course.js';
import {courseSurfaceHeight} from '../src/terrain.js';
const surface=(c,x,z)=>courseSurfaceHeight(c,x,z,heightAt,ellipse);
test('Tee marker pairs follow the opening route and stay outside the golf stance',()=>{
 for(const set of COURSE_SETS)for(const course of set.holes){
  const route=routePoint(course,0),frames=teeMarkerFrames(course);
  for(const frame of frames){
   const p=new THREE.Vector3().setFromMatrixPosition(frame),up=new THREE.Vector3().setFromMatrixColumn(frame,1),forward=new THREE.Vector3().setFromMatrixColumn(frame,2);
   assert.ok(Math.abs(Math.hypot(p.x,p.z)-TEE_MARKER_SIZE.spacing)<1e-8);
   assert.ok(Math.abs(p.x*route.tangentX+p.z*route.tangentZ)<1e-8);
   assert.ok(forward.x*route.tangentX+forward.z*route.tangentZ>.97);assert.ok(up.y>.8);
   assert.ok(Math.abs(p.y-surface(course,p.x,p.z)+.006)<1e-8);
   for(const x of [-.075,.075])for(const z of [-.045,.045]){const contact=new THREE.Vector3(x,0,z).applyMatrix4(frame);assert.ok(Math.abs(contact.y-surface(course,contact.x,contact.z))<.018);}
  }
 }
});
test('Four marker finishes use four compact merged draws without mutating shared textures',()=>{
 const map=new THREE.Texture(),normal=new THREE.Texture(),colors=new Set();
 for(const set of COURSE_SETS){const root=new THREE.Group(),course=set.holes[0],group=buildTeeMarkers(root,course,{stoneColor:map,stoneNormal:normal});
  assert.equal(root.children.length,1);assert.equal(group.children.length,4);let triangles=0;
  for(const mesh of group.children){triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;if(mesh.name!=='Tee marker contact')assert.ok(mesh.castShadow&&mesh.receiveShadow);const p=mesh.geometry.attributes.position;for(let i=0;i<p.array.length;i++)assert.ok(Number.isFinite(p.array[i]));mesh.geometry.dispose();mesh.material.dispose();}
  assert.ok(triangles<2500);colors.add(group.children[0].material.color.getHex());
  assert.equal(group.children[0].material.map,course.theme==='cyberpunk'?null:map);
 }
 assert.equal(colors.size,4);assert.equal(map.repeat.x,1);assert.equal(map.repeat.y,1);map.dispose();normal.dispose();
});
