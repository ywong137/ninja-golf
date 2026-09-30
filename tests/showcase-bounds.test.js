import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {WARRIORS} from '../src/warriors.js';

const records=JSON.parse(fs.readFileSync(new URL('../src/showcase-bounds.json',import.meta.url)));
for(const {model}of WARRIORS)test(`${model}: preview bounds match the released animation asset`,()=>{
 const record=records.heroes[model];
 assert.ok(record,'Bake the complete preview with tools/bake-showcase-bounds.mjs.');
 const sha=createHash('sha256').update(fs.readFileSync(new URL(`../public/models/${model}.glb`,import.meta.url))).digest('hex');
 assert.equal(record.modelSha256,sha,'Animation changed. Re-bake and visually verify its full preview envelope.');
 assert.ok(record.rate>=60&&record.samples>record.rate*5);
 assert.ok(record.hull.length>=8);
 for(const point of record.hull)for(let axis=0;axis<3;axis++){
  assert.ok(Number.isFinite(point[axis]));
  assert.ok(point[axis]>=record.min[axis]-1e-8&&point[axis]<=record.max[axis]+1e-8);
 }
});
