import test from 'node:test';
import assert from 'node:assert/strict';
import {gaitContactWeight,gaitSupportProgress,sourceGaitBlend,sourceGaitContacts,sourceSupportIntervals} from '../src/source-gait-clock.js';

const clip=(name,stride,duration=.7)=>({name,duration,userData:{sourceGaitClockVersion:1,sourceGait:{stride,feet:{
 r:{supportInterval:[42/88,60/88]},l:{supportInterval:[-2/88,15/88]},
}}}});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('support progress survives zero-crossing intervals without treating an airborne foot as planted',()=>{
 close(gaitSupportProgress(.05,[-.05,.15]),.5);
 close(gaitSupportProgress(.95,[-.05,.15]),0);
 close(gaitSupportProgress(.1,[0,.28]),.1/.28);
 assert.equal(gaitSupportProgress(.4,[-.05,.15]),null);
 assert.equal(gaitSupportProgress(.3,[0,.28]),null);
 assert.throws(()=>gaitSupportProgress(NaN,[0,.28]),/finite phase/);
});

test('captured cadence covers the requested distance at different character scales and frame rates',()=>{
 for(const scale of [.85,1,1.1,1.2])for(const rate of [40,60,120]){
  const blend=sourceGaitBlend([clip('Run',2.626)],[1],5.6,scale);
  let cycles=0;for(let i=0;i<rate*10;i++)cycles+=blend.phaseRate/rate;
  close(cycles*2.626*scale,56);
 }
});

test('directional blends retain the requested world velocity with unequal strides and clip durations',()=>{
 const directions=[Math.cos(.61),Math.sin(.61)],clips=[clip('Forward',2.626,.7),clip('Right',1.8,.9)];
 const blend=sourceGaitBlend(clips,directions,5.6,1.1);
 for(let i=0;i<2;i++)close(blend.phaseRate*blend.weights[i]*clips[i].userData.sourceGait.stride*1.1,5.6*directions[i]);
 close(blend.weights.reduce((a,b)=>a+b,0),1);
});

test('captured support starts on the left, releases it, and supports the right at its measured phase',()=>{
 const blend=sourceGaitBlend([clip('Run',2.626)],[1],5.6,1.1);
 assert.deepEqual(sourceGaitContacts(blend,0),{contactWeights:{r:0,l:1},stance:{r:false,l:true}});
 assert.deepEqual(sourceGaitContacts(blend,.3),{contactWeights:{r:0,l:0},stance:{r:false,l:false}});
 assert.deepEqual(sourceGaitContacts(blend,.55),{contactWeights:{r:1,l:0},stance:{r:true,l:false}});
});

test('contact wrapping is periodic for negative phases and many cycles',()=>{
 for(const phase of [-.08,-.01,0,.1,.2,.4,.98])for(const cycle of [-7,-1,0,1,12])
  close(gaitContactWeight(phase+cycle,[-.02,.18]),gaitContactWeight(phase,[-.02,.18]));
});

test('legacy and mixed source blends keep the existing controller, but inactive legacy clips do not block a source clock',()=>{
 const legacy={name:'Old',duration:.7},source=clip('New',2.6);
 assert.equal(sourceGaitBlend([legacy],[1],5.6,1.1),null);
 assert.equal(sourceGaitBlend([source,legacy],[.5,.5],5.6,1.1),null);
 assert.ok(sourceGaitBlend([source,legacy],[1,0],5.6,1.1));
 assert.equal(sourceGaitBlend([source],[0],5.6,1.1),null);
});

test('zero speed holds the captured phase without a nonfinite value',()=>{
 const blend=sourceGaitBlend([clip('Run',2.6)],[1],0,1.1);
 assert.equal(blend.phaseRate,0);assert.deepEqual(blend.weights,[1]);
});

test('invalid source metadata fails with the affected clip and side',()=>{
 const missing=clip('MissingContacts',2.6);delete missing.userData.sourceGait.feet.r;
 assert.throws(()=>sourceGaitBlend([missing],[1],5.6,1.1),/support interval r in MissingContacts/);
 assert.throws(()=>sourceGaitBlend([clip('NoStride',0)],[1],5.6,1.1),/stride.*NoStride/);
 assert.throws(()=>sourceGaitBlend([clip('Run',2.6)],[1],5.6,0),/positive scale/);
 assert.throws(()=>gaitContactWeight(0,[0,2]),/at most one cycle/);
});

test('directional source transfers keep only contact shared by asymmetric captured strides',()=>{
 const forward=clip('Forward',2.626),backward=clip('Backward',2.626);
 backward.userData.sourceGait.feet.r.supportInterval=[41/88,59/88];
 // The same left interval can use the neighboring representation of phase zero.
 backward.userData.sourceGait.feet.l.supportInterval=[86/88,103/88];
 const blend=sourceGaitBlend([forward,backward],[.4,.6],5.3,1.1);
 const intervals=sourceSupportIntervals(blend);
 close(intervals.r[0],42/88);close(intervals.r[1],59/88);
 close(intervals.l[0],-2/88);close(intervals.l[1],15/88);
 for(const side of ['r','l'])for(let i=0;i<=20;i++){
  const phase=intervals[side][0]+(intervals[side][1]-intervals[side][0])*i/20;
  for(const profile of blend.profiles)close(gaitContactWeight(phase,profile.feet[side].supportInterval),1);
 }
 const reversed=sourceSupportIntervals({...blend,profiles:[...blend.profiles].reverse()});
 for(const side of ['r','l'])for(const edge of [0,1])close(Math.sin(Math.PI*(reversed[side][edge]-intervals[side][edge])),0);
 backward.userData.sourceGait.feet.r.supportInterval=[.05,.25];
 assert.throws(()=>sourceSupportIntervals(blend),/shared planted interval for r/);
});
