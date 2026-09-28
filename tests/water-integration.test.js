import {shorelinePoint} from '../src/shoreline.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,CLUBS,WARRIORS,heightAt,lieAt,pondProfiles,waterSurfaceAt} from '../src/course.js';
import {BALL_RADIUS,BALL_STEP,ballSurface,ballHazard} from '../src/golf-roll.js';
import {previewShot} from '../src/golf-guide.js';
import {buildThemeScenery} from '../src/course-themes.js';
import {findWaterEmergence,waterEmergencePosition,WATER_EMERGENCE} from '../src/water-emergence.js';
const waterSites=c=>pondProfiles(c).flatMap(({basin})=>Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,[sx,sz]=shorelinePoint(basin,a),x=basin[0]+(sx-basin[0])*.92,z=basin[1]+(sz-basin[1])*.92;return{x,z,y:waterSurfaceAt(c,x,z),kind:'water'};}).filter(s=>s.y!=null));

test('All 36 holes use visible water elevation for ball contact and airborne previews',()=>{
 let checked=0;for(const set of COURSE_SETS)for(const c of set.holes){const s=waterSites(c)[0];assert.ok(s,`${c.name}: no water sample`);const surface=ballSurface(c,s);assert.equal(surface.water,s.y);assert.equal(surface.lie,'Water');assert.equal(ballHazard({y:s.y+BALL_RADIUS+.001},surface,1),null);assert.equal(ballHazard({y:s.y+BALL_RADIUS},surface,1),'Water');
  const origin={x:s.x,y:s.y+2,z:s.z},guide=previewShot(c,CLUBS[0],WARRIORS[0],'Fairway',0,0,origin);assert.equal(guide.lie,'Water');assert.ok(Math.abs(guide.landing.y-waterSurfaceAt(c,guide.landing.x,guide.landing.z)-BALL_RADIUS)<1e-7);
  // Live flight ordering: acceleration, movement, then the shared surface/hazard query.
  const p={...origin},v={x:0,y:0,z:0};let contact=false;for(let i=0;i<2400;i++){v.y-=9.81*BALL_STEP;v.x+=c.wind[0]*.22*BALL_STEP;v.z+=c.wind[1]*.22*BALL_STEP;p.x+=v.x*BALL_STEP;p.y+=v.y*BALL_STEP;p.z+=v.z*BALL_STEP;if(ballHazard(p,ballSurface(c,p),(i+1)*BALL_STEP)){contact=true;break;}}assert.ok(contact);assert.ok(Math.hypot(p.x-guide.landing.x,p.z-guide.landing.z)<1e-7);checked++;
 }assert.equal(checked,36);
});
test('Ocean contact uses its own plane and dry bridges retain null water',()=>{
 const c=COURSE_SETS[0].holes[0],p={x:220,z:40};assert.equal(waterSurfaceAt(c,p.x,p.z),-1.1);assert.equal(ballHazard({y:-1.1+BALL_RADIUS},ballSurface(c,p),1),'Water');assert.equal(ballHazard({y:0},ballSurface(c,p),1),null);
 for(const set of COURSE_SETS)for(const c of set.holes)for(const s of c.layout.bridgeSegments){const x=(s[0]+s[2])/2,z=(s[1]+s[3])/2;if(lieAt(c,x,z)!=='Water')assert.equal(waterSurfaceAt(c,x,z),null);}
});
test('Theme water ambush sites start at water planes, never basin beds',()=>{
 for(const set of COURSE_SETS.slice(1)){const root=new THREE.Group(),sites=[],c=set.holes[0];buildThemeScenery(root,c,sites);const water=sites.filter(s=>s.kind==='water');assert.ok(water.length);for(const s of water)assert.equal(s.y,waterSurfaceAt(c,s.x,s.z));root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
});
test('Water entrances land on dry modest slopes and their whole arcs clear terrain',()=>{
 let accepted=0,rejected=0;for(const set of COURSE_SETS)for(const c of set.holes){let holeAccepted=0;for(const s of waterSites(c)){const entry=findWaterEmergence(c,s,{x:0,z:0});if(!entry){rejected++;continue;}accepted++;holeAccepted++;const p=entry.landing;assert.equal(waterSurfaceAt(c,p.x,p.z),null);assert.ok(Math.hypot(p.x-s.x,p.z-s.z)<=WATER_EMERGENCE.maxDistance);assert.ok(entry.arcHeight<=WATER_EMERGENCE.maxArc);for(let i=0;i<=96;i++){const q=waterEmergencePosition(s,p,entry.arcHeight,i/96,entry.startY);assert.ok(q.y>=heightAt(c,q.x,q.z)-.026,`${c.name}: buried entrance`);}assert.equal(findWaterEmergence(c,s,p,{blocked:()=>true}),null);assert.equal(findWaterEmergence(c,s,p,{blocked:()=>false,segmentClear:()=>false}),null);}
  assert.ok(holeAccepted>0,`${c.name}: no safe short water entrance`);
 }assert.ok(accepted>36);console.log(`Water entrances accepted ${accepted}, rejected${rejected} unsafe sites.`);
});
