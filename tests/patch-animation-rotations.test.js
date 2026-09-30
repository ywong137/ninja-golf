import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {patchAnimationRotations,patchAnimationTransforms} from '../tools/patch-animation-rotations.mjs';
import {parseGlb} from '../tools/bake-native-golf.mjs';
const input=fs.readFileSync(new URL('../public/models/ronin.glb',import.meta.url));
const entry={clip:'Ronin_Ready',times:[0,2],rotations:{foot_r:[0,0,0,1,0,0,0,1]},extras:{testPatch:true}};
test('Rotation replacement preserves binary payloads, geometry, other animations, and other channels',()=>{
 const original=parseGlb(input),patched=parseGlb(patchAnimationRotations(input,[entry]));
 assert.deepEqual(patched.bin.subarray(0,original.bin.length),original.bin);
 for(const key of Object.keys(original.doc).filter(k=>!['animations','accessors','bufferViews','buffers'].includes(k)))assert.deepEqual(patched.doc[key],original.doc[key]);
 for(const key of ['accessors','bufferViews'])assert.deepEqual(patched.doc[key].slice(0,original.doc[key].length),original.doc[key]);
 for(const clip of original.doc.animations){const next=patched.doc.animations.find(c=>c.name===clip.name);if(clip.name!==entry.clip){assert.deepEqual(next,clip);continue;}
  assert.deepEqual(next.samplers.slice(0,clip.samplers.length),clip.samplers);
  for(const [i,channel]of clip.channels.entries()){
   if(original.doc.nodes[channel.target.node].name==='foot_r'&&channel.target.path==='rotation')assert.equal(next.channels[i].sampler,clip.samplers.length);
   else assert.deepEqual(next.channels[i],channel);
  }
 }
});
test('Translation replacement appends VEC3 samples and preserves all other channels',()=>{
 const translations={pelvis:[0,0,0,.1,0,-.05]},original=parseGlb(input),patched=parseGlb(patchAnimationTransforms(input,[{clip:entry.clip,times:entry.times,translations}]));
 assert.deepEqual(patched.bin.subarray(0,original.bin.length),original.bin);
 for(const clip of original.doc.animations){
  const next=patched.doc.animations.find(c=>c.name===clip.name);
  if(clip.name!==entry.clip){assert.deepEqual(next,clip);continue;}
  for(const [i,c]of clip.channels.entries()){
   if(original.doc.nodes[c.target.node].name!=='pelvis'||c.target.path!=='translation'){assert.deepEqual(next.channels[i],c);continue;}
   const accessor=patched.doc.accessors[next.samplers[next.channels[i].sampler].output],view=patched.doc.bufferViews[accessor.bufferView];assert.equal(accessor.type,'VEC3');assert.equal(accessor.count,2);
   translations.pelvis.forEach((value,j)=>assert.equal(patched.bin.readFloatLE(view.byteOffset+j*4),Math.fround(value)));
  }
 }
 assert.throws(()=>patchAnimationRotations(input,[{...entry,translations}]),/patchAnimationTransforms/);
 for(const translations of [{missing:[0,0,0,0,0,0]},{pelvis:[0,0,0]},{pelvis:[0,NaN,0,0,0,0]}])assert.throws(()=>patchAnimationTransforms(input,[{...entry,translations}]));
});
test('Rotation writer rejects missing channels, repeated clips, invalid keys, and invalid rotations',()=>{
 for(const change of [{clip:'absent'},{times:[0,0]},{times:[0,2,2+1e-9]},{times:[0,NaN]},{rotations:{missing:entry.rotations.foot_r}},{rotations:{foot_r:[0,0,0,1]}},{rotations:{foot_r:[0,0,0,2,0,0,0,1]}}])assert.throws(()=>patchAnimationRotations(input,[{...entry,...change}]));
 assert.throws(()=>patchAnimationRotations(input,[entry,entry]));
});
