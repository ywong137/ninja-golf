import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {gzipSync} from 'node:zlib';
import {decodeEnvironmentBytes,loadEnvironmentBytes,loadEnvironmentTexture} from '../src/compressed-environment.js';
import {ENVIRONMENT_FILES,writeCompressedEnvironment} from '../tools/compressed-environment.mjs';
const buffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);

test('binary environment packaging preserves every byte and keeps raw fallbacks',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ninja-environment-'));
 try{
  for(const file of ENVIRONMENT_FILES){await fs.mkdir(path.dirname(path.join(directory,file)),{recursive:true});await fs.writeFile(path.join(directory,file),Buffer.from(file.repeat(100)));}
  const result=await writeCompressedEnvironment(directory);assert.equal(result.length,5);
  for(const {name,originalBytes,compressedBytes}of result){const raw=await fs.readFile(path.join(directory,name)),packed=await fs.readFile(path.join(directory,name+'.gz'));assert.equal(raw.length,originalBytes);assert.ok(compressedBytes<originalBytes);assert.deepEqual(Buffer.from(await decodeEnvironmentBytes(buffer(packed))),raw);assert.equal(await decodeEnvironmentBytes(buffer(raw)).then(b=>Buffer.compare(Buffer.from(b),raw)),0);}
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('environment downloads accept server-decoded files, report HTTP failures, and retain HDR loader configuration',async()=>{
 const saved=globalThis.fetch,raw=Buffer.from('#?RADIANCE\nexample sky'),requests=[];let encoded=true,failed=false;
 globalThis.fetch=async url=>{requests.push(url);return{ok:!failed,status:503,arrayBuffer:async()=>buffer(encoded?gzipSync(raw):raw)};};
 try{
  assert.deepEqual(Buffer.from(await loadEnvironmentBytes('/sky.hdr',{compressed:true})),raw);assert.equal(requests[0],'/sky.hdr.gz');
  encoded=false;assert.deepEqual(Buffer.from(await loadEnvironmentBytes('/sky.hdr',{compressed:true})),raw);
  const sentinel={retainsHDRSettings:true},loader={loadAsync:async url=>{assert.ok(url.startsWith('blob:'));assert.deepEqual(Buffer.from(await (await saved(url)).arrayBuffer()),raw);return sentinel;}};
  assert.equal(await loadEnvironmentTexture(loader,'/sky.hdr',{compressed:true}),sentinel);
  failed=true;await assert.rejects(loadEnvironmentBytes('/missing',{compressed:true}),/missing.*503/);
 }finally{globalThis.fetch=saved;}
});
