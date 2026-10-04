import {withoutMusouTarget} from './without-musou-target.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyRevision,packedStream,readModel,replaceStream,serializeModel} from '../tools/preserve-vice-president-head.mjs';
import {applyVicePresidentBrowWeights,restoreVicePresidentLegacyBrowWeights} from '../tools/author-vice-president-brow-weights.mjs';

const recipe=JSON.parse(fs.readFileSync(new URL('../assets/characters/vice-president-head-revision.json',import.meta.url)));
const publicBytes=fs.readFileSync(new URL('../public/models/monk.glb',import.meta.url));
test('The full-rebuild revision matches the currently published head',()=>{
 const model=readModel(publicBytes),head=model.doc.meshes[0].primitives[1];
 for(const name of ['POSITION','NORMAL'])assert.deepEqual(packedStream(model,head.attributes[name]),Buffer.from(recipe.streams[name].result,'base64'));
});
function baseline(){
 const model=withoutMusouTarget(readModel(publicBytes)),head=model.doc.meshes[0].primitives[1];
 if(model.doc.extras?.vicePresidentBrowWeights)restoreVicePresidentLegacyBrowWeights(model);
 for(const name of ['POSITION','NORMAL'])replaceStream(model,head.attributes[name],Buffer.from(recipe.streams[name].source,'base64'));
 delete model.doc.extras.vicePresidentShapeFit;return model;
}

test('A native head rebuild retains the reviewed geometry and newer animation payloads',()=>{
 const model=baseline(),head=model.doc.meshes[0].primitives[1];
 // A later animation revision must survive the saved geometry correction.
 const animation=model.doc.animations[0];animation.name='Newer authored clip';
 const id=animation.samplers[0].output,bytes=packedStream(model,id);bytes.writeFloatLE(bytes.readFloatLE(0)+.0001,0);replaceStream(model,id,bytes);
 const before=Buffer.from(model.bin),nodes=structuredClone(model.doc.nodes),skins=structuredClone(model.doc.skins),clips=structuredClone(model.doc.animations);
 applyRevision(model,recipe);
 assert.deepEqual(model.doc.nodes,nodes);assert.deepEqual(model.doc.skins,skins);assert.deepEqual(model.doc.animations,clips);
 const allowed=new Set();
 for(const name of ['POSITION','NORMAL']){
  const a=model.doc.accessors[head.attributes[name]],v=model.doc.bufferViews[a.bufferView];
  const start=(a.byteOffset??0)+(v.byteOffset??0),stride=v.byteStride??12;
  for(let i=0;i<a.count;i++)for(let j=0;j<12;j++)allowed.add(start+i*stride+j);
  assert.deepEqual(packedStream(model,head.attributes[name]),Buffer.from(recipe.streams[name].result,'base64'));
 }
 for(let i=0;i<before.length;i++)if(before[i]!==model.bin[i])assert.ok(allowed.has(i),`Unexpected non-head byte change at ${i}`);
 assert.deepEqual(packedStream(readModel(serializeModel(model)),id),bytes);
});

test('The full rebuild restores measured geometry before the reviewed brow weights',()=>{
 const model=baseline();
 assert.throws(()=>applyVicePresidentBrowWeights(model),/POSITION/,'Brow weights require the measured head first');
 applyRevision(model,recipe);applyVicePresidentBrowWeights(model);
 const released=readModel(publicBytes),head=model.doc.meshes[0].primitives[1],releasedHead=released.doc.meshes[0].primitives[1];
 for(const name of Object.keys(head.attributes))assert.deepEqual(packedStream(model,head.attributes[name]),packedStream(released,releasedHead.attributes[name]),name);
});

test('A changed sculpt, changed skin, or duplicate application fails before mutation',()=>{
 for(const kind of ['sculpt','skin','already-applied']){
  const model=kind==='already-applied'?readModel(publicBytes):baseline(),head=model.doc.meshes[0].primitives[1];
  if(kind!=='already-applied'){
   const id=head.attributes[kind==='skin'?'WEIGHTS_0':'POSITION'],bytes=packedStream(model,id);bytes[0]^=1;replaceStream(model,id,bytes);
  }
  const before=Buffer.from(model.bin);assert.throws(()=>applyRevision(model,recipe));assert.deepEqual(model.bin,before);
 }
});
