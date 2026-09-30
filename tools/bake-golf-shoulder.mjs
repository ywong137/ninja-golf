// Rebuild the reviewed paired-grip shoulder correction without changing the mesh.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';

const names=['r','l'].flatMap(side=>['clavicle','upperarm','lowerarm','hand'].map(part=>part+'_'+side));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function bakeGolfShoulder(input,curves){
 if(curves.schema!==1||curves.hero!=='kaede'||curves.clip!=='Golf_Swing')
  throw Error('Use the reviewed shoulder curves for the Ace.');
 if(sha(input)!==curves.sourceSha256)
  throw Error(`Source model changed. Use kaede.glb from ${curves.sourceCommit}.`);
 if(Object.keys(curves.rotations??{}).length!==names.length||names.some(n=>!curves.rotations[n])||
    curves.translations||!Array.isArray(curves.times)||Math.abs(curves.times.at(-1)-2.4)>1e-6||
    curves.extras?.golfShoulderRelease?.version!==1)
  throw Error('The correction requires eight arm rotations over the complete Golf_Swing.');
 const output=patchAnimationTransforms(input,[curves]);
 if(!curves.outputSha256||sha(output)!==curves.outputSha256)
  throw Error('The rebuilt model differs from the reviewed output.');
 return output;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
 if(values.help){
  console.log('node tools/bake-golf-shoulder.mjs --input SOURCE.glb --output NEW.glb\nUses kaede.glb from 2c65f92. Writes a new, hash-verified candidate outside public/.');
  process.exit(0);
 }
 if(!values.input||!values.output?.endsWith('.glb'))throw Error('Supply --input and --output. See --help.');
 const output=path.resolve(values.output),parent=fs.realpathSync(path.dirname(output)),publicPath=fs.realpathSync(new URL('../public/',import.meta.url));
 if(parent===publicPath||parent.startsWith(publicPath+path.sep)||fs.existsSync(output))throw Error('Write a new candidate outside public/.');
 const curves=JSON.parse(gunzipSync(fs.readFileSync(new URL('./golf-shoulder/kaede.json.gz',import.meta.url))));
 const result=bakeGolfShoulder(fs.readFileSync(values.input),curves);
 fs.writeFileSync(output,result,{flag:'wx'});
 console.log(JSON.stringify({output,bytes:result.length,sha256:sha(result)}));
}
