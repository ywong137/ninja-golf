import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneryCollision} from '../src/scenery-collision.js';
import {BALL_RADIUS} from '../src/golf-equipment.js';
import {resolveBuildingBall} from '../src/building-ball.js';
const box=(extra={})=>({id:'solid',kind:'box',x:0,z:0,halfWidth:2,halfDepth:2,yaw:0,minY:0,maxY:5,...extra});
const collision=(extra)=>new SceneryCollision([], [box(extra)]);
const point=(x,y,z=0)=>({x,y,z});
const length=v=>Math.hypot(v.x,v.y,v.z);
test('A fast wall hit stops outside the wall and loses energy',()=>{
 const c=collision(),before=point(-10,2),position=point(10,2,1),velocity=point(20,0,1),energy=length(velocity);
 const result=resolveBuildingBall(c,before,position,velocity);
 assert.deepEqual(result,{hit:true,unplayableRoof:false});assert.ok(position.x<-2-BALL_RADIUS);assert.ok(velocity.x<0);assert.ok(velocity.z>0);assert.ok(length(velocity)<energy);
});
test('Roof impacts bounce upward and underside impacts bounce downward',()=>{
 const c=collision(),position=point(0,2),velocity=point(1,-8);
 assert.deepEqual(resolveBuildingBall(c,point(0,10),position,velocity),{hit:true,unplayableRoof:false});assert.ok(position.y>5+BALL_RADIUS);assert.ok(velocity.y>0);assert.ok(velocity.y<8);
 const beam=collision({minY:4}),under=point(0,6),up=point(0,8);
 resolveBuildingBall(beam,point(0,2),under,up);assert.ok(under.y<4-BALL_RADIUS);assert.ok(up.y<0);
});
test('Outward surface travel leaves position and velocity unchanged',()=>{
 const c=collision(),before=point(-2-BALL_RADIUS,2),position=point(-4,2),velocity=point(-3,0),savedPosition={...position},savedVelocity={...velocity};
 assert.equal(resolveBuildingBall(c,before,position,velocity),null);assert.deepEqual(position,savedPosition);assert.deepEqual(velocity,savedVelocity);
 // Also tolerate a collision provider that reports a surface hit at t=0.
 assert.equal(resolveBuildingBall({sweepSphere:()=>({t:0,normal:{x:-1,y:0,z:0}})},before,position,velocity),null);
});
test('Slow roof landing requests relief even on a low inaccessible plinth',()=>{
 for(const maxY of [.2,5]){
  const c=collision({maxY}),position=point(0,maxY),velocity=point(.4,-1.2);
  assert.deepEqual(resolveBuildingBall(c,point(0,maxY+.4),position,velocity),{hit:true,unplayableRoof:true});assert.ok(position.y>maxY+BALL_RADIUS);assert.ok(velocity.y>0);
 }
 const position=point(0,5),velocity=point(0,-1.7);assert.equal(resolveBuildingBall(collision(),point(0,6),position,velocity).unplayableRoof,false);
});
test('A clear path and scenery-only obstacles leave the ball unchanged',()=>{
 const c=new SceneryCollision([{kind:'tree',x:0,z:0,y:0,height:8,radius:1}]),position=point(3,1),velocity=point(5,0),saved={...position};
 assert.equal(resolveBuildingBall(c,point(-3,1),position,velocity),null);assert.deepEqual(position,saved);assert.deepEqual(velocity,point(5,0));
 assert.equal(resolveBuildingBall(null,point(-3,1),position,velocity),null);
});
