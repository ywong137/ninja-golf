import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,PerspectiveCamera,Vector3,Plane} from 'three';
import {PortraitCutaway} from '../src/portrait-cutaway.js';

test('Portrait cutaway removes foreground scenery in each camera direction and retains the background',()=>{
 const effect=new PortraitCutaway(),camera=new PerspectiveCamera(),focus=new Vector3(3,2,5),renderer={localClippingEnabled:false},root=new Group();
 const material=new MeshStandardMaterial();root.add(new Mesh(new BoxGeometry(),material));
 for(const direction of [new Vector3(1,0,0),new Vector3(-1,.2,1),new Vector3(0,0,-1)]){
  direction.normalize();camera.position.copy(focus).addScaledVector(direction,-2);
  effect.withClippedScenery(renderer,camera,focus,[root],()=>{
   assert.equal(renderer.localClippingEnabled,true);assert.equal(root.children[0].material.clippingPlanes.length,1);
   const plane=root.children[0].material.clippingPlanes[0];
   assert.ok(plane.distanceToPoint(camera.position)<0);
   assert.ok(plane.distanceToPoint(focus.clone().addScaledVector(direction,.1))<0);
   assert.ok(plane.distanceToPoint(focus.clone().addScaledVector(direction,1))>0);
  });
  assert.equal(material.clippingPlanes,null);assert.equal(renderer.localClippingEnabled,false);
 }
});

test('Portrait rendering restores shared materials and renderer state after a failed frame',()=>{
 const effect=new PortraitCutaway(),camera=new PerspectiveCamera(),renderer={localClippingEnabled:true},root=new Group();camera.position.z=2;
 const material=new MeshStandardMaterial(),original=[new Plane(new Vector3(0,1,0),10)];material.clippingPlanes=original;
 root.add(new Mesh(new BoxGeometry(),material),new Mesh(new BoxGeometry(),material));
 assert.throws(()=>effect.withClippedScenery(renderer,camera,new Vector3(),[root],()=>{assert.equal(root.children[0].material.clippingPlanes.length,2);assert.equal(material.clippingPlanes,original);throw Error('Render failed');}),/Render failed/);
 assert.equal(material.clippingPlanes,original);assert.equal(renderer.localClippingEnabled,true);
});


test('Portrait clipping cannot leak through a shared hero weapon or garment material',()=>{
 const effect=new PortraitCutaway(),root=new Group(),material=new MeshStandardMaterial(),enemy=new Mesh(new BoxGeometry(),material),hero=new Mesh(new BoxGeometry(),material),camera=new PerspectiveCamera(),renderer={localClippingEnabled:false};
 camera.position.z=2;root.add(enemy);let clipped;
 effect.withClippedScenery(renderer,camera,new Vector3(),[root],()=>{
  clipped=enemy.material;assert.notEqual(clipped,material);assert.equal(hero.material.clippingPlanes,null);assert.equal(clipped.clippingPlanes.length,1);
 });
 assert.equal(enemy.material,material);assert.equal(hero.material,material);
 effect.withClippedScenery(renderer,camera,new Vector3(),[root],()=>assert.equal(enemy.material,clipped));
});
