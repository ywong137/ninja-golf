import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {Effects} from '../src/effects.js';

const pools=effects=>[effects.contacts.mesh,...effects.impacts.pools.map(p=>p.mesh),...effects.clouds.pools.map(p=>p.mesh)];
const living=pool=>pool.particles.filter(p=>p.life>0);

test('missed swings retain their arc without emitting contact sparks, blood, flashes, or fire',()=>{
 const effects=new Effects(new Scene(),()=>0);
 for(const special of [false,true])effects.slash(new Vector3(),0,special);
 effects.update(1/60);
 assert.equal(effects.items.length,2);
 assert.ok(pools(effects).every(mesh=>!mesh.visible));
 assert.ok(effects.impacts.pools.every(p=>living(p).length===0));
 assert.equal(effects.contacts.active,0);
});

test('hits stay at the contact and resume correctly after all pools become idle',()=>{
 const effects=new Effects(new Scene(),()=>0),contact=new Vector3(4,1.4,-8),direction=new Vector3(1,0,0);
 assert.ok(pools(effects).every(mesh=>!mesh.visible));
 for(let cycle=0;cycle<3;cycle++){
  effects.hit(contact,direction,{heavy:true});effects.update(0);
  assert.ok(pools(effects).every(mesh=>mesh.visible));
  assert.equal(effects.contacts.active,1);
  assert.equal(living(effects.impacts.pools[0]).length,180);
  assert.equal(living(effects.impacts.pools[1]).length,66);
  for(const p of living(effects.impacts.pools[0]))assert.deepEqual(p.p.toArray(),contact.toArray());
  effects.update(2);
  assert.ok(pools(effects).every(mesh=>!mesh.visible));
  assert.ok(effects.impacts.pools.every(p=>p.attributes.opacity.array.every(a=>a===0)));
  assert.ok(effects.clouds.pools.every(p=>p.a.age.array.every(a=>a===1)));
  contact.x+=10;
 }
});

test('guard contacts show sparks without blood and preserve the exact impact position',()=>{
 const effects=new Effects(new Scene(),()=>0),contact=new Vector3(-4,2,7);
 effects.hit(contact,new Vector3(0,0,1),{guarded:true});effects.update(.02);
 assert.ok(effects.impacts.pools[0].mesh.visible);
 assert.ok(!effects.impacts.pools[1].mesh.visible);
 assert.equal(living(effects.impacts.pools[1]).length,0);
 assert.deepEqual(Array.from(effects.contacts.attributes.center.array.slice(0,3)),contact.toArray());
});

test('returning to golf and changing courses remove contact fire and ninja smoke',()=>{
 const effects=new Effects(new Scene(),()=>0),contact=new Vector3(1,2,3);
 effects.hit(contact,new Vector3(1,0,0),{special:true});effects.clouds.dissolve(contact);
 effects.update(.4,true);
 assert.ok(pools(effects).every(mesh=>!mesh.visible));
 effects.hit(contact,new Vector3(1,0,0),{heavy:true});effects.clouds.dissolve(contact);effects.clear();
 assert.ok(pools(effects).every(mesh=>!mesh.visible));
 effects.update(.01);
 assert.ok(pools(effects).every(mesh=>!mesh.visible));
 assert.equal(effects.scene.userData.contactFlash,false);
});
