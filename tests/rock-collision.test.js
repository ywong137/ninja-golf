import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {sceneryRockObstacle,fitSceneryRock} from '../src/scenery-rocks.js';
import {SceneryCollision} from '../src/scenery-collision.js';

for(const source of ['coastal-rock','desert-rock','sea-cliff'])test(source+' collision encloses both rendered LODs at actual scale and rotation',()=>{
 const bytes=fs.readFileSync(new URL('../public/models/nature/'+source+'.glb',import.meta.url));
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const boxes=json.meshes.flatMap(m=>m.primitives.map(p=>{const a=json.accessors[p.attributes.POSITION];return new T.Box3(new T.Vector3(...a.min),new T.Vector3(...a.max));}));
 const bounds=boxes.reduce((b,p)=>b.union(p),new T.Box3());
 for(const angle of [0,.61,2.5,4.71])for(const scale of [.4,3,12]){
  const record={x:20,y:7,z:35,scale,angle},obstacle=sceneryRockObstacle(record,bounds,'scan'),matrix=new T.Matrix4().compose(new T.Vector3(record.x,record.y,record.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),new T.Vector3(scale,scale,scale));
  const collision=new SceneryCollision([],[],[obstacle]);
  for(const box of boxes)for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const vertex=new T.Vector3(x,y,z).applyMatrix4(matrix);
   // Check the complete visible footprint, including the extreme edges.
   assert.ok(collision.blocked({...vertex,y:(obstacle.minY+obstacle.maxY)/2},0,.01));
   assert.ok(vertex.y>=obstacle.minY-1e-6&&vertex.y<=obstacle.maxY+1e-6);
  }
  const extent=Math.hypot(obstacle.halfWidth,obstacle.halfDepth)+5;
  for(const offset of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const yaw=angle+offset;
   const from={x:obstacle.x+Math.sin(yaw)*extent,y:obstacle.minY,z:obstacle.z+Math.cos(yaw)*extent},to={x:2*obstacle.x-from.x,y:from.y,z:2*obstacle.z-from.z};
   collision.slide(to,.38,from);assert.equal(collision.blocked(to,.379),false);
   assert.ok((to.x-obstacle.x)*(from.x-obstacle.x)+(to.z-obstacle.z)*(from.z-obstacle.z)>0,'Fast movement must stay on its approach side');
  }
 }
});
test('Fitted garden rocks replace guessed cover radii without changing building-only golf queries',()=>{
 const bounds=new T.Box3(new T.Vector3(-3,-1,-2),new T.Vector3(2,4,2)),record={x:5,y:4,z:8,height:2,radius:4,angle:.7,burial:.2};
 const fit=fitSceneryRock(record,bounds),obstacle=sceneryRockObstacle(fit,bounds,'cover');
 const collision=new SceneryCollision([{kind:'rock',x:5,y:4,z:8,radius:1,height:2}],[],[obstacle]);
 assert.equal(collision.rocks.length,1);assert.equal(collision.nearby(5,8).length,1);
 assert.equal(collision.blocked({x:5,y:4,z:8}),true);
 assert.equal(collision.blocked({x:5,y:4,z:8},.38,2,true),false);
});
test('Rock surfaces slide tangentially and let players run around corners',()=>{
 const collision=new SceneryCollision([],[],[{id:'large-rock',kind:'box',x:0,z:0,minY:0,maxY:6,halfWidth:3,halfDepth:2,yaw:0}]);
 const p={x:-6,y:0,z:0};
 for(let i=0;i<90;i++){const from={...p};p.x+=.15;p.z+=.05;collision.slide(p,.38,from);assert.equal(collision.blocked(p,.379),false);}
 assert.ok(p.x>3.38&&p.z>2.38,'Sliding must retain progress around the rock');
});

test('Combat camera stays outside the body when orbiting beside a tall rock',()=>{
 const c=new SceneryCollision([],[],[{id:'rock',kind:'box',x:0,z:0,halfWidth:4,halfDepth:3,minY:0,maxY:12,yaw:0}]);
 const p={x:-4.38,y:1.7,z:0};
 for(let i=0;i<64;i++){
  const angle=i*Math.PI/32,target={x:p.x+Math.sin(angle)*7.7,y:3.3,z:Math.cos(angle)*7.7};
  c.camera(p,target,2.4);
  assert.ok(Math.hypot(target.x-p.x,target.y-p.y,target.z-p.z)>=2.4-1e-6);
  assert.equal(c.sweepSphere(p,target,.2,false),null);
 }
});

test('A ball inside a solid rock gets a reachable drop with golf stance clearance',async()=>{
 const {COURSE_SETS,heightAt,routePoint}=await import('../src/course.js');
 const {obstructionRelief,GOLF_STANCE_CLEARANCE}=await import('../src/building-ball.js');
 const course=COURSE_SETS[0].holes[0],site=routePoint(course,.2),y=heightAt(course,site.x,site.z);
 const collision=new SceneryCollision([],[],[{id:'rock',kind:'box',x:site.x,z:site.z,halfWidth:3,halfDepth:4,minY:y-3,maxY:y+6,yaw:.4}]);
 const ball={x:site.x,y:y+.13,z:site.z},relief=obstructionRelief(course,collision,ball);
 assert.equal(relief.status,'relief');
 assert.equal(collision.blocked(relief.position,GOLF_STANCE_CLEARANCE,2.2),false);
 assert.ok(Math.hypot(relief.position.x-course.greenX,relief.position.z-course.length)>=Math.hypot(ball.x-course.greenX,ball.z-course.length));
 assert.deepEqual(obstructionRelief(course,collision,relief.position),{status:'clear'});
});
