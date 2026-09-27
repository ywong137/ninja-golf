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
test('Combat choreography keeps the torso coupled and both weapon paths explicit',()=>{
 for(const [name,clip] of Object.entries(motions)){
  if(name.startsWith('Golf'))continue;
  for(const pose of clip.poses){
   assert.ok(Math.abs(pose.chest-pose.hip)<.9,`${name}: excessive torso twist`);
   for(const key of ['offGrip','offTip','elbowR','elbowL','footR','footL'])assert.equal(pose[key].length,3,`${name}: ${key}`);
   assert.ok(Math.hypot(pose.grip[0],pose.grip[1])<.85,`${name}: unreachable hand target`);
  }
 }
 for(const name of ['Musou_Flow','Twin_Musou_Flow']){
  const clip=motions[name];assert.equal(clip.duration,3.3);assert.equal(clip.impacts.length,6);assert.equal(clip.headings.length,6);
  assert.ok(clip.poses.length>=25,'Each cut has loading, contact, and follow-through');
  assert.ok(Math.abs(clip.poses.at(-1).hip-Math.PI*2)<1e-6,'A completed turn must not rewind through recovery');
  assert.ok(clip.poses.some(p=>p.footR[2]>.04),'Step clear of the floor during the turn');
 }
});
test('Fan, ring, and sickle have complete independent animation families',()=>{
 const names=['Ready','Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow'];
 for(const prefix of ['Fan_','Ring_','Sickle_'])for(const name of names){
  const clip=motions[prefix+name];assert.ok(clip,`${prefix}${name}`);assert.equal(clip.twoHanded,false);
  for(const p of clip.poses){assert.ok(Number.isFinite(p.roll));assert.ok(p.freeHand>0,'The free hand uses a distinct open guard');}
  if(name==='Musou_Flow'){assert.equal(clip.headings.length,6);assert.equal(clip.headings.at(-1),Math.PI*2);}
  if(name==='Ready')assert.deepEqual(clip.poses[0].grip,clip.poses.at(-1).grip,'Stance loop closes without a hand jump');
  else {assert.equal(clip.duration,motions[name].duration);assert.notDeepEqual(clip.poses.map(p=>p.grip),motions[name].poses.map(p=>p.grip),'A new weapon needs its own trajectory');}
 }
 const guards=['Fan_','Ring_','Sickle_'].map(prefix=>motions[prefix+'Ready'].poses[0].grip);
 for(let i=0;i<guards.length;i++)for(let j=i+1;j<guards.length;j++)assert.ok(Math.hypot(...guards[i].map((x,k)=>x-guards[j][k]))>.07,'Distinct resting silhouettes');
});
