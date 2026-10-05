import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const name of ['understory','fern','woody-scrub','forest-canopy']){
 test(`${name} embeds actual opacity data for photographed leaf cards`,()=>{
  const raw=fs.readFileSync(new URL(`../public/models/nature/${name}.glb`,import.meta.url)),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),start=28+size;
  const materials=doc.materials.filter(m=>m.alphaMode&&m.alphaMode!=='OPAQUE');assert.ok(materials.length);
  for(const material of materials){
   const image=doc.images[doc.textures[material.pbrMetallicRoughness.baseColorTexture.index].source];
   assert.equal(image.mimeType,'image/png',`${material.name}: JPEG discarded the source opacity`);
   const view=doc.bufferViews[image.bufferView],at=start+(view.byteOffset??0),png=raw.subarray(at,at+view.byteLength);
   assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
   assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1024);
   assert.equal(png[24],8);assert.equal(png[25],6,`${material.name}: missing RGBA channel`);
  }
 });
}
