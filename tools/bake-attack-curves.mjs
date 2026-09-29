// Install reviewed native curves into a candidate without changing other assets.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {parseGlb} from './bake-native-golf.mjs';
import {validatePlanarRoot} from '../src/attack-root-motion.js';

export const rigDigest=doc=>createHash('sha256').update(JSON.stringify({nodes:doc.nodes,skins:doc.skins})).digest('hex');
export function bakeAttackCurves(input,curves){
 const {doc,bin,chunks}=parseGlb(input);
 if(curves.schema!==1||rigDigest(doc)!==curves.rigSha256)throw Error('Native skeleton changed. Re-author and review these curves against the new rig.');
 if(doc.animations.filter(c=>c.name===curves.clip).length!==1)throw Error('Expected one existing attack named '+curves.clip);
 const spec=curves.motion;
 if(!(spec?.duration>0)||!spec.nativeAttachment||!curves.channels?.length)throw Error('Missing native motion metadata or channels.');
 if(spec.planarRoot){validatePlanarRoot(spec.planarRoot);if(Math.abs(spec.planarRoot.duration-spec.duration)>1e-6)throw Error('Root path duration differs from the animation.');}
 const parts=[bin];let length=bin.length;
 function accessor(values,width){
  const array=Float32Array.from(values);if(array.some(v=>!Number.isFinite(v)))throw Error('Curve values overflow Float32.');
  const padding=(4-length%4)%4;if(padding){parts.push(Buffer.alloc(padding));length+=padding;}
  const bytes=Buffer.alloc(array.length*4);array.forEach((v,i)=>bytes.writeFloatLE(v,i*4));
  const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});parts.push(bytes);length+=bytes.length;
  const a={bufferView:view,componentType:5126,count:values.length/width,type:{1:'SCALAR',3:'VEC3',4:'VEC4'}[width]};
  if(width===1){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;
 }
 const animation={name:curves.clip,channels:[],samplers:[],extras:{reviewedNativeCurves:1}},seen=new Set(),inputs=new Map();
 for(const c of curves.channels){
  const width={translation:3,rotation:4,scale:3}[c.path],node=doc.nodes[c.node],key=c.node+':'+c.path;
  if(!width||!node||node.name!==c.name||seen.has(key))throw Error('Invalid or duplicate channel: '+key);seen.add(key);
  if(c.times.length<2||c.times[0]!==0||Math.abs(c.times.at(-1)-spec.duration)>1e-6||c.times.some((v,i)=>!Number.isFinite(v)||(i&&Math.fround(v)<=Math.fround(c.times[i-1]))))throw Error('Channel times must span the clip and increase in Float32: '+key);
  if(c.values.length!==c.times.length*width||c.values.some(v=>!Number.isFinite(v)))throw Error('Invalid curve values: '+key);
  if(c.path==='rotation')for(let i=0;i<c.values.length;i+=4)if(Math.abs(Math.hypot(...c.values.slice(i,i+4))-1)>.001)throw Error('Non-unit rotation: '+key);
  const timeKey=JSON.stringify(c.times);if(!inputs.has(timeKey))inputs.set(timeKey,accessor(c.times,1));
  animation.channels.push({sampler:animation.samplers.length,target:{node:c.node,path:c.path}});
  animation.samplers.push({input:inputs.get(timeKey),output:accessor(c.values,width),interpolation:'LINEAR'});
 }
 doc.animations=doc.animations.map(a=>a.name===curves.clip?animation:a);doc.buffers[0].byteLength=length;
 const pad=(buffer,byte=0)=>Buffer.concat([buffer,Buffer.alloc((4-buffer.length%4)%4,byte)]);
 const json=pad(Buffer.from(JSON.stringify(doc)),32),binary=pad(Buffer.concat(parts));
 const out=chunks.map(c=>({type:c.type,data:c.type===0x4e4f534a?json:c.type===0x004e4942?binary:c.data}));
 const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+out.reduce((n,c)=>n+8+c.data.length,0),8);
 return Buffer.concat([header,...out.flatMap(c=>{const h=Buffer.alloc(8);h.writeUInt32LE(c.data.length);h.writeUInt32LE(c.type,4);return[h,c.data]})]);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{input:{type:'string'},curves:{type:'string'},output:{type:'string'},record:{type:'string'},help:{type:'boolean'}}});
 if(values.help){console.log('node tools/bake-attack-curves.mjs --input MODEL.glb --curves CURVES.json.gz --output /tmp/CANDIDATE.glb --record /tmp/RECORD.json\nRebuild reviewed native curves. Verify the skeleton fingerprint and preserve unrelated payloads. Output remains outside public/.');process.exit(0);}
 if(!values.input||!values.curves||!values.output?.endsWith('.glb')||!values.record?.endsWith('.json'))throw Error('Supply --input, --curves, --output and --record. See --help.');
 for(const output of [values.output,values.record])if(path.resolve(output).startsWith(fileURLToPath(new URL('../public/',import.meta.url))))throw Error('Write a candidate outside public/ before review.');
 const data=fs.readFileSync(values.curves),curves=JSON.parse(values.curves.endsWith('.gz')?gunzipSync(data):data);
 const result=bakeAttackCurves(fs.readFileSync(values.input),curves);fs.writeFileSync(values.output,result);fs.writeFileSync(values.record,JSON.stringify({[curves.clip]:curves.motion}));
 console.log(JSON.stringify({output:values.output,bytes:result.length,clip:curves.clip,channels:curves.channels.length}));
}
