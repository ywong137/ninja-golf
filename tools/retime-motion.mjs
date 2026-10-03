import {parseGlb} from './bake-native-golf.mjs';

// Add time inside chosen phases. The clock's value and rate are continuous;
// dense native keys approximate this curve between samples. Other phases
// retain their speed. Retiming cannot repair discontinuous source poses.
export function extendMotionPhases(duration,phases){
 if(!(Number.isFinite(duration)&&duration>0)||!Array.isArray(phases)||!phases.length)throw Error('Supply a duration and at least one phase.');
 for(const [i,{start,end,extra}]of phases.entries())if(![start,end,extra].every(Number.isFinite)||start<0||end<=start||end>duration||extra<=0||i>0&&start<phases[i-1].end)throw Error('Phases must have positive extensions and ordered, nonoverlapping intervals within the duration.');
 return t=>{
  if(!Number.isFinite(t)||t<0||t>duration+1e-6)throw Error('Retimed marker lies outside the source duration: '+t);
  t=Math.min(t,duration);let result=t;
  for(const {start,end,extra}of phases){const u=Math.max(0,Math.min(1,(t-start)/(end-start)));result+=extra*u*u*(3-2*u);}
  return result;
 };
}

export function retimeMotionRecord(source,map,{combatDuration}={}){
 const record=structuredClone(source),oldDuration=record.duration;record.duration=map(oldDuration);
 record.combatDuration=combatDuration??record.duration*(source.combatDuration===undefined?1:source.combatDuration/oldDuration);
 if(!(Number.isFinite(record.combatDuration)&&record.combatDuration>0))throw Error('Combat duration must be positive.');
 for(const pose of record.poses)pose.t=map(pose.t*oldDuration)/record.duration;
 record.impacts=record.impacts.map(map);
 for(const key of ['footPlants','toePlants'])for(const intervals of Object.values(record[key]??{}))for(const interval of intervals)for(let i=0;i<interval.length;i++)interval[i]=map(interval[i]);
 for(const branch of Object.values(record.continuations??{}))branch.at=map(branch.at);
 if(record.shoulderSkinWindow)record.shoulderSkinWindow=record.shoulderSkinWindow.map(map);
 if(record.planarRoot){
  if(Math.abs(record.planarRoot.duration-oldDuration)>1e-6)throw Error('Root travel and skeletal motion must use the same native clock.');
  record.planarRoot.duration=record.duration;
  for(const row of record.planarRoot.rows)row.time=map(row.time);
 }
 // Nonuniform key spacing no longer has a constant sample rate.
 delete record.nativeSampleRate;
 return record;
}

export function retimeAnimation(input,clipName,map){
 const {doc,bin,chunks}=parseGlb(input),clips=doc.animations.filter(a=>a.name===clipName);
 if(clips.length!==1)throw Error('Expected exactly one animation: '+clipName);
 const parts=[bin],mapped=new Map();let length=bin.length;
 // Replaced tracks can leave unused samplers with an unrelated old clock.
 // Retiming affects the channels that the selected animation actually plays.
 for(const samplerIndex of new Set(clips[0].channels.map(channel=>channel.sampler))){
  const sampler=clips[0].samplers[samplerIndex];
  if(![undefined,'LINEAR','STEP'].includes(sampler.interpolation))throw Error('Retiming supports LINEAR and STEP tracks only; cubic tangents require resampling.');
  if(mapped.has(sampler.input)){sampler.input=mapped.get(sampler.input);continue;}
  const accessor=doc.accessors[sampler.input],view=doc.bufferViews[accessor.bufferView];
  if(accessor.componentType!==5126||accessor.type!=='SCALAR'||view.byteStride||accessor.sparse)throw Error('Expected packed float32 animation times.');
  const times=[];for(let i=0;i<accessor.count;i++)times.push(Math.fround(map(bin.readFloatLE((view.byteOffset??0)+(accessor.byteOffset??0)+i*4))));
  if(times.some((t,i)=>!Number.isFinite(t)||i>0&&t<=times[i-1]))throw Error('Retimed keys must increase in float32.');
  const padding=(4-length%4)%4;if(padding){parts.push(Buffer.alloc(padding));length+=padding;}
  const bytes=Buffer.alloc(times.length*4);times.forEach((t,i)=>bytes.writeFloatLE(t,i*4));
  const bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});parts.push(bytes);length+=bytes.length;
  const index=doc.accessors.length;doc.accessors.push({bufferView,componentType:5126,count:times.length,type:'SCALAR',min:[times[0]],max:[times.at(-1)]});
  mapped.set(sampler.input,index);sampler.input=index;
 }
 doc.buffers[0].byteLength=length;
 const pad=(b,v=0)=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,v)]),json=pad(Buffer.from(JSON.stringify(doc)),32),binary=pad(Buffer.concat(parts));
 const out=chunks.map(c=>({type:c.type,data:c.type===0x4e4f534a?json:c.type===0x004e4942?binary:c.data})),header=Buffer.alloc(12);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+out.reduce((n,c)=>n+8+c.data.length,0),8);
 return Buffer.concat([header,...out.flatMap(c=>{const h=Buffer.alloc(8);h.writeUInt32LE(c.data.length);h.writeUInt32LE(c.type,4);return[h,c.data];})]);
}
