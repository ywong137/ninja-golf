import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,COURSES,lieAt,heightAt,fairwayDistance,routePoint,waterAt,waterBasins,waterSurfaceAt,mapOutlines} from '../src/course.js';
import {MAX_FAIRWAY_SEGMENTS,MAX_BRIDGES,MAX_ISLANDS,MAX_WATERS} from '../src/course-layout.js';
import {courseMaterial} from '../src/terrain.js';
import {createPond} from '../src/water.js';

test('Four rounds contain 36 independently authored topology plans',()=>{
 assert.equal(COURSE_SETS.length,4);assert.equal(COURSES,COURSE_SETS[0].holes);
 const all=COURSE_SETS.flatMap(s=>s.holes);assert.equal(all.length,36);assert.equal(new Set(all.map(c=>c.layout.kind)).size,36);
 for(const set of COURSE_SETS){assert.equal(set.holes.length,9);assert.equal(set.holes.reduce((v,c)=>v+c.par,0),36);for(const c of set.holes){assert.equal(c.courseId,set.id);assert.ok(c.strategy.length>45);assert.ok(c.layout.segments.length<=MAX_FAIRWAY_SEGMENTS);assert.ok(c.layout.bridgeSegments.length<=MAX_BRIDGES);assert.ok(c.layout.islands.length<=MAX_ISLANDS);assert.ok(c.waters.length<=MAX_WATERS);assert.ok(c.bunkers.length<=4);}}
});
test('All 36 tee and green discs remain dry and every walking route reaches the cup',()=>{
 for(const set of COURSE_SETS)for(const c of set.holes){
  assert.equal(lieAt(c,0,0),'Tee',c.name);assert.equal(lieAt(c,c.greenX,c.length),'Green',c.name);
  for(const [x,z] of [[0,0],[c.greenX,c.length]]){assert.ok(heightAt(c,x,z)>3.1);for(let a=0;a<6.28;a+=.5)assert.equal(waterAt(c,x+Math.cos(a)*4,z+Math.sin(a)*4),false,c.name);}
  const end=routePoint(c,1);assert.ok(Math.hypot(end.x-c.greenX,end.z-c.length)<1e-8);
  for(let i=0;i<=800;i++){const p=routePoint(c,i/800);assert.ok(!['Water','Out of bounds'].includes(lieAt(c,p.x,p.z)),`${c.name} route ${i}`);assert.ok(Number.isFinite(heightAt(c,p.x,p.z)));}
  for(const b of c.bunkers)assert.equal(lieAt(c,b[0],b[1]),'Bunker',c.name);
 }
});
test('Layouts include real disconnected pads, forks, elbows, and backward hairpins',()=>{
 const crane=COURSE_SETS[0].holes[0];assert.equal(lieAt(crane,54,crane.length*.70),'Fairway');assert.equal(lieAt(crane,0,crane.length*.70),'Rough');
 const fork=COURSE_SETS[1].holes[0];assert.ok(fairwayDistance(fork,-51,fork.length*.6)<0);assert.ok(fairwayDistance(fork,42,fork.length*.6)<0);assert.ok(fairwayDistance(fork,0,fork.length*.6)>10);
 const packets=COURSE_SETS[3].holes[3];assert.ok(fairwayDistance(packets,64,packets.length*.4)<0);assert.ok(fairwayDistance(packets,0,packets.length*.55)>15);
 const noodle=COURSE_SETS[3].holes[6];assert.ok(noodle.layout.route.some((p,i,a)=>i&&p[1]<a[i-1][1]));
 const island=COURSE_SETS[0].holes[1];assert.equal(waterAt(island,island.greenX,island.length),false);assert.equal(waterAt(island,island.greenX,island.length-38),true);
 assert.ok(COURSE_SETS.flatMap(s=>s.holes).filter(c=>c.layout.fairways.length>1).length>=18);
});
test('Walking bridges cross real water without creating broad fairways',()=>{
 const c=COURSE_SETS[3].holes[7],s=c.layout.bridgeSegments[2],x=(s[0]+s[2])*.5,z=(s[1]+s[3])*.5;
 assert.equal(waterAt(c,x,z),false);assert.ok(heightAt(c,x,z)>3.1);assert.ok(fairwayDistance(c,x,z)>0);
 const dx=s[2]-s[0],dz=s[3]-s[1],len=Math.hypot(dx,dz),xx=x-dz/len*7,zz=z+dx/len*7;
 assert.equal(waterAt(c,xx,zz),true);assert.ok(heightAt(c,xx,zz)<waterSurfaceAt(c,xx,zz));
});
test('CPU coverage supplies shader primitives and map boundaries for every hole',()=>{
 for(const set of COURSE_SETS)for(const c of set.holes){const m=courseMaterial(c,{grassColor:null,grassNormal:null}),shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <normal_fragment_maps>'};m.onBeforeCompile(shader);assert.equal(shader.uniforms.routeCount.value,c.layout.segments.length);assert.ok(shader.fragmentShader.includes('float edge=routeDistance(p)'));assert.ok(!shader.fragmentShader.includes('cx=sin('));
  const outlines=mapOutlines(c);assert.equal(outlines.length,c.layout.segments.length);for(const polygon of outlines)assert.ok(polygon.length>=16&&polygon.every(p=>p.every(Number.isFinite)));m.dispose();}
});
test('Multiple water basins share dry masks and release all reflection targets',()=>{
 const c=COURSE_SETS[3].holes[8],u={time:{value:0},skyMap:{value:null},hasSky:{value:0}},group=createPond(c,u);assert.equal(group.children.length,waterBasins(c).length);let disposed=0;for(const mesh of group.children){mesh.getRenderTarget().addEventListener('dispose',()=>disposed++);assert.equal(mesh.material.uniforms.time,u.time);assert.equal(mesh.material.uniforms.bridgeCount.value,c.layout.bridgeSegments.length);assert.ok(mesh.material.fragmentShader.includes('dryDistance(p)<0.'));}group.dispose();assert.equal(disposed,2);group.children.forEach(m=>m.geometry.dispose());
});
