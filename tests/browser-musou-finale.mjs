import {disableHmr} from '../tools/disable-hmr.mjs';
import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
const out='artifacts/reviews/musou-finale/'+(process.env.PRIVATE?'private':'public');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5184');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 await page.evaluate(async()=>{
 const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();await g.world.waitForAssets();g.begin(2,0);g.audio.pause();
 const{createPlayerGuard}=await import('/src/combat.js');
 window.resetMusou=hero=>{g.clearEnemies();g.effects.clear();g.selectWarrior(hero);g.mode='game';g.phase='combat';g.paused=false;g.ui.showScreen('game');g.input.clear();g.input.setContext('combat');g.guard=createPlayerGuard();g.dodgeTimer=0;g.hitStop=0;g.spawnTime=999;g.combatTime=0;g.resolve=100;g.invincible=0;g.time+=10;g.cameraYaw=0;g.cameraPitch=.25;g.player.root.rotation.set(0,0,0);g.player.root.position.set(0,g.groundHeight(0,45),45);g.ball.position.set(0,0,200);g.playerVelocity={x:0,z:0};g.events=[];g.audio.play=name=>g.events.push({name,time:g.time,cinematic:g.cinematic});g.updateCamera(10);};
 window.tickMusou=(dt=1/60)=>{g.input.poll(dt,true);g.time+=dt;g.updateCombat(dt,dt);g.effects.update(dt);g.updateCamera(dt);g.updatePortraitLighting();g.ui.update(g,dt);g.scene.userData.musou=g.action?.kind==='musou';g.input.end();};
 });
 const rows=[];
 for(const hero of process.env.PRIVATE?[2]:[0,1,2,3,4,5])for(const state of ['light','heavy','dodge','guardbreak','hitstop']){
  await page.evaluate(({hero,state})=>{resetMusou(hero);const g=window.__golfTest;
   if(['light','heavy','hitstop'].includes(state)){g.startAttack(state==='hitstop'?'light':state);g.action.time=g.action.hits[0];g.attackBuffer={kind:'light',expires:g.time+1};g.player.update(g.time,0,{action:g.action,attack:g.attackTimer});}
   if(state==='dodge')g.dodgeTimer=.4;
   if(state==='guardbreak'){g.guard.brokenUntil=g.time+2;g.guard.breakPoseUntil=g.time+2;g.guard.attackReadyAt=g.time+2;g.guardBufferedAttack={kind:'heavy',expires:g.time+2};}
   if(state==='hitstop')g.hitStop=.08;
  },{hero,state});
  await page.keyboard.press('f');
  const row=await page.evaluate(()=>{tickMusou();const g=window.__golfTest;return{cinematic:g.cinematic,action:g.action,dodge:g.dodgeTimer,hitStop:g.hitStop,resolve:g.resolve,buffer:g.attackBuffer,guardBuffer:g.guardBufferedAttack,visible:g.player.root.visible,events:g.events};});
  assert.ok(row.cinematic>4.1&&!row.action&&!row.buffer&&!row.guardBuffer&&!row.dodge&&!row.hitStop&&row.visible&&row.resolve===0,JSON.stringify({hero,state,row}));assert.equal(row.events.filter(e=>e.name==='musou-wipe').length,1);rows.push({hero,state,cinematic:row.cinematic});
 }
 const sequences=[];
 for(const hero of process.env.PRIVATE?[2]:[0,1,2,3,4,5]){
  await page.evaluate(hero=>{resetMusou(hero);window.__golfTest.attack('musou')},hero);
  for(const seconds of [.5,1.85,3.2]){
   await page.evaluate(seconds=>{const g=window.__golfTest;while(g.cinematic>4.2-seconds)tickMusou();g.rendering.render('high');for(const a of document.getAnimations()){a.pause();a.currentTime=seconds*1000;}},seconds);
   if([2,3].includes(hero))await page.screenshot({path:`${out}/hero-${hero}-intro-${seconds}.png`});
  }
  const seq=await page.evaluate(()=>{const g=window.__golfTest;while(g.cinematic>0)tickMusou();return{duration:g.action.duration,hits:g.action.hits,clips:g.action.sequence.segments.map(s=>s.clip),events:g.events};});
  assert.equal(seq.events.filter(e=>e.name==='musou-wipe').length,2);assert.ok(seq.duration>=7&&seq.hits.length>=6);
  let sample=0;const poses=[];
  while(await page.evaluate(()=>!!window.__golfTest.action)){
   const pose=await page.evaluate(()=>{const g=window.__golfTest;for(let i=0;i<10&&g.action;i++)tickMusou();const a=g.action;g.rendering.render('balanced');let visible=true;for(let o=g.player.weapon;o;o=o.parent)if(!o.visible)visible=false;return{time:a?.time??0,hit:a?.hitIndex??0,clip:g.player.current,visible,vertices:g.effects.ribbon.geometry.drawRange.count,finite:Object.values(g.player.bones).every(b=>[...b.position,...b.quaternion].every(Number.isFinite))};});
   poses.push(pose);assert.ok(pose.finite);if(hero!==1)assert.ok(pose.visible);
   assert.ok(pose.vertices<=1536);if([2,3].includes(hero)&&sample++%7===1)await page.screenshot({path:`${out}/hero-${hero}-attack-${sample}.png`});
  }
  sequences.push({hero,...seq,poses});
 }
 const audio=await page.evaluate(async()=>{const{CombatAudio}=await import('/src/combat-audio.js');const ctx=new OfflineAudioContext(2,48000*3,48000),bus=new CombatAudio(ctx,ctx.destination);await bus.ready;const played=bus.play('musou-wipe'),b=await ctx.startRendering(),d=b.getChannelData(0);let energy=0,peak=0,clipped=0;for(const x of d){energy+=x*x;peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>=1)clipped++;}return{played,peak,rms:Math.sqrt(energy/d.length),clipped};});
 assert.ok(audio.played&&audio.rms>.01&&audio.clipped===0,JSON.stringify(audio));assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/report.json',JSON.stringify({rows,sequences,audio,errors},null,2));console.log(JSON.stringify({priorityCases:rows.length,sequences:sequences.map(({hero,duration,hits})=>({hero,duration,hits:hits.length})),audio,errors}));
}finally{await browser.close();}
