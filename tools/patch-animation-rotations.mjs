// Append replacement rotation tracks without rewriting geometry or other channels.
import {parseGlb} from './bake-native-golf.mjs';

export function patchAnimationRotations(input,entries){
 const {doc,bin,chunks}=parseGlb(input),parts=[bin],seen=new Set();let length=bin.length;
 function accessor(values,width){
  const array=Float32Array.from(values);if(array.some(v=>!Number.isFinite(v)))throw Error('Rotation track contains non-finite values.');
  const padding=(4-length%4)%4;if(padding){parts.push(Buffer.alloc(padding));length+=padding;}
  const bytes=Buffer.alloc(array.length*4);array.forEach((v,i)=>bytes.writeFloatLE(v,i*4));
  const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});parts.push(bytes);length+=bytes.length;
  const a={bufferView:view,componentType:5126,count:values.length/width,type:width===1?'SCALAR':'VEC4'};
  if(width===1){a.min=[array[0]];a.max=[array.at(-1)];}doc.accessors.push(a);return doc.accessors.length-1;
 }
 for(const {clip,times,rotations,extras={}}of entries){
  if(seen.has(clip))throw Error('Repeated animation: '+clip);seen.add(clip);
  const matches=doc.animations.filter(a=>a.name===clip);if(matches.length!==1)throw Error('Expected one animation: '+clip);const animation=matches[0];
  if(times.length<2||times[0]!==0||times.some((v,i)=>!Number.isFinite(v)||(i&&Math.fround(v)<=Math.fround(times[i-1]))))throw Error('Animation times must start at zero and increase in Float32: '+clip);
  const input=accessor(times,1);
  for(const [name,values]of Object.entries(rotations)){
   if(values.length!==times.length*4)throw Error('Wrong rotation sample count: '+name);
   for(let i=0;i<values.length;i+=4)if(Math.abs(Math.hypot(...values.slice(i,i+4))-1)>.001)throw Error('Non-unit rotation: '+name);
   const channels=animation.channels.filter(c=>doc.nodes[c.target.node].name===name&&c.target.path==='rotation');
   if(channels.length!==1)throw Error('Expected one existing rotation channel: '+clip+'/'+name);
   channels[0].sampler=animation.samplers.length;animation.samplers.push({input,output:accessor(values,4),interpolation:'LINEAR'});
  }
  animation.extras={...animation.extras,...extras};
 }
 doc.buffers[0].byteLength=length;
 const pad=(b,value=0)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,value)]),json=pad(Buffer.from(JSON.stringify(doc)),32),binary=pad(Buffer.concat(parts));
 const out=chunks.map(c=>({type:c.type,data:c.type===0x4e4f534a?json:c.type===0x004e4942?binary:c.data})),header=Buffer.alloc(12);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+out.reduce((n,c)=>n+8+c.data.length,0),8);
 return Buffer.concat([header,...out.flatMap(c=>{const h=Buffer.alloc(8);h.writeUInt32LE(c.data.length);h.writeUInt32LE(c.type,4);return[h,c.data]})]);
}
