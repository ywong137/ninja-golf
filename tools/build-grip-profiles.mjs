import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {values,positionals}=parseArgs({allowPositionals:true,options:{profile:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/build-grip-profiles.mjs [OUTPUT_DIR] [--profile sword|golf]\nFit both hands for all six heroes. --profile preserves the other existing profile.');process.exit(0);}
if(positionals.length>1||values.profile&&!['sword','golf'].includes(values.profile))throw Error('See --help for valid grip profile arguments.');
const output=path.resolve(positionals[0]||path.join(root,'artifacts/grip-fit'));
const models=['ronin','shinobi','monk','kaede','ayame','sora'];
const previous=JSON.parse(fs.readFileSync(path.join(root,'src/grip-data.json')));
const result=values.profile?structuredClone(previous):{};
for(const [index,model]of models.entries()){
 result[model]??={};
 for(const profile of values.profile?[values.profile]:['sword','golf']){
  result[model][profile]={};
  for(const side of ['r','l']){
   const file=path.join(output,`${model}-${side}-${profile}.json`);
   const radius=profile==='golf'?.012:index<3?.016:.014;
   const run=spawnSync(process.execPath,[path.join(root,'tools/solve-grip.mjs'),model,side,String(radius),file,profile],{stdio:'inherit'});
   if(run.status!==0)process.exit(run.status||1);
   const data=JSON.parse(fs.readFileSync(file,'utf8'));
   const {center,axis,rotations}=data;
   result[model][profile][side]={radius,center,axis,rotations};
   // Refit the cylinder without discarding a reviewed blade or club orientation.
   const frame=previous[model]?.[profile]?.[side]?.frame;
   if(frame)result[model][profile][side].frame=frame;
  }
 }
}
fs.writeFileSync(path.join(root,'src/grip-data.json'),JSON.stringify(result)+'\n');
