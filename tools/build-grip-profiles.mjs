import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]||path.join(root,'artifacts/grip-fit'));
const models=['ronin','shinobi','monk','kaede','ayame','sora'];
const result={};
for(const [index,model]of models.entries()){
 result[model]={};
 for(const profile of ['sword','golf']){
  result[model][profile]={};
  for(const side of ['r','l']){
   const file=path.join(output,`${model}-${side}-${profile}.json`);
   const radius=profile==='golf'?.012:index<3?.016:.014;
   const run=spawnSync(process.execPath,[path.join(root,'tools/solve-grip.mjs'),model,side,String(radius),file,profile],{stdio:'inherit'});
   if(run.status!==0)process.exit(run.status||1);
   const data=JSON.parse(fs.readFileSync(file,'utf8'));
   const {center,axis,rotations}=data;
   result[model][profile][side]={radius,center,axis,rotations};
  }
 }
}
fs.writeFileSync(path.join(root,'src/grip-data.json'),JSON.stringify(result)+'\n');
