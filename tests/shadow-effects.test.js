import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Effects} from '../src/effects.js';
import {shadowBurst,shadowWave} from '../src/shadow-effects.js';

test('a shadow wave reaches the damage boundary and faces the strike direction',()=>{
 for(const yaw of [0,.9,-2.3]){
  const effects=new Effects(new T.Scene()),position=new T.Vector3(3,1,2),reach=19;
  shadowWave(effects,position,yaw,reach,1.1,'#6ca3aa');
  const item=effects.items[0],wave=item.m;
  const direction=new T.Vector3(1,0,0).applyEuler(wave.rotation);
  assert.ok(direction.distanceTo(new T.Vector3(Math.sin(yaw),0,Math.cos(yaw)))<1e-12);
  effects.update(.239);
  assert.ok(wave.scale.x>reach-.1&&wave.scale.x<reach);
  let geometryDisposed=false,materialDisposed=false;
  wave.geometry.addEventListener('dispose',()=>{geometryDisposed=true;});
  wave.material.addEventListener('dispose',()=>{materialDisposed=true;});
  effects.update(.01);
  assert.equal(effects.items.length,0);assert.equal(wave.parent,null);
  assert.ok(geometryDisposed&&materialDisposed);
 }
});

test('smoke breaks the teleport ribbon and clears without leaving live effects',()=>{
 const scene=new T.Scene(),effects=new Effects(scene),baseline=scene.children.length;
 effects.trail(new T.Vector3(),new T.Vector3(0,1,0),2,1,0);
 shadowBurst(effects,new T.Vector3(), '#6ca3aa',{appear:true});
 assert.equal(effects.ribbonTracks.size,0);
 const smoke=effects.items[0].m;
 effects.update(.1);assert.ok(smoke.scale.x>1);
 assert.ok(smoke.material.uniforms.opacity.value<.9);
 effects.clear();assert.equal(scene.children.length,baseline);assert.equal(effects.items.length,0);
 assert.ok(effects.impacts.pools.every(pool=>pool.particles.every(p=>p.life===0)));
});
