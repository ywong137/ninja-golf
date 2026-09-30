// Rebuild the reviewed arm release without changing the club or body path.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';

const heroes=['kaede'];
const names=['upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export function bakeGolfRelease(input,curves){
 if(curves.schema!==1||!heroes.includes(curves.hero)||curves.clip!=='Golf_Swing')
  throw Error('Use the reviewed golf-release curves for the Ace.');
 if(sha(input)!==curves.sourceSha256)
  throw Error(`Source model changed. Use ${curves.hero}.glb from ${curves.sourceCommit}.`);
 if(Object.keys(curves.rotations??{}).length!==names.length||names.some(n=>!curves.rotations[n])||
    curves.translations||!Array.isArray(curves.times)||Math.abs(curves.times.at(-1)-2.4)>1e-6)
  throw Error('The release requires six arm rotation channels over the complete Golf_Swing.');
 const output=patchAnimationTransforms(input,[{clip:curves.clip,times:curves.times,rotations:curves.rotations}]);
 if(!curves.outputSha256||sha(output)!==curves.outputSha256)
  throw Error('The rebuilt model differs from the reviewed output.');
 return output;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{hero:{type:'string'},input:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
 if(values.help){
  console.log('node tools/bake-golf-release.mjs --hero kaede --input SOURCE.glb --output NEW.glb\nUses source commit 6fb8995. Writes a new, hash-verified candidate outside public/.');
  process.exit(0);
 }
 if(!heroes.includes(values.hero)||!values.input||!values.output?.endsWith('.glb'))
  throw Error('Supply --hero, --input, and --output. See --help.');
 const output=path.resolve(values.output),parent=fs.realpathSync(path.dirname(output)),publicPath=fs.realpathSync(new URL('../public/',import.meta.url));
 if(parent===publicPath||parent.startsWith(publicPath+path.sep)||fs.existsSync(output))
  throw Error('Write a new candidate outside public/.');
 const curves=JSON.parse(gunzipSync(fs.readFileSync(new URL(`./golf-release/${values.hero}.json.gz`,import.meta.url))));
 const result=bakeGolfRelease(fs.readFileSync(values.input),curves);
 fs.writeFileSync(output,result,{flag:'wx'});
 console.log(JSON.stringify({output,bytes:result.length,sha256:sha(result)}));
}
