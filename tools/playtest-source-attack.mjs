import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';

const {values}=parseArgs({options:{output:{type:'string'},record:{type:'boolean'},kind:{type:'string',default:'musou'},hero:{type:'string',multiple:true},help:{type:'boolean'}}});
if(values.help){console.log('node tools/playtest-source-attack.mjs --kind light|heavy|musou [--hero INDEX] [--output DIRECTORY] [--record]\nExercise source attacks from standing, running, and queued-light states at 40, 60, and 144 Hz. All audio is muted. Repeat --hero for more characters.');process.exit(0);}
if(!['light','heavy','musou'].includes(values.kind))throw Error('Use --kind light, heavy, or musou.');
const heroes=values.hero?.map(Number)??(values.kind==='light'?[1]:values.kind==='heavy'?[3]:[0,5]);if(heroes.some(x=>!Number.isInteger(x)||x<0||x>5))throw Error('--hero must be a roster index from 0 to 5.');
const output=path.resolve(values.output??'artifacts/reviews/source-'+values.kind+'/gameplay');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto('http://localhost:5174');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const report=await page.evaluate(async({heroes,kind})=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {createPlayerGuard}=await import('/src/combat.js'),{motions,combatMotionName}=await import('/src/motion.js'),g=window.__golfTest;
  g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(0,0);g.audio.pause();
  const originalSlide=g.slideOnLand.bind(g),originalHeight=g.groundHeight,originalClear=g.world.collision.segmentClear.bind(g.world.collision);
  const reset=(hero,terrain=false)=>{
   g.clearEnemies();g.effects.clear();g.selectWarrior(hero);g.phase='combat';g.mode='game';g.spawnTime=999;g.time+=10;g.combatTime=0;g.paused=false;g.hitStop=0;
   g.groundHeight=terrain?originalHeight:()=>0;g.slideOnLand=terrain?originalSlide:p=>{p.y=0;};g.world.collision.segmentClear=terrain?originalClear:()=>true;
   g.player.root.position.set(0,0,45);g.player.root.rotation.set(0,0,0);g.ball.position.set(0,0,190);g.input.clear();g.input.setContext('combat');g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;g.resolve=100;g.playerVelocity={x:0,z:0};g.cameraYaw=0;g.enemiesSpawned=0;g.enemyBudget=1000;for(const site of g.world.ambushSites)site.readyAt=0;
  };
  window.sourceAttackReset=reset;
  const strike=g.strike.bind(g),explosion=g.effects.explosion.bind(g.effects);let hits=[],blasts=0;
  g.effects.explosion=(p,scale)=>{if(scale===2)blasts++;return explosion(p,scale);};
  g.strike=a=>{
   const facing=g.attackYaw+(a.headings?.[a.hitIndex]??0),targets=g.enemies.slice(0,2);
   for(const [i,e]of targets.entries()){
    e.root.position.copy(g.player.root.position).add(new T.Vector3(Math.sin(facing),0,Math.cos(facing)).multiplyScalar(i?-3:3));
    e.hp=100000;e.dead=0;e.emerging=0;e.type=0;
   }
   strike(a);hits.push({kind:a.kind,name:a.motionName,time:a.time,planned:a.hits[a.hitIndex],index:a.hitIndex,damage:targets.map(e=>100000-e.hp)});
  };
  const rows=[];
  for(const hero of heroes)for(const rate of [40,60,144])for(const mode of ['standing','moving','queued-light']){
   reset(hero);g.spawnWave(8);if(g.enemies.length<2)throw Error('Expected two real enemy actors.');g.spawnTime=999;
   for(const e of g.enemies){e.readyAt=1e9;e.cooldown=999;e.stun=999;e.emerging=0;}
   hits=[];blasts=0;const name=combatMotionName(g.warrior,kind),motion=motions[name];
   const row={hero,rate,mode,name,expectedHits:motion.impacts.length,hidden:0,finite:true,maxPalmGap:0,clips:[]};
   const tick=()=>{
    g.time+=1/rate;g.updateCombat(1/rate);g.effects.update(1/rate);g.input.end();
    if(g.action&&row.clips.at(-1)!==g.action.motionName)row.clips.push(g.action.motionName);
    if(g.action||g.cinematic>0)for(const held of [g.player.weapon,...(g.player.offhand?[g.player.offhand]:[])])for(let o=held;o;o=o.parent)if(!o.visible)row.hidden++;
    for(const b of Object.values(g.player.bones))if(![...b.position,...b.quaternion].every(Number.isFinite))row.finite=false;
    if(g.action?.kind===kind&&g.action.time>.3){
     const a=g.player;a.root.updateMatrixWorld(true);
     for(const side of motion.twoHanded||a.offhand?['r','l']:['r']){
      const palm=a.bones['hand_'+side].localToWorld(a.handGrip.profiles.sword[side].center.clone());
      const held=side==='l'&&a.offhand?a.offhand:a.weapon;
      const station=held.userData.primaryGrip-(side==='l'&&!a.offhand?motion.gripSpacing:0);
      row.maxPalmGap=Math.max(row.maxPalmGap,palm.distanceTo(held.localToWorld(new T.Vector3(0,station,0))));
     }
    }
   };
   for(let i=0;i<rate/2;i++)tick();if(mode==='moving'){g.input.keys.add('KeyW');for(let i=0;i<rate;i++)tick();}
   g.attack(kind);let queued=false;
   for(let i=0;i<10*rate;i++){
    if(mode==='queued-light'&&!queued&&g.action?.kind===kind&&g.action.duration-g.action.time<.25){g.attack('light');queued=true;}
    tick();
   }
   Object.assign(row,{hits,blasts,remaining:!!(g.action||g.attackBuffer||g.cinematic>0),running:g.player.running});rows.push(row);
  }
  g.strike=strike;g.effects.explosion=explosion;reset(heroes[0],true);return {rows};
 },{heroes,kind:values.kind});
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({...report,errors},null,2));
 for(const r of report.rows){
  assert.ok(r.finite&&!r.hidden&&!r.remaining,JSON.stringify(r));
  assert.ok(r.maxPalmGap<.002,'Hands detached: '+JSON.stringify(r));
  assert.equal(r.hits.length,r.expectedHits+(r.mode==='queued-light'?1:0),JSON.stringify(r));
  for(const h of r.hits){assert.ok(h.time>=h.planned&&h.time-h.planned<=1/r.rate+1e-6);assert.ok(h.damage[0]>0);assert.equal(h.damage[1]>0,h.kind==='musou'&&h.index===r.expectedHits-1,JSON.stringify(h));}
  assert.equal(r.blasts,values.kind==='musou'?1:0);if(r.mode==='moving')assert.ok(r.running);
 }
 if(values.record){
  const encoded=await page.evaluate(async({hero,kind})=>{
   const g=window.__golfTest;window.sourceAttackReset(hero,true);g.cameraYaw=.7;g.cameraPitch=.18;g.audio.enabled=false;g.audio.pause();
   const chunks=[],stream=g.renderer.domElement.captureStream(60),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:5000000});
   const done=new Promise(r=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=r;});const wait=ms=>new Promise(r=>setTimeout(r,ms));
   const complete=async()=>{const start=performance.now();await wait(100);while(g.action||g.cinematic>0){if(performance.now()-start>45000)throw Error(kind+' attack did not finish.');await wait(50);}await wait(700);};
   g.previousTime=performance.now();g.renderer.setAnimationLoop(()=>g.frame());await wait(600);recorder.start();g.attack(kind);await complete();g.cameraYaw=-.9;g.resolve=100;g.attack(kind);await complete();recorder.stop();await done;g.renderer.setAnimationLoop(null);stream.getTracks().forEach(t=>t.stop());
   const data=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);
  },{hero:heroes[0],kind:values.kind});fs.writeFileSync(path.join(output,'source-'+values.kind+'.webm'),Buffer.from(encoded,'base64'));
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:report.rows.length,errors}));
}finally{await browser.close();}
