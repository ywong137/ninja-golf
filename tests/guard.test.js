import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlayerGuard,updatePlayerGuard,resolvePlayerGuard,exitPlayerGuard,PLAYER_GUARD} from '../src/combat.js';
import {Projectiles} from '../src/projectiles.js';
const step=(g,time,held=true,allowed=true,dt=.016)=>updatePlayerGuard(g,{time,dt,held,allowed});
const hit=(g,time,dx=0,dz=3,damage=8,facing=0)=>resolvePlayerGuard(g,{time,dx,dz,damage,facing});
test('Guard blocks the camera-facing arc but leaves rear and side attacks exposed',()=>{
 const g=createPlayerGuard();step(g,0);assert.equal(hit(g,.2).kind,'block');assert.equal(g.strength,76);
 assert.equal(hit(g,.3,0,-3).damage,8);assert.equal(hit(g,.3,3,0).damage,8);assert.equal(g.strength,76);
 assert.equal(hit(g,.4,3,0,8,Math.PI/2).kind,'block');assert.equal(hit(g,.4,NaN,NaN).kind,'hit');
});
test('A timed parry rewards one hit and cannot be farmed by rapidly toggling guard',()=>{
 const g=createPlayerGuard();step(g,1);const parry=hit(g,1.1);assert.equal(parry.kind,'parry');assert.equal(parry.resolve,10);assert.equal(parry.stagger,1.2);
 assert.equal(hit(g,1.12).kind,'block');step(g,1.13,false);step(g,1.14);assert.equal(hit(g,1.15).kind,'block');
 step(g,1.7,false);step(g,1.71);assert.equal(hit(g,1.72).kind,'parry');
});
test('Guard break protects its triggering hit, delays recovery, then permits defense again',()=>{
 const g=createPlayerGuard();step(g,0);for(let i=0;i<3;i++)assert.equal(hit(g,.2+i*.1,0,3,12).damage,0);
 assert.equal(g.strength,0);assert.equal(g.active,false);assert.equal(hit(g,.6).kind,'hit');
 step(g,1.4,true,true,.1);assert.equal(g.strength,0);step(g,1.6,false,true,.1);assert.ok(g.strength>0);step(g,1.7);assert.equal(g.active,true);
});
test('Attacks and dodges cancel guard without granting a new parry when the hold resumes',()=>{
 const g=createPlayerGuard();step(g,0);exitPlayerGuard(g);assert.equal(hit(g,.05).kind,'hit');step(g,.06,true,false);step(g,.07,true,true);assert.equal(hit(g,.08).kind,'block');
 const strength=g.strength;step(g,2,false,true,1);assert.equal(g.strength,Math.min(100,strength+PLAYER_GUARD.recoveryRate));
});
test('Swept projectiles report incoming position and their attacker to guard resolution',()=>{
 const scene=new THREE.Scene(),projectiles=new Projectiles(scene,{burst(){}}),attacker={id:4},player=new THREE.Vector3();
 projectiles.spawn(new THREE.Vector3(0,1,2),new THREE.Vector3(0,1,0),4,attacker);let result;
 projectiles.update(.15,player,(damage,source,owner)=>{const g=createPlayerGuard();step(g,0);result=hit(g,.1,source.x,source.z,damage);assert.equal(owner,attacker);});
 assert.equal(result.kind,'parry');assert.equal(projectiles.items.length,0);projectiles.geometry.dispose();projectiles.material.dispose();
});

test('Guard break briefly delays attacks but permits an immediate dodge escape',async()=>{
 const {guardAttackRecovering,escapeGuardBreak}=await import('../src/combat.js');
 const g=createPlayerGuard();step(g,0);g.strength=10;hit(g,1);
 assert.equal(guardAttackRecovering(g,1.1),true);assert.equal(guardAttackRecovering(g,1.23),false);
 escapeGuardBreak(g,1.05);assert.equal(guardAttackRecovering(g,1.05),false);assert.equal(g.breakPoseUntil,1.05);assert.ok(g.brokenUntil>1.05);
});

test('Gamepad B only dodges; left-stick click only sprints; LB guard and LT focus stay separate',async()=>{
 const {Input}=await import('../src/input.js'),previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const pad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))},input=Object.assign(Object.create(Input.prototype),{previousButtons:[],pressed:new Set(),lookX:0,lookY:0,context:'combat',keys:new Set()});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[pad]}});
 try{
  pad.buttons[1].pressed=true;input.poll(.016,true);assert.equal(input.tap('Dodge'),true);assert.equal(input.padSprint,false);
  pad.buttons[1].pressed=false;input.end();pad.buttons[10].pressed=true;input.poll(.016,true);assert.equal(input.padSprint,true);assert.equal(input.tap('Dodge'),false);
  pad.buttons[10].pressed=false;pad.buttons[4].pressed=true;input.poll(.016,true);assert.equal(input.guarding,true);assert.equal(input.focused,false);
  pad.buttons[4].pressed=false;pad.buttons[6].pressed=true;input.poll(.016,true);assert.equal(input.guarding,false);assert.equal(input.focused,true);
 }finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});

test('V guards without binding Ctrl or changing focused movement',async()=>{
 const {Input}=await import('../src/input.js'),input=Object.assign(Object.create(Input.prototype),{keys:new Set(),padGuard:false,padFocus:false});
 input.keys.add('ControlLeft');assert.equal(input.guarding,false);input.keys.add('ControlRight');assert.equal(input.guarding,false);
 input.keys.clear();input.keys.add('KeyV');assert.equal(input.guarding,true);assert.equal(input.focused,false);
 input.keys.add('KeyC');assert.equal(input.guarding,true);assert.equal(input.focused,true);input.keys.delete('KeyV');assert.equal(input.guarding,false);assert.equal(input.focused,true);
});
