import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {queueSceneryRock,fitSceneryRock} from '../src/scenery-rocks.js';
import {buildThemeScenery,buildFairwayCover} from '../src/course-themes.js';
import {COURSE_SETS,lieAt} from '../src/course.js';

test('Both licensed rock scans fit their cover dimensions across both LOD bounds',()=>{
 for(const source of ['coastal-rock','desert-rock']){
  const glb=fs.readFileSync(new URL(`../public/models/nature/${source}.glb`,import.meta.url)),json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)));
  const boxes=json.meshes.flatMap(m=>m.primitives.map(p=>{const a=json.accessors[p.attributes.POSITION];return new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max));}));
  const bounds=boxes.reduce((b,p)=>b.union(p),new THREE.Box3()),original=bounds.clone();
  for(const angle of [0,.71,2.6,4.7]){
   const record={x:17,z:-31,y:8,height:1.95,radius:1.15,angle,burial:.16},fit=fitSceneryRock(record,bounds),object=new THREE.Object3D();
   object.position.set(fit.x,fit.y,fit.z);object.rotation.y=angle;object.scale.set(fit.scaleX,fit.scaleY,fit.scaleZ);object.updateMatrix();
   let minY=Infinity,maxY=-Infinity;
   for(const box of boxes)for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const v=new THREE.Vector3(x,y,z).applyMatrix4(object.matrix);assert.ok(Math.hypot(v.x-record.x,v.z-record.z)<=record.radius+1e-6);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
   }
   assert.ok(Math.abs(maxY-record.y-record.height)<1e-6);assert.ok(minY<record.y);assert.equal(fit.scaleX,fit.scaleZ,'Keep the horizontal scan proportions');
  }
  assert.ok(bounds.equals(original),'Fitting must not modify shared source bounds');
 }
});

test('Theme rocks retain visible cover sites and a bounded shared instance queue',()=>{
 for(const set of COURSE_SETS.slice(1,3))for(const c of set.holes){
  const root=new THREE.Group(),sites=[];buildThemeScenery(root,c,sites);const covers=buildFairwayCover(root,c,sites,{color:null,normal:null}),queue=root.userData.sceneryRocks;
  assert.ok(sites.some(s=>s.kind==='rock'));assert.ok(queue.length>covers&&queue.length<100);
  for(const site of sites.filter(s=>s.kind==='rock')){
   const rock=queue.find(p=>p.x===site.x&&p.z===site.z);assert.ok(rock,`${c.name}: invisible rock cover`);assert.equal(rock.height,site.height);assert.ok(rock.height/rock.radius<1);assert.notEqual(lieAt(c,rock.x,rock.z),'Water');
  }
  root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 }
});

test('Scenery queues reject malformed records and excessive detail',()=>{
 const root=new THREE.Group(),r={x:0,y:5,z:0,height:1,radius:1};assert.throws(()=>queueSceneryRock(root,{...r,radius:0}),/positive/);
 for(let i=0;i<256;i++)queueSceneryRock(root,r);assert.throws(()=>queueSceneryRock(root,r),/256/);
});
