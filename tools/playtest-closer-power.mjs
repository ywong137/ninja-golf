import {preloadWarriorFixtures} from './preload-warrior-fixtures.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
const output=path.resolve('artifacts/reviews/closer-heavy/gameplay');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto('http://localhost:5174');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 const report=await page.evaluate(async()=>{
  const {createPlayerGuard}=await import('/src/combat.js'),g=window.__golfTest;
  g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(5,0);g.audio.pause();
  const originalSlide=g.slideOnLand.bind(g),originalHeight=g.groundHeight,originalClear=g.world.collision.segmentClear.bind(g.world.collision);
  const reset=terrain=>{
   g.clearEnemies();g.effects.clear();g.selectWarrior(5);g.phase='combat';g.mode='game';g.spawnTime=999;g.time+=10;g.combatTime=0;g.paused=false;g.hitStop=0;
   g.groundHeight=terrain?originalHeight:()=>0;g.slideOnLand=terrain?originalSlide:p=>{p.y=0;};g.world.collision.segmentClear=terrain?originalClear:()=>true;
   g.player.root.position.set(0,0,45);g.player.root.rotation.set(0,0,0);g.ball.position.set(0,0,190);g.input.clear();g.input.setContext('combat');g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;g.resolve=100;g.playerVelocity={x:0,z:0};g.cameraYaw=0;g.enemiesSpawned=0;g.enemyBudget=1000;for(const site of g.world.ambushSites)site.readyAt=0;
  };
  window.powerReset=reset;
  const strike=g.strike.bind(g),explosion=g.effects.explosion.bind(g.effects);let hits=[],blasts=0;
  g.effects.explosion=(p,scale)=>{if(scale===2)blasts++;return explosion(p,scale);};
  g.strike=a=>{
   const targets=g.enemies.slice(0,2);for(const [i,e]of targets.entries()){e.root.position.copy(g.player.root.position);e.root.position.z+=i?-3:3;e.hp=100000;e.dead=0;e.emerging=0;e.type=0;}
   strike(a);hits.push({kind:a.kind,name:a.motionName,time:a.time,planned:a.hits[a.hitIndex],index:a.hitIndex,damage:targets.map(e=>100000-e.hp)});
  };
  const rows=[];
  for(const rate of [40,60,144])for(const mode of ['heavy','queued-light','moving','dodge','musou']){
   reset(false);g.spawnWave(8);if(g.enemies.length<2)throw Error('Expected two real enemy actors for damage tests.');g.spawnTime=999;
   for(const e of g.enemies){e.readyAt=1e9;e.cooldown=999;e.stun=999;e.emerging=0;}
   hits=[];blasts=0;const row={rate,mode,hidden:0,finite:true,clips:[],steps:[]},tick=()=>{
    g.time+=1/rate;g.updateCombat(1/rate);g.effects.update(1/rate);g.input.end();
    if(g.action&&row.clips.at(-1)!==g.action.motionName)row.clips.push(g.action.motionName);
    if(g.action||g.cinematic>0)for(let o=g.player.weapon;o;o=o.parent)if(!o.visible)row.hidden++;
    for(const b of Object.values(g.player.bones))if(![...b.position,...b.quaternion].every(Number.isFinite))row.finite=false;
   };
   for(let i=0;i<rate/2;i++)tick();if(mode==='moving'){g.input.keys.add('KeyW');for(let i=0;i<rate;i++)tick();}
   g.attack(mode==='musou'?'musou':'heavy');let queued=false;
   for(let i=0;i<9*rate;i++){
    if(!queued&&g.action?.time>.7){if(mode==='queued-light')g.attack('light');if(mode==='dodge')g.input.pressed.add('Dodge');queued=true;}
    tick();
   }
   Object.assign(row,{hits,blasts,remaining:!!(g.action||g.attackBuffer||g.cinematic>0),running:g.player.running});rows.push(row);
  }
  g.strike=strike;g.effects.explosion=explosion;reset(true);return {rows};
 });
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({...report,errors},null,2));
 for(const r of report.rows){
  assert.ok(r.finite&&!r.hidden&&!r.remaining,JSON.stringify(r));
  assert.equal(r.hits.length,r.mode==='musou'?4:r.mode==='queued-light'?2:1,JSON.stringify(r));
  for(const h of r.hits){assert.ok(h.time>=h.planned&&h.time-h.planned<=1/r.rate+1e-6);assert.ok(h.damage[0]>0);assert.equal(h.damage[1]>0,r.mode==='musou'&&h.index===3,JSON.stringify(h));}
  assert.equal(r.blasts,r.mode==='musou'?1:0);if(r.mode==='moving')assert.ok(r.running);
 }
 if(process.argv.includes('--record')){
  const encoded=await page.evaluate(async()=>{
   const g=window.__golfTest;window.powerReset(true);g.cameraYaw=.8;g.cameraPitch=.18;g.audio.enabled=false;g.audio.pause();
   const canvas=g.renderer.domElement,chunks=[],stream=canvas.captureStream(60),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:5000000});
   const done=new Promise(r=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=r;});const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const complete=async()=>{const start=performance.now();await wait(100);while(g.action||g.cinematic>0){if(performance.now()-start>45000)throw Error('Recorded attack did not finish.');await wait(50);}await wait(500);};
   g.previousTime=performance.now();g.renderer.setAnimationLoop(()=>g.frame());await wait(600);recorder.start();g.attack('heavy');await complete();g.cameraYaw=-.9;g.attack('heavy');await complete();g.cameraYaw=.6;g.resolve=100;g.attack('musou');await complete();recorder.stop();await done;g.renderer.setAnimationLoop(null);stream.getTracks().forEach(t=>t.stop());
   const data=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);
  });fs.writeFileSync(path.join(output,'closer-power.webm'),Buffer.from(encoded,'base64'));
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:report.rows.length,errors}));
}finally{await browser.close();}
