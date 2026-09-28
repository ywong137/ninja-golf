import {shorelinePoint} from '../src/shoreline.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {COURSE_SETS,CLUBS,WARRIORS,heightAt,lieAt} from '../src/course.js';
import {previewShot} from '../src/golf-guide.js';
import {applyRollingResistance,capturesCup,ballHazard} from '../src/golf-roll.js';
const origin=(c,x,z)=>({x,z,y:heightAt(c,x,z)+.13});
const putt=(c,p,aim,power=1)=>previewShot(c,CLUBS[7],WARRIORS[0],lieAt(c,p.x,p.z),power,aim,p);

test('Lotus Crossing controlled putt stops in rough before the organic island shore',()=>{
 const c=COURSE_SETS[0].holes[4],start=origin(c,c.greenX,c.length-12),p=putt(c,start,Math.PI,.9);
 assert.equal(p.outcome,'Stopped');assert.equal(p.lie,'Rough');assert.ok(p.distance>9&&p.distance<11);
 assert.ok(p.points.every(v=>lieAt(c,v.x,v.z)!=='Water'));

});
test('Shrine green controlled putt stops on its collar while an overhit reaches water',()=>{
 const c=COURSE_SETS[0].holes[6],aim=Math.PI*5/9,start=origin(c,c.greenX+Math.sin(aim)*12,c.length+Math.cos(aim)*12),controlled=putt(c,start,aim,.9),overhit=putt(c,start,aim);
 assert.equal(controlled.lie,'Rough');assert.equal(controlled.outcome,'Stopped');assert.ok(controlled.distance>14&&controlled.distance<16);assert.ok(controlled.points.every(p=>lieAt(c,p.x,p.z)!=='Water'));
 assert.equal(overhit.outcome,'Water');assert.ok(overhit.distance>16&&overhit.distance<18);
});
test('Putt guides cross fairway into sand and stop at water across three themes',()=>{
 for(const [theme,hole]of [[0,0],[1,2],[2,6]]){
  const c=COURSE_SETS[theme].holes[hole],b=c.bunkers[0],sand=putt(c,origin(c,b[0]-b[2]-3,b[1]),Math.PI/2);
  assert.equal(lieAt(c,sand.points[0].x,sand.points[0].z),'Fairway');assert.equal(sand.lie,'Bunker');assert.equal(sand.outcome,'Stopped');assert.ok(sand.distance<11);
  const [wx,wz]=shorelinePoint(c.pond,Math.PI),water=putt(c,origin(c,wx-3,wz),Math.PI/2);
  assert.equal(water.outcome,'Water');assert.equal(water.lie,'Water');assert.ok(water.distance<4,'Guide must terminate at the bank, not traverse the pond');
 }
});
test('Putting responds to uphill/downhill direction and increasing surface resistance',()=>{
 const c=COURSE_SETS[0].holes[0],p=origin(c,c.greenX,c.length+7);
 assert.ok(putt(c,p,-Math.PI/2,.4).distance>putt(c,p,Math.PI/2,.4).distance);
 const speeds=[];for(const lie of ['Green','Fairway','Rough','Bunker']){const v={x:4,y:0,z:0};applyRollingResistance(c,{...p},v,{ground:p.y,lie},.1,0);speeds.push(Math.hypot(v.x,v.z));}
 assert.ok(speeds.every((s,i)=>i===0||s<speeds[i-1]));
 const rest={x:0,y:0,z:0};assert.ok(Math.abs(applyRollingResistance(c,{...p},rest,{ground:p.y,lie:'Green'},.1,.2)-.3)<1e-12);assert.deepEqual(rest,{x:0,y:0,z:0});
});
test('Swept cup checks preserve speed, height, and narrow miss rules',()=>{
 const cup={x:0,y:2,z:0},a={x:-1,y:2.13,z:0},b={x:1,y:2.13,z:0};
 assert.equal(capturesCup(a,b,{x:5,y:0,z:0},cup),true);
 assert.equal(capturesCup(a,b,{x:6,y:0,z:0},cup),false);
 assert.equal(capturesCup({...a,z:.33},{...b,z:.33},{x:5,y:0,z:0},cup),false);
 assert.equal(capturesCup(a,{...b,y:3},{x:5,y:0,z:0},cup),false);
 assert.equal(ballHazard({y:18},{ground:12,lie:'Water',water:14},1),null);assert.equal(ballHazard({y:14.1},{ground:12,lie:'Water',water:14},1),'Water');
 assert.equal(ballHazard({y:5},{ground:5,lie:'Out of bounds'},1),'Out of bounds');
});
