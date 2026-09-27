import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COURSE_SETS,heightAt} from '../src/course.js';
import {buildThemeScenery} from '../src/course-themes.js';
import {SceneryCollision} from '../src/scenery-collision.js';
import {BuildingNavigation} from '../src/building-navigation.js';

test('A city crowd shares verified corridors without repeating every graph search',()=>{
 const course=COURSE_SETS[3].holes[0],root=new THREE.Group();buildThemeScenery(root,course,[]);
 const collision=new SceneryCollision([],root.userData.buildingObstacles),nav=new BuildingNavigation(course,collision),site=root.userData.landmarks[0];
 const point=(x,z)=>({x,y:heightAt(course,x,z),z});
 const pairs=Array.from({length:64},(_,i)=>[point(site.x-25,site.z-8+i*.25),point(site.x+25+(i%8)*.07,site.z-4+i*.12)]);
 let checks=0;const clear=nav.clear.bind(nav);nav.clear=(...args)=>{checks++;return clear(...args);};
 const routes=pairs.map(([from,target])=>nav.route(from,target));
 assert.ok(checks<400,`Repeated graph visibility work: ${checks}`);
 for(const [i,route]of routes.entries()){
  assert.ok(route.length>1);let before=pairs[i][0];for(const next of route){assert.equal(clear(before,next),true);assert.equal(collision.blocked(next,.3,2,true),false);before=next;}
  assert.deepEqual(route.at(-1),pairs[i][1]);
 }
 // Each returned route owns its points; consuming one enemy's path must not change another.
 const saved=structuredClone(routes[1]);routes[0][0].x+=100;routes[0].shift();assert.deepEqual(routes[1],saved);
 root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('A valid moving-target route survives refresh without a new graph search',()=>{
 const course=COURSE_SETS[0].holes[0],center={x:0,z:70},point=(x,z)=>({x,y:heightAt(course,x,z),z});
 const floor=heightAt(course,center.x,center.z),collision=new SceneryCollision([],[{id:'wall',kind:'box',...center,halfWidth:2,halfDepth:3,yaw:0,minY:floor-10,maxY:floor+20}]);
 const nav=new BuildingNavigation(course,collision),from=point(-8,70),target=point(8,70),state={};let searches=0;const route=nav.route.bind(nav);nav.route=(...args)=>{searches++;return route(...args);};
 nav.waypoint(from,target,state,0);assert.ok(state.buildingPath.length>1);
 nav.waypoint(point(-7.8,70),point(8,70.2),state,1);assert.equal(searches,1);assert.deepEqual(state.buildingPath.at(-1),point(8,70.2));
});

test('A grouped flight keeps four navigation corners while every stair remains solid',()=>{
 const course=COURSE_SETS[0].holes[0],center={x:0,z:70},point=(x,z)=>({x,y:heightAt(course,x,z),z}),floor=heightAt(course,0,70);
 const records=Array.from({length:25},(_,i)=>({id:`stair-${i}`,kind:'box',x:0,z:65.2+i*.4,halfWidth:2.1,halfDepth:.21,yaw:0,minY:floor-8,maxY:floor+.2+i*.19,...(i?{navigationSkip:true}:{navigationFootprint:{...center,halfWidth:2.1,halfDepth:5.01,yaw:0}})}));
 const collision=new SceneryCollision([],records),nav=new BuildingNavigation(course,collision);
 assert.equal(collision.buildings.length,25);assert.equal(nav.nodes.length,4);
 const position=point(-8,70),target=point(8,70),state={};assert.equal(collision.segmentClear(position,target,.3,2,true),false);
 const route=nav.route(position,target);assert.ok(route.length>1);let previous=position;for(const next of route){assert.equal(nav.clear(previous,next),true);previous=next;}
 for(let frame=0;frame<600&&Math.hypot(position.x-target.x,position.z-target.z)>.4;frame++){
  const before={...position},goal=nav.waypoint(position,target,state,frame/60),dx=goal.x-position.x,dz=goal.z-position.z,d=Math.hypot(dx,dz),step=Math.min(.08,d);if(d){position.x+=dx/d*step;position.z+=dz/d*step;}position.y=heightAt(course,position.x,position.z);collision.slide(position,.3,before);assert.equal(collision.blocked(position,.299,2,true),false);
 }
 assert.ok(Math.hypot(position.x-target.x,position.z-target.z)<.4);
});
