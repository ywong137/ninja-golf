import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneryCollision} from '../src/scenery-collision.js';
const box=(more={})=>({id:'wall',kind:'box',x:0,z:0,halfWidth:2,halfDepth:1,yaw:0,minY:0,maxY:5,...more});
const p=(x,z,y=0)=>({x,y,z});
const near=(a,b,e=1e-4)=>assert.ok(Math.abs(a-b)<e,`${a} differs from ${b}`);
test('Box faces, rounded corners, and inside recovery use exact circle clearance',()=>{
 const c=new SceneryCollision([], [box()]);
 for(const [start,end,axis,value] of [[p(-5,0),p(0,0),'x',-2.38],[p(5,0),p(0,0),'x',2.38],[p(0,-5),p(0,0),'z',-1.38],[p(0,5),p(0,0),'z',1.38]]){c.slide(end,.38,start);near(end[axis],value);assert.equal(c.blocked(end),false);}
 assert.equal(c.blocked(p(2.3,1.3),.38),false);assert.equal(c.blocked(p(2.25,1.25),.38),true);
 const inside=p(0,0);c.slide(inside);assert.equal(c.blocked(inside),false);near(inside.z,1.38);
});
test('Fast movement cannot cross thin walls and keeps tangential progress',()=>{
 const c=new SceneryCollision([], [box({halfWidth:.025,halfDepth:10})]);
 for(const radius of [.3,.38]){const end=p(20,3);c.slide(end,radius,p(-20,-3));near(end.x,-.025-radius);near(end.z,3);assert.equal(c.blocked(end,radius),false);assert.equal(c.segmentClear(p(-20,0),p(20,0),radius),false);}
 const tangent=p(-.405,8);assert.equal(c.segmentClear(p(-.405,-8),tangent),true);
});
test('Rotated boxes use Three.js yaw and preserve corner sliding',()=>{
 const c=new SceneryCollision([], [box({halfWidth:4,halfDepth:.1,yaw:Math.PI/2})]);
 const end=p(8,2);c.slide(end,.38,p(-8,2));near(end.x,-.48);near(end.z,2);
 assert.equal(c.blocked(p(0,3)),true);assert.equal(c.blocked(p(3,0)),false);
 const d=new SceneryCollision([], [box()]),corner=p(4,3);d.slide(corner,.38,p(-4,-3));assert.equal(d.blocked(corner),false);assert.ok(corner.z>1.38||corner.x>2.38);
});
test('Footprint buckets find far-center structures and deduplicate wide records',()=>{
 const record=box({x:50,halfWidth:55,halfDepth:2}),c=new SceneryCollision([], [record,record]);
 assert.equal(c.buildings.length,1);assert.equal(c.nearby(0,0).length,1);assert.equal(c.blocked(p(0,0)),true);
 assert.equal(c.segmentClear(p(-10,0),p(120,0)),false);
 const target=p(100,0,2);c.camera(p(-10,0,2),target);near(target.x,-5.45-.22);
});
test('Heights preserve gate openings, porches, and views over low walls',()=>{
 const c=new SceneryCollision([], [box({id:'left',x:-3,halfWidth:.5}),box({id:'right',x:3,halfWidth:.5}),box({id:'beam',halfWidth:3,minY:4,maxY:5})]);
 assert.equal(c.segmentClear(p(0,-5),p(0,5)),true);assert.equal(c.blocked(p(0,0)),false);
 let target=p(0,5,2);c.camera(p(0,-5,2),target);near(target.z,5);
 target=p(0,5,4.5);c.camera(p(0,-5,4.5),target);assert.ok(target.z<-1.4);
 const low=new SceneryCollision([], [box({maxY:1})]);target=p(0,5,2);low.camera(p(0,-5,2),target);near(target.z,5);
 assert.equal(low.blocked(p(0,0,1.01)),false);assert.equal(low.blocked(p(0,0,.5)),true);
});
test('Legacy cylinders and building-only route queries remain separate',()=>{
 const c=new SceneryCollision([{kind:'tree',x:0,z:0,y:0,height:8,radius:.5}],[]),end=p(0,0);c.slide(end);near(end.x,.88);assert.equal(c.blocked(p(0,0)),true);assert.equal(c.blocked(p(0,0),.38,2,true),false);assert.equal(c.segmentClear(p(-5,0),p(5,0),.38,2,true),true);
 const round=new SceneryCollision([], [{id:'column',kind:'cylinder',x:0,z:0,radius:.45,minY:0,maxY:5}]);assert.equal(round.segmentClear(p(-10,0),p(10,0)),false);
});
test('Sphere sweeps return wall and roof normals across fast segments',()=>{
 const c=new SceneryCollision([], [box({halfWidth:.025})]);let hit=c.sweepSphere(p(-20,0,2),p(20,0,2),.13);assert.ok(hit);near(hit.t,(20-.155)/40);assert.deepEqual(hit.normal,{x:-1,y:0,z:0});assert.equal(hit.obstacle.id,'wall');
 hit=c.sweepSphere(p(0,0,20),p(0,0,-10),.13);near(hit.t,(20-5.13)/30);assert.deepEqual(hit.normal,{x:0,y:1,z:0});
 hit=c.sweepSphere(p(0,0,-10),p(0,0,20),.13);assert.deepEqual(hit.normal,{x:0,y:-1,z:0});
 assert.equal(c.sweepSphere(p(-20,0,6),p(20,0,6),.13),null);
});
test('Collision records fail early for invalid bounds',()=>{
 assert.throws(()=>new SceneryCollision([], [box({halfWidth:-1})]),/Invalid building/);
 assert.throws(()=>new SceneryCollision([], [box({kind:'mesh'})]),/Unsupported building/);
});

test('Touching surfaces permit outward motion and roof-height routes',()=>{
 const c=new SceneryCollision([], [box()]);
 assert.equal(c.segmentClear(p(-5,0,5),p(5,0,5)),true);
 assert.equal(c.sweepSphere(p(-2.13,0,2),p(-5,0,2),.13),null);
 assert.equal(c.sweepSphere(p(0,0,5.13),p(0,0,8),.13),null);
 assert.ok(c.sweepSphere(p(0,0,5.13),p(0,0,2),.13));
});
test('Two-wall corners stop diagonal movement without entering either wall',()=>{
 const c=new SceneryCollision([], [box({id:'x',halfWidth:.05,halfDepth:10}),box({id:'z',halfWidth:10,halfDepth:.05})]);
 const end=p(8,8);c.slide(end,.38,p(-8,-8));assert.equal(c.blocked(end),false);near(end.x,-.43);near(end.z,-.43);
});

test('Elevated combat camera keeps its full clearance beside a raised building',()=>{
 const c=new SceneryCollision([], [box({halfWidth:12,halfDepth:7,minY:0,maxY:7.3866}),box({id:'upper-wall',halfWidth:12,halfDepth:7,minY:7.3866,maxY:12.1866})]);
 const origin={x:0,y:6.9809,z:8};
 for(let i=0;i<32;i++){
  const angle=i*Math.PI/16,target={x:Math.sin(angle)*7.7,y:7.8409,z:8+Math.cos(angle)*7.7};c.camera(origin,target,2.4);
  assert.equal(c.sweepSphere(origin,target,.25,false),null);
  assert.ok(Math.hypot(target.x-origin.x,target.y-origin.y,target.z-origin.z)>=2.4);
 }
});
