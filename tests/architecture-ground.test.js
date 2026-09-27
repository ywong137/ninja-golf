import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,heightAt,lieAt,fairwayDistance} from '../src/course.js';
import {createCoursePath} from '../src/course-path.js';
import {buildArchitecture} from '../src/architecture.js';
import {buildThemeScenery} from '../src/course-themes.js';
import {buildArchitectureGround} from '../src/architecture-ground.js';
import {SceneryCollision} from '../src/scenery-collision.js';
import {BuildingNavigation} from '../src/building-navigation.js';

function build(c){
 const root=new THREE.Group(),path=createCoursePath(c,{}),sites=[];root.add(path);root.userData.pathContains=path.userData.contains;
 if(c.theme==='japanese')buildArchitecture(root,c,{color:null,normal:null});else buildThemeScenery(root,c,sites);
 const originalTriangles=path.geometry.index.count/3,originalObstacles=root.userData.buildingObstacles.length,ground=buildArchitectureGround(root,c,path,sites);
 return {root,path,sites,ground,originalTriangles,originalObstacles};
}
const cleanup=root=>root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});

test('Architectural courts and path connections stay dry and outside every playing surface',()=>{
 let connected=0;
 for(const c of COURSE_SETS.flatMap(s=>s.holes)){
  const {root,path,ground,originalTriangles}=build(c);
  assert.equal(ground.courts.length,root.userData.landmarks.length);
  for(const p of ground.samples){assert.ok(!['Water','Out of bounds','Green','Tee','Bunker'].includes(lieAt(c,p.x,p.z)));assert.ok(fairwayDistance(c,p.x,p.z)>.5);assert.equal(root.userData.pathContains(p.x,p.z),true);}
  const collision=new SceneryCollision([],root.userData.buildingObstacles);
  for(const link of ground.connections){
   connected++;assert.ok(link.length<65);assert.equal(path.userData.contains(link.end.x,link.end.z),true);
   for(let i=0;i<=100;i++){const x=link.start.x+(link.end.x-link.start.x)*i/100,z=link.start.z+(link.end.z-link.start.z)*i/100;
    assert.equal(collision.blocked({x,y:heightAt(c,x,z),z},.3,2,true),false,`${c.name}: blocked approach`);
    for(const side of [-1,1]){const dx=(link.end.x-link.start.x)/link.length,dz=(link.end.z-link.start.z)/link.length;assert.ok(!['Water','Out of bounds','Green','Tee','Bunker'].includes(lieAt(c,x-dz*side*1.25,z+dx*side*1.25)));}
   }
  }
  assert.ok(path.geometry.index.count/3-originalTriangles<6500);
  assert.equal(path.geometry.getAttribute('courtPaving').count,path.geometry.getAttribute('position').count);
  assert.ok([...path.geometry.getAttribute('uv').array].every(Number.isFinite));cleanup(root);
 }
 assert.ok(connected>=30,'The compounds should have actual route connections where dry corridors exist');
});

test('City entrance stairs reach their threshold without adding redundant navigation corners',()=>{
 for(const c of COURSE_SETS[3].holes){
  const {root,ground}=build(c),collision=new SceneryCollision([],root.userData.buildingObstacles),navigation=new BuildingNavigation(c,collision);
  assert.ok(navigation.nodes.length<100,`${c.name}: excessive redundant stair nodes`);
  for(const court of ground.courts){const steps=ground.steps.filter(s=>s.id.startsWith(court.id+'-step-'));if(!steps.length)continue;
   const site=root.userData.landmarks.find(s=>s.x===court.x);assert.ok(Math.abs(steps.at(-1).top-site.y)<1e-8);
   for(const [i,s]of steps.entries()){
    assert.ok(s.halfDepth*2>=.25);if(i)assert.ok(s.top-steps[i-1].top<=.19001);
    for(const dx of [-s.halfWidth,0,s.halfWidth]){const y=heightAt(c,s.x+dx,s.z);assert.ok(s.bottom<y);assert.ok(s.top>y,`${c.name}: buried step`);}
   }
  }
  assert.ok(root.children.filter(m=>m.name==='Building entrance steps').length<=1);cleanup(root);
 }
});
