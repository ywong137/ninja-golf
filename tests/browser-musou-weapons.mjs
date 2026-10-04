import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const base=process.env.NINJA_BASE_URL??'http://localhost:5174';
const output='artifacts/reviews/musou-weapons';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(base);await page.waitForFunction(()=>window.__golfTest);await preloadWarriorFixtures(page);
 await page.evaluate(()=>{const g=window.__golfTest;g.audio.pause();g.audio.enabled=false;g.frame=()=>{};});
 const rows=[];
 for(let hero=0;hero<6;hero++){
  const result=await page.evaluate(hero=>{
   const g=window.__golfTest;g.clearEnemies();g.selectWarrior(hero);g.mode='game';g.phase='combat';g.paused=false;g.resolve=100;
   g.ui.showScreen('game');g.player.update(g.time,1/60,{});g.attack('musou');
   const row={hero,introFrames:0,attackFrames:0,recoveryFrames:0,hidden:[],detached:[]};
   const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
   const inspect=stage=>{
    row[stage+'Frames']++;
    for(const [hand,weapon]of [['right',g.player.weapon],['left',g.player.offhand]])if(weapon){
     if(!visible(weapon)&&row.hidden.length<8)row.hidden.push({stage,hand,time:g.time,clip:g.player.current});
     let attached=false;for(let p=weapon;p;p=p.parent)if(p===g.player.root)attached=true;
     if(!attached)row.detached.push({stage,hand});
    }
   };
   for(let i=0;i<900;i++){
    const stage=g.cinematic>0?'intro':g.action?.kind==='musou'?'attack':'recovery';
    g.time+=1/60;g.updateCombat(1/60);inspect(stage);
    if(row.recoveryFrames>=30)break;
   }
   return row;
  },hero);
  rows.push(result);
 }
 fs.writeFileSync(output+'/report.json',JSON.stringify({base,errors,rows},null,2));
 assert.deepEqual(errors,[]);
 for(const row of rows){
  assert.ok(row.introFrames>120&&row.attackFrames>120&&row.recoveryFrames===30,JSON.stringify(row));
  assert.deepEqual(row.hidden,[],`Hero ${row.hero}: weapon disappears during musou: ${JSON.stringify(row.hidden)}`);
  assert.deepEqual(row.detached,[],`Hero ${row.hero}: weapon detached from actor`);
 }
 console.log(JSON.stringify({heroes:rows.length,frames:rows.reduce((s,r)=>s+r.introFrames+r.attackFrames+r.recoveryFrames,0),errors}));
}finally{await browser.close();}
