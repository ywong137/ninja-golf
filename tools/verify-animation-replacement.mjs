// Verify that a native animation patch preserves all unrelated model data.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';

const unpack=file=>{const raw=fs.readFileSync(file),size=raw.readUInt32LE(12);assert.equal(raw.readUInt32LE(0),0x46546c67,'Expected a GLB model.');return{doc:JSON.parse(raw.subarray(20,20+size)),bin:raw.subarray(28+size)};};
export function verifyAnimationReplacement(before,after,replacements){
 const original=unpack(before),candidate=unpack(after),retired=new Set(replacements.flat()),targets=new Set(replacements.map(([,name])=>name));
 assert.equal(targets.size,replacements.length,'Replacement targets must be unique.');
 for(const [oldName,newName]of replacements)assert.ok(original.doc.animations.some(a=>a.name===oldName||a.name===newName),`Missing source animation ${oldName}.`);
 assert.ok(candidate.bin.subarray(0,original.bin.length).equals(original.bin),'Original binary payload changed.');
 for(const key of Object.keys(original.doc).filter(k=>!['animations','accessors','bufferViews','buffers'].includes(k)))assert.deepEqual(candidate.doc[key],original.doc[key],`${key} changed.`);
 for(const key of ['accessors','bufferViews'])assert.deepEqual(candidate.doc[key].slice(0,original.doc[key].length),original.doc[key],`Original ${key} changed.`);
 const retained=original.doc.animations.filter(a=>!retired.has(a.name));
 assert.equal(candidate.doc.animations.length,retained.length+targets.size,'Animation count changed outside the replacements.');
 assert.deepEqual(candidate.doc.animations.filter(a=>retired.has(a.name)).map(a=>a.name).sort(),[...targets].sort(),'Replacement aliases are missing or duplicated.');
 for(const animation of retained)assert.deepEqual(candidate.doc.animations.find(a=>a.name===animation.name),animation,`${animation.name} changed.`);
 return{preservedOriginalBytes:original.bin.length,preservedAnimations:retained.length,replacements:[...targets]};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{before:{type:'string'},after:{type:'string'},replace:{type:'string',multiple:true},help:{type:'boolean'}}});
 if(values.help){console.log('node tools/verify-animation-replacement.mjs --before ORIGINAL.glb --after CANDIDATE.glb --replace OLD:NEW [--replace OLD:NEW]\nVerifies original geometry, binary data, and unrelated animation descriptors.');process.exit(0);}
 const pairs=values.replace?.map(value=>value.split(':'));
 if(!values.before||!values.after||!pairs?.length||pairs.some(pair=>pair.length!==2||pair.some(name=>!name)))throw Error('Supply --before, --after, and --replace OLD:NEW. See --help.');
 console.log(JSON.stringify(verifyAnimationReplacement(values.before,values.after,pairs)));
}
