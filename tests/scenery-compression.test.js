import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {compressSceneryGLB} from '../tools/compress-scenery.mjs';
import {NATURE_ASSET_NAMES} from '../src/nature-assets.js';
const parse=bytes=>{const length=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+length).toString()),binary:bytes.subarray(28+length)};};

test('All scenery geometry and textures decode byte-for-byte with the shipped Three decoder',async t=>{
 await MeshoptDecoder.ready;let before=0,after=0,views=0;
 for(const name of NATURE_ASSET_NAMES){
  const original=await fs.readFile(new URL(`../public/models/nature/${name}.glb`,import.meta.url)),packed=await compressSceneryGLB(original),a=parse(original),b=parse(packed.bytes);
  assert.equal(packed.bytes.readUInt32LE(8),packed.bytes.length);
  assert.equal(b.json.bufferViews.length,a.json.bufferViews.length,name);
  for(const key of Object.keys(a.json))if(!['buffers','bufferViews','extensionsUsed','extensionsRequired'].includes(key))assert.deepEqual(b.json[key],a.json[key],`${name}: ${key}`);
  for(let i=0;i<a.json.bufferViews.length;i++){
   const old=a.json.bufferViews[i],v=b.json.bufferViews[i],ext=v.extensions?.EXT_meshopt_compression;
   const expected=a.binary.subarray(old.byteOffset||0,(old.byteOffset||0)+old.byteLength);
   let actual;
   if(ext){actual=new Uint8Array(v.byteLength);MeshoptDecoder.decodeGltfBuffer(actual,ext.count,ext.byteStride,b.binary.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength),ext.mode,ext.filter);views++;}
   else actual=b.binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
   assert.deepEqual(Buffer.from(actual),expected,`${name}: buffer ${i}`);
   assert.equal(v.byteStride,old.byteStride);assert.equal(v.target,old.target);assert.equal(v.byteLength,old.byteLength);
  }
  before+=gzipSync(original).length;after+=gzipSync(packed.bytes).length;
 }
 assert.ok(views>200);assert.ok(after<before*.86,`Compressed scenery ${after} should save at least 14% against gzip ${before}`);
 t.diagnostic(`${views} exact decoded buffers; ${(before-after).toLocaleString()} fewer download bytes`);
});
