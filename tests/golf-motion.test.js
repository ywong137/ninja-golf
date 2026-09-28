import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeGolfPhase,GOLF_CONTACT,GOLF_LENGTH,GOLF_GRIP_SPACING} from '../tools/golf-motion-profile.mjs';
const json=readFileSync(new URL('../src/motion-data.json',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/motion.js',import.meta.url),'utf8')
 .replace("import motions from './motion-data.json';",'const motions='+json+';')
 .replace("import selectionMotions from './selection-data.json';",'const selectionMotions={};');
const {motions,sampleMotion}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('golf keeps one club length between animation samples',()=>{
 for(const name of ['Golf_Address','Golf_Swing','Golf_Putt']){
  const clip=motions[name];assert.equal(clip.gripSpacing,GOLF_GRIP_SPACING);
  for(let i=0;i<=1000;i++){
   const p=sampleMotion(name,clip.duration*i/1000);
   assert.ok(Math.abs(Math.hypot(...p.tip.map((v,k)=>v-p.grip[k]))-GOLF_LENGTH)<1e-10,name);
  }
 }
});
test('native swing retains exact ball contact and hip-first transition',()=>{
 const impact=sampleMotion('Golf_Swing',1.4);
 for(let i=0;i<3;i++)assert.ok(Math.abs(impact.tip[i]-GOLF_CONTACT[i])<1e-9);
 const top=nativeGolfPhase('Golf_Swing',.435).body,transition=nativeGolfPhase('Golf_Swing',1.15/2.4).body;
 assert.ok(top.chest>.9&&top.hip>.5,'Backswing turns toward the hands.');
 assert.ok(top.hip-transition.hip>top.chest-transition.chest,'Pelvis reverses before shoulders.');
 const finish=nativeGolfPhase('Golf_Swing',1).body;
 assert.ok(finish.x<-.10&&finish.heel>.9&&finish.chest< -1.7,'Finish loads the lead foot and releases the trail heel.');
});

test('the club rises over the hands after impact',()=>{
 const samples=[1.56,1.62,1.66,1.70].map(t=>sampleMotion('Golf_Swing',t));
 for(let i=1;i<samples.length;i++)assert.ok(samples[i].tip[2]>samples[i-1].tip[2],'Release took a downward shortcut.');
 assert.ok(samples.at(-1).tip[2]-samples.at(-1).grip[2]>.9,'Club never passed above the hands.');
});
