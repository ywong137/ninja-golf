import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {ContactBursts} from '../src/contact-bursts.js';

test('contact bursts retain exact world contacts, distinguish guards, and stay bounded',()=>{
 const scene=new Scene(),bursts=new ContactBursts(scene),contact=new Vector3(17,4,-23);
 bursts.emit(contact,{heavy:true});
 assert.deepEqual(Array.from(bursts.attributes.center.array.slice(0,3)),contact.toArray());
 const heavy=bursts.attributes.radius.getX(0);bursts.emit(contact,{guarded:true});
 assert.ok(heavy>bursts.attributes.radius.getX(1));assert.equal(bursts.attributes.guard.getX(1),1);
 for(let i=0;i<300;i++)bursts.emit(new Vector3(i,1,2),{special:true});
 assert.equal(scene.children.length,1);assert.equal(bursts.records.length,96);assert.equal(bursts.mesh.geometry.instanceCount,96);
 bursts.update(.01);assert.equal(bursts.active,96);
 bursts.update(.5);assert.equal(bursts.active,0);assert.ok(bursts.attributes.age.array.every(age=>age===1));
});

test('contact bursts fade promptly during golf and reset on course changes',()=>{
 const bursts=new ContactBursts(new Scene());bursts.emit(new Vector3(),{special:true});bursts.update(.1,true);
 assert.equal(bursts.active,0);
 bursts.emit(new Vector3());bursts.update(.01);assert.equal(bursts.active,1);bursts.clear();
 assert.equal(bursts.active,0);assert.ok(bursts.attributes.age.array.every(age=>age===1));assert.ok(bursts.records.every(p=>p.life===0));
});
