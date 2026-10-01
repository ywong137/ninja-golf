import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {parseGlb} from '../../bake-native-golf.mjs';
import {createSourceSampler} from '../connected-return/source.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/author-travel.mjs --candidate DIRECTORY --output DIRECTORY\nCopies the fitted Ready arm chains into five combat run clips. Preserves the source body, legs, head, geometry, and other animations. Writes a separate review candidate outside public/.');process.exit(0);}
if(!values.candidate||!values.output)throw Error('Supply --candidate and --output. See --help.');
const source=path.resolve(values.candidate),out=path.resolve(values.output),publicRoot=path.resolve('public');
if(out===source||out===publicRoot||out.startsWith(publicRoot+path.sep))throw Error('Use a separate output directory outside public/.');
const raw=fs.readFileSync(source+'/ronin.glb'),hash=crypto.createHash('sha256').update(raw).digest('hex');
if(hash!=='eac107e3221b204c4727b78fd2dbe75f7207d9816e99bf191a43070c604f7c5f')throw Error('Source model changed. Review the connected-combo family before rebuilding travel.');
const sample=await createSourceSampler(source),ready=sample('Ronin_Ready',0),{doc,bin}=parseGlb(raw),parts=[bin];let length=bin.length;
const names=['Run_Forward','Run_Right','Run_Backward','Run_Left','Sprint_Forward'];
const boneNames=Object.keys(ready.bodyPose).filter(n=>/^(clavicle|upperarm|lowerarm|hand|thumb_\d+|index_\d+|middle_\d+|ring_\d+|pinky_\d+)_[rl]$/.test(n));
const nodes=new Map(doc.nodes.map((n,i)=>[T.PropertyBinding.sanitizeNodeName(n.name??''),i]));
function accessor(values,width){
 const array=Float32Array.from(values),bytes=Buffer.from(array.buffer),pad=(4-length%4)%4;if(pad){parts.push(Buffer.alloc(pad));length+=pad;}
 const bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});parts.push(bytes);length+=bytes.length;
 const record={bufferView,componentType:5126,count:values.length/width,type:width===1?'SCALAR':width===3?'VEC3':'VEC4'};if(width===1){record.min=[values[0]];record.max=[values.at(-1)];}
 doc.accessors.push(record);return doc.accessors.length-1;
}
for(const name of names){
 const clip=doc.animations.find(a=>a.name===name);if(!clip)throw Error('Missing run clip '+name);
 const duration=Math.max(...clip.samplers.map(s=>doc.accessors[s.input].max?.[0]??0));if(!(duration>0))throw Error('Missing clip duration '+name);
 const time=accessor([0,duration],1),replaced=new Set(boneNames.map(n=>nodes.get(n)));
 clip.channels=clip.channels.filter(c=>!replaced.has(c.target.node));
 for(const name of boneNames){const pose=ready.bodyPose[name];for(const[property,key]of [['rotation','q'],['translation','p'],['scale','s']]){
  clip.channels.push({target:{node:nodes.get(name),path:property},sampler:clip.samplers.length});clip.samplers.push({input:time,output:accessor([...pose[key],...pose[key]],key==='q'?4:3),interpolation:'LINEAR'});
 }}
 clip.extras={...clip.extras,fixedPairedTravel:1,reviewCandidate:true};
}
doc.buffers[0].byteLength=length;
const pad=(b,v=0)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,v)]),json=pad(Buffer.from(JSON.stringify(doc)),32),binary=pad(Buffer.concat(parts));
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const tail=Buffer.alloc(8);tail.writeUInt32LE(binary.length);tail.writeUInt32LE(0x004e4942,4);
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/ronin.glb',Buffer.concat([header,json,tail,binary]));
for(const name of ['diagonal.json','motion.json','ready.json','return.json','guards.json','grips.json'])fs.copyFileSync(source+'/'+name,out+'/'+name);
const grip={nativeAttachment:true,pairedGrip:true,fixedGripFrame:true,twoHanded:true,gripSpacing:.12};fs.writeFileSync(out+'/travel.json',JSON.stringify(grip));
console.log(JSON.stringify({out,clips:names,armBones:boneNames.length,sourceSha256:hash}));
