// Rebuild the reviewed grasp and its matching native arm curves as one asset set.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {parseArgs} from 'node:util';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function bakeAceGolfGrasp(model,grips,record){
  if(record.schema!==1||record.hero!=='kaede')throw Error('Use the reviewed Ace grasp record.');
  if(hash(model)!==record.sourceModelSha256||hash(grips)!==record.sourceGripsSha256)
    throw Error(`Source assets changed. Use the model and grip data from ${record.sourceCommit}, or review a new fit.`);
  const clips=['Golf_Address','Golf_Swing','Golf_Putt'];
  const bones=['clavicle_r','upperarm_r','lowerarm_r','hand_r','clavicle_l','upperarm_l','lowerarm_l','hand_l'];
  if(record.motions?.length!==clips.length||record.motions.some((motion,i)=>motion.clip!==clips[i]||Object.keys(motion.rotations??{}).length!==bones.length||bones.some(name=>!motion.rotations[name])))
    throw Error('The grasp needs the eight reviewed arm channels in all three golf clips.');
  const profiles=JSON.parse(grips);profiles.kaede.golf=record.grip;
  const output={model:patchAnimationTransforms(model,record.motions),grips:JSON.stringify(profiles)+'\n'};
  if(hash(output.model)!==record.outputModelSha256||hash(output.grips)!==record.outputGripsSha256)
    throw Error('Rebuilt assets differ from the reviewed hashes.');
  return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {values}=parseArgs({options:{'model-source':{type:'string'},'grip-source':{type:'string'},'output-dir':{type:'string'},help:{type:'boolean'}}});
  if(values.help){console.log('node tools/bake-ace-golf-grasp.mjs --model-source SOURCE.glb --grip-source GRIPS.json --output-dir NEW_DIRECTORY\nRebuilds the reviewed Ace grasp from d3ea945. Writes kaede.glb and grip-data.json together. Requires a new directory outside public/ and src/.');process.exit(0);}
  if(!values['model-source']||!values['grip-source']||!values['output-dir'])throw Error('Supply both source files and a new output directory. See --help.');
  const output=path.resolve(values['output-dir']);if(fs.existsSync(output))throw Error('The output directory already exists. Choose a new directory.');
  const parent=fs.realpathSync(path.dirname(output));
  for(const dir of ['public','src']){const protectedPath=fs.realpathSync(new URL('../'+dir,import.meta.url));if(parent===protectedPath||parent.startsWith(protectedPath+path.sep))throw Error('Write a candidate outside public/ and src/.');}
  const record=JSON.parse(gunzipSync(fs.readFileSync(new URL('./golf-grasp/ace.json.gz',import.meta.url))));
  const result=bakeAceGolfGrasp(fs.readFileSync(values['model-source']),fs.readFileSync(values['grip-source']),record);
  fs.mkdirSync(output);fs.writeFileSync(path.join(output,'kaede.glb'),result.model,{flag:'wx'});fs.writeFileSync(path.join(output,'grip-data.json'),result.grips,{flag:'wx'});
  console.log(JSON.stringify({output,modelSha256:hash(result.model),gripsSha256:hash(result.grips)}));
}
