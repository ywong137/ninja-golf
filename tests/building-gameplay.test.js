import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,CLUBS,WARRIORS,heightAt,routePoint,lieAt,COURSE_BOUNDS} from '../src/course.js';
import {SceneryCollision} from '../src/scenery-collision.js';
import {BuildingNavigation} from '../src/building-navigation.js';
import {moveOnLand} from '../src/land-movement.js';
import {Projectiles} from '../src/projectiles.js';
import {previewShot} from '../src/golf-guide.js';
import {obstructionRelief,GOLF_STANCE_CLEARANCE} from '../src/building-ball.js';
const course=COURSE_SETS[0].holes[0],site=routePoint(course,.2);
const point=(dx,dz)=>({x:site.x+dx,z:site.z+dz,y:heightAt(course,site.x+dx,site.z+dz)});
const building={id:'test-clubhouse',kind:'box',x:site.x,z:site.z,halfWidth:2,halfDepth:3,yaw:0,minY:heightAt(course,site.x,site.z)-4,maxY:heightAt(course,site.x,site.z)+20};

test('Enemy waypoints make progress around both sides of a solid building',()=>{
 for(const side of [-1,1]){
  const collision=new SceneryCollision([],[building]),navigation=new BuildingNavigation(course,collision),position=point(-8,side*.6),target=point(8,side*.6),state={};let maxDetour=0;
  for(let frame=0;frame<720&&Math.hypot(position.x-target.x,position.z-target.z)>.5;frame++){
   const start={...position},goal=navigation.waypoint(position,target,state,frame/60),dx=goal.x-position.x,dz=goal.z-position.z,d=Math.hypot(dx,dz),step=Math.min(d,.08);if(d){position.x+=dx/d*step;position.z+=dz/d*step;}moveOnLand(position,start,course,collision,.3);assert.equal(collision.blocked(position,.299,2,true),false);maxDetour=Math.max(maxDetour,Math.abs(position.z-site.z));
  }
  assert.ok(maxDetour>3.3);assert.ok(Math.hypot(position.x-target.x,position.z-target.z)<.55,JSON.stringify(position));
 }
});

test('Movement retains its safe prior position when a correction reaches water',()=>{
 const from=point(-8,0),position={...from,x:from.x+1},water=course.pond;assert.equal(lieAt(course,water[0],water[1]),'Water');
 moveOnLand(position,from,course,{slide(p){p.x=water[0];p.z=water[1];},blocked(){return false;}},.38);
 assert.deepEqual(position,from);
});

test('Fast land movement cannot cross a thin building wall or course edge',()=>{
 const collision=new SceneryCollision([],[{...building,halfWidth:.05}]),from=point(-3,0),position=point(3,0);moveOnLand(position,from,course,collision,.38);assert.ok(position.x<site.x-.42);assert.equal(collision.blocked(position,.379),false);
 const inland=COURSE_SETS[2].holes[0],x=COURSE_BOUNDS.maxX-1,boundary={x,y:heightAt(inland,x,60),z:60},outside={...boundary,x:COURSE_BOUNDS.maxX+20};assert.notEqual(lieAt(inland,x,60),'Out of bounds');moveOnLand(outside,boundary,inland,new SceneryCollision());assert.ok(outside.x<=COURSE_BOUNDS.maxX);assert.notEqual(lieAt(inland,outside.x,outside.z),'Out of bounds');
});

test('Building cover intercepts projectiles but does not protect someone in front of the wall',()=>{
 const collision=new SceneryCollision([],[{id:'wall',kind:'box',x:0,z:0,halfWidth:.1,halfDepth:3,yaw:0,minY:-2,maxY:5}]);
 for(const playerX of [-1,3]){let hits=0,bursts=0;const projectiles=new Projectiles(new THREE.Scene(),{burst(){bursts++;}});projectiles.spawn(new THREE.Vector3(-3,1,0),new THREE.Vector3(5,1,0),5);projectiles.update(.6,new THREE.Vector3(playerX,0,0),()=>hits++,collision);assert.equal(hits,playerX<0?1:0);assert.equal(projectiles.items.length,0);assert.ok(bursts>0);}
});

test('Shot previews stop at an airborne obstruction and reflect rolling wall impacts',()=>{
 const collision=new SceneryCollision([],[building]),start=point(-8,0);start.y+=.13;
 const air=previewShot(course,CLUBS[0],WARRIORS[0],lieAt(course,start.x,start.z),1,Math.PI/2,start,collision);assert.equal(air.outcome,'Obstruction');assert.equal(air.lie,'Building');assert.ok(air.landing.x<site.x-2);
 const putt=previewShot(course,CLUBS[7],WARRIORS[0],lieAt(course,start.x,start.z),1,Math.PI/2,start,collision);assert.equal(putt.outcome,'Stopped');assert.ok(putt.landing.x<site.x-2);assert.ok(putt.points.some((p,i)=>i&&p.x<putt.points[i-1].x));
});


test('A route can restart at the movement solver wall clearance',()=>{
 const collision=new SceneryCollision([],[building]),navigation=new BuildingNavigation(course,collision),from=point(-1,3.31),target=point(8,0);
 assert.equal(collision.blocked(from,.3,2,true),false);assert.ok(navigation.route(from,target).length>0);
});

test('A ball beside a building gets a dry free-drop position with room for every golf stance',()=>{
 const collision=new SceneryCollision([],[building]),ball=point(-2.2,0);ball.y+=.13;
 const relief=obstructionRelief(course,collision,ball);assert.equal(relief.status,'relief');
 assert.ok(Math.hypot(relief.position.x-course.greenX,relief.position.z-course.length)>=Math.hypot(ball.x-course.greenX,ball.z-course.length));
 assert.notEqual(lieAt(course,relief.position.x,relief.position.z),'Water');
 for(let i=0;i<32;i++){const angle=i*Math.PI/16,x=relief.position.x-Math.sin(angle)*(GOLF_STANCE_CLEARANCE-.38),z=relief.position.z-Math.cos(angle)*(GOLF_STANCE_CLEARANCE-.38);assert.equal(collision.blocked({x,y:heightAt(course,x,z),z},.38,2,true),false);}
 assert.equal(obstructionRelief(course,collision,relief.position).status,'clear');
});

test('Building relief leaves clear lies untouched and reports an enclosed lie as unplayable',()=>{
 const clear=point(-8,0);assert.deepEqual(obstructionRelief(course,new SceneryCollision([],[building]),clear),{status:'clear'});
 const enclosed=new SceneryCollision([],[{...building,halfWidth:30,halfDepth:30}]);assert.deepEqual(obstructionRelief(course,enclosed,point(0,0)),{status:'unplayable'});
});
