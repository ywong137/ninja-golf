import {withoutMusouTarget} from './without-musou-target.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseGlb} from '../tools/bake-native-golf.mjs';
const reports=JSON.parse(fs.readFileSync(new URL('../docs/reviews/selected-wardrobe-preservation.json',import.meta.url)));
const hash=x=>createHash('sha256').update(x).digest('hex');
for(const [model,saved]of Object.entries(reports))test(`${model}: selected outfit preserves the face, rig and motion data`,()=>{
 const raw=fs.readFileSync(new URL('../public/models/'+model+'.glb',import.meta.url)),{doc,bin}=parseGlb(raw);
 assert.equal(hash(raw),saved.facialRevision?.outputSha256??saved.motionAppend?.outputSha256??saved.garmentRevision?.outputSha256??saved.motionExtension?.outputSha256??saved.outputSha256);assert.equal(hash(bin.subarray(0,saved.originalTargetBinaryBytes)),saved.originalTargetBinarySha256);
 if(saved.facialRevision){const f=saved.facialRevision;assert.equal(hash(bin.subarray(0,f.baseBinaryBytes)),f.baseBinarySha256,'Every original binary byte must remain unchanged');assert.equal(f.sourceSha256,saved.motionAppend?.outputSha256??saved.garmentRevision?.outputSha256??saved.motionExtension?.outputSha256??saved.outputSha256);withoutMusouTarget({doc});}
 for(const key of ['animations','nodes','skins'])assert.equal(hash(JSON.stringify(key==='animations'?doc.animations.slice(0,saved.preservedAnimations):doc[key])),saved.originalRigHashes[key],key);
 if(saved.motionExtension){
  const ext=saved.motionExtension;assert.equal(hash(bin.subarray(0,ext.baseBinaryBytes)),ext.baseBinarySha256);const meshes=structuredClone(doc.meshes);
  if(saved.garmentRevision){const revision=saved.garmentRevision;assert.equal(hash(bin.subarray(0,saved.motionAppend?.baseBinaryBytes??saved.facialRevision?.baseBinaryBytes??bin.length)),revision.binarySha256);assert.equal(hash(JSON.stringify(meshes)),revision.finalMeshesSha256);meshes[0].primitives.splice(revision.removedPrimitive,0,revision.removedPrimitiveDefinition);}
  assert.equal(hash(JSON.stringify(meshes)),ext.baseMeshesSha256);
  assert.deepEqual(doc.animations.slice(saved.preservedAnimations).map(a=>a.name),ext.addedClips);
 }else assert.equal(doc.animations.length,saved.preservedAnimations);
 for(let i=0;i<saved.originalFacePrimitives.length;i++)assert.deepEqual(doc.meshes[0].primitives[i+1],saved.originalFacePrimitives[i],'Preserve original face and hair streams.');
 assert.ok(doc.meshes[0].primitives.length<=8,'Keep the wardrobe within eight skinned draw groups.');
 assert.ok(saved.addedTriangles<10000,'Keep new cloth below ten thousand triangles.');
 assert.ok(doc.extras.wardrobeDefault.newGarmentParts.length>=3);
 if(saved.motionAppend){
  const ext=saved.motionAppend;
  assert.equal(ext.baseSha256,saved.garmentRevision.outputSha256);
  assert.equal(hash(JSON.stringify(doc.animations.slice(0,ext.baseAnimations))),ext.baseAnimationsSha256);
  assert.deepEqual(doc.animations.slice(ext.baseAnimations).map(a=>a.name),ext.addedClips);
 }
 const joints=doc.skins[0].joints.length;
 for(const p of doc.meshes[0].primitives){
  const wa=doc.accessors[p.attributes.WEIGHTS_0],ja=doc.accessors[p.attributes.JOINTS_0],wv=doc.bufferViews[wa.bufferView],jv=doc.bufferViews[ja.bufferView],js=ja.componentType===5121?1:2,jr=js===1?'readUInt8':'readUInt16LE';
  for(let i=0;i<wa.count;i++){let total=0;for(let k=0;k<4;k++){const w=bin.readFloatLE((wv.byteOffset||0)+(wa.byteOffset||0)+i*(wv.byteStride||16)+k*4),j=bin[jr]((jv.byteOffset||0)+(ja.byteOffset||0)+i*(jv.byteStride||js*4)+k*js);assert.ok(Number.isFinite(w)&&w>=0&&j<joints);total+=w;}assert.ok(Math.abs(total-1)<.001,'Normalize garment skin weights.');}
 }
});
