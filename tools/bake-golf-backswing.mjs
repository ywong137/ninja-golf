// Rebuild the reviewed backswing from the exact published source model.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';

const heroes=['ronin','shinobi','monk','kaede','ayame','sora'];
const names=['clavicle_r','clavicle_l','upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function bakeGolfBackswing(input,curves){
 if(curves.schema!==1||!heroes.includes(curves.hero)||curves.clip!=='Golf_Swing')
  throw Error('Use the reviewed golf backswing curves for a playable hero.');
 if(hash(input)!==curves.sourceSha256)
  throw Error(`Source model changed. Use ${curves.hero}.glb from ${curves.sourceCommit}, or review a new fit.`);
 if(names.length!==Object.keys(curves.rotations??{}).length||names.some(n=>!curves.rotations[n])||
    !Array.isArray(curves.times)||Math.abs(curves.times.at(-1)-2.4)>1e-6||curves.translations)
  throw Error('The backswing must contain the eight reviewed rotation channels and span Golf_Swing.');
 const result=patchAnimationTransforms(input,[{clip:curves.clip,times:curves.times,rotations:curves.rotations,extras:{nativeGolfBackswing:1}}]);
 if(!curves.outputSha256||hash(result)!==curves.outputSha256)
  throw Error('The rebuilt model differs from the reviewed output.');
 return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},hero:{type:'string'},help:{type:'boolean'}}});
 if(values.help){
  console.log('node tools/bake-golf-backswing.mjs --hero ronin|shinobi|monk|kaede|ayame|sora --input SOURCE.glb --output CANDIDATE.glb\nUses source ce08de7. Writes a new, hash-verified candidate outside public/.');
  process.exit(0);
 }
 if(!values.input||!values.output?.endsWith('.glb')||!heroes.includes(values.hero))throw Error('Supply --hero, --input, and --output. See --help.');
 const output=path.resolve(values.output),parent=fs.realpathSync(path.dirname(output)),publicPath=fs.realpathSync(new URL('../public/',import.meta.url));
 if(parent===publicPath||parent.startsWith(publicPath+path.sep)||fs.existsSync(output))throw Error('Write a new candidate outside public/.');
 const curves=JSON.parse(gunzipSync(fs.readFileSync(new URL('./golf-backswing/'+values.hero+'.json.gz',import.meta.url))));
 const result=bakeGolfBackswing(fs.readFileSync(values.input),curves);
 fs.writeFileSync(output,result,{flag:'wx'});
 console.log(JSON.stringify({output,bytes:result.length,sha256:hash(result)}));
}
