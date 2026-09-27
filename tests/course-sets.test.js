import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,COURSES,lieAt,heightAt,center,ellipse} from '../src/course.js';
import {World} from '../src/world.js';
import {courseMaterial} from '../src/terrain.js';
import {buildThemeScenery,buildFairwayCover} from '../src/course-themes.js';

test('Four complete rounds have unique identities and original layouts',()=>{
 assert.equal(COURSE_SETS.length,4);assert.equal(COURSES,COURSE_SETS[0].holes);
 const all=COURSE_SETS.flatMap(s=>s.holes);assert.equal(all.length,36);assert.equal(new Set(all.map(c=>c.id)).size,36);assert.equal(new Set(all.map(c=>c.name)).size,36);
 for(const s of COURSE_SETS){assert.equal(s.holes.length,9);assert.ok(s.holes.reduce((v,c)=>v+c.par,0)>=35);for(const c of s.holes){assert.equal(c.courseId,s.id);assert.equal(c.theme,s.theme);assert.ok(c.bunkers.length<=4);}}
});
test('All 36 tees and greens are dry; hazards remain distinct',()=>{
 for(const s of COURSE_SETS)for(const c of s.holes){
  assert.equal(lieAt(c,0,0),'Tee',c.name);assert.equal(lieAt(c,c.greenX,c.length),'Green',c.name);
  assert.ok(heightAt(c,0,0)>3.1);assert.ok(heightAt(c,c.greenX,c.length)>3.1);
  assert.equal(lieAt(c,c.pond[0],c.pond[1]),'Water');assert.ok(heightAt(c,c.pond[0],c.pond[1])<3.1);
  for(const b of c.bunkers)assert.equal(lieAt(c,b[0],b[1]),'Bunker',c.name);
  for(let z=0;z<=c.length;z+=4){const x=center(c,z),y=heightAt(c,x,z);assert.ok(Number.isFinite(y));if(ellipse(x,z,c.pond)>1.2)assert.ok(y>.8,c.name);}
 }
});
test('Inland courses do not inherit an invisible coastal water hazard',()=>{
 for(const s of COURSE_SETS.filter(s=>['desert','cyberpunk'].includes(s.theme)))for(const c of s.holes){assert.notEqual(lieAt(c,190,20),'Water');assert.ok(heightAt(c,190,20)>.8);}
});
test('Neon winding routes end at the cup and have shader parity',()=>{
 for(const c of COURSE_SETS[3].holes){assert.ok(Math.abs(center(c,0))<1e-10);assert.ok(Math.abs(center(c,c.length)-c.greenX)<1e-10);for(let z=0;z<=c.length;z+=10){const t=Math.max(0,Math.min(1,z/c.length));assert.equal(center(c,z),Math.sin(t*Math.PI)*c.bend+c.greenX*t+c.weave*Math.sin(t*Math.PI*2));}}
 const c=COURSE_SETS[3].holes[0],m=courseMaterial(c,{grassColor:null,grassNormal:null}),shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <normal_fragment_maps>'};m.onBeforeCompile(shader);assert.equal(shader.uniforms.courseWeave.value,c.weave);assert.equal(shader.uniforms.courseCoastal.value,0);assert.ok(shader.fragmentShader.includes('courseWeave*sin(t*6.2831853)'));m.dispose();
});
test('Each new theme uses batched scenery and registers useful cover',()=>{
 for(const s of COURSE_SETS.slice(1)){const root=new THREE.Group(),sites=[];buildThemeScenery(root,s.holes[0],sites);assert.ok(root.children.length<22,`${s.theme}: ${root.children.length} draw calls`);assert.ok(root.children.some(o=>o.isInstancedMesh));assert.ok(sites.filter(o=>o.kind==='lantern').length>=10);assert.ok(sites.some(o=>o.kind==='tree'));root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
});

test('All 36 holes have dry interior cover outside the landing centre',()=>{
 for(const set of COURSE_SETS)for(const c of set.holes){const root=new THREE.Group(),sites=[];assert.ok(buildFairwayCover(root,c,sites)>=2,c.name);for(const site of sites){assert.equal(lieAt(c,site.x,site.z),'Fairway');assert.equal(site.fairway,true);assert.ok(Math.abs(site.x-center(c,site.z))>c.width*.5,c.name);assert.ok(site.y>3.1);}}
});

test('Landmarks and background rocks stay outside all new landing corridors',()=>{
 for(const set of COURSE_SETS.slice(1))for(const c of set.holes){
  const root=new THREE.Group();buildThemeScenery(root,c,[]);
  for(const landmark of root.userData.landmarks)for(let z=landmark.z-landmark.halfDepth;z<=landmark.z+landmark.halfDepth;z+=2){assert.ok(landmark.x+landmark.halfWidth<center(c,z)-c.width,c.name);}
  root.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.geometry?.dispose();o.material?.dispose();});
  const rocksRoot=new THREE.Group();World.prototype.makeRocks.call({root:rocksRoot,course:c,texture:()=>null},(()=>{let seed=17;return()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};})());
  const rocks=rocksRoot.children[0],matrix=new THREE.Matrix4(),position=new THREE.Vector3();
  for(let i=0;i<rocks.count-20;i++){rocks.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);assert.ok(Math.abs(position.x-center(c,position.z))>=c.width+11.99,c.name);assert.ok(Math.hypot(position.x-c.greenX,position.z-c.length)>=27.99,c.name);}
  rocks.dispose();rocks.geometry.dispose();rocks.material.dispose();
 }
});
