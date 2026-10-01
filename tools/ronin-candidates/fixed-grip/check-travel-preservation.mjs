import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {parseGlb} from '../../bake-native-golf.mjs';
import {pairedTravelGrip} from '../../../src/travel-grip.js';
const {values}=parseArgs({options:{candidate:{type:'string'},before:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/check-travel-preservation.mjs --candidate DIRECTORY --before MODEL.glb\nChecks unchanged body, leg, mesh, and unrelated animation data after paired-travel authoring.');process.exit(0);}
if(!values.candidate||!values.before)throw Error('Supply --candidate and --before. See --help.');
const source=parseGlb(fs.readFileSync(values.before)),output=parseGlb(fs.readFileSync(path.join(values.candidate,'ronin.glb')));
assert.ok(output.bin.subarray(0,source.bin.length).equals(source.bin),'Existing model bytes changed.');
for(const field of ['nodes','meshes','skins','materials','textures','images'])assert.deepEqual(output.doc[field],source.doc[field],field+' changed.');
const runs=new Set(['Run_Forward','Run_Right','Run_Backward','Run_Left','Sprint_Forward']),arm=n=>/^(clavicle|upperarm|lowerarm|hand|thumb_\d+|index_\d+|middle_\d+|ring_\d+|pinky_\d+)_[rl]$/.test(T.PropertyBinding.sanitizeNodeName(n));
let untouched=0,bodyChannels=0;
for(const clip of source.doc.animations){
 const other=output.doc.animations.find(a=>a.name===clip.name);assert.ok(other,'Missing '+clip.name);
 if(!runs.has(clip.name)){assert.deepEqual(other,clip,'Unrelated animation changed: '+clip.name);untouched++;continue;}
 assert.equal(other.extras.fixedPairedTravel,1);
 const body=channels=>channels.filter(c=>!arm(source.doc.nodes[c.target.node].name));
 assert.deepEqual(body(other.channels),body(clip.channels),'Body or leg channels changed: '+clip.name);
 for(const channel of body(clip.channels)){assert.deepEqual(other.samplers[channel.sampler],clip.samplers[channel.sampler]);bodyChannels++;}
}
assert.equal(output.doc.animations.length,source.doc.animations.length);
const grip=JSON.parse(fs.readFileSync(path.join(values.candidate,'travel.json')));for(const name of runs)assert.equal(pairedTravelGrip({pairedTravelGrip:grip},name),grip);
const report={clips:[...runs],untouchedAnimations:untouched,preservedBodyChannels:bodyChannels,preservedBinaryBytes:source.bin.length};
fs.writeFileSync(path.join(values.candidate,'travel-preservation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
