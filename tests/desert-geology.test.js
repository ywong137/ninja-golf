import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {natureModelFilesForTheme} from '../src/nature-assets.js';

test('Desert boulders retain two independent forms and shared scanned textures',()=>{
 const bytes=fs.readFileSync(new URL('../public/models/nature/desert-boulders.glb',import.meta.url)),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 assert.equal(json.materials.length,1);assert.equal(json.images.length,3);assert.equal(json.nodes.length,4);
 for(const form of [0,1])for(const lod of [0,1]){
  const node=json.nodes.find(n=>n.name===`LOD${lod}_desert_boulder_${form}`);assert.equal(node?.extras?.rockForm,form);
  const primitives=json.meshes[node.mesh].primitives;assert.equal(primitives.length,1);
  const p=primitives[0],position=json.accessors[p.attributes.POSITION],triangles=json.accessors[p.indices].count/3;
  assert.equal(p.material,0);assert.ok(p.attributes.NORMAL!==undefined&&p.attributes.TEXCOORD_0!==undefined);
  assert.ok([...position.min,...position.max].every(Number.isFinite));assert.ok(Math.abs(position.max[1]-position.min[1]-3)<.04);
  assert.ok(lod===0?triangles>10000&&triangles<=25000:triangles>2500&&triangles<=3200);
 }
 assert.ok(natureModelFilesForTheme('desert').includes('desert-boulders'));
 for(const theme of ['japanese','highlands','cyberpunk'])assert.ok(!natureModelFilesForTheme(theme).includes('desert-boulders'));
});
