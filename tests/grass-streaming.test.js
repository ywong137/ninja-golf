import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {World} from '../src/world.js';
import {COURSE_SETS} from '../src/course.js';

test('Grass keeps its buffer while the player stays in the same cell, including its far corner',()=>{
 let writes=0;
 const world={grass:{setMatrixAt(){writes++;},instanceMatrix:{},count:0},grassAnchor:new THREE.Vector2(Infinity,Infinity),course:COURSE_SETS[0].holes[0],root:{userData:{}}};
 const update=(x,z)=>World.prototype.updateGrass.call(world,{x,z});
 update(.1,90.1);assert.ok(writes>0,'Initial grass buffer must populate');
 const initial=writes;
 for(let i=0;i<120;i++)update(4.9,94.9);
 assert.equal(writes,initial,'The diagonal corner must not rebuild every frame');
 update(5.1,94.9);assert.ok(writes>initial,'Crossing a cell boundary must refresh grass');
 const crossed=writes;update(9.9,94.9);assert.equal(writes,crossed);
 update(-.1,94.9);assert.ok(writes>crossed,'Negative cells must also refresh');
 const negative=writes;update(-4.9,90.1);assert.equal(writes,negative);
 assert.ok(world.grass.count<=15000);
});
