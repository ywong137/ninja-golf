import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';

const {values}=parseArgs({options:{output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/bake-showcase-bounds.mjs --output FILE.json\nRequires a local Vite server; GAME_URL defaults to http://localhost:5173. Run from that server’s checkout so model hashes match. Measures complete visible preview geometry at 60 Hz. Audio stays muted.');process.exit(0);}
if(!values.output)throw Error('Specify --output FILE.json. See --help.');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
  const page=await browser.newPage();await disableHmr(page);
  await page.goto((process.env.GAME_URL??'http://localhost:5173').replace(/\/$/,'')+'/tests/rig-stage.html');
  const heroes=await page.evaluate(async()=>{
    const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
    const {WARRIORS}=await import('/src/warriors.js');
    const {measureShowcaseBounds}=await import('/tools/showcase-bound-sampling.mjs');
    await loadWarriorAssets();const result={};
    for(let i=0;i<WARRIORS.length;i++){
      const actor=new Warrior(i);actor.root.scale.setScalar(2);actor.root.rotation.y=.25;actor.setGolfClub('DR');
      try{result[WARRIORS[i].model]=measureShowcaseBounds(actor);}finally{actor.dispose();}
    }
    return result;
  });
  for(const [name,record]of Object.entries(heroes))record.modelSha256=createHash('sha256').update(fs.readFileSync(path.join('public/models',name+'.glb'))).digest('hex');
  fs.writeFileSync(values.output,JSON.stringify({version:1,padding:.08,heroes},null,2)+'\n');
  console.log(JSON.stringify({output:values.output,heroes}));
}finally{await browser.close();}
