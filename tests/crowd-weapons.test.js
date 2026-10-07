import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Matrix4,Mesh,MeshStandardMaterial,Scene} from 'three';
import {CrowdWeapons} from '../src/crowd-weapons.js';
const geometry=new BoxGeometry(.1,1,.03),material=new MeshStandardMaterial();
function actor(scene,x=0){const root=new Group(),weapon=new Group(),mesh=new Mesh(geometry,material);root.position.set(x,2,3);root.rotation.y=x*.15;weapon.position.set(.2,1,.3);weapon.rotation.z=.7;mesh.castShadow=true;weapon.add(mesh);root.add(weapon);scene.add(root);return{root,weapon,mesh,dead:0};}
test('crowd weapon instances preserve each animated world matrix and shared geometry',()=>{
 const scene=new Scene();scene.position.set(2,0,4);const crowd=new CrowdWeapons(scene),actors=[actor(scene),actor(scene,3)];crowd.update(actors);scene.updateMatrixWorld(true);crowd.updateMatrices();
 assert.equal(crowd.batches.size,1);const batch=[...crowd.batches.values()][0];assert.equal(batch.mesh.count,2);assert.equal(batch.mesh.geometry,geometry);assert.equal(batch.mesh.material,material);assert.equal(batch.mesh.castShadow,true);
 const actual=new Matrix4();for(let i=0;i<actors.length;i++){assert.equal(actors[i].mesh.visible,false);batch.mesh.getMatrixAt(i,actual);actual.premultiply(batch.mesh.matrixWorld);actual.elements.forEach((v,k)=>assert.ok(Math.abs(v-actors[i].mesh.matrixWorld.elements[k])<1e-6));}
 actors[0].weapon.rotation.x=.8;scene.updateMatrixWorld(true);crowd.updateMatrices();batch.mesh.getMatrixAt(0,actual);actual.premultiply(batch.mesh.matrixWorld);actual.elements.forEach((v,k)=>assert.ok(Math.abs(v-actors[0].mesh.matrixWorld.elements[k])<1e-6));crowd.dispose();
});
test('hidden, dying, and portrait weapons use their original visibility and materials',()=>{
 const scene=new Scene(),crowd=new CrowdWeapons(scene),a=actor(scene),b=actor(scene,2);crowd.update([a,b]);a.dead=1;b.weapon.visible=false;crowd.update([a,b]);assert.equal(a.mesh.visible,true);assert.equal(b.mesh.visible,true);assert.ok([...crowd.batches.values()].every(b=>!b.mesh.visible));
 a.dead=0;b.weapon.visible=true;crowd.update([a,b]);crowd.update([a,b],{enabled:false});assert.equal(a.mesh.visible,true);assert.equal(b.mesh.visible,true);assert.ok([...crowd.batches.values()].every(b=>!b.mesh.visible));crowd.update([]);assert.equal(crowd.batches.size,0);
});
test('material arrays batch by their contents and capacity grows without losing actors',()=>{
 const scene=new Scene(),crowd=new CrowdWeapons(scene),actors=Array.from({length:140},(_,i)=>actor(scene,i));for(const a of actors)a.mesh.material=[material];crowd.update(actors);scene.updateMatrixWorld(true);crowd.updateMatrices();assert.equal(crowd.batches.size,1);assert.equal([...crowd.batches.values()][0].mesh.count,140);crowd.dispose();assert.ok(actors.every(a=>a.mesh.visible));
});
