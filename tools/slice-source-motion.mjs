import {AnimationClip,InterpolateLinear} from 'three';

/** Keep source interpolation keys and exact shared endpoints when splitting. */
export function sliceSourceMotion(clip,start,end,name=clip?.name){
 if(!clip?.tracks.length||![start,end].every(Number.isFinite)||start<0||end<=start||end>clip.duration+1e-6)throw Error('Choose an ordered time range inside a source clip.');
 const tracks=clip.tracks.map(track=>{
  const width=track.getValueSize(),constant=Array.from(track.values).every((v,i)=>v===track.values[i%width]);
  if(track.getInterpolation()!==InterpolateLinear&&!constant)throw Error('Source slicing requires linear tracks: '+track.name);
  const interpolant=track.createInterpolant();
  const sourceTimes=[start,...Array.from(track.times).filter(t=>t>start+1e-7&&t<end-1e-7),end];
  const times=sourceTimes.map(t=>Math.fround(t-start));
  if(times.some((t,i)=>i&&t<=times[i-1]))throw Error('Slice times collapse in Float32: '+track.name);
  const result=track.clone();result.setInterpolation(InterpolateLinear);result.times=Float32Array.from(times);result.values=Float32Array.from(sourceTimes.flatMap(t=>Array.from(interpolant.evaluate(t))));
  return result;
 });
 return new AnimationClip(name,Math.fround(end-start),tracks);
}
