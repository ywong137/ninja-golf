import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildMusouSequence,combatSequenceFrame,samplePerformanceClock} from '../src/musou-sequence.js';
import {WARRIORS} from '../src/warriors.js';
import {MUSOU_WIPES} from '../src/musou-cinematic.js';
import {MUSOU_CINEMATIC_DURATION} from '../src/combat.js';
const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
for(const hero of WARRIORS.filter(w=>w.musouChain))test(hero.name+' ultimate preserves captured strikes and a shared root/contact clock',()=>{
 const s=buildMusouSequence(motions,hero.musouChain);
 assert.ok(s.duration>=7&&s.duration<11);assert.ok(s.hits.length>=7);
 for(const [i,part]of s.segments.entries()){
  const record=motions[part.clip];assert.ok(record.nativeSourceMotion&&record.nativeAttachment);
  for(const fraction of [0,.2,.5,.999]){
   const a=combatSequenceFrame({sequence:s,time:part.start+part.duration*fraction,token:42});
   assert.equal(a.index,i);assert.equal(a.action.motionName,part.clip);assert.equal(a.hidden,false);
   const source=samplePerformanceClock(part.clock,part.duration*fraction);
   assert.ok(Math.abs(a.action.time/record.combatDuration*record.duration-source)<1e-8);assert.ok(a.action.syncMotion);
  }
 }
 for(const part of s.segments)for(const hit of part.motion.impacts){
  const time=part.start+samplePerformanceClock(part.clock,hit,true),frame=combatSequenceFrame({sequence:s,time,token:42});
  assert.ok(Math.abs(frame.action.time/frame.action.duration*part.motion.duration-hit)<1e-7,'A damage contact must sample its original captured strike');
 }
 for(const hz of [40,60,144]){
  const fired=[];let index=0;
  for(let time=0;time<=s.duration+1/hz;time+=1/hz)while(index<s.hits.length&&time>=s.hits[index])fired.push(index++);
  assert.equal(new Set(fired).size,s.hits.length);
 }
 assert.equal(s.planarRoot.duration,s.duration);assert.equal(s.planarRoot.rows.at(-1).time,s.duration);
});
test('Musou never silently falls back to procedural cuts',()=>{
 assert.throws(()=>buildMusouSequence(motions,['Ethan_Naginata_Musou_Flow','Ethan_Naginata_Power_Cut']),/fitted captured/);
});
test('Wipe beats have readable doubled durations and fit inside the intro',()=>{
 assert.equal(MUSOU_WIPES.length,2);assert.equal(MUSOU_WIPES[0].time,0);
 assert.ok(MUSOU_WIPES[0].duration>=1.32&&MUSOU_WIPES[1].duration>=1.14);
 assert.ok(MUSOU_WIPES[1].time>=1);assert.ok(MUSOU_WIPES[1].time+MUSOU_WIPES[1].duration<MUSOU_CINEMATIC_DURATION);
});

test('Repeated musou impacts reuse compiled rings and bounded flash storage',async()=>{
 const {Effects}=await import('../src/effects.js'),T=await import('three');
 const effects=new Effects(new T.Scene()),origin=new T.Vector3();
 effects.flourish(origin,0,'naginata');
 const first=effects.items.map(item=>item.m);effects.clear();
 effects.flourish(origin,1,'naginata');
 assert.deepEqual(effects.items.map(item=>item.m),first);
 const itemCount=effects.items.length;
 for(let i=0;i<150;i++)effects.explosion(origin,1);
 assert.equal(effects.items.length,itemCount);assert.equal(effects.contacts.records.length,96);
 effects.clear();assert.equal(effects.items.length,0);assert.ok(effects.contacts.records.every(r=>r.life===0));
});
