import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {BLADE_PROFILES,bladeGeometry} from '../src/weapons.js';
import {ENEMY_TYPES,enemyTypeForSlot,enemyIntent,guardDamageMultiplier} from '../src/combat.js';
import {Projectiles} from '../src/projectiles.js';
const motions=JSON.parse(readFileSync(new URL('../src/motion-data.json',import.meta.url)));
test('Blades have broad flat faces, distinct profiles, and bounded draw groups',()=>{
 for(const [name,p]of Object.entries(BLADE_PROFILES)){const g=bladeGeometry(p),size=g.boundingBox.getSize(new THREE.Vector3());assert.ok(size.x>size.z*7,`${name} must read as a flat blade`);assert.equal(g.groups.length,2);assert.equal(g.getAttribute('position').count,165);g.dispose();}
});
test('Authored motion has continuous phase landmarks and a stable lead foot contract',()=>{
 for(const [name,c]of Object.entries(motions)){assert.equal(c.poses[0].t,0,name);assert.equal(c.poses.at(-1).t,1,name);for(let i=1;i<c.poses.length;i++)assert.ok(c.poses[i].t>c.poses[i-1].t,name);for(const p of c.poses){assert.ok(Object.values(p).flat().every(Number.isFinite),name);assert.ok(Math.hypot(...p.tip.map((x,i)=>x-p.grip[i]))>.3,name);}}
 const swing=motions.Golf_Swing;assert.equal(swing.duration,2.4);assert.ok(swing.poses.some(p=>Math.abs(p.hip-p.chest)>.3),'Hips and chest have separate turns');assert.ok(swing.poses.at(-1).heel>.5,'Trail heel rises into finish');
});
test('Enemy silhouettes correspond to different threats and counters',()=>{
 assert.equal(new Set(ENEMY_TYPES.map(e=>e.model)).size,4);assert.equal(new Set(Array.from({length:8},(_,i)=>enemyTypeForSlot(i))).size,4);
 assert.equal(guardDamageMultiplier(1,'light',true,false),.24);for(const args of [[1,'heavy',true,false],[1,'light',false,false],[1,'light',true,true],[0,'light',true,false]])assert.equal(guardDamageMultiplier(...args),1);
 const p={x:0,z:5},v={x:0,z:0};assert.ok(enemyIntent({type:3,x:0,z:0,slot:0},p,v).z<0,'Thrower retreats when approached');assert.deepEqual(enemyIntent({type:1,x:0,z:0,slot:0},p,v),p,'Guard advances');
});
test('Visible projectiles use swept collisions and can be dodged sideways',()=>{
 const scene=new THREE.Scene(),shots=new Projectiles(scene,{burst(){}}),player=new THREE.Vector3(0,0,0);let damage=0;
 shots.spawn(new THREE.Vector3(0,1,-2),new THREE.Vector3(0,1,2),8);shots.update(.3,player,n=>damage+=n);assert.equal(damage,8);assert.equal(shots.items.length,0);
 shots.spawn(new THREE.Vector3(0,1,-2),new THREE.Vector3(0,1,2),8);shots.update(.3,new THREE.Vector3(2,0,0),n=>damage+=n);assert.equal(damage,8);shots.clear();assert.equal(scene.children.length,0);
});
