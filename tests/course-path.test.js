import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,heightAt,ellipse,lieAt,fairwayDistance} from '../src/course.js';
import {courseSurfaceHeight} from '../src/terrain.js';
import {createCoursePath} from '../src/course-path.js';
test('All36 course paths follow the rendered terrain and exclude water and playing surfaces',()=>{
 for(const c of COURSE_SETS.flatMap(set=>set.holes)){
  const path=createCoursePath(c,{}),geo=path.geometry,p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
  assert.ok(geo.index.count>300,`${c.name}: path must retain visible sections`);
  for(let i=0;i<p.count;i++){
   assert.ok(Number.isFinite(p.getY(i))&&Number.isFinite(uv.getY(i)));
   assert.ok(Math.abs(p.getY(i)-courseSurfaceHeight(c,p.getX(i),p.getZ(i),heightAt,ellipse)-.028)<.0002);
  }
  for(const i of new Set(geo.index.array)){
   assert.ok(!['Water','Green','Tee','Bunker'].includes(lieAt(c,p.getX(i),p.getZ(i))));
   assert.ok(fairwayDistance(c,p.getX(i),p.getZ(i))>.9999);
   assert.ok(n.getY(i)>0,'The visible path must face upward');
  }
  geo.dispose();path.material.dispose();
 }
});
