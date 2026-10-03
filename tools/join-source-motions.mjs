import {AnimationClip,InterpolateLinear,Quaternion} from 'three';

// Preserve each authored motion. A single source-frame bridge handles the
// small endpoint differences in attack/recovery pairs from the same library.
export function joinSourceMotions(first,second,{bridge=1/60}={}){
 if(!first?.tracks?.length||!second?.tracks?.length||!(bridge>0&&Number.isFinite(bridge)))throw Error('Supply two clips and a positive bridge duration.');
 const next=new Map(second.tracks.map(t=>[t.name,t]));
 if(next.size!==first.tracks.length||new Set(first.tracks.map(t=>t.name)).size!==next.size)throw Error('Source clips must have the same unique channels.');
 const offset=first.duration+bridge,tracks=[];
 for(const a of first.tracks){
  const b=next.get(a.name),width=a.getValueSize();
  if(!b||a.ValueTypeName!==b.ValueTypeName||width!==b.getValueSize()||a.getInterpolation()!==InterpolateLinear||b.getInterpolation()!==InterpolateLinear)throw Error('Incompatible source channel: '+a.name);
  if(a.times[0]!==0||b.times[0]!==0)throw Error('Source channels must begin at zero: '+a.name);
  const end=Array.from(a.createInterpolant().evaluate(first.duration)),start=Array.from(b.createInterpolant().evaluate(0));
  if(a.ValueTypeName==='quaternion'){
   const degrees=new Quaternion().fromArray(end).angleTo(new Quaternion().fromArray(start))*180/Math.PI;
   if(degrees>2)throw Error('Source recovery does not match '+a.name+': '+degrees.toFixed(2)+' degrees.');
  }else if(Math.hypot(...end.map((v,i)=>v-start[i]))>.001)throw Error('Source recovery does not match '+a.name+'.');
  const times=Array.from(a.times),values=Array.from(a.values);
  if(times.at(-1)<first.duration){times.push(first.duration);values.push(...end);}
  times.push(...Array.from(b.times,t=>t+offset));values.push(...b.values);
  if(a.ValueTypeName==='quaternion')for(let i=width;i<values.length;i+=width){
   if(values.slice(i,i+4).reduce((sum,v,k)=>sum+v*values[i-4+k],0)<0)for(let k=0;k<4;k++)values[i+k]*=-1;
  }
  const track=a.clone();track.times=Float32Array.from(times);track.values=Float32Array.from(values);tracks.push(track);
 }
 return new AnimationClip(first.name+' + '+second.name,offset+second.duration,tracks);
}
