import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import {parseGlb} from '../../bake-native-golf.mjs';

const {values}=parseArgs({options:{candidate:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/author-startup.mjs --candidate DIRECTORY --output DIRECTORY\nExtends preparation of the paired-travel first cut. Preserves all pose values and unrelated clips. Retimes contact, planted-foot intervals, recovery skin correction, and combo handoff. Writes an offline candidate outside public/.');process.exit(0);}
if(!values.candidate||!values.output)throw Error('Supply --candidate and --output. See --help.');
const source=path.resolve(values.candidate),out=path.resolve(values.output),publicRoot=path.resolve('public');
if(out===source||out===publicRoot||out.startsWith(publicRoot+path.sep))throw Error('Use a separate output directory outside public/.');
const raw=fs.readFileSync(path.join(source,'ronin.glb')),sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
if(sourceSha256!=='8920a5c5d88c348ac750ff24efe30941dff6f52e25c2cba4103be4d487c17111')throw Error('Source model changed. Review the paired-travel family before retiming.');
const {doc,bin}=parseGlb(raw),parts=[bin];let length=bin.length;
const extension=.08,preparationEnd=.16,combatDuration=.48;
// The derivative equals one at both ends. The cut and its recovery keep their
// native spacing after preparation; the clock never stops or reverses.
const warp=t=>{const u=Math.min(1,t/preparationEnd);return t+extension*u*u*(3-2*u);};
const clip=doc.animations.find(a=>a.name==='Ronin_Cut_Diagonal'),mapped=new Map();
if(!clip)throw Error('Missing Ronin_Cut_Diagonal.');
for(const sampler of clip.samplers){
 if(mapped.has(sampler.input)){sampler.input=mapped.get(sampler.input);continue;}
 const accessor=doc.accessors[sampler.input],view=doc.bufferViews[accessor.bufferView];
 if(accessor.componentType!==5126||accessor.type!=='SCALAR'||view.byteStride)throw Error('Expected packed float32 time keys.');
 const times=[];for(let i=0;i<accessor.count;i++)times.push(warp(bin.readFloatLE((view.byteOffset??0)+(accessor.byteOffset??0)+i*4)));
 const bytes=Buffer.alloc(times.length*4);times.forEach((t,i)=>bytes.writeFloatLE(t,i*4));
 const bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});parts.push(bytes);length+=bytes.length;
 const index=doc.accessors.length;doc.accessors.push({bufferView,componentType:5126,count:times.length,type:'SCALAR',min:[times[0]],max:[times.at(-1)]});
 mapped.set(sampler.input,index);sampler.input=index;
}
clip.extras={...clip.extras,continuousStartupExtension:extension};doc.buffers[0].byteLength=length;
const pad=(b,v=0)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,v)]),json=pad(Buffer.from(JSON.stringify(doc)),32),binary=pad(Buffer.concat(parts));
const header=Buffer.alloc(20),tail=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(binary.length);tail.writeUInt32LE(0x004e4942,4);
const sidecars=Object.fromEntries(['diagonal','motion','ready','return','guards','grips','travel'].map(n=>[n,fs.readFileSync(path.join(source,n+'.json'))]));
const records=JSON.parse(sidecars.diagonal),record=records.Ronin_Cut_Diagonal,oldDuration=record.duration;
if(oldDuration!==.6||!record.continuations?.light)throw Error('Expected the connected .60-second first cut.');
record.duration=warp(oldDuration);record.combatDuration=combatDuration;
record.impacts=record.impacts.map(warp);
for(const branch of Object.values(record.continuations))branch.at=warp(branch.at);
for(const key of ['footPlants','toePlants'])for(const intervals of Object.values(record[key]??{}))for(const interval of intervals)for(let i=0;i<interval.length;i++)interval[i]=warp(interval[i]);
for(const pose of record.poses)pose.t=warp(pose.t*oldDuration)/record.duration;
record.shoulderSkinWindow=[.40,.46,.58,.66].map(t=>warp(t*.60/.76));
sidecars.diagonal=JSON.stringify(records);
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'ronin.glb'),Buffer.concat([header,json,tail,binary]));
for(const [name,data]of Object.entries(sidecars))fs.writeFileSync(path.join(out,name+'.json'),data);
const report={sourceSha256,extension,preparationEnd,combatDuration,duration:record.duration,contact:record.impacts[0]/record.duration*combatDuration,branch:record.continuations.light.at/record.duration*combatDuration};
fs.writeFileSync(path.join(out,'startup-timing.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report}));
