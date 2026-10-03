import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';

const {values:v}=parseArgs({options:{source:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(v.help){console.log('node tools/build-ronin-musou.mjs --source LICENSED_MIXAMO.fbx --output REVIEW_DIRECTORY\nRebuild the Ronin musou from Mixamo Great Sword Combo Slash and the reviewed baseline. Creates three review GLBs and one motion record outside public/. Does not change the release assets.');process.exit(0);}
if(!v.source||!v.output)throw Error('Supply --source and --output. See --help.');
const source=path.resolve(v.source),output=path.resolve(v.output),root=fileURLToPath(new URL('../',import.meta.url));
if(!fs.existsSync(source)||!source.endsWith('.fbx'))throw Error('Supply the licensed Great Sword Combo Slash FBX.');
if(output.split(path.sep).includes('public'))throw Error('Choose a review directory outside public/.');
fs.mkdirSync(output,{recursive:true});
const baseline=path.join(output,'ronin-base.glb'),study=path.join(output,'ronin-study.glb'),candidate=path.join(output,'ronin.glb');
for(const p of [baseline,study,candidate])if(path.resolve(p)===source)throw Error('The source must remain separate from the outputs.');
fs.writeFileSync(baseline,execFileSync('git',['show','6a943af4ddbf0ac524eef0ca0de01b9676feed4b:public/models/ronin.glb'],{cwd:root,maxBuffer:32*1024*1024}));
const run=(tool,args)=>execFileSync(process.execPath,[path.join(root,'tools',tool),...args],{cwd:root,stdio:'inherit'});
const grips=path.join(root,'src/grip-data.json');
run('transfer-sword-study.mjs',['--input',baseline,'--source',source,'--output',study,'--grips',grips,'--hero','ronin','--clip','Ronin_Combo_Source','--template','Ronin_Driving_Cut','--paired-spacing','.17','--grounded','--joint-fit','--fit-pair-reach','--sample-rate','240','--stance-width','.12']);
run('assemble-source-attack.mjs',['--base',baseline,'--source',study,'--source-clip','Ronin_Combo_Source','--template','Ronin_Driving_Cut','--name','Ronin_Musou_Advance','--output',candidate,'--grips',grips,'--hero','ronin','--paired-spacing','.17','--grip-roll',String(219.75*Math.PI/180),'--speed','1.15','--impact','.9','--impact','1.7','--impact','2.575','--credit','Adobe Mixamo Great Sword Combo Slash; complete advancing two-handed sequence']);
const record=path.join(output,'ronin-motion.json'),data=JSON.parse(fs.readFileSync(record));
Object.assign(data.Ronin_Musou_Advance,{entryBlend:.18,headings:[.52,1.16,1.74],damageScale:2});
fs.writeFileSync(record,JSON.stringify(data)+'\n');
console.log(JSON.stringify({candidate,record,baseline:'6a943af',source}));
