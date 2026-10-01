import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {parseGlb} from '../../bake-native-golf.mjs';

const {values}=parseArgs({options:{candidate:{type:'string'},before:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/check-startup-preservation.mjs --candidate DIRECTORY --before DIRECTORY\nChecks every first-cut time key, unchanged pose outputs, unrelated clips, original binary data, and all associated event times.');process.exit(0);}
if(!values.candidate||!values.before)throw Error('Supply --candidate and --before. See --help.');
const load=dir=>parseGlb(fs.readFileSync(path.join(dir,'ronin.glb'))),source=load(values.before),result=load(values.candidate);
assert.ok(result.bin.subarray(0,source.bin.length).equals(source.bin),'Existing model data changed.');
for(const key of ['nodes','meshes','skins','materials','textures','images','accessors','bufferViews']){
 const actual=['accessors','bufferViews'].includes(key)?result.doc[key].slice(0,source.doc[key].length):result.doc[key];
 assert.deepEqual(actual,source.doc[key],key+' changed.');
}
const times=(model,index)=>{const a=model.doc.accessors[index],v=model.doc.bufferViews[a.bufferView];return Array.from({length:a.count},(_,i)=>model.bin.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*4));};
const warp=t=>{const u=Math.min(1,t/.16);return t+.08*u*u*(3-2*u);};
let untouchedAnimations=0,timeKeys=0;
assert.equal(result.doc.animations.length,source.doc.animations.length);
for(const clip of source.doc.animations){
 const other=result.doc.animations.find(a=>a.name===clip.name);assert.ok(other,'Missing '+clip.name);
 if(clip.name!=='Ronin_Cut_Diagonal'){assert.deepEqual(other,clip,'Unrelated animation changed: '+clip.name);untouchedAnimations++;continue;}
 assert.deepEqual(other.channels,clip.channels);assert.equal(other.samplers.length,clip.samplers.length);
 for(let i=0;i<clip.samplers.length;i++){
  const old=clip.samplers[i],next=other.samplers[i];assert.deepEqual({...next,input:old.input},old,'Pose output or interpolation changed.');
  const a=times(source,old.input),b=times(result,next.input);assert.equal(a.length,b.length);
  for(let k=0;k<a.length;k++){assert.equal(b[k],Math.fround(warp(a[k])));if(k)assert.ok(b[k]>b[k-1],'Time keys must increase.');timeKeys++;}
 }
}
for(const name of ['motion','ready','return','guards','grips','travel'])assert.ok(fs.readFileSync(path.join(values.candidate,name+'.json')).equals(fs.readFileSync(path.join(values.before,name+'.json'))),name+' changed.');
const loadRecord=dir=>JSON.parse(fs.readFileSync(path.join(dir,'diagonal.json'))).Ronin_Cut_Diagonal;
const old=loadRecord(values.before),next=loadRecord(values.candidate);
assert.equal(next.duration,warp(old.duration));assert.equal(next.combatDuration,.48);
assert.deepEqual(next.impacts,old.impacts.map(warp));
assert.deepEqual(next.continuations,Object.fromEntries(Object.entries(old.continuations).map(([k,v])=>[k,{...v,at:warp(v.at)}])));
assert.deepEqual(next.poses,old.poses.map(p=>({...p,t:warp(p.t*old.duration)/next.duration})));
for(const key of ['footPlants','toePlants'])if(old[key])assert.deepEqual(next[key],Object.fromEntries(Object.entries(old[key]).map(([s,rows])=>[s,rows.map(r=>r.map(warp))])));
assert.deepEqual(next.shoulderSkinWindow,[.40,.46,.58,.66].map(t=>warp(t*.60/.76)));
assert.ok(next.impacts[0]<next.continuations.light.at&&next.continuations.light.at<next.duration);
const report={untouchedAnimations,timeKeys,preservedBinaryBytes:source.bin.length,contact:next.impacts[0]/next.duration*next.combatDuration,branch:next.continuations.light.at/next.duration*next.combatDuration};
fs.writeFileSync(path.join(values.candidate,'startup-preservation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
