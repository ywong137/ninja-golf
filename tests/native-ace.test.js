import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectNativeAce} from '../tools/check-native-ace.mjs';
import {attackDefinition} from '../src/combat.js';
import {WARRIORS} from '../src/warriors.js';

const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const ace=WARRIORS.find(hero=>hero.model==='kaede');

for(const [kind,canonical]of [['light','Fan_Cut_Diagonal'],['heavy','Fan_Heavy_Cleave']]){
 const clip=ace.motionOverrides[canonical];
 test(`${clip}: controller contact matches the native stroke, with neutral wrists and full-body support`,async t=>{
  const definition=attackDefinition(kind,0,ace.combatStyle);
  assert.equal(definition.duration,motions[clip].duration,'Gameplay must not rescale the native stroke.');
  assert.deepEqual(definition.hits,motions[clip].impacts,'Damage must coincide with the blade contact.');
  const report=await inspectNativeAce({clip});
  assert.ok(report.samples>1200,'Check Ready and intermediate native frames.');
  assert.ok(report.skin.samples>500,'Check both deformed arms through the complete stroke.');
  t.diagnostic(JSON.stringify(report));
 });
}
