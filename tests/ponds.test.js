import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,heightAt,naturalHeightAt,pondProfiles,waterAt,waterSurfaceAt,ellipse} from '../src/course.js';
import {dryLandDistance} from '../src/course-layout.js';
import {courseSurfaceHeight} from '../src/terrain.js';
import {createPond} from '../src/water.js';
const courses=COURSE_SETS.flatMap(s=>s.holes);
test('Pond planes fit their local terrain and the rendered reflectors use those planes',()=>{
 const planes=[];
 for(const c of courses){
  const profiles=pondProfiles(c),group=createPond(c,{time:{value:0},skyMap:{value:null},hasSky:{value:0}});
  assert.equal(group.children.length,profiles.length);
  for(const [i,p]of profiles.entries()){
   assert.ok(Number.isFinite(p.surface));assert.ok(p.bankWidth>=10&&p.bankWidth<55);planes.push(p.surface);
   assert.equal(group.children[i].position.y,p.surface);assert.equal(group.children[i].material.uniforms.basinDepth.value,p.depth);
  }group.dispose();group.children.forEach(m=>m.geometry.dispose());
 }
 assert.ok(Math.max(...planes)-Math.min(...planes)>10,'Ponds cannot share a global elevation');
 assert.ok(pondProfiles(COURSE_SETS[1].holes[4])[0].surface>15,'The elevated kirk pond must follow the local ridge');
});
test('Every water edge is continuous and dense samples keep dry islands above the visible plane',()=>{
 let shoreSamples=0,wetSamples=0,drySamples=0;
 for(const c of courses)for(const p of pondProfiles(c)){
  const b=p.basin;
  for(let i=0;i<128;i++){
   const a=i/128*Math.PI*2,x=b[0]+Math.cos(a)*b[2],z=b[1]+Math.sin(a)*b[3];if(dryLandDistance(c,x,z)<.1)continue;
   const nx=Math.cos(a)/b[2],nz=Math.sin(a)/b[3],length=Math.hypot(nx,nz),dx=nx/length*.002,dz=nz/length*.002;
   if(!waterAt(c,x-dx,z-dz)||waterAt(c,x+dx,z+dz))continue;
   assert.ok(Math.abs(heightAt(c,x-dx,z-dz)-p.surface)<.005,`${c.name}: water edge has a gap`);
   assert.ok(Math.abs(heightAt(c,x+dx,z+dz)-p.surface)<.005,`${c.name}: dry edge has a gap`);shoreSamples++;
  }
  for(let z=b[1]-b[3];z<=b[1]+b[3];z+=2)for(let x=b[0]-b[2];x<=b[0]+b[2];x+=2){
   if(ellipse(x,z,b)>=.9999)continue;const y=heightAt(c,x,z),water=waterSurfaceAt(c,x,z);
   if(water!=null){assert.ok(y<=water+.00001,`${c.name}: bed above water`);wetSamples++;}
   else {assert.ok(y>=p.surface-.00001,`${c.name}: submerged dry island`);drySamples++;}
  }
 }
 assert.ok(shoreSamples>4000&&wetSamples>40000&&drySamples>1000);
});
test('Putting surfaces and tees retain their uncarved heights',()=>{
 for(const c of courses)for(const [x,z,radius]of [[0,0,4],[c.greenX,c.length,15]])for(let i=0;i<24;i++){
  const a=i/24*Math.PI*2,xx=x+Math.cos(a)*radius,zz=z+Math.sin(a)*radius;
  assert.equal(waterAt(c,xx,zz),false,`${c.name}: protected surface flooded`);
  assert.ok(Math.abs(heightAt(c,xx,zz)-naturalHeightAt(c,xx,zz))<1e-8,`${c.name}: protected surface moved`);
 }
});
test('The old narrow bank band has no cliff on any of the 38 analytic or rendered pond shores',()=>{
 let analyticMax=0,renderedMax=0;
 for(const c of courses)for(const p of pondProfiles(c))for(let i=0;i<96;i++)for(let j=0;j<=16;j++){
  const a=i/96*Math.PI*2,e=1+j/16*.16,x=p.basin[0]+Math.cos(a)*p.basin[2]*e,z=p.basin[1]+Math.sin(a)*p.basin[3]*e;
  if(dryLandDistance(c,x,z)<.5)continue;
  for(const rendered of [false,true]){
   const h=(x,z)=>rendered?courseSurfaceHeight(c,x,z,heightAt,ellipse):heightAt(c,x,z);
   const slope=Math.hypot((h(x+.1,z)-h(x-.1,z))/.2,(h(x,z+.1)-h(x,z-.1))/.2);
   assert.ok(slope<.75,`${c.name}: ${rendered?'rendered':'analytic'} bank grade ${slope}`);
   if(rendered)renderedMax=Math.max(renderedMax,slope);else analyticMax=Math.max(analyticMax,slope);
  }
 }
 console.log(`Maximum old-bank-band grades: analytic ${analyticMax.toFixed(3)}, rendered ${renderedMax.toFixed(3)}`);
});
test('The ocean hazard line meets the visible ocean and all wet ground stays below it',()=>{
 for(const c of COURSE_SETS[0].holes)for(let z=-20;z<=c.length+50;z+=3){
  const edge=138+Math.sin(z*.014)*28;
  for(const distance of [.002,1,5,20]){const x=edge+distance;assert.equal(waterSurfaceAt(c,x,z),-1.1);assert.ok(heightAt(c,x,z)<=-1.1+.00001,`${c.name}: exposed ocean hazard at ${x},${z}`);}
 }
});
