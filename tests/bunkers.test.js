import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,lieAt,heightAt,routePoint,waterAt,waterBasins,ellipse} from '../src/course.js';
import {bunkerProfile,bunkerDistance,bunkerHeightOffset,bunkerOutline} from '../src/bunkers.js';
import {courseMapGeometry} from '../src/course-map.js';

test('Organic contours preserve centers and footprints while producing distinct scallops',()=>{
 const profiles=new Set();
 for(const c of COURSE_SETS.flatMap(s=>s.holes))for(const b of c.bunkers){
  profiles.add(bunkerProfile(b).slice(0,2).join(','));assert.deepEqual(bunkerProfile([...b]),bunkerProfile(b));assert.equal(lieAt(c,b[0],b[1]),'Bunker');
  const radii=[];for(const [x,z]of bunkerOutline(b)){const radius=Math.hypot((x-b[0])/b[2],(z-b[1])/b[3]);radii.push(radius);assert.ok(radius<=1.000001);assert.ok(Math.abs(bunkerDistance(x,z,b))<1e-10);}
  assert.ok(Math.max(...radii)-Math.min(...radii)>.12,'Scallops must visibly depart from an ellipse');
 }
 assert.ok(profiles.size>50);
});
test('Map contours, sand lies, and shaped bowls agree along every dry bunker edge',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes))for(const [index,b]of c.bunkers.entries()){
  assert.deepEqual(courseMapGeometry(c).bunkers[index],bunkerOutline(b));
  assert.ok(bunkerHeightOffset(b[0],b[1],b)<-.85);
  for(const [x,z]of bunkerOutline(b,32)){
   const dx=x-b[0],dz=z-b[1],inside=[b[0]+dx*.985,b[1]+dz*.985],outside=[b[0]+dx*1.03,b[1]+dz*1.03];
   assert.ok(bunkerDistance(...inside,b)<0);assert.ok(bunkerDistance(...outside,b)>0);
   if(!waterAt(c,...inside))assert.equal(lieAt(c,...inside),'Bunker');
   assert.ok(bunkerHeightOffset(...outside,b)>0,'Turf lip must rise above its surrounding base');
   assert.ok(Number.isFinite(heightAt(c,x,z)));
  }
 }
});
test('Bunker shaping preserves dry endpoints and dry walking routes on all 36 holes',()=>{
 for(const c of COURSE_SETS.flatMap(s=>s.holes)){
  assert.equal(lieAt(c,0,0),'Tee');assert.equal(lieAt(c,c.greenX,c.length),'Green');
  for(let i=0;i<=400;i++){const p=routePoint(c,i/400);assert.notEqual(lieAt(c,p.x,p.z),'Water');assert.ok(Number.isFinite(heightAt(c,p.x,p.z)));if(waterBasins(c).some(b=>ellipse(p.x,p.z,b)<1))assert.ok(heightAt(c,p.x,p.z)>3.1);}
 }
});
