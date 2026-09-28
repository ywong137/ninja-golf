// Build a review candidate from a complete native performance. This command
// never changes a shipping model. Authoring targets do not replace joint motion.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';

const {values}=parseArgs({options:{hero:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/study-native-performance.mjs --hero kaede --output /tmp/kaede-performance.glb\nBuilds a non-shipping full-body attack candidate for visual study. Retains the native Sword_Attack performance and blends into Fan_Ready.');process.exit(0);}
if(values.hero!=='kaede'||!values.output?.endsWith('.glb'))throw Error('This pilot requires --hero kaede --output CANDIDATE.glb. See --help.');
const input=new URL('../public/models/kaede.glb',import.meta.url);
if(path.resolve(values.output)===input.pathname||path.resolve(values.output).startsWith(new URL('../public/',import.meta.url).pathname))throw Error('Use a review output outside public/. This pilot is not a shipping export.');
const raw=fs.readFileSync(input),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
const chunks=[raw.subarray(28+size)];let byteLength=chunks[0].length;
const rig=await loadNativeSkin(input),bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const capture=()=>Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));
const play=(name)=>{rig.mixer.stopAllAction();const clip=rig.animations.find(c=>c.name===name);if(!clip)throw Error('Missing clip '+name);return rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();};
play('Fan_Ready');rig.mixer.update(0);const ready=capture();
const source=play('Sword_Attack');source.clampWhenFinished=true;
const duration=.76,rate=120,count=Math.ceil(duration*rate),times=Float32Array.from({length:count+1},(_,i)=>Math.min(i/rate,duration));
// The forward blade crossing occurs near 0.43 s in the source. Hold its
// anticipation, accelerate through the crossing, then give recovery more time.
const timing=[[0,0],[.12,.12],[.27,.26],[.36,.43],[.43,.65],[.54,.90],[.65,1.20],[duration,1.50]];
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
function sourceTime(t){for(let i=1;i<timing.length;i++)if(t<=timing[i][0]){const a=timing[i-1],b=timing[i];return T.MathUtils.lerp(a[1],b[1],(t-a[0])/(b[0]-a[0]));}return timing.at(-1)[1];}
const tracks=Object.fromEntries(Object.keys(bones).map(name=>[name,{translation:new Float32Array(times.length*3),rotation:new Float32Array(times.length*4),scale:new Float32Array(times.length*3)}]));
for(let i=0;i<times.length;i++){
 const t=times[i],weight=smooth(t/.14)*(1-smooth((t-.57)/(duration-.57)));
 source.time=sourceTime(t);rig.mixer.update(0);
 for(const [name,bone]of Object.entries(bones)){
  const base=ready[name],p=base.p.clone().lerp(bone.position,weight),q=base.q.clone().slerp(bone.quaternion,weight),s=base.s.clone().lerp(bone.scale,weight),track=tracks[name];
  if(i&&q.dot(new T.Quaternion().fromArray(track.rotation,(i-1)*4))<0)q.set(-q.x,-q.y,-q.z,-q.w);
  p.toArray(track.translation,i*3);q.toArray(track.rotation,i*4);s.toArray(track.scale,i*3);
 }
}
function accessor(array,type){
 const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}
 const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=doc.bufferViews.length;chunks.push(data);doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length});byteLength+=data.length;
 const row={bufferView:view,componentType:5126,count:array.length/(type==='VEC4'?4:type==='VEC3'?3:1),type};if(type==='SCALAR'){row.min=[array[0]];row.max=[array.at(-1)];}doc.accessors.push(row);return doc.accessors.length-1;
}
const time=accessor(times,'SCALAR'),animation={name:'Fan_Heavy_Cleave',channels:[],samplers:[],extras:{reviewCandidate:true,nativePerformanceSource:'Sword_Attack'}};
for(const [name,track]of Object.entries(tracks))for(const [property,array]of Object.entries(track)){
 const node=doc.nodes.findIndex(n=>T.PropertyBinding.sanitizeNodeName(n.name||'')===name);if(node<0)throw Error('Missing native node '+name);
 animation.channels.push({sampler:animation.samplers.length,target:{node,path:property}});
 animation.samplers.push({input:time,output:accessor(array,property==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
}
doc.animations=doc.animations.map(a=>a.name===animation.name?animation:a);doc.buffers[0].byteLength=byteLength;
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
let binary=Buffer.concat(chunks);binary=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(values.output,Buffer.concat([header,json,binHeader,binary]));
console.log(JSON.stringify({output:values.output,clip:animation.name,source:'Sword_Attack',duration,samples:times.length,shipping:false}));
