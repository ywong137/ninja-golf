#!/usr/bin/env node
// Carry the exact reviewed head through full native character rebuilds.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export function readModel(raw){
 if(raw.readUInt32LE(0)!==0x46546c67||raw.readUInt32LE(4)!==2)throw Error('Expected a GLB 2 model.');
 const n=raw.readUInt32LE(12);
 return {doc:JSON.parse(raw.subarray(20,20+n)),bin:Buffer.from(raw.subarray(28+n))};
}
function headPrimitive(doc){
 const primitives=doc.meshes.flatMap(m=>m.primitives).filter(p=>doc.materials[p.material]?.name==='m009_head');
 if(primitives.length!==1)throw Error('Expected one m009_head primitive.');
 return primitives[0];
}
function layout(doc,id){
 const a=doc.accessors[id],v=doc.bufferViews[a.bufferView];
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
 const size=components*({5121:1,5123:2,5125:4,5126:4}[a.componentType]);
 if(!size||a.sparse||v.buffer!==0)throw Error('Unsupported native accessor.');
 return {a,start:(a.byteOffset??0)+(v.byteOffset??0),stride:v.byteStride??size,size};
}
export function packedStream(model,id){
 const {a,start,stride,size}=layout(model.doc,id);
 return Buffer.concat(Array.from({length:a.count},(_,i)=>model.bin.subarray(start+i*stride,start+i*stride+size)));
}
export function replaceStream(model,id,bytes){
 const {a,start,stride,size}=layout(model.doc,id);
 if(bytes.length!==a.count*size)throw Error('Head revision has an invalid stream length.');
 for(let i=0;i<a.count;i++)bytes.copy(model.bin,start+i*stride,i*size,(i+1)*size);
}
function structuralHashes(model,p){
 return Object.fromEntries([['indices',p.indices],...Object.entries(p.attributes).filter(([n])=>!['POSITION','NORMAL'].includes(n))].sort(([a],[b])=>a.localeCompare(b)).map(([n,id])=>[n,hash(packedStream(model,id))]));
}
export function recordRevision(before,after){
 const bp=headPrimitive(before.doc),ap=headPrimitive(after.doc);
 const structural=structuralHashes(before,bp);
 if(JSON.stringify(structural)!==JSON.stringify(structuralHashes(after,ap)))throw Error('The head topology, UVs or skin streams changed.');
 const streams={};
 for(const name of ['POSITION','NORMAL']){
  const a=before.doc.accessors[bp.attributes[name]],b=after.doc.accessors[ap.attributes[name]];
  if(a.count!==1713||a.count!==b.count||a.type!=='VEC3'||b.type!=='VEC3'||a.componentType!==5126||b.componentType!==5126)throw Error('Expected the native 1713-vertex head.');
  const source=packedStream(before,bp.attributes[name]),result=packedStream(after,ap.attributes[name]);
  streams[name]={sourceSha256:hash(source),resultSha256:hash(result),source:source.toString('base64'),result:result.toString('base64'),min:b.min,max:b.max};
 }
 if(!after.doc.extras?.vicePresidentShapeFit)throw Error('The candidate has no measured shape-fit provenance.');
 return {schemaVersion:1,material:'m009_head',vertexCount:1713,structuralHashes:structural,streams,shapeFit:after.doc.extras.vicePresidentShapeFit};
}
export function applyRevision(model,recipe){
 if(recipe.schemaVersion!==1||recipe.material!=='m009_head'||recipe.vertexCount!==1713)throw Error('Unsupported measured head revision.');
 const p=headPrimitive(model.doc);
 if(JSON.stringify(structuralHashes(model,p))!==JSON.stringify(recipe.structuralHashes))throw Error('Head topology, UVs or skin streams differ from the reviewed source.');
 for(const name of ['POSITION','NORMAL']){
  const r=recipe.streams[name],current=packedStream(model,p.attributes[name]),source=Buffer.from(r.source,'base64'),result=Buffer.from(r.result,'base64');
  if(hash(source)!==r.sourceSha256||hash(result)!==r.resultSha256)throw Error(`Corrupt ${name} revision payload.`);
  if(hash(current)!==r.sourceSha256)throw Error(`${name} differs from the reviewed base sculpt. Do not apply the correction twice or overwrite another sculpt.`);
  if(result.length!==current.length)throw Error(`Invalid ${name} result length.`);
 }
 // Validate both streams before changing either. The remaining binary bytes,
 // including every animation, stay exactly as the current export wrote them.
 for(const name of ['POSITION','NORMAL']){
  const r=recipe.streams[name];replaceStream(model,p.attributes[name],Buffer.from(r.result,'base64'));
  const a=model.doc.accessors[p.attributes[name]];
  if(r.min)a.min=r.min;if(r.max)a.max=r.max;
 }
 model.doc.extras??={};model.doc.extras.vicePresidentShapeFit=structuredClone(recipe.shapeFit);
 return model;
}
export function serializeModel({doc,bin}){
 const source=Buffer.from(JSON.stringify(doc)),header=Buffer.concat([source,Buffer.alloc((-source.length)&3,32)]);
 const data=Buffer.concat([bin,Buffer.alloc((-bin.length)&3)]),prefix=Buffer.alloc(20),middle=Buffer.alloc(8);
 prefix.writeUInt32LE(0x46546c67,0);prefix.writeUInt32LE(2,4);prefix.writeUInt32LE(28+header.length+data.length,8);prefix.writeUInt32LE(header.length,12);prefix.writeUInt32LE(0x4e4f534a,16);
 middle.writeUInt32LE(data.length,0);middle.writeUInt32LE(0x004e4942,4);
 return Buffer.concat([prefix,header,middle,data]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values:v}=parseArgs({options:{before:{type:'string'},after:{type:'string'},input:{type:'string'},output:{type:'string'},recipe:{type:'string'},help:{type:'boolean'}}});
 if(v.help){console.log('Record: node tools/preserve-vice-president-head.mjs --before BASE.glb --after REVIEWED.glb --output REVISION.json\nApply: node tools/preserve-vice-president-head.mjs --input REBUILT.glb --recipe REVISION.json --output CANDIDATE.glb\nThe reviewed base head must match exactly. Animation changes are preserved. Output must be a separate file.');process.exit(0);}
 if(!v.output)throw Error('Supply --output. See --help.');
 if([v.before,v.after,v.input,v.recipe].filter(Boolean).some(p=>path.resolve(p)===path.resolve(v.output)))throw Error('Output must be a separate file.');
 let output;
 if(v.before&&v.after&&!v.input&&!v.recipe)output=JSON.stringify(recordRevision(readModel(fs.readFileSync(v.before)),readModel(fs.readFileSync(v.after))),null,2)+'\n';
 else if(v.input&&v.recipe&&!v.before&&!v.after)output=serializeModel(applyRevision(readModel(fs.readFileSync(v.input)),JSON.parse(fs.readFileSync(v.recipe))));
 else throw Error('Choose exactly one record or apply operation. See --help.');
 fs.writeFileSync(v.output,output);console.log(`Saved ${v.output}`);
}
