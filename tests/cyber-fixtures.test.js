import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CYBER_FIXTURES,queueCyberFixture,flushCyberFixtures} from '../src/cyber-fixtures.js';
import {buildThemeScenery,buildFairwayCover} from '../src/course-themes.js';
import {COURSE_SETS} from '../src/course.js';
import {SceneryCollision} from '../src/scenery-collision.js';

test('Fixture geometry fits its published height and circular collision at arbitrary yaw',()=>{
 for(const kind of Object.keys(CYBER_FIXTURES))for(const yaw of [0,.27,Math.PI/4]){
  const root=new THREE.Group(),spec=queueCyberFixture(root,{x:3,y:5,z:-7,kind,yaw});flushCyberFixtures(root);
  let bottom=Infinity,top=-Infinity,triangles=0;for(const mesh of root.children){const p=mesh.geometry.attributes.position;triangles+=p.count/3;for(let i=0;i<p.count;i++){const y=p.getY(i)-5;bottom=Math.min(bottom,y);top=Math.max(top,y);assert.ok(Math.hypot(p.getX(i)-3,p.getZ(i)+7)<=spec.radius+1e-5);assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));}}
  assert.ok(bottom<0&&bottom>=-.06,'Plinth must enter the ground slightly');assert.ok(Math.abs(top-spec.height)<1e-5);assert.ok(triangles<1800);assert.equal(root.children.length,3);assert.ok(root.children.every(m=>!m.isLight));
 }
});
test('Appending fairway fixtures keeps three batches and disposes replaced buffers',()=>{
 const root=new THREE.Group();queueCyberFixture(root,{x:0,y:0,z:0});flushCyberFixtures(root);const meshes=[...root.children];let disposed=0;for(const m of meshes)m.geometry.addEventListener('dispose',()=>disposed++);
 queueCyberFixture(root,{x:4,y:0,z:0,kind:'cover'});flushCyberFixtures(root);assert.deepEqual(root.children,meshes);assert.equal(disposed,3);assert.equal(root.userData.cyberFixtures.length,2);
});
test('Cyber course placements retain ambush sites with matching fixture bounds',()=>{
 const course=COURSE_SETS.find(c=>c.id==='neo-tokyo').holes[0],root=new THREE.Group(),sites=[];buildThemeScenery(root,course,sites);buildFairwayCover(root,course,sites,{color:new THREE.Texture(),normal:new THREE.Texture()});
 const fixtures=root.userData.cyberFixtures;assert.ok(fixtures.length>20);assert.ok(fixtures.some(f=>f.kind==='cover'));assert.equal(root.children.filter(m=>m.userData.cyberFixtureBatch).length,3);
 const collision=new SceneryCollision(sites);for(const fixture of fixtures){const site=sites.find(s=>s.x===fixture.x&&s.z===fixture.z&&s.kind==='lantern');assert.ok(site);assert.equal(site.height,fixture.height);assert.equal(site.radius,fixture.radius);assert.equal(collision.blocked({x:site.x,y:site.y,z:site.z},.1,1),true);assert.equal(collision.blocked({x:site.x,y:site.y+site.height+.01,z:site.z},.1,.1),false);}
});

test('Rebuilding on a cleared course root creates attached fresh batches',()=>{
 const root=new THREE.Group();queueCyberFixture(root,{x:0,y:0,z:0});flushCyberFixtures(root);const old=[...root.children];root.clear();root.userData={};queueCyberFixture(root,{x:12,y:0,z:0});flushCyberFixtures(root);assert.equal(root.children.length,3);assert.ok(root.children.every(m=>!old.includes(m)));assert.equal(root.userData.cyberFixtures.length,1);
});
