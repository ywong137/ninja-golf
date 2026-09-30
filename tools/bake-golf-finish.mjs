// Rebuild the reviewed finish without retaining intermediate candidate payloads.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';

export function bakeGolfFinish(input,curves){
  if(curves.schema!==1||!['ronin','shinobi','monk','kaede','ayame','sora'].includes(curves.hero)||curves.clip!=='Golf_Swing')
    throw Error('Use the reviewed golf finish curves for a playable hero.');
  if(createHash('sha256').update(input).digest('hex')!==curves.sourceSha256)
    throw Error(`Source model changed. Use ${curves.hero}.glb from ${curves.sourceCommit}, or review a new fit.`);
  const names=['spine_02','spine_03','Head','clavicle_r','clavicle_l','upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'];
  if(names.length!==Object.keys(curves.rotations??{}).length||names.some(n=>!curves.rotations[n])||!Array.isArray(curves.times)||Math.abs(curves.times.at(-1)-2.4)>1e-6)
    throw Error('The finish must contain the eleven reviewed rotation channels and span Golf_Swing.');
  const result=patchAnimationTransforms(input,[curves]);
  if(curves.outputSha256&&createHash('sha256').update(result).digest('hex')!==curves.outputSha256)
    throw Error('The rebuilt model differs from the reviewed output.');
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},hero:{type:'string',default:'kaede'},help:{type:'boolean'}}});
  if(values.help){
    console.log('node tools/bake-golf-finish.mjs --hero ronin|shinobi|monk|kaede|ayame|sora --input SOURCE.glb --output CANDIDATE.glb\nRebuilds the reviewed finish. The Ace uses source 6e7150a; other heroes use 9d04ee3. Writes a new candidate outside public/.');
    process.exit(0);
  }
  if(!values.input||!values.output?.endsWith('.glb'))throw Error('Supply --input and --output. See --help.');
  const output=path.resolve(values.output),parent=fs.realpathSync(path.dirname(output));
  const publicPath=fs.realpathSync(new URL('../public/',import.meta.url));
  if(parent===publicPath||parent.startsWith(publicPath+path.sep)||fs.existsSync(output))
    throw Error('Write a new candidate outside public/.');
  if(!['ronin','shinobi','monk','kaede','ayame','sora'].includes(values.hero))throw Error('Choose a playable --hero. See --help.');
  const curveName=values.hero==='kaede'?'ace-rotations':values.hero+'-rotations';
  const curves=JSON.parse(gunzipSync(fs.readFileSync(new URL('./golf-finish/'+curveName+'.json.gz',import.meta.url))));
  const result=bakeGolfFinish(fs.readFileSync(values.input),curves);
  fs.writeFileSync(output,result,{flag:'wx'});
  console.log(JSON.stringify({output,bytes:result.length,sha256:createHash('sha256').update(result).digest('hex')}));
}
