import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildShadowSequence,shadowSequenceFrame,crossedShadowEvents} from '../src/shadow-sequence.js';
import {samplePlanarRoot,attackRootDelta} from '../src/attack-root-motion.js';
const all=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const steps=[{clip:'Shinobi_Stepping_Cut',heading:0},{clip:'Shinobi_Left_Stepping_Cut',heading:Math.PI*2/3,shadowTravel:1.5},{clip:'Shinobi_Airborne_Cut',heading:-Math.PI*2/3,shadowTravel:1.5},{clip:'Shinobi_Left_Airborne_Cut',heading:0,shadowTravel:1.5}];
const records=Object.fromEntries(steps.map(s=>[s.clip,all[s.clip]]));
test('four complete performances retain native strike poses, grip records and recovery',()=>{
 const before=JSON.stringify(records),sequence=buildShadowSequence(records,steps);
 assert.deepEqual(sequence.impactHands,['r','l','r','l']);assert.equal(sequence.hits.length,4);assert.ok(sequence.duration>6&&sequence.duration<6.1);
 sequence.hits.forEach((time,index)=>{const part=sequence.segments[index],f=shadowSequenceFrame({sequence,time,token:14});assert.equal(f.hidden,false);assert.equal(f.action.motionName,steps[index].clip);assert.ok(Math.abs(f.action.time/f.action.duration*part.motion.duration-part.motion.impacts[0])<1e-8);assert.equal(f.action.planarRoot,part.motion.planarRoot);});
 assert.equal(JSON.stringify(records),before);assert.equal(shadowSequenceFrame(null),null);
});
test('each stance and blade-mount change happens during an explicit disappearance',()=>{
 const sequence=buildShadowSequence(records,steps);
 for(let i=1;i<4;i++){
  const before=sequence.segments[i-1],after=sequence.segments[i],t=(before.end+after.start)/2;
  const f=shadowSequenceFrame({sequence,time:t,token:2});assert.ok(f.hidden);assert.equal(f.action.motionName,after.clip);assert.equal(f.action.time,0);assert.equal(f.action.entryBlend,0);
  assert.equal(shadowSequenceFrame({sequence,time:after.start,token:2}).hidden,false);
  assert.equal(shadowSequenceFrame({sequence,time:before.end-1e-8,token:2}).action.motionName,before.clip);
 }
 assert.equal(shadowSequenceFrame({sequence,time:sequence.duration+1,token:2}).hidden,false);
});
test('root travel follows each rotated source exactly and moves only within the disappearance between cuts',()=>{
 const sequence=buildShadowSequence(records,steps);
 for(const part of sequence.segments){
  const start=samplePlanarRoot(sequence.planarRoot,part.start),c=Math.cos(part.heading),s=Math.sin(part.heading);
  for(const t of [0,.1,.35,.7,1]){const expected=samplePlanarRoot(part.motion.planarRoot,part.motion.duration*t),actual=samplePlanarRoot(sequence.planarRoot,part.start+part.duration*t);assert.ok(Math.hypot(actual.x-start.x-expected.x*c-expected.z*s,actual.z-start.z-expected.z*c+expected.x*s)<1e-6);}
 }
 for(let i=1;i<4;i++){const before=samplePlanarRoot(sequence.planarRoot,sequence.segments[i-1].end),after=samplePlanarRoot(sequence.planarRoot,sequence.segments[i].start);assert.ok(Math.abs(Math.hypot(after.x-before.x,after.z-before.z)-1.5)<1e-6);}
});
for(const rate of [40,60,144])test('time steps preserve all six transition events and total travel at '+rate+' Hz',()=>{
 const s=buildShadowSequence(records,steps);let x=0,z=0,events=[];
 for(let previous=0;previous<s.duration;){const time=Math.min(s.duration,previous+1/rate);events.push(...crossedShadowEvents(s,previous,time));const d=attackRootDelta(s.planarRoot,previous,time,s.duration,.3,1.8);x+=d.x;z+=d.z;previous=time;}
 const expected=attackRootDelta(s.planarRoot,0,s.duration,s.duration,.3,1.8);assert.deepEqual(events,s.events);assert.ok(Math.hypot(x-expected.x,z-expected.z)<1e-8);
});
test('invalid sequence records fail before gameplay',()=>{
 assert.throws(()=>buildShadowSequence(records,[]));assert.throws(()=>buildShadowSequence(records,steps,{gap:0}));assert.throws(()=>buildShadowSequence(records,[steps[0],{...steps[1],shadowTravel:-1}]));
 for(const change of [{duration:NaN},{combatDuration:0},{impactHands:['foot']},{impacts:[Infinity]},{nativeSourceMotion:false}]){const altered={...records,[steps[0].clip]:{...records[steps[0].clip],...change}};assert.throws(()=>buildShadowSequence(altered,steps));}
});
