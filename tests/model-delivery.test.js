import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {gzipSync,gunzipSync} from 'node:zlib';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {loadModel,decodeModelBytes} from '../src/load-model.js';
import {writeCompressedModels} from '../tools/compressed-models.mjs';
import {WARRIOR_ASSET_NAMES} from '../src/warrior-assets.js';

const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scenes:[{}]}).padEnd(68,' '));
const model=Buffer.alloc(20+json.length);model.write('glTF');model.writeUInt32LE(2,4);model.writeUInt32LE(model.length,8);model.writeUInt32LE(json.length,12);model.write('JSON',16);json.copy(model,20);
const array=buffer=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
const compressed=gzipSync(model),fakeLoader=()=>({raw:[],parsed:[],loadAsync(url){this.raw.push(url);return Promise.resolve({raw:url});},parseAsync(buffer,base){this.parsed.push({buffer,base});return Promise.resolve({parsed:true});}});

test('Lossless decoding preserves GLB bytes and accepts HTTP-decoded bodies',async()=>{
 for(const bytes of [model,compressed])assert.deepEqual(Buffer.from(await decodeModelBytes(array(bytes))),model);
 await assert.rejects(decodeModelBytes(array(Buffer.from('<html>Not a model</html>'))),/Expected a gzip-compressed GLB/);
 await assert.rejects(decodeModelBytes(array(gzipSync(Buffer.from('invalid model')))),/does not contain a GLB/);
 await assert.rejects(decodeModelBytes(array(compressed.subarray(0,compressed.length-4))));
});

test('Production loader handles static gzip and HTTP encoding without double decoding',async t=>{
 const requests=[];
 const server=createServer((req,res)=>{
  requests.push(req.url);
  if(req.url.startsWith('/missing/')){res.writeHead(404);res.end('missing');return;}
  if(req.url.startsWith('/bad/')){res.end('not gzip');return;}
  if(req.url.startsWith('/http/')){res.setHeader('Content-Encoding','gzip');res.end(compressed);return;}
  if(req.url.startsWith('/nested/')){res.setHeader('Content-Encoding','gzip');res.end(gzipSync(compressed));return;}
  res.end(compressed);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const origin=`http://127.0.0.1:${server.address().port}`;
 for(const prefix of ['static','http','nested']){
  const loader=fakeLoader();await loadModel(loader,`${origin}/${prefix}/hero.glb?v=sample#fragment`,{compressed:true});
  assert.deepEqual(loader.raw,[]);assert.equal(loader.parsed.length,1);assert.deepEqual(Buffer.from(loader.parsed[0].buffer),model);assert.equal(loader.parsed[0].base,`${origin}/${prefix}/`);
  assert.equal(requests.at(-1),`/${prefix}/hero.glb.gz?v=sample`);
 }
 for(const [prefix,message]of [['missing',/download failed \(404\)/],['bad',/decompression failed/]]){
  const loader=fakeLoader(),before=requests.length;await assert.rejects(loadModel(loader,`${origin}/${prefix}/hero.glb`,{compressed:true}),message);
  assert.equal(requests.length,before+1,'Failures must not silently download a second, larger model');assert.deepEqual(loader.raw,[]);assert.deepEqual(loader.parsed,[]);
 }
 await assert.rejects(loadModel(fakeLoader(),`${origin}/hero.txt?fallback=hero.glb`,{compressed:true}),/URL must end in .glb/);
});

test('Development and browsers without native gzip support retain the original loader',async()=>{
 const url='./models/hero.glb?v=sample',loader=fakeLoader();await loadModel(loader,url);assert.deepEqual(loader.raw,[url]);assert.deepEqual(loader.parsed,[]);
 const original=globalThis.DecompressionStream;
 try{globalThis.DecompressionStream=undefined;const fallback=fakeLoader();await loadModel(fallback,url,{compressed:true});assert.deepEqual(fallback.raw,[url]);assert.deepEqual(fallback.parsed,[]);}
 finally{globalThis.DecompressionStream=original;}
});

test('Build compression keeps the original file and emits an exact reversible copy',async t=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'ninja-model-delivery-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 await mkdir(path.join(directory,'models'));const file=path.join(directory,'models','test.glb');await writeFile(file,model);
 const report=await writeCompressedModels(directory,['test']);assert.equal(report.length,1);assert.equal(report[0].originalBytes,model.length);
 const packed=await readFile(file+'.gz');assert.equal(report[0].compressedBytes,packed.length);assert.deepEqual(gunzipSync(packed),model);assert.deepEqual(await readFile(file),model);
 assert.equal(WARRIOR_ASSET_NAMES.length,new Set(WARRIOR_ASSET_NAMES).size);assert.deepEqual(WARRIOR_ASSET_NAMES.slice(-2),['warrior-motion','golf-motion']);
});
