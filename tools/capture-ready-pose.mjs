// Copy one captured full-body stance, including channels absent from the old idle.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';

export async function capturedReadyPose(input,sourceName,targetName,{time=0,duration=2}={}){
 if(!Number.isFinite(time)||time<0||!Number.isFinite(duration)||duration<=0)throw Error('Use a nonnegative source time and a positive idle duration.');
 const g=await loadNativeSkin(input),source=g.animations.find(c=>c.name===sourceName),target=g.animations.find(c=>c.name===targetName);
 if(!source||!target||time>source.duration)throw Error('The input must contain both named clips and the requested source time.');
 const existing=new Set(target.tracks.map(t=>t.name));
 const entry={clip:targetName,times:[0,duration],rotations:{},newRotations:{},translations:{},scales:{},extras:{readySource:{clip:sourceName,time,version:1}}};
 for(const track of source.tracks){
  const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),property=track.name.slice(dot+1);
  const field={quaternion:existing.has(track.name)?'rotations':'newRotations',position:'translations',scale:'scales'}[property];
  if(!field||property!=='quaternion'&&!existing.has(track.name))throw Error('Unsupported new stance channel: '+track.name);
  const value=Array.from(track.createInterpolant().evaluate(time));entry[field][name]=[...value,...value];
 }
 return patchAnimationTransforms(fs.readFileSync(input),[entry]);
}
if(process.argv[1]?.endsWith('capture-ready-pose.mjs')){
 const {values:v}=parseArgs({options:{input:{type:'string'},output:{type:'string'},source:{type:'string'},target:{type:'string'},time:{type:'string',default:'0'},duration:{type:'string',default:'2'},help:{type:'boolean'}}});
 if(v.help){console.log('node tools/capture-ready-pose.mjs --input MODEL.glb --output NEW.glb --source CAPTURED_CLIP --target EXISTING_READY_CLIP [--time 0] [--duration 2]\nCopies the complete captured stance. Preserve the source grip metadata when installing the new idle.');process.exit(0);}
 for(const key of ['input','output','source','target'])if(!v[key])throw Error('Supply --'+key+'. See --help.');
 if(fs.existsSync(v.output))throw Error('Choose a new output file.');
 fs.writeFileSync(v.output,await capturedReadyPose(v.input,v.source,v.target,{time:Number(v.time),duration:Number(v.duration)}));
}
