import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {WARRIORS} from '../src/warriors.js';
for(const [model,sourceName,readyName]of [['kaede','Ace_Cut_Diagonal','Ace_Ready'],['ronin','Ronin_Power_Cut','Ronin_Ready'],['monk','Ethan_GDH_Combo5_Review','Ethan_Naginata_Ready']])test(model+': ready retains every channel of the captured full-body stance',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+model+'.glb',import.meta.url));
 const source=g.animations.find(c=>c.name===sourceName),ready=g.animations.find(c=>c.name===readyName);
 const byName=new Map(ready.tracks.map(t=>[t.name,t]));
 for(const track of source.tracks){const actual=byName.get(track.name);assert.ok(actual,'Missing ready channel '+track.name);const expected=Array.from(track.createInterpolant().evaluate(0));for(const time of [0,.5,1.9])assert.deepEqual(Array.from(actual.createInterpolant().evaluate(time)),expected);}
 const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));assert.ok(motions[readyName].nativeAttachment);for(const key of ['weaponGripRoll','primaryGrip','gripSpacing','slidingGrip'])assert.equal(motions[readyName][key],motions[sourceName][key]);
});
test('Shinobi normal heavy attacks preserve a complete captured leap without teleports',()=>{
 const w=WARRIORS[1],m=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
 assert.equal(w.heavySequence,undefined);
 for(const suffix of ['Cleave','Rising','Sweep','Slam']){const name=w.motionOverrides['Twin_Heavy_'+suffix];assert.match(name,/Airborne_Cut$/);assert.ok(m[name].nativeSourceMotion);assert.ok(m[name].duration>2.4);assert.ok(m[name].combatDuration>1.5);}
 assert.match(w.motionOverrides.Twin_Cut_Diagonal,/Stepping_Cut$/);
});
