import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectNativeBladeHeadClearance} from '../tools/native-blade-head-clearance.mjs';
import {WARRIORS} from '../src/warriors.js';
const grips=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
for(const [modelKey,environment]of [['ayame','NINJA_HUSTLER_CANDIDATE'],['sora','NINJA_CLOSER_CANDIDATE']]){
 test(`${modelKey} keeps every native combat blade clear of the animated head`,async()=>{
  const hero=WARRIORS.find(w=>w.model===modelKey),candidate=process.env[environment];
  const clips=Object.keys(motions).filter(name=>name.startsWith(hero.motionPrefix)&&motions[name].nativeAttachment);
  assert.equal(clips.length,17,'Cover Ready, nine attacks, and seven guards.');
  const result=await inspectNativeBladeHeadClearance({model:candidate?candidate+'.glb':new URL(`../public/models/${modelKey}.glb`,import.meta.url),modelKey,weaponKind:hero.weaponKind,frames:grips[modelKey],record:new URL('../src/motion-data.json',import.meta.url),clips,rate:480});
  assert.equal(result.passed,true,JSON.stringify(Object.fromEntries(Object.entries(result.clips).filter(([,v])=>v.minimumClearance<.005))));
  for(const clip of Object.values(result.clips))assert.equal(clip.crossingSamples,0);
 });
}
