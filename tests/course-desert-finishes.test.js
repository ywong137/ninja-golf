import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,CLUBS,lieAt,heightAt,routePoint} from '../src/course.js';
const mirage=COURSE_SETS[2].holes[3],sunset=COURSE_SETS[2].holes[8];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function lies(c,a,b){return Array.from({length:200},(_,i)=>lieAt(c,a.x+(b.x-a.x)*i/199,a.z+(b.z-a.z)*i/199));}
function disc(c,p,r){for(let a=0;a<Math.PI*2;a+=.1)assert.equal(lieAt(c,p.x+Math.cos(a)*r,p.z+Math.sin(a)*r),'Fairway');}
test('Palm Mirage rewards a short tee shot before a separate lake carry',()=>{
 const tee={x:0,z:0},landing={x:-30,z:mirage.length*.45},cup={x:13,z:304};
 assert.equal(mirage.par,4);assert.equal(mirage.greenX,cup.x);assert.equal(mirage.length,cup.z);
 disc(mirage,landing,17);assert.ok(distance(tee,landing)<CLUBS[2].carry);assert.ok(distance(landing,cup)<CLUBS[1].carry);
 assert.ok(!lies(mirage,tee,landing).includes('Water'));assert.ok(lies(mirage,landing,cup).filter(l=>l==='Water').length>50);
 assert.equal(lieAt(mirage,0,220),'Water','A straight full drive risks the lake');
 for(const x of[-58,-30,14])assert.equal(lieAt(mirage,x,146),'Fairway','The tee target must extend sideways');
 assert.equal(lieAt(mirage,13,260),'Water','Water must separate the landing bar from the final green');
});
test('Sunset offers a reachable risky second shot and a dry route behind the cup',()=>{
 const tee={x:0,z:0},landing={x:-55,z:sunset.length*.49},cup={x:9,z:418},layup={x:-68,z:sunset.length*.96};
 assert.equal(sunset.par,4);assert.equal(sunset.greenX,cup.x);assert.equal(sunset.length,cup.z);
 disc(sunset,landing,22);assert.ok(distance(tee,landing)<CLUBS[0].carry);assert.ok(distance(landing,cup)<CLUBS[0].carry);
 assert.ok(lies(sunset,landing,cup).includes('Water'),'The two-shot route must cross the front water');
 assert.ok(distance(landing,layup)<CLUBS[1].carry);assert.ok(!lies(sunset,landing,layup).includes('Water'));
 assert.ok(sunset.layout.route.some(p=>p[1]>sunset.length+50),'The safe approach must pass behind the cup');
 const rear={x:8,z:sunset.length*1.14};assert.ok(!lies(sunset,rear,cup).some(l=>['Water','Bunker'].includes(l)));
 assert.ok(distance(rear,cup)<CLUBS[5].carry);
});
test('Both par-four redesigns retain dry walking corridors and clear greens',()=>{
 for(const c of[mirage,sunset]){
  for(let i=1;i<=800;i++){
   const p=routePoint(c,i/800),q=routePoint(c,(i-1)/800);
   for(const offset of[-3,0,3])assert.ok(!['Water','Out of bounds'].includes(lieAt(c,p.x+p.tangentZ*offset,p.z-p.tangentX*offset)));
   assert.ok(Math.abs(heightAt(c,p.x,p.z)-heightAt(c,q.x,q.z))/distance(p,q)<.24);
  }
  for(let a=0;a<Math.PI*2;a+=.1)assert.equal(lieAt(c,c.greenX+Math.cos(a)*10,c.length+Math.sin(a)*10),'Green');
 }
});
