import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';

const {values:v}=parseArgs({options:{source:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(v.help){console.log('node tools/build-ace-power.mjs --source LICENSED_MIXAMO.fbx --output REVIEW_DIRECTORY\nRebuild the Ace power attack from Mixamo Great Sword Power Slash and the reviewed baseline. Creates three review GLBs and one motion record outside public/. Does not change the release assets.');process.exit(0);}
if(!v.source||!v.output)throw Error('Supply --source and --output. See --help.');
const source=path.resolve(v.source),output=path.resolve(v.output),root=fileURLToPath(new URL('../',import.meta.url));
if(!fs.existsSync(source)||!source.endsWith('.fbx'))throw Error('Supply the licensed Great Sword Power Slash FBX.');
if(output.split(path.sep).includes('public'))throw Error('Choose a review directory outside public/.');
fs.mkdirSync(output,{recursive:true});
const baseline=path.join(output,'kaede-base.glb'),study=path.join(output,'kaede-study.glb'),candidate=path.join(output,'kaede.glb');
for(const p of [baseline,study,candidate])if(path.resolve(p)===source)throw Error('The source must remain separate from the outputs.');
fs.writeFileSync(baseline,execFileSync('git',['show','9fb02c47c6ae22f432830bf0e64f3543cc44a40a:public/models/kaede.glb'],{cwd:root,maxBuffer:32*1024*1024}));
const run=(tool,args)=>execFileSync(process.execPath,[path.join(root,'tools',tool),...args],{cwd:root,stdio:'inherit'});
const grips=path.join(root,'src/grip-data.json');
run('transfer-sword-study.mjs',['--input',baseline,'--source',source,'--output',study,'--grips',grips,'--hero','kaede','--clip','Ace_Power_Source','--template','Ace_Heavy_Cleave','--paired-spacing','.13','--grounded','--joint-fit','--fit-pair-reach','--paired-elbow-poles','0,16','--sample-rate','240','--stance-width','.15','--neutral-source','--overhead-lift','.075']);
run('assemble-source-attack.mjs',['--base',baseline,'--source',study,'--source-clip','Ace_Power_Source','--template','Ace_Heavy_Cleave','--name','Ace_Turning_Double_Cut','--output',candidate,'--grips',grips,'--hero','kaede','--paired-spacing','.13','--grip-roll',String(104*Math.PI/180),'--speed','1.3','--slow-phase','1.02,1.20,.10','--impact','.7','--impact','1.45','--credit','Adobe Mixamo Great Sword Power Slash; turning two-handed combination']);
const record=path.join(output,'kaede-motion.json'),data=JSON.parse(fs.readFileSync(record));
Object.assign(data.Ace_Turning_Double_Cut,{entryBlend:.16,damageScale:.5});
fs.writeFileSync(record,JSON.stringify(data)+'\n');
console.log(JSON.stringify({candidate,record,baseline:'9fb02c4',source}));
