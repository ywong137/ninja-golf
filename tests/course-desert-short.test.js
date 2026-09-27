import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,lieAt,heightAt,routePoint,fairwayDistance,waterAt} from '../src/course.js';
const ridge=COURSE_SETS[2].holes[1],shore=COURSE_SETS[2].holes[5];
function clearDisc(c,x,z,r){for(let a=0;a<Math.PI*2;a+=.1)assert.ok(['Fairway','Green'].includes(lieAt(c,x+Math.cos(a)*r,z+Math.sin(a)*r)));}
function crossings(c,x,z,kind){return Array.from({length:150},(_,i)=>lieAt(c,x*i/150,z*i/150)).filter(l=>l===kind).length;}
test('Copper ridge offers a broad short apron and narrow diagonal finish instead of a detached bowl',()=>{
 assert.equal(ridge.par,3);assert.equal(ridge.length,159);assert.equal(ridge.greenX,-12);
 clearDisc(ridge,44,.59*ridge.length,17);
 assert.ok(-fairwayDistance(ridge,44,.59*ridge.length)>-fairwayDistance(ridge,22,.80*ridge.length)*1.8);
 assert.ok(crossings(ridge,ridge.greenX,ridge.length,'Bunker')>20);
 assert.equal(crossings(ridge,44,.59*ridge.length,'Bunker'),0);
 for(let i=0;i<=400;i++){const p=routePoint(ridge,i/400);assert.ok(fairwayDistance(ridge,p.x,p.z)<0,'The apron and ridge must remain connected');}
 assert.ok(Math.hypot(44,.59*ridge.length)<110,'A short iron reaches the safe apron');
});
test('Oasis shoreline has a direct water carry and a dry connected bank with no enclosed island',()=>{
 assert.equal(shore.par,3);assert.equal(shore.length,138);assert.equal(shore.greenX,4);
 assert.equal(shore.layout.islands.length,0);assert.equal(shore.layout.bridges.length,0);
 assert.ok(crossings(shore,shore.greenX,shore.length,'Water')>35);
 assert.equal(crossings(shore,65,.55*shore.length,'Water'),0);
 clearDisc(shore,65,.55*shore.length,12);
 for(let x=-28;x<=40;x+=2)assert.ok(fairwayDistance(shore,x,shore.length*1.02)<0,'The target must extend laterally along the bank');
 for(let z=shore.length;z<=shore.length+60;z+=2)assert.equal(waterAt(shore,shore.greenX,z),false,'The target must remain connected to dry land behind it');
 for(let i=0;i<=400;i++){const p=routePoint(shore,i/400);assert.ok(fairwayDistance(shore,p.x,p.z)<0,'The eastern bank must connect tee and target');}
});
test('Both revised short holes retain dry walking width, moderate grades, and clear cup surrounds',()=>{
 for(const c of[ridge,shore]){
  for(let i=1;i<=800;i++){
   const p=routePoint(c,i/800),q=routePoint(c,(i-1)/800);
   for(const offset of[-3,0,3])assert.ok(!['Water','Out of bounds'].includes(lieAt(c,p.x+p.tangentZ*offset,p.z-p.tangentX*offset)));
   assert.ok(Math.abs(heightAt(c,p.x,p.z)-heightAt(c,q.x,q.z))/Math.hypot(p.x-q.x,p.z-q.z)<.15);
  }
  for(let a=0;a<Math.PI*2;a+=.1)assert.equal(lieAt(c,c.greenX+Math.cos(a)*10,c.length+Math.sin(a)*10),'Green');
 }
});
