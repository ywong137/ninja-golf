import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

// Start from a real golf shot, with the golfer still facing across the line.
// Rig-only tests that started from a forward ready pose missed this regression.
const output=process.env.NINJA_REVIEW_OUTPUT??'artifacts/reviews/run-after-golf';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(process.env.NINJA_BASE_URL??process.env.GAME_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const rows=await page.evaluate(async()=>{
  const {WARRIORS}=await import('/src/warriors.js');
  const g=window.__golfTest,rows=[];g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();
  const render=g.rendering.render;g.rendering.render=()=>{}; // Keep the real game update and input path; skip GPU work.
  let pad=null;const getPads=navigator.getGamepads.bind(navigator);Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pad?[pad]:[]});
  const makePad=()=>({axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))});
  try{
   for(let hero=0;hero<6;hero++)for(const hz of [40,60,144])for(const amount of [.2,.5,1]){
    pad=null;g.begin(hero,0);g.audio.pause();g.input.clear();g.paused=false;
    const tick=()=>{g.previousTime=performance.now()-1000/hz;g.frame();};
    for(let i=0;i<hz/3;i++)tick();g.swing();g.power=.65;g.swing();
    for(let i=0;i<30*hz&&g.phase!=='combat'&&g.phase!=='holed';i++)tick();
    if(g.phase!=='combat')throw Error('Test drive did not enter combat: '+WARRIORS[hero].name+' '+g.phase);
    // Retain the production golfer/camera poses and terrain. Remove enemies
    // only after landing, so damage cannot interrupt the gait under inspection.
    for(const e of g.enemies)g.scene.remove(e.root);g.enemies=[];g.spawnTime=999;g.invincible=999;
    const row={hero,name:WARRIORS[hero].name,hz,amount,initialClip:g.player.current,clips:[],samples:0,legacy:0,maxStepsPerSecond:0,firstRun:null,dodges:0,focusReleaseSamples:0,finite:true};
    if(amount<1){pad=makePad();pad.axes[1]=-amount;}else g.input.keys.add('KeyW');
    for(let i=0;i<5*hz;i++){
     const t=i/hz,focused=t>=3&&t<3.6;
     if(t>=.5&&t<2.5)g.input.lookX=.14*Math.sin(t*4); // Continuous small camera corrections must not restore short steps.
     if(t>=1.5&&t<2.5)g.input.keys.add('ShiftLeft');else g.input.keys.delete('ShiftLeft');
     if(focused){g.input.keys.add('KeyC');g.input.keys.add('KeyD');}else{g.input.keys.delete('KeyC');g.input.keys.delete('KeyD');}
     tick();const p=g.player;
     if(row.clips.at(-1)!==p.current)row.clips.push(p.current);
     if(p.current==='Roll'||g.dodgeTimer>0)row.dodges++;
     if(!focused&&p.running){
      row.samples++;row.firstRun??=t;if(t>=3.6)row.focusReleaseSamples++;
      if(!p.sourceRun||!['Run_Forward','Sprint_Forward'].includes(p.current))row.legacy++;
      if(p.sourceRun)row.maxStepsPerSecond=Math.max(row.maxStepsPerSecond,2*p.sourceRun.phaseRate);
     }
     for(const b of Object.values(p.bones))if(![...b.position,...b.quaternion].every(Number.isFinite))row.finite=false;
    }rows.push(row);
   }
  }finally{g.rendering.render=render;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:getPads});g.audio.pause();}
  return rows;
 });
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'controller.json'),JSON.stringify({errors,rows},null,2));
 assert.deepEqual(errors,[]);assert.equal(rows.length,54);
 for(const r of rows){
  assert.ok(r.initialClip.startsWith('Golf_'),JSON.stringify(r));assert.ok(r.samples>r.hz*2.5,JSON.stringify(r));
  assert.equal(r.legacy,0,JSON.stringify(r));assert.equal(r.dodges,0,JSON.stringify(r));assert.ok(r.finite,JSON.stringify(r));
  assert.ok(r.firstRun<.1&&r.focusReleaseSamples>r.hz*.5,JSON.stringify(r));assert.ok(r.maxStepsPerSecond<4,JSON.stringify(r));
 }
 console.log(JSON.stringify({cases:rows.length,heroes:6,rates:[40,60,144],analogSpeeds:[.2,.5,1],legacyFreeRunFrames:rows.reduce((n,r)=>n+r.legacy,0),maxStepsPerSecond:Math.max(...rows.map(r=>r.maxStepsPerSecond)),errors}));
}finally{await browser.close();}
