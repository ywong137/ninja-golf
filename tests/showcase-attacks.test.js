import test from 'node:test';import assert from 'node:assert/strict';
import {buildShowcaseAttacks,showcaseAttackFrame,showcaseAttackTravel} from '../src/showcase-attacks.js';
const record=(duration,hit,travel)=>({duration,combatDuration:duration,impacts:[hit],planarRoot:{duration,rows:[{time:0,x:0,z:0},{time:duration,x:0,z:travel}]}});
const records={l0:{...record(1,.2,1),continuations:{light:{at:.4,clip:'l1',step:1}}},l1:record(1,.4,1),h0:record(2,.6,2),h1:record(3,1,3),m0:record(4,1,4)};
const warrior={lightComboLength:2,combatStyle:'sword'},resolve=(w,kind,step)=>kind[0]+step;
test('preview continues a captured combo before recovery while keeping each cut inspectable',()=>{
 const {performances,inspection}=buildShowcaseAttacks(warrior,records,resolve);
 assert.equal(performances.light.duration,1.4);assert.equal(performances['light-1'].duration,1);
 assert.deepEqual(inspection.map(s=>s.id),['light-1','light-2','heavy-2','musou']);
 const before=showcaseAttackFrame(performances.light,.39,'test'),after=showcaseAttackFrame(performances.light,.45,'test');
 assert.equal(before.action.motionName,'l0');assert.equal(after.action.motionName,'l1');assert.ok(Math.abs(after.action.time-.05)<1e-8);
 assert.notEqual(before.action.token,after.action.token);
 const a=showcaseAttackTravel(performances.light,.4,0,2),b=showcaseAttackTravel(performances.light,1.4,0,2);
 assert.ok(Math.abs(a.z-.8)<1e-8);assert.ok(Math.abs(b.z-2.8)<1e-8);
 const finish=showcaseAttackFrame(performances.light,1.4,'test');assert.ok(Math.abs(finish.action.time-1)<1e-8);
});
test('direct heavy inspection preserves its full gameplay contact and travel',()=>{
 const p=buildShowcaseAttacks(warrior,records,resolve).performances['heavy-2'];
 const f=showcaseAttackFrame(p,1,'test');assert.equal(f.action.kind,'heavy');assert.equal(f.action.step,1);assert.deepEqual(f.action.hits,[1]);assert.equal(f.action.duration,3);
 const delta=showcaseAttackTravel(p,3,Math.PI/2,1);assert.ok(Math.abs(delta.x-3)<1e-8);assert.ok(Math.abs(delta.z)<1e-8);
});
