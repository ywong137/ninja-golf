import test from 'node:test';
import assert from 'node:assert/strict';
import {CLUBS,WARRIORS,COURSES,carryFor,launchShot,heightAt} from '../src/course.js';
import {SHOT_HEIGHTS,shotHeightProfile} from '../src/shot-height.js';
import {previewShot} from '../src/golf-guide.js';
import {BALL_RADIUS} from '../src/golf-equipment.js';
import {Input} from '../src/input.js';

test('every airborne club offers lower and higher arcs with a carry cost and different landing speeds',()=>{
 for(const club of CLUBS.slice(0,7))for(const warrior of WARRIORS)for(const lie of ['Tee','Fairway','Rough','Bunker'])for(const power of [.15,.55,1]){
  const shots=SHOT_HEIGHTS.map(({value})=>launchShot(club,warrior,lie,power,.37,value));
  const flight=shots.map(s=>({height:s.y*s.y/(2*9.81),time:2*s.y/9.81,speed:Math.hypot(s.x,s.z)}));
  assert.ok(flight[0].height<flight[1].height&&flight[1].height<flight[2].height);
  assert.ok(flight[0].time<flight[1].time&&flight[1].time<flight[2].time);
  assert.ok(flight[0].speed>flight[1].speed&&flight[1].speed>flight[2].speed);
  for(let i=0;i<3;i++)assert.ok(Math.abs(flight[i].speed*flight[i].time-carryFor(club,warrior,lie,power,SHOT_HEIGHTS[i].value))<1e-7);
  assert.ok(carryFor(club,warrior,lie,power,-1)<carryFor(club,warrior,lie,power));
  assert.ok(carryFor(club,warrior,lie,power,1)<carryFor(club,warrior,lie,power));
  assert.deepEqual(shots[1],launchShot(club,warrior,lie,power,.37));
 }
});
test('wind exposure increases with shot height in the actual terrain preview',()=>{
 const course=COURSES[0],origin={x:0,y:heightAt(course,0,0)+BALL_RADIUS,z:0};
 for(const club of [CLUBS[0],CLUBS[3],CLUBS[6]]){
  const drift=SHOT_HEIGHTS.map(({value})=>{
   const calm=previewShot({...course,wind:[0,0]},club,WARRIORS[0],'Tee',.8,0,origin,null,value);
   const wind=previewShot({...course,wind:[6,0]},club,WARRIORS[0],'Tee',.8,0,origin,null,value);
   return wind.landing.x-calm.landing.x;
  });
  assert.ok(drift[0]>0&&drift[0]<drift[1]&&drift[1]<drift[2],`${club.short}: ${drift}`);
 }
});
test('putting remains independent of shot height and invalid profiles fail clearly',()=>{
 for(const power of [0,.3,1])for(const {value}of SHOT_HEIGHTS){
  assert.deepEqual(launchShot(CLUBS[7],WARRIORS[0],'Green',power,.5,value),launchShot(CLUBS[7],WARRIORS[0],'Green',power,.5));
  assert.equal(carryFor(CLUBS[7],WARRIORS[0],'Green',power,value),carryFor(CLUBS[7],WARRIORS[0],'Green',power));
 }
 for(const value of [2,-2,.2,NaN,'high'])assert.throws(()=>shotHeightProfile(value),/Shot height must/);
});
test('D-pad height controls use single presses and do not enter the combat action map',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),pad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
 const input=Object.assign(Object.create(Input.prototype),{keys:new Set(),pressed:new Set(),previousButtons:[],lookX:0,lookY:0,context:'aim'});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[pad]}});
 try{
  for(const [button,key]of [[12,'KeyX'],[13,'KeyZ']]){
   pad.buttons[button].pressed=true;input.poll(.016,false);assert.equal(input.tap(key),true);
   input.end();input.poll(.016,false);assert.equal(input.tap(key),false);
   pad.buttons[button].pressed=false;input.poll(.016,false);input.end();
   pad.buttons[button].pressed=true;input.poll(.016,true);assert.equal(input.tap(key),false);
   pad.buttons[button].pressed=false;input.poll(.016,true);input.end();
  }
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
