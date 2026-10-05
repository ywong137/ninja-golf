import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ROUGH_GRASS} from '../src/rough-grass.js';
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
 assert.ok(world.grass.count<=ROUGH_GRASS.capacity);
});


test('Grass reuses unchanged patch transforms and bounds its cache during travel',()=>{
 const world={grass:{setMatrixAt(){},instanceMatrix:{},count:0},grassAnchor:new THREE.Vector2(Infinity,Infinity),course:COURSE_SETS[0].holes[0],root:{userData:{}}};
 World.prototype.updateGrass.call(world,{x:0,z:90});
 const previous=world.grassCells,first=world.grassStats;
 assert.ok(first.tested>ROUGH_GRASS.capacity*.5&&first.tested<=ROUGH_GRASS.capacity);assert.equal(first.reused,0);
 World.prototype.updateGrass.call(world,{x:5.1,z:90});
 assert.ok(world.grassStats.tested<first.tested*.18);
 assert.ok(world.grassStats.reused>first.tested*.82);
 for(const[key,matrix]of world.grassCells)if(previous.has(key))assert.equal(matrix,previous.get(key));
 World.prototype.updateGrass.call(world,{x:-110,z:180});
 assert.ok(world.grassCells.size<=ROUGH_GRASS.capacity);
 assert.equal(world.grassStats.tested,world.grassCells.size);
 assert.ok(world.grass.count<=ROUGH_GRASS.capacity);
});
