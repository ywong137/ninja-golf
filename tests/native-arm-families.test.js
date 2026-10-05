import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectNativeAceFamily} from '../tools/check-native-ace-family.mjs';
import {inspectNativeHustler} from '../tools/check-native-hustler.mjs';
import {inspectNativeCloser} from '../tools/check-native-closer.mjs';
import {attackDefinition} from '../src/combat.js';
import {withMotionTiming} from '../src/attack-timing.js';
import {WARRIORS} from '../src/warriors.js';

const record=new URL('../src/motion-data.json',import.meta.url);
const motions=JSON.parse(fs.readFileSync(record));
const source=fs.readFileSync(new URL('../src/motion.js',import.meta.url),'utf8')
 .replace("import motions from './motion-data.json';",'const motions='+JSON.stringify(motions)+';')
 .replace("import selectionMotions from './selection-data.json';",'const selectionMotions={};');
const {combatMotionName}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const [model,inspect]of [['kaede',inspectNativeAceFamily],['ayame',inspectNativeHustler],['sora',inspectNativeCloser]]){
 test(`${model}: native arm family keeps human hinges, fitted fingers, and cutting edges`,async()=>{
  const report=await inspect({model:new URL(`../public/models/${model}.glb`,import.meta.url),record,rate:120,includeReady:false});
  assert.ok(report.passed,JSON.stringify(report.violations));
  assert.ok(Object.values(report.clips).reduce((n,clip)=>n+clip.samples,0)>1500);
 });
 test(`${model}: all gameplay contacts match authored attack timing`,()=>{
  const hero=WARRIORS.find(h=>h.model===model);
  for(const kind of ['light','heavy','musou'])for(let step=0;step<(kind==='musou'?1:4);step++){
   const name=combatMotionName(hero,kind,step),spec=motions[name],attack=withMotionTiming(attackDefinition(kind,step,hero.combatStyle),spec);
   assert.ok(spec.nativeAttachment,`${name}: runtime must retain the authored wrist.`);
   assert.ok(Math.abs((spec.combatDuration??spec.duration)-attack.duration)<1e-7,`${name}: duration mismatch.`);
   assert.equal(spec.impacts.length,attack.hits.length);
   for(let i=0;i<attack.hits.length;i++)assert.ok(Math.abs(spec.impacts[i]/spec.duration*attack.duration-attack.hits[i])<1e-7,`${name}: damage timing mismatch.`);
  }
 });
}
