import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseGlb} from '../tools/bake-native-golf.mjs';
const reports=JSON.parse(fs.readFileSync(new URL('../docs/reviews/selected-wardrobe-preservation.json',import.meta.url)));
const hash=x=>createHash('sha256').update(x).digest('hex');
for(const [model,saved]of Object.entries(reports))test(`${model}: selected outfit preserves the face, rig and motion data`,()=>{
 const raw=fs.readFileSync(new URL('../public/models/'+model+'.glb',import.meta.url)),{doc,bin}=parseGlb(raw);
 assert.equal(hash(raw),saved.outputSha256);assert.equal(hash(bin.subarray(0,saved.originalTargetBinaryBytes)),saved.originalTargetBinarySha256);
 for(const key of ['animations','nodes','skins'])assert.equal(hash(JSON.stringify(doc[key])),saved.originalRigHashes[key],key);
 for(let i=0;i<saved.originalFacePrimitives.length;i++)assert.deepEqual(doc.meshes[0].primitives[i+1],saved.originalFacePrimitives[i],'Preserve original face and hair streams.');
 assert.ok(doc.meshes[0].primitives.length<=8,'Keep the wardrobe within eight skinned draw groups.');
 assert.ok(saved.addedTriangles<10000,'Keep new cloth below ten thousand triangles.');
 assert.ok(doc.extras.wardrobeDefault.newGarmentParts.length>=3);
 const joints=doc.skins[0].joints.length;
 for(const p of doc.meshes[0].primitives){
  const wa=doc.accessors[p.attributes.WEIGHTS_0],ja=doc.accessors[p.attributes.JOINTS_0],wv=doc.bufferViews[wa.bufferView],jv=doc.bufferViews[ja.bufferView],js=ja.componentType===5121?1:2,jr=js===1?'readUInt8':'readUInt16LE';
  for(let i=0;i<wa.count;i++){let total=0;for(let k=0;k<4;k++){const w=bin.readFloatLE((wv.byteOffset||0)+(wa.byteOffset||0)+i*(wv.byteStride||16)+k*4),j=bin[jr]((jv.byteOffset||0)+(ja.byteOffset||0)+i*(jv.byteStride||js*4)+k*js);assert.ok(Number.isFinite(w)&&w>=0&&j<joints);total+=w;}assert.ok(Math.abs(total-1)<.001,'Normalize garment skin weights.');}
 }
});
