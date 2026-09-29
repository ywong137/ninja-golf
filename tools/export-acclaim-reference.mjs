#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {decodeAcclaimReference} from './acclaim-motion.mjs';

const {values}=parseArgs({options:{asf:{type:'string'},amc:{type:'string'},rate:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){
 console.log('node tools/export-acclaim-reference.mjs --asf SKELETON.asf --amc MOTION.amc --rate HZ --output REFERENCE.json\nExports source endpoints and world rotations in metres. It does not create a game animation or infer a weapon.\nSupply the documented capture rate. Outputs must remain outside public/ and must not overwrite an input.');
 process.exit(0);
}
if(!values.asf||!values.amc||!values.output?.endsWith('.json'))throw Error('Supply --asf, --amc, --rate, and --output. See --help.');
const output=path.resolve(values.output),publicDir=path.resolve(new URL('../public',import.meta.url).pathname);
if(output.startsWith(publicDir+path.sep)||[values.asf,values.amc].some(p=>path.resolve(p)===output))throw Error('Keep reference outputs outside public/ and separate from source files.');
const asf=fs.readFileSync(values.asf,'utf8'),amc=fs.readFileSync(values.amc,'utf8');
const result=decodeAcclaimReference(asf,amc,{rate:Number(values.rate)});
result.sources=Object.fromEntries([['asf',asf],['amc',amc]].map(([kind,text])=>[kind,{file:path.basename(values[kind]),sha256:createHash('sha256').update(text).digest('hex')}]));
fs.writeFileSync(output,JSON.stringify(result));
console.log(JSON.stringify({output,frames:result.frames.length,duration:result.frames.at(-1).t,rate:result.rate,units:result.units}));
