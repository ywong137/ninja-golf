// Rebuild the reviewed complete-stroke clock and its constrained arm curves.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {resolveFootSupport} from '../src/foot-placement.js';

const names=['Head','hand_l','lowerarm_l','upperarm_l','clavicle_l','hand_r',
 'lowerarm_r','upperarm_r','clavicle_r','neck_01','spine_03','spine_02',
 'foot_l','calf_l','thigh_l','foot_r','calf_r','thigh_r','spine_01','pelvis'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function bakeGolfPacing(input,curves){
 if(curves.schema!==1||curves.hero!=='kaede'||curves.clip!=='Golf_Swing')
  throw Error('Use the reviewed golf-pacing curves for the Ace.');
 if(sha(input)!==curves.sourceSha256)
  throw Error(`Source model changed. Use kaede.glb from ${curves.sourceCommit}.`);
 if(Object.keys(curves.rotations??{}).length!==names.length||names.some(n=>!curves.rotations[n])||
    Object.keys(curves.translations??{}).join(',')!=='pelvis'||!Array.isArray(curves.times)||
    Math.abs(curves.times.at(-1)-2.4)>1e-6)
  throw Error('The pacing curves require twenty rotations and the pelvis translation over the complete Golf_Swing.');
 resolveFootSupport({name:curves.clip,duration:2.4,userData:curves.extras},{duration:2.4});
 if(!curves.extras?.footSupport)throw Error('The retimed clip must contain its foot-support schedule.');
 const output=patchAnimationTransforms(input,[curves]);
 if(!curves.outputSha256||sha(output)!==curves.outputSha256)
  throw Error('The rebuilt model differs from the reviewed output.');
 return output;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
 if(values.help){
  console.log('node tools/bake-golf-pacing.mjs --input SOURCE.glb --output NEW.glb\nUses kaede.glb from 9e80579. Writes a new, hash-verified candidate outside public/.');
  process.exit(0);
 }
 if(!values.input||!values.output?.endsWith('.glb'))throw Error('Supply --input and --output. See --help.');
 const output=path.resolve(values.output),parent=fs.realpathSync(path.dirname(output)),publicPath=fs.realpathSync(new URL('../public/',import.meta.url));
 if(parent===publicPath||parent.startsWith(publicPath+path.sep)||fs.existsSync(output))throw Error('Write a new candidate outside public/.');
 const curves=JSON.parse(gunzipSync(fs.readFileSync(new URL('./golf-pacing/kaede.json.gz',import.meta.url))));
 const result=bakeGolfPacing(fs.readFileSync(values.input),curves);
 fs.writeFileSync(output,result,{flag:'wx'});
 console.log(JSON.stringify({output,bytes:result.length,sha256:sha(result)}));
}
