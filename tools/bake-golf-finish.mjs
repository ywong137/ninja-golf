// Rebuild the reviewed finish without retaining intermediate candidate payloads.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';

export function bakeGolfFinish(input,curves){
  if(curves.schema!==1||curves.hero!=='kaede'||curves.clip!=='Golf_Swing')
    throw Error('Use the reviewed Ace golf finish curves.');
  if(createHash('sha256').update(input).digest('hex')!==curves.sourceSha256)
    throw Error(`Source model changed. Use kaede.glb from ${curves.sourceCommit}, or review a new fit.`);
  const names=['spine_02','spine_03','Head','clavicle_r','clavicle_l','upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'];
  if(names.length!==Object.keys(curves.rotations??{}).length||names.some(n=>!curves.rotations[n])||!Array.isArray(curves.times)||Math.abs(curves.times.at(-1)-2.4)>1e-6)
    throw Error('The finish must contain the eleven reviewed rotation channels and span Golf_Swing.');
  return patchAnimationTransforms(input,[curves]);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
  if(values.help){
    console.log('node tools/bake-golf-finish.mjs --input SOURCE.glb --output CANDIDATE.glb\nRebuilds the reviewed Ace finish from the model at 6e7150a. Writes a separate candidate outside public/.');
    process.exit(0);
  }
  if(!values.input||!values.output?.endsWith('.glb'))throw Error('Supply --input and --output. See --help.');
  const output=path.resolve(values.output),parent=fs.realpathSync(path.dirname(output));
  const publicPath=fs.realpathSync(new URL('../public/',import.meta.url));
  if(parent===publicPath||parent.startsWith(publicPath+path.sep)||fs.existsSync(output))
    throw Error('Write a new candidate outside public/.');
  const curves=JSON.parse(gunzipSync(fs.readFileSync(new URL('./golf-finish/ace-rotations.json.gz',import.meta.url))));
  const result=bakeGolfFinish(fs.readFileSync(values.input),curves);
  fs.writeFileSync(output,result,{flag:'wx'});
  console.log(JSON.stringify({output,bytes:result.length,sha256:createHash('sha256').update(result).digest('hex')}));
}
