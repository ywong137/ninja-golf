import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attackDefinition,strikeContains,interceptTarget,chooseAmbushSites} from '../src/combat.js';
import {courseMapPoint,radarPoint} from '../src/navigation.js';
test('Course map and forward-facing radar agree on left and right',()=>{const tee=courseMapPoint(0,0,330),bend=courseMapPoint(28,150,330);assert.ok(bend.x<tee.x);assert.ok(bend.y<tee.y);assert.ok(radarPoint(28,150,0,80,200).x<0);});
test('Light chains branch into distinct heavy finishers',()=>{const finishers=new Set();for(let i=0;i<4;i++){const light=attackDefinition('light',i),heavy=attackDefinition('heavy',i);assert.ok(heavy.damage>light.damage);assert.ok(light.hits.every(t=>t<light.duration));finishers.add(heavy.name);}assert.equal(finishers.size,4);assert.equal(attackDefinition('musou').hits.length,6);});
test('Fan, ring, and sickle reward different positioning and finishers',()=>{
  const fan=attackDefinition('light',0,'fan'),ring=attackDefinition('light',0,'ring'),sickle=attackDefinition('light',0,'sickle');
  assert.ok(strikeContains(0,6,0,ring.reach,ring.arc));assert.ok(!strikeContains(0,6,0,fan.reach,fan.arc));
  assert.ok(strikeContains(3.8,-.8,0,fan.reach,fan.arc));assert.ok(!strikeContains(3.8,-.8,0,sickle.reach,sickle.arc));
  assert.equal(attackDefinition('heavy',0,'sickle').pull,true);assert.ok(attackDefinition('heavy',0,'fan').knockback>14);
  const names=new Set();for(const style of ['fan','ring','sickle'])for(const kind of ['light','heavy','musou'])for(let i=0;i<(kind==='musou'?1:4);i++){
    const a=attackDefinition(kind,i,style);assert.ok(a.hits.every(t=>t>0&&t<a.duration));names.add(a.name);
  }assert.equal(names.size,27);
});
test('Forward cuts spare targets behind, circular finishers do not',()=>{assert.ok(strikeContains(0,3,0,5,1.65));assert.ok(!strikeContains(0,-3,0,5,1.65));assert.ok(strikeContains(0,-3,0,5,Math.PI));assert.ok(!strikeContains(0,8,0,5,Math.PI));});
test('Interceptors lead a running player and flankers separate laterally',()=>{const player={x:0,z:20},velocity={x:0,z:8};const left=interceptTarget({x:0,z:0,role:2,slot:0},player,velocity),right=interceptTarget({x:0,z:0,role:2,slot:1},player,velocity);assert.ok(left.x*right.x<0);assert.ok(interceptTarget({x:0,z:0,role:1,slot:0},player,velocity).z>player.z+8);});
test('Ambush selection uses real, nearby hiding places with cooldowns',()=>{const sites=[{id:'near',x:0,z:3},{id:'front',x:0,z:28},{id:'rear',x:0,z:-28},{id:'used',x:0,z:22,readyAt:20},{id:'far',x:0,z:90}];assert.deepEqual(chooseAmbushSites(sites,{x:0,z:0},0,10).map(x=>x.id),['front','rear']);});
