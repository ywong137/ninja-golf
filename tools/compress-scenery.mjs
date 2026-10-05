import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {MeshoptEncoder} from 'meshoptimizer';
import {NATURE_MODEL_NAMES} from '../src/nature-assets.js';

// Encode the original attribute bytes. No quantization, filtering, vertex
// reordering, triangle rotation, texture conversion, or simplification occurs.
export async function compressSceneryGLB(bytes){
 await MeshoptEncoder.ready;
 if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)throw Error('Scenery compression needs a binary glTF 2 model.');
 const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),binary=bytes.subarray(28+jsonLength);
 if(gltf.buffers.length!==1||gltf.buffers[0].uri||gltf.bufferViews.some(v=>v.buffer!==0||v.extensions?.EXT_meshopt_compression))throw Error('Scenery compression needs one embedded, uncompressed buffer.');
 const chunks=[];let length=0,fallbackLength=0,compressedViews=0;
 const append=data=>{const offset=length;chunks.push(data);length+=data.length;const padding=(4-length%4)%4;if(padding){chunks.push(Buffer.alloc(padding));length+=padding;}return offset;};
 for(let i=0;i<gltf.bufferViews.length;i++){
  const view=gltf.bufferViews[i],data=binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),accessors=gltf.accessors.filter(a=>a.bufferView===i);
  if(accessors.length===1){
   const a=accessors[0],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],stride=components*size;
   const index=view.target===34963,mode=index?'INDICES':'ATTRIBUTES';
   if(!a.sparse&&!(a.byteOffset||0)&&(!view.byteStride||view.byteStride===stride)&&a.count*stride===data.length&&(index?[2,4].includes(stride):stride%4===0)){
    // Version 0 is the EXT format supported by the shipped Three.js decoder.
    const encoded=MeshoptEncoder.encodeGltfBuffer(data,a.count,stride,mode,0);
    if(encoded.length<data.length){
     const offset=append(Buffer.from(encoded));view.buffer=1;view.byteOffset=fallbackLength;fallbackLength=Math.ceil((fallbackLength+data.length)/4)*4;
     view.extensions={...view.extensions,EXT_meshopt_compression:{buffer:0,byteOffset:offset,byteLength:encoded.length,byteStride:stride,count:a.count,mode,filter:'NONE'}};compressedViews++;continue;
    }
   }
  }
  view.buffer=0;view.byteOffset=append(data);
 }
 if(!compressedViews)throw Error('Scenery model has no supported compressible geometry.');
 gltf.buffers=[{byteLength:length},{byteLength:fallbackLength,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 gltf.extensionsUsed=[...new Set([...(gltf.extensionsUsed||[]),'EXT_meshopt_compression'])];gltf.extensionsRequired=[...new Set([...(gltf.extensionsRequired||[]),'EXT_meshopt_compression'])];
 const json=Buffer.from(JSON.stringify(gltf)),padding=Buffer.alloc((4-json.length%4)%4,32),body=Buffer.concat(chunks),output=Buffer.alloc(28+json.length+padding.length+body.length);
 output.writeUInt32LE(0x46546c67,0);output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(json.length+padding.length,12);output.writeUInt32LE(0x4e4f534a,16);json.copy(output,20);padding.copy(output,20+json.length);
 const offset=20+json.length+padding.length;output.writeUInt32LE(body.length,offset);output.writeUInt32LE(0x004e4942,offset+4);body.copy(output,offset+8);
 return {bytes:output,compressedViews};
}

export function compressedSceneryPlugin(){
 let outputDirectory;
 return {name:'ninja-golf-compressed-scenery',apply:'build',configResolved(config){outputDirectory=path.resolve(config.root,config.build.outDir,'models/nature');},async writeBundle(){
  let before=0,after=0;
  for(const name of NATURE_MODEL_NAMES){
   const source=await readFile(path.join(outputDirectory,name+'.glb')),{bytes}=await compressSceneryGLB(source),gzip=gzipSync(bytes,{level:6});
   await writeFile(path.join(outputDirectory,name+'.meshopt.glb'),bytes);await writeFile(path.join(outputDirectory,name+'.meshopt.glb.gz'),gzip);
   before+=gzipSync(source,{level:6}).length;after+=gzip.length;
  }
  this.info(`Scenery downloads: ${(before/1048576).toFixed(1)} → ${(after/1048576).toFixed(1)} MiB (lossless geometry).`);
 }};
}
