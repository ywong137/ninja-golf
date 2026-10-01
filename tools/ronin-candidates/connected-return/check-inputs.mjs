import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {routeFixedGripCandidate} from '../../../tools/ronin-candidates/fixed-grip/route.mjs';
import {disableHmr} from '../../../tools/disable-hmr.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/connected-return/check-inputs.mjs --candidate DIRECTORY\nChecks queued, boundary, late, replacement, single-attack, and dodge input at 45, 60, and 144 Hz. Requires Vite on localhost:5173. Uses a headless, muted browser.');process.exit(0);}
if(!values.candidate)throw Error('Supply --candidate. See --help.');
const first=JSON.parse(fs.readFileSync(path.join(values.candidate,'diagonal.json'))).Ronin_Cut_Diagonal;
const branchTime=first.continuations.light.at/first.duration*(first.combatDuration??.4);
const interruptTime=first.impacts[0]/first.duration*(first.combatDuration??.4)+.011;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:400,height:300}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await routeFixedGripCandidate(page,values.candidate,{withDiagonal:true,withReturn:true});
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const rows=await page.evaluate(async({branchTime,interruptTime})=>{
  const{createPlayerGuard}=await import('/src/combat.js');const g=window.__golfTest;g.frame=()=>{};g.paused=true;g.audio.enabled=false;g.audio.pause();const rows=[];
  for(const rate of [45,60,144])for(const mode of ['none','early','edge','late','heavy','replace','dodge']){
   g.clearEnemies();g.selectWarrior(0);g.phase='combat';g.spawnTime=999;g.time+=10;g.groundHeight=()=>0;g.slideOnLand=p=>{p.y=0;};g.player.root.position.set(0,0,45);g.ball.position.set(0,0,190);g.input.clear();g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;
   const actor=g.player;actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';actor.play('Ronin_Ready',0);actor.mixer.update(0);actor.syncHeldObjects();
   const row={rate,mode,clips:[],hits:[],branchTimes:[]},strike=g.strike;g.strike=a=>{row.hits.push({step:a.step,kind:a.kind,time:a.time});};
   const tick=()=>{g.time+=1/rate;g.updateCombat(1/rate);g.input.end();if(row.clips.at(-1)!==actor.current)row.clips.push(actor.current);if(g.action?.motionName==='Ronin_Cut_Return_Connected'&&row.branchTimes.length===0)row.branchTimes.push(g.action.time);};
   for(let i=0;i<rate/2;i++)tick();row.clips=[];g.paused=false;g.attack('light');const start=g.time;let sent=false,replaced=false;
   for(let i=0;i<2*rate;i++){
    const elapsed=g.time-start;
    if(!sent){
     if(['early','heavy','replace','dodge'].includes(mode)&&elapsed>=.1){g.attack(mode==='heavy'?'heavy':'light');sent=true;}
     else if(mode==='late'&&elapsed>=branchTime+.064){g.attack('light');sent=true;}
     else if(mode==='edge'&&g.action?.time<=branchTime&&g.action.time+1/rate>=branchTime){g.input.pressed.add('LightAttack');sent=true;}
    }
    if(!replaced&&elapsed>=interruptTime&&['replace','dodge'].includes(mode)){if(mode==='replace')g.attack('heavy');else g.input.pressed.add('Dodge');replaced=true;}
    tick();
   }
   row.remaining=!!(g.action||g.attackBuffer);rows.push(row);g.strike=strike;
  }
  g.paused=true;g.audio.pause();return rows;
 },{branchTime,interruptTime});
 fs.writeFileSync(path.join(values.candidate,'input-check.json'),JSON.stringify({rows,errors},null,2));
 for(const row of rows){
  assert.equal(row.remaining,false,JSON.stringify(row));
  const connected=['early','edge'].includes(row.mode);
  assert.equal(row.clips.includes('Ronin_Cut_Return_Connected'),connected,JSON.stringify(row));
  if(connected)assert.deepEqual(row.clips,['Ronin_Cut_Diagonal','Ronin_Cut_Return_Connected','Ronin_Ready']);
  if(row.mode==='none')assert.deepEqual(row.clips,['Ronin_Cut_Diagonal','Ronin_Ready']);
  if(row.mode==='late')assert.deepEqual(row.clips,['Ronin_Cut_Diagonal','Ronin_Cut_Return','Ronin_Ready']);
  if(['heavy','replace'].includes(row.mode))assert.deepEqual(row.clips,['Ronin_Cut_Diagonal','Ronin_Heavy_Cleave','Ronin_Ready']);
  if(row.mode==='dodge')assert.ok(row.clips.includes('Roll'));
  assert.equal(row.hits.length,['none','dodge'].includes(row.mode)?1:2,JSON.stringify(row));
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:rows.length,errors}));
}finally{await browser.close();}
