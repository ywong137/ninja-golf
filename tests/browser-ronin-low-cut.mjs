import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {parseArgs} from 'node:util';
import {disableHmr} from '../tools/disable-hmr.mjs';
const {values}=parseArgs({options:{url:{type:'string',default:process.env.BASE_URL??'http://localhost:5174'},output:{type:'string',default:'artifacts/reviews/ronin-low-cut/gameplay'},record:{type:'boolean'},help:{type:'boolean'}}});
if(values.help){console.log('node tests/browser-ronin-low-cut.mjs [--url DEV_URL] [--output DIRECTORY] [--record]\nTest the shipped Ronin returning cut through the real combat controller. Cover six entry/queue states at 40, 60, and 144 Hz. Audio stays muted. Optional recording captures only the canvas.');process.exit(0);}
const url=new URL(values.url);
if(!['http:','https:'].includes(url.protocol))throw Error('--url must identify a running Vite development server over HTTP or HTTPS.');
const output=path.resolve(values.output);fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(url.href);await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{motions}=await import('/src/motion.js'),{createPlayerGuard}=await import('/src/combat.js');
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(0,0);g.audio.pause();
  const slide=g.slideOnLand.bind(g),height=g.groundHeight,clear=g.world.collision.segmentClear.bind(g.world.collision),strike=g.strike.bind(g);let hits=[];
  const reset=terrain=>{
   g.clearEnemies();g.effects.clear();g.selectWarrior(0);g.phase='combat';g.mode='game';g.spawnTime=999;g.time+=10;g.combatTime=0;g.paused=false;g.hitStop=0;
   g.groundHeight=terrain?height:()=>0;g.slideOnLand=terrain?slide:p=>{p.y=0;};g.world.collision.segmentClear=terrain?clear:()=>true;
   g.player.root.position.set(0,0,45);g.player.root.rotation.set(0,0,0);g.ball.position.set(0,0,190);g.input.clear();g.input.setContext('combat');g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;g.playerVelocity={x:0,z:0};g.cameraYaw=0;g.lightChain=0;g.chainExpires=0;g.action=null;g.attackBuffer=null;g.enemiesSpawned=0;g.enemyBudget=1000;for(const site of g.world.ambushSites)site.readyAt=0;hits=[];
  };
  window.lowCutReset=reset;
  g.strike=a=>{
   const heading=g.attackYaw+(a.headings?.[a.hitIndex]??0),targets=g.enemies.slice(0,2);
   for(const [i,e]of targets.entries()){e.root.position.copy(g.player.root.position).add(new T.Vector3(Math.sin(heading),0,Math.cos(heading)).multiplyScalar(i?-3:3));e.hp=1e5;e.dead=0;e.emerging=0;e.type=0;}
   strike(a);hits.push({name:a.motionName,time:a.time,planned:a.hits[a.hitIndex],heading:a.headings?.[a.hitIndex]??0,damage:targets.map(e=>1e5-e.hp)});
  };
  const rows=[];
  for(const rate of [40,60,144])for(const mode of ['single','pair','repeat','moving','resume-run','terrain']){
   reset(mode==='terrain');g.spawnWave(8);if(g.enemies.length<2)throw Error('Expected two enemy targets.');g.spawnTime=999;for(const e of g.enemies){e.readyAt=1e9;e.cooldown=999;e.stun=999;e.emerging=0;}
   const row={rate,mode,clips:[],hidden:0,finite:true,maxPalmGap:0,supportSamples:0};
   const tick=()=>{
    g.time+=1/rate;g.updateCombat(1/rate);g.effects.update(1/rate);g.input.end();const a=g.player;
    if(g.action&&row.clips.at(-1)!==g.action.motionName)row.clips.push(g.action.motionName);
    if(g.action?.motionName==='Ronin_Low_Cut'&&g.action.time>0){
     for(let o=a.weapon;o;o=o.parent)if(!o.visible)row.hidden++;
     a.root.updateMatrixWorld(true);const motion=motions.Ronin_Low_Cut;
     for(const side of ['r','l']){const palm=a.bones['hand_'+side].localToWorld(a.handGrip.profiles.sword[side].center.clone()),station=a.weapon.userData.primaryGrip-(side==='l'?motion.gripSpacing:0);if(side==='l'&&g.action.time<(motion.entryBlend??.07)+.02)continue;if(side==='l')row.supportSamples++;const gap=palm.distanceTo(a.weapon.localToWorld(new T.Vector3(0,station,0)));if(gap>row.maxPalmGap){row.maxPalmGap=gap;row.worstGrip={side,time:g.action.time,current:a.current,running:a.running,fade:a.poseFade?.age,kind:a.handGrip.kind};}}
    }
    for(const b of Object.values(a.bones))if(![...b.position,...b.quaternion].every(Number.isFinite))row.finite=false;
   };
   for(let i=0;i<rate/2;i++)tick();if(mode==='moving'){g.input.keys.add('KeyW');for(let i=0;i<rate;i++)tick();}
   if(mode!=='pair'&&mode!=='repeat'){g.lightChain=1;g.chainExpires=g.time+10;}
   g.attack('light');const sent=new Set();let n=0;
   for(let i=0;i<6*rate;i++){
    const a=g.action;if(a&&!sent.has(a.token)&&a.time>.12&&(mode==='repeat'&&n<3||mode==='pair'&&a.step===0)){g.attack('light');sent.add(a.token);n++;}
    if(mode==='resume-run'&&i/rate>.5)g.input.keys.add('KeyW');tick();
   }
   Object.assign(row,{hits:[...hits],remaining:!!(g.action||g.attackBuffer),running:g.player.running});rows.push(row);
  }
  g.strike=strike;reset(true);return {rows};
 });
 fs.writeFileSync(output+'/report.json',JSON.stringify({...report,errors},null,2));
 for(const r of report.rows){
  assert.ok(r.finite&&!r.hidden&&!r.remaining,JSON.stringify(r));assert.ok(r.maxPalmGap<.002&&r.supportSamples>10,JSON.stringify(r));
  const low=r.hits.filter(h=>h.name==='Ronin_Low_Cut');assert.equal(low.length,1,JSON.stringify(r));
  for(const h of low){assert.ok(h.time>=h.planned&&h.time-h.planned<=1/r.rate+1e-6);assert.equal(h.heading,1.01);assert.ok(h.damage[0]>0);assert.equal(h.damage[1],0);}
  if(r.mode==='pair')assert.deepEqual(r.clips,['Ronin_Driving_Cut','Ronin_Low_Cut']);if(['moving','resume-run'].includes(r.mode))assert.ok(r.running);
 }
 if(values.record){
  const encoded=await page.evaluate(async()=>{
   const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js');window.lowCutReset(true);let viewSide=1;g.cameraYaw=.7;g.cameraPitch=.18;
   const chunks=[],stream=g.renderer.domElement.captureStream(60),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
   const done=new Promise(r=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=r;});const wait=ms=>new Promise(r=>setTimeout(r,ms));let queued=false;
   g.previousTime=performance.now();g.renderer.setAnimationLoop(()=>{g.frame();const p=g.player.root.position;g.camera.fov=35;g.camera.updateProjectionMatrix();g.camera.position.copy(p).add(new T.Vector3(3.7*viewSide,1.9,5.4));g.camera.lookAt(p.x,p.y+1,p.z);g.rendering.render('balanced');if(!queued&&g.action?.step===0&&g.action.time>.12){queued=true;g.attack('light');}});
   await wait(600);recorder.start();g.attack('light');await wait(3300);g.cameraYaw=-.9;viewSide=-1;queued=false;g.lightChain=0;g.attack('light');await wait(3300);g.input.keys.add('KeyW');await wait(1600);g.input.clear();recorder.stop();await done;g.renderer.setAnimationLoop(null);stream.getTracks().forEach(t=>t.stop());
   const data=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);
  });fs.writeFileSync(output+'/ronin-low-cut.webm',Buffer.from(encoded,'base64'));
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:report.rows.length,maxPalmGap:Math.max(...report.rows.map(r=>r.maxPalmGap)),errors}));
}finally{await browser.close();}
