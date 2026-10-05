import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Effects,activeBladeTrailHands} from '../src/effects.js';
test('Red musou aura persists between impacts, follows travel, and uses fixed geometry',()=>{
 const effects=new Effects(new T.Scene()),a=effects.musouAura,meshes=a.root.children.slice(),geometries=meshes.map(m=>m.geometry);
 const p=new T.Vector3();assert.equal(a.root.visible,false);
 for(let i=0;i<600;i++){
  p.x=i/100;effects.setMusou(p,true);effects.update(1/60);
  assert.ok(a.root.visible&&a.strength>0);assert.ok(a.root.position.equals(p));
 }
 assert.equal(a.strength,1);assert.deepEqual(a.root.children,meshes);assert.deepEqual(a.root.children.map(m=>m.geometry),geometries);
 assert.equal(effects.items.length,0);assert.equal(meshes.length,3);assert.equal(meshes[0].geometry.instanceCount,28);
 effects.setMusou(p,false);effects.update(.21);assert.equal(a.root.visible,false);
 effects.setMusou(p,true);effects.update(.1);effects.update(.21,true);assert.equal(a.root.visible,false);
 effects.setMusou(p,true);effects.update(.1);effects.clear();assert.equal(a.root.visible,false);
});
test('Every moving musou blade has a red trail even between scheduled impacts',()=>{
 for(const time of [0,.5,1,2,4,8]){
  const action={kind:'musou',time,hits:[.3,3,7]};
  assert.deepEqual(activeBladeTrailHands(action,false),['r']);assert.deepEqual(activeBladeTrailHands(action,true),['r','l']);
 }
 const effects=new Effects(new T.Scene()),color=effects.palette[2];assert.ok(color.r>color.g*5&&color.r>color.b*5);
 effects.setMusou(new T.Vector3(),true,true);assert.equal(effects.musouAura.uniforms.motion.value,.2);
});
