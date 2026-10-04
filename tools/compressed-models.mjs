import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import {WARRIOR_ASSET_NAMES} from '../src/warrior-assets.js';

const compress=promisify(gzip);
export async function writeCompressedModels(outputDirectory,names=WARRIOR_ASSET_NAMES){
 const results=[];
 // Compress one model at a time to bound the build's working memory.
 for(const name of names){
  const file=path.join(outputDirectory,'models',`${name}.glb`),source=await readFile(file);
  const compressed=await compress(source,{level:6});
  await writeFile(file+'.gz',compressed);
  results.push({name,originalBytes:source.length,compressedBytes:compressed.length});
 }
 return results;
}

export function compressedModelsPlugin(){
 let outputDirectory;
 return {
  name:'ninja-golf-compressed-models',apply:'build',
  configResolved(config){outputDirectory=path.resolve(config.root,config.build.outDir);},
  async writeBundle(){
   const results=await writeCompressedModels(outputDirectory);
   const before=results.reduce((n,r)=>n+r.originalBytes,0),after=results.reduce((n,r)=>n+r.compressedBytes,0);
   this.info(`Character downloads: ${(before/1048576).toFixed(1)} → ${(after/1048576).toFixed(1)} MiB (lossless gzip).`);
  },
 };
}
