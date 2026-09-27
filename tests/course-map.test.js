import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,fairwayDistance,waterAt,lieAt} from '../src/course.js';
import {courseMapGeometry,courseMapProjection} from '../src/course-map.js';
import {pagodaLocation} from '../src/architecture.js';

test('Full maps contain every branch, water basin, island, bridge, and walking detour',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes)){
  const g=courseMapGeometry(c),project=courseMapProjection(c);
  assert.equal(g.waters.length,c.waters.length);assert.equal(g.islands.length,c.layout.islands.length);assert.equal(g.bridges.length,c.layout.bridgeSegments.length);
  for(const polygon of [...g.fairways,...g.waters,...g.islands,...g.bridges,c.layout.route])for(const [x,z]of polygon){const p=project(x,z);assert.ok(p.x>=15.9&&p.x<=204.1&&p.y>=23.9&&p.y<=246.1,`${c.name}: clipped map geometry`);}
  assert.ok(project(1,0).x<project(0,0).x);assert.ok(project(0,1).y<project(0,0).y);
 }
});
test('Pagoda footprints and steps stay clear of all fairways, water, and greens',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes)){
  const p=pagodaLocation(c);assert.ok(Math.hypot(p.x-c.greenX,p.z-c.length)<150);
  for(let dx=-13;dx<=13;dx++)for(let dz=-12;dz<=12;dz++){
   const x=p.x+dx,z=p.z+dz;
   assert.ok(fairwayDistance(c,x,z)>=11,`${c.name}: structure obstructs fairway`);
   assert.ok(Math.hypot(x-c.greenX,z-c.length)>34);assert.equal(waterAt(c,x,z),false);assert.notEqual(lieAt(c,x,z),'Out of bounds');
  }
 }
});
