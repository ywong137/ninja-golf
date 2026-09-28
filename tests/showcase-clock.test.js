import test from 'node:test';
import assert from 'node:assert/strict';
import {ShowcaseClock,showcaseStages} from '../src/showcase-clock.js';

test('showcase runs golf, fast attack, heavy attack and returns to address',()=>{
 const stages=showcaseStages(2.4,.6,1),clock=new ShowcaseClock(stages),visited=[];
 for(const stage of stages){assert.equal(clock.stage.id,stage.id);visited.push(clock.stage.id);clock.advance(stage.duration+.0000001);}
 assert.ok(visited.indexOf('swing')<visited.indexOf('light'));assert.ok(visited.indexOf('light')<visited.indexOf('heavy'));
 assert.equal(clock.stage.id,'address');assert.equal(clock.cycle,1);
});
test('slow playback and pause preserve phase progress',()=>{
 const clock=new ShowcaseClock(showcaseStages(2.4,.6,1));clock.setSpeed(.1);clock.advance(5);assert.equal(clock.elapsed,.5);
 clock.paused=true;const before={index:clock.index,elapsed:clock.elapsed,time:clock.time};assert.equal(clock.advance(90),0);assert.deepEqual({index:clock.index,elapsed:clock.elapsed,time:clock.time},before);
 clock.paused=false;clock.advance(1);assert.ok(Math.abs(clock.elapsed-.6)<1e-12);
 for(const speed of [0,1.1,NaN,Infinity])assert.throws(()=>clock.setSpeed(speed),/between/);
});
test('weapon changes happen while the old and new figures are fully faded',()=>{
 const clock=new ShowcaseClock(showcaseStages(2.4,.6,1));
 clock.advance(1.1+2.4+.65+.12);assert.equal(clock.stage.id,'golf-out');assert.ok(Math.abs(clock.opacity-.5)<1e-12);
 clock.advance(.12);assert.equal(clock.stage.id,'ready-in');assert.ok(clock.opacity<1e-12);assert.equal(clock.stage.golf,undefined);
 clock.advance(.24);assert.equal(clock.opacity,1);
});
