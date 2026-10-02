import test from 'node:test';
import assert from 'node:assert/strict';
import {withMotionTiming} from '../src/attack-timing.js';
import {extendMotionPhases,retimeMotionRecord,retimeAnimation} from '../tools/retime-motion.mjs';
import {parseGlb} from '../tools/bake-native-golf.mjs';
import fs from 'node:fs';

const phases=[{start:0,end:.16,extra:.12},{start:.52,end:.76,extra:.14}];
test('Phase extensions preserve strike speed and continuous, forward time',()=>{
 const map=extendMotionPhases(.76,phases),epsilon=1e-6;
 assert.equal(map(0),0);assert.equal(map(.76),1.02);assert.equal(map(.36),.48);
 for(const t of [.16,.52])assert.ok(Math.abs((map(t+epsilon)-map(t-epsilon))/(2*epsilon)-1)<.0001);
 for(let i=1;i<=760;i++)assert.ok(map(i/1000)>map((i-1)/1000));
 assert.ok(Math.abs(map(.44)-map(.24)-.2)<1e-10,'The actual cut must retain its speed.');
 assert.throws(()=>extendMotionPhases(.76,[{start:.3,end:.2,extra:.1}]));
 assert.throws(()=>extendMotionPhases(.76,[{start:0,end:.2,extra:-.1}]));
 assert.throws(()=>map(1));
});
test('Retiming keeps damage, planted feet, toe pivots, and combo branches on their original poses',()=>{
 const source={duration:.76,nativeSampleRate:480,impacts:[.36],poses:[{t:0,grip:[1,2,3]},{t:.36/.76,grip:[4,5,6]},{t:1,grip:[7,8,9]}],footPlants:{l:[[0,.76]],r:[[0,.16],[.3,.595]]},toePlants:{r:[[.595,.7]]},continuations:{light:{at:.52,clip:'next'}},shoulderSkinWindow:[.4,.46,.58,.66]};
 const before=structuredClone(source),map=extendMotionPhases(.76,phases),result=retimeMotionRecord(source,map);
 assert.deepEqual(source,before);assert.deepEqual(result.poses.map(p=>p.grip),source.poses.map(p=>p.grip));
 assert.equal(result.poses[1].t*result.duration,result.impacts[0]);assert.equal(result.footPlants.r[0][1],map(.16));
 assert.equal(result.toePlants.r[0][0],result.footPlants.r[1][1]);assert.equal(result.continuations.light.at,map(.52));
 assert.deepEqual(result.shoulderSkinWindow,source.shoulderSkinWindow.map(map));assert.equal(result.nativeSampleRate,undefined);
});
test('Explicit motion timing preserves attack behavior and does not mutate shared definitions',()=>{
 const definition={duration:.76,hits:[.36],damage:90,reach:7},motion={duration:1.02,combatDuration:.9,impacts:[.48]};
 const actual=withMotionTiming(definition,motion);assert.equal(actual.duration,.9);assert.equal(actual.hits[0],.48/1.02*.9);
 assert.equal(actual.damage,90);assert.equal(actual.reach,7);assert.equal(definition.duration,.76);assert.deepEqual(definition.hits,[.36]);
 assert.equal(withMotionTiming(definition,{duration:1}),definition);
 assert.throws(()=>withMotionTiming(definition,{...motion,impacts:[2]}));
 assert.throws(()=>withMotionTiming(definition,{...motion,combatDuration:NaN}));
});
test('Retiming retains gameplay speed ratios and root travel on the body clock',()=>{
 const map=extendMotionPhases(.76,phases),source={duration:.76,combatDuration:.38,poses:[{t:0},{t:1}],impacts:[.36],planarRoot:{duration:.76,rows:[{time:0,x:0,z:0},{time:.36,x:0,z:.2},{time:.76,x:0,z:.3}]}};
 const result=retimeMotionRecord(source,map);assert.equal(result.combatDuration,.51);
 assert.deepEqual(result.planarRoot.rows.map(p=>p.z),[0,.2,.3]);assert.equal(result.planarRoot.rows[1].time,result.impacts[0]);assert.equal(result.planarRoot.duration,result.duration);
 assert.equal(retimeMotionRecord(source,map,{combatDuration:1.1}).combatDuration,1.1);
 assert.throws(()=>retimeMotionRecord({...source,planarRoot:{...source.planarRoot,duration:2}},map));
});
test('GLB retiming preserves every pose value, mesh byte, and unrelated animation',()=>{
 const raw=fs.readFileSync(new URL('../public/models/ronin.glb',import.meta.url)),before=parseGlb(raw),map=extendMotionPhases(.76,phases);
 const after=parseGlb(retimeAnimation(raw,'Ronin_Heavy_Cleave',map));
 assert.deepEqual(after.bin.subarray(0,before.bin.length),before.bin);
 assert.deepEqual(after.doc.meshes,before.doc.meshes);assert.deepEqual(after.doc.nodes,before.doc.nodes);
 for(let i=0;i<before.doc.animations.length;i++){
  const a=before.doc.animations[i],b=after.doc.animations[i];
  if(a.name!=='Ronin_Heavy_Cleave'){assert.deepEqual(b,a);continue;}
  assert.deepEqual(b.channels,a.channels);
  for(let s=0;s<a.samplers.length;s++){
   assert.equal(b.samplers[s].output,a.samplers[s].output);assert.equal(b.samplers[s].interpolation,a.samplers[s].interpolation);
   const values=(doc,bin,index)=>{const accessor=doc.accessors[index],view=doc.bufferViews[accessor.bufferView];return Array.from({length:accessor.count},(_,i)=>bin.readFloatLE((view.byteOffset??0)+(accessor.byteOffset??0)+i*4));};
   const source=values(before.doc,before.bin,a.samplers[s].input),result=values(after.doc,after.bin,b.samplers[s].input);
   assert.deepEqual(result,source.map(t=>Math.fround(map(t))));
  }
 }
});
