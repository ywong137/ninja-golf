import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
const {values:v}=parseArgs({options:{base:{type:'string'},source:{type:'string'},grips:{type:'string'},output:{type:'string',default:'artifacts/reviews/closer-heavy'},help:{type:'boolean'}}});
if(v.help){console.log('node tools/assemble-closer-power.mjs --base BASE.glb --source BAKED.glb --grips grip-data.json [--output DIRECTORY]\nRead Closer_Heavy_Source from the baked model. Append the finishing cut and full musou sequence. Writes candidate/ and musou/ review files, never production assets. The base must not contain these two new clips.');process.exit(0);}
for(const key of ['base','source','grips'])if(!v[key])throw Error('Supply --'+key+'. See --help.');
const common=['--source',v.source,'--source-clip','Closer_Heavy_Source','--grips',v.grips,'--hero','sora','--speed','1.2','--slow-phase','2.45,2.70,.18'];
const power=path.join(v.output,'candidate/sora.glb'),musou=path.join(v.output,'musou/sora.glb');
const assemble=args=>execFileSync(process.execPath,[fileURLToPath(new URL('./assemble-source-attack.mjs',import.meta.url)),...common,...args],{stdio:'inherit'});
assemble(['--base',v.base,'--template','Sickle_Heavy_Cleave','--name','Closer_Power_Finish','--output',power,'--start',String(67/30),'--impact','2.625','--credit','Quaternius UAL2 Sword_Heavy_Combo: final cut and recovery (CC0)']);
assemble(['--base',power,'--template','Sickle_Musou_Flow','--name','Closer_Musou_Pursuit','--output',musou,...[.5,1.115,1.795,2.625].flatMap(t=>['--impact',String(t)]),'--credit','Quaternius UAL2 Sword_Heavy_Combo: full four-cut sequence (CC0)']);
const records={...JSON.parse(fs.readFileSync(power.replace('.glb','-motion.json'))),...JSON.parse(fs.readFileSync(musou.replace('.glb','-motion.json')))};
records.Closer_Power_Finish.entryBlend=.18;
records.Closer_Musou_Pursuit.entryBlend=.12;
records.Closer_Musou_Pursuit.headings=[0,0,0,0];
records.Closer_Musou_Pursuit.damageScale=1.5;
fs.writeFileSync(path.join(v.output,'power-motion.json'),JSON.stringify(records));
