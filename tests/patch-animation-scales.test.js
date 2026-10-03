import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {patchAnimationTransforms,patchAnimationRotations} from '../tools/patch-animation-rotations.mjs';
import {parseGlb} from '../tools/bake-native-golf.mjs';
const input=fs.readFileSync(new URL('../public/models/sora.glb',import.meta.url));
test('Constant scale keys preserve geometry and unrelated animation channels',()=>{
 const before=parseGlb(input),entry={clip:'Closer_Rising_Cut',times:[0,1],scales:{hand_l:[1,1,1,1,1,1]}},after=parseGlb(patchAnimationTransforms(input,[entry]));
 assert.deepEqual(after.bin.subarray(0,before.bin.length),before.bin);assert.deepEqual(after.doc.meshes,before.doc.meshes);
 for(const clip of before.doc.animations){
  const next=after.doc.animations.find(c=>c.name===clip.name);
  if(clip.name!==entry.clip){assert.deepEqual(next,clip);continue;}
  for(const [i,c]of clip.channels.entries()){
   if(before.doc.nodes[c.target.node].name!=='hand_l'||c.target.path!=='scale'){assert.deepEqual(next.channels[i],c);continue;}
   const accessor=after.doc.accessors[next.samplers[next.channels[i].sampler].output],view=after.doc.bufferViews[accessor.bufferView];
   assert.equal(accessor.count,2);assert.equal(accessor.type,'VEC3');
   entry.scales.hand_l.forEach((v,k)=>assert.equal(after.bin.readFloatLE(view.byteOffset+k*4),v));
  }
 }
 assert.throws(()=>patchAnimationRotations(input,[entry]),/patchAnimationTransforms/);
 for(const scales of [{missing:[1,1,1,1,1,1]},{hand_l:[1,1,1]},{hand_l:[0,1,1,1,1,1]},{hand_l:[NaN,1,1,1,1,1]}])assert.throws(()=>patchAnimationTransforms(input,[{...entry,scales}]));
});
