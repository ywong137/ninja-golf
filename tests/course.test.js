import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, CLUBS, WARRIORS, heightAt, lieAt, carryFor, launchShot, scoreName } from '../src/course.js';

test('Every hole has a safe tee, a playable green, and distinct hazards',()=>{
  for(const c of COURSES){assert.equal(lieAt(c,0,0),'Tee');assert.equal(lieAt(c,c.greenX,c.length),'Green');assert.ok(Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return lieAt(c,c.pond[0]+Math.cos(a)*c.pond[2]*.5,c.pond[1]+Math.sin(a)*c.pond[3]*.5)==='Water';}).some(Boolean),c.name+' retains playable water');for(const b of c.bunkers)assert.equal(lieAt(c,...b.slice(0,2)),'Bunker');assert.equal(lieAt(c,300,0),'Out of bounds');assert.ok(Number.isFinite(heightAt(c,0,0)));}
});
test('Ballistic launch agrees with displayed carry at every power',()=>{
  for(const club of CLUBS.slice(0,-1))for(const w of WARRIORS)for(const power of [.15,.5,1]){
    const shot=launchShot(club,w,'Fairway',power,0);const duration=2*shot.y/9.81;const carry=shot.z*duration;assert.ok(Math.abs(carry-carryFor(club,w,'Fairway',power))<1e-7);
  }
});
test('Putting pace matches the green rolling friction',()=>{
  const c=CLUBS[7];for(const power of [.2,.5,1]){const shot=launchShot(c,WARRIORS[0],'Green',power,0);assert.equal(shot.y,0);assert.ok(Math.abs(shot.z**2/(2*.95)-carryFor(c,WARRIORS[0],'Green',power))<1e-8);}
});
test('Rough reduces carry, and a sand wedge escapes sand more effectively',()=>{
  const w=WARRIORS[0];assert.ok(carryFor(CLUBS[0],w,'Rough')<carryFor(CLUBS[0],w,'Fairway'));const sw=CLUBS[6];assert.ok(carryFor(sw,w,'Bunker')/carryFor(sw,w,'Fairway')>carryFor(CLUBS[0],w,'Bunker')/carryFor(CLUBS[0],w,'Fairway'));
});
test('Full-power shots stay finite for every club and direction',()=>{
  for(const c of CLUBS)for(const angle of [-Math.PI,-1,0,1,Math.PI]){const s=launchShot(c,WARRIORS[0],'Fairway',1,angle);assert.ok([s.x,s.y,s.z].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(s.x,s.z)-Math.abs(launchShot(c,WARRIORS[0],'Fairway',1,0).z))<1e-7);}
});
test('Golf scoring names remain correct around par',()=>{assert.equal(scoreName(1,3),'Hole in one!');assert.equal(scoreName(2,4),'Eagle');assert.equal(scoreName(3,4),'Birdie');assert.equal(scoreName(4,4),'Par');assert.equal(scoreName(5,4),'Bogey');assert.equal(scoreName(6,4),'Double bogey');});
