import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import sources from '../public/terrain/SOURCES.json' with {type:'json'};
const compress=promisify(gzip);
export const ENVIRONMENT_FILES=Object.freeze(['textures/coastal-sky.hdr','textures/city-night.hdr',...sources.map(source=>'terrain/'+source.file)]);
export async function writeCompressedEnvironment(directory){
 const results=[];
 for(const name of ENVIRONMENT_FILES){const original=await readFile(path.join(directory,name)),compressed=await compress(original,{level:6});await writeFile(path.join(directory,name+'.gz'),compressed);results.push({name,originalBytes:original.length,compressedBytes:compressed.length});}
 return results;
}
export function compressedEnvironmentPlugin(){
 let output;
 return{name:'ninja-golf-compressed-environment',apply:'build',configResolved(config){output=path.resolve(config.root,config.build.outDir);},async writeBundle(){
  const results=await writeCompressedEnvironment(output);this.info(`Environment downloads: ${(results.reduce((n,r)=>n+r.originalBytes,0)/1048576).toFixed(1)} → ${(results.reduce((n,r)=>n+r.compressedBytes,0)/1048576).toFixed(1)} MiB (lossless gzip).`);
 }};
}
