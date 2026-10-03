import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PropertyBinding,Vector3,InterpolateLinear} from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {parseGlb} from './bake-native-golf.mjs';
import {sliceSourceMotion} from './slice-source-motion.mjs';
import {extractPlanarRoot} from './extract-planar-root.mjs';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {extendMotionPhases} from './retime-motion.mjs';

const {values:v}=parseArgs({options:{base:{type:'string'},source:{type:'string'},'source-clip':{type:'string'},template:{type:'string'},name:{type:'string'},output:{type:'string'},grips:{type:'string'},hero:{type:'string'},start:{type:'string',default:'0'},end:{type:'string'},speed:{type:'string',default:'1.2'},impact:{type:'string',multiple:true},'slow-phase':{type:'string',multiple:true},credit:{type:'string'},help:{type:'boolean'}}});
if(v.help){console.log('node tools/assemble-source-attack.mjs --base RELEASE.glb --source BAKED.glb --source-clip CLIP --template TEMPLATE --name NAME --output REVIEW.glb --grips grip-data.json --hero MODEL --impact SOURCE_SECONDS --credit TEXT [--start SECONDS] [--end SECONDS] [--speed RATIO]\nAppend a complete native attack or source interval. Extract horizontal travel, retain vertical motion, and sample the shared gameplay record. Repeat --impact for several strikes. Use --slow-phase start,end,extra to extend a phase (seconds). Output must be outside public/.');process.exit(0);}
for(const key of ['base','source','source-clip','template','name','output','grips','hero','impact','credit'])if(!v[key])throw Error('Supply --'+key+'. See --help.');
if(path.resolve(v.output).split(path.sep).includes('public')||[v.base,v.source].some(p=>path.resolve(p)===path.resolve(v.output)))throw Error('Choose a separate review output outside public/.');
const base=await loadNativeSkin(v.base),source=await loadNativeSkin(v.source);
const original=source.animations.find(c=>c.name===v['source-clip']),template=base.animations.find(c=>c.name===v.template);
if(!original||!template)throw Error('The named source clip and template must exist.');
const start=Number(v.start),end=v.end===undefined?original.duration:Number(v.end),speed=Number(v.speed),impacts=v.impact.map(Number);
if(!Number.isFinite(speed)||speed<=0||impacts.some((t,i)=>!Number.isFinite(t)||t<=start||t>=end||i&&t<=impacts[i-1]))throw Error('Use a positive speed and increasing impacts inside the source interval.');
// Imported static translations may use cubic tangents. Retain those channels
// from the native template instead of treating tangents as animated lengths.
const animated=original.clone();animated.tracks=animated.tracks.filter(track=>{
 if((track.name.endsWith('.quaternion')||track.name==='pelvis.position')&&track.getInterpolation()===InterpolateLinear)return true;
 const sampler=track.createInterpolant(),initial=Array.from(sampler.evaluate(0));
 for(const time of [0,...track.times,original.duration])if(Array.from(sampler.evaluate(time)).some((x,i)=>Math.abs(x-initial[i])>1e-6))throw Error('Unsupported animated channel: '+track.name);
 return false;
});
const warp=v['slow-phase']?extendMotionPhases(original.duration,v['slow-phase'].map(text=>{const values=text.split(',').map(Number);if(values.length!==3)throw Error('--slow-phase needs start,end,extra seconds.');const [start,end,extra]=values;return{start,end,extra};})):t=>t;
for(const track of animated.tracks)track.times=Float32Array.from(track.times,t=>warp(t));animated.duration=Math.fround(warp(original.duration));
const clockStart=Math.fround(warp(start)),clockEnd=Math.fround(warp(end));
const extracted=extractPlanarRoot(base.scene,sliceSourceMotion(animated,clockStart,clockEnd));
// A slice can start metres along the source path. Put its local pelvis at the
// native actor origin; the controller applies only the extracted travel.
base.scene.updateMatrixWorld(true);
const pelvis=base.scene.getObjectByName('pelvis'),parent=pelvis.parent.matrixWorld,inverse=parent.clone().invert(),origin=pelvis.getWorldPosition(new Vector3());
const root=extracted.clip.tracks.find(t=>t.name==='pelvis.position');
for(let i=0;i<root.values.length;i+=3){const p=new Vector3().fromArray(root.values,i).applyMatrix4(parent);p.x=origin.x;p.z=origin.z;p.applyMatrix4(inverse).toArray(root.values,i);}
const {doc}=parseGlb(fs.readFileSync(v.base));
const nativeNames=new Map(doc.nodes.filter(n=>n.name).map(n=>[PropertyBinding.sanitizeNodeName(n.name),n.name]));
const existing=new Set(template.tracks.filter(t=>t.name.endsWith('.quaternion')).map(t=>t.name.slice(0,-11)));
const times=Array.from(new Set([0,extracted.clip.duration,...extracted.clip.tracks.flatMap(t=>Array.from(t.times))].map(Math.fround))).sort((a,b)=>a-b);
const entry={clip:v.name,template:v.template,times,rotations:{},newRotations:{},translations:{},scales:{},extras:{source:v.credit,sourceInterval:[start,end]}};
for(const track of extracted.clip.tracks){
 const dot=track.name.lastIndexOf('.'),bone=track.name.slice(0,dot),property=track.name.slice(dot+1),native=nativeNames.get(bone),sampler=track.createInterpolant();
 if(!native)throw Error('No native bone for '+track.name);
 if(property==='position'&&bone!=='pelvis'&&Array.from(track.values).some((x,i)=>Math.abs(x-track.values[i%3])>1e-6))throw Error('Source changes limb length: '+bone);
 if(property==='scale'&&Array.from(track.values).some(x=>Math.abs(x-1)>1e-4))throw Error('Source changes bone scale: '+bone);
 const field=property==='quaternion'?(existing.has(bone)?'rotations':'newRotations'):property==='position'?'translations':property==='scale'?'scales':null;
 if(!field)throw Error('Unsupported channel: '+track.name);
 entry[field][native]=times.flatMap(t=>Array.from(sampler.evaluate(t)));
}
fs.mkdirSync(path.dirname(v.output),{recursive:true});
fs.writeFileSync(v.output,patchAnimationTransforms(fs.readFileSync(v.base),[entry]));
const output=v.output.replace(/\.glb$/,'-motion.json');
execFileSync(process.execPath,[fileURLToPath(new URL('./sample-source-cut-record.mjs',import.meta.url)),'--input',v.output,'--grips',v.grips,'--hero',v.hero,'--clip',v.name,'--output',output,'--combat-duration',String(extracted.clip.duration/speed),...impacts.flatMap(t=>['--impact',String(warp(t)-clockStart)]),'--source-credit',v.credit],{stdio:'pipe'});
const records=JSON.parse(fs.readFileSync(output));records[v.name].planarRoot=extracted.path;
fs.writeFileSync(output,JSON.stringify(records));
const report={clip:v.name,duration:extracted.clip.duration,sourceInterval:[start,end],combatDuration:records[v.name].combatDuration,impacts:records[v.name].impacts,travel:extracted.path.rows.at(-1),source:v.credit};
fs.writeFileSync(v.output+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
