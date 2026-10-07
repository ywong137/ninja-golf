import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {CourseGeometryCache} from '../src/course-geometry-cache.js';
test('revisiting a course reuses exact CPU geometry without sharing world-owned buffers',()=>{
 const cache=new CourseGeometryCache(),course={},region={};let builds=0;const build=()=>{builds++;return new BoxGeometry();};
 const a=cache.get(course,region,'horizon',build),b=cache.get(course,region,'horizon',build);
 assert.equal(builds,1);assert.notEqual(a,b);assert.notEqual(a.attributes.position.array,b.attributes.position.array);assert.deepEqual(a.attributes.position.array,b.attributes.position.array);
 a.attributes.position.setX(0,999);a.dispose();const c=cache.get(course,region,'horizon',build);assert.deepEqual(b.attributes.position.array,c.attributes.position.array);
 cache.get(course,{},'horizon',build);cache.get(course,region,'fairway',build);assert.equal(builds,3);
});
test('least recently used geometry expires at the fixed byte budget',()=>{
 const cache=new CourseGeometryCache(1700),a={},b={};let builds=0;const build=()=>{builds++;return new BoxGeometry();};
 cache.get(a,null,'fairway',build);cache.get(b,null,'fairway',build);assert.equal(cache.entries.length,2);cache.get(a,null,'fairway',build);cache.get({},null,'fairway',build);assert.equal(cache.entries[0].course,a);cache.get(b,null,'fairway',build);assert.equal(builds,4);assert.ok(cache.bytes<=cache.maxBytes);
 const tiny=new CourseGeometryCache(1);tiny.get(a,null,'fairway',build);assert.equal(tiny.bytes,0);
});
