import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSES,CLUBS,WARRIORS,heightAt} from '../src/course.js';
import {previewShot} from '../src/golf-guide.js';
import {engagementTarget,ENEMY_TYPES} from '../src/combat.js';
import {SceneryCollision} from '../src/scenery-collision.js';
import {telegraphGeometry} from '../src/effects.js';

test('Shot planning follows wind and terrain instead of a fixed carry arc',()=>{
 const c=COURSES[0],origin={x:0,y:heightAt(c,0,0)+.13,z:0};const calm=previewShot({...c,wind:[0,0]},CLUBS[0],WARRIORS[0],'Tee',1,0,origin),wind=previewShot({...c,wind:[4,0]},CLUBS[0],WARRIORS[0],'Tee',1,0,origin);
 assert.ok(wind.landing.x>calm.landing.x+2);assert.ok(Math.abs(calm.landing.y-heightAt(c,calm.landing.x,calm.landing.z)-.13)<.001);assert.ok(calm.points.some(p=>p.y>origin.y+10));
 const putt=previewShot(c,CLUBS[7],WARRIORS[0],'Green',.5,0,{x:c.greenX,y:heightAt(c,c.greenX,c.length-9)+.13,z:c.length-9});assert.ok(putt.distance>4&&putt.distance<9);assert.ok(putt.points.every(p=>Object.values(p).every(Number.isFinite)));
});
test('Waiting enemies leave room for attackers and approach distinct lanes',()=>{
 const player={x:0,z:0},v={x:0,z:0};for(let type=0;type<3;type++){const e={x:0,z:7,type,slot:2};const waiting=engagementTarget(e,player,v,false),attacking=engagementTarget(e,player,v,true);assert.ok(Math.hypot(waiting.x,waiting.z)>6);assert.ok(Math.hypot(attacking.x,attacking.z)<ENEMY_TYPES[type].reach);}
});
test('Scenery collision slides around trunks and retracts an obstructed camera',()=>{
 const collision=new SceneryCollision([{kind:'tree',x:0,z:0,y:0,height:9}]);const p=collision.slide({x:.1,z:.1});assert.ok(Math.hypot(p.x,p.z)>=.69);const camera=collision.camera({x:0,y:1.7,z:4},{x:0,y:3,z:-4});assert.ok(camera.z>0);const clear=collision.camera({x:4,y:1.7,z:4},{x:4,y:3,z:-4});assert.equal(clear.z,-4);
});

test('Scanned scenery can retain an authored collision radius',()=>{
 const collision=new SceneryCollision([{kind:'rock',x:0,z:0,y:0,height:2.2,radius:.7}]);
 const p=collision.slide({x:.1,z:0});assert.ok(Math.abs(p.x-1.08)<1e-8);
 const clear=collision.slide({x:1.2,z:0});assert.equal(clear.x,1.2);
});

test('Inland hollows do not expose the ocean plane',()=>{for(const c of COURSES)for(let x=-230;x<70;x+=7)for(let z=-70;z<c.length+95;z+=7)assert.ok(heightAt(c,x,z)>-1,'Inland water artifact');});

test('Attack warnings face the strike and follow hills without cutting through them',()=>{
 const ground=(x,z)=>2+Math.sin(x*.2)*.5+z*.12,origin={x:10,y:ground(10,30),z:30};
 for(const type of ['thrust','sweep'])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const geo=telegraphGeometry(origin,yaw,4,type,ground),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   assert.ok((x-origin.x)*Math.sin(yaw)+(z-origin.z)*Math.cos(yaw)>-.00001,'Warning points behind the attacker');
   assert.ok(Math.abs(y-ground(x,z)-.085)<.00001,'Warning intersects the ground');
  }
  geo.dispose();
 }
});
