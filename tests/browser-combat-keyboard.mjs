import {disableHmr} from '../tools/disable-hmr.mjs';
import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import{chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{const page=await browser.newPage({viewport:{width:1100,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5184');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
const setup=async hero=>page.evaluate(async hero=>{const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(hero,0);g.clearEnemies();g.ui.showScreen('game');g.mode='game';g.phase='combat';g.paused=false;g.input.setContext('combat');g.input.clear();g.spawnTime=999;g.invincible=999;g.cameraYaw=0;g.player.root.rotation.y=0;g.ball.position.z=190;g.enemyBudget=64;g.enemiesSpawned=0;g.spawnWave(10);const{heightAt}=await import('/src/course.js');g.player.root.position.set(0,heightAt(g.course,0,45),45);g.enemies.forEach((e,i)=>{e.emerging=null;e.root.visible=true;e.hp=10000;e.cooldown=999;e.root.position.set(Math.sin(i)*1.8,0,46.3+Math.cos(i)*.6);e.root.position.y=heightAt(g.course,e.root.position.x,e.root.position.z);e.update(0,0,{});});g.audioEvents=[];g.audio.play=name=>g.audioEvents.push(name);g.updateCamera(10);g.rendering.render('balanced');},hero);
const step=async(n=1)=>page.evaluate(n=>{const g=window.__golfTest;for(let i=0;i<n;i++){const real=1/60,dt=g.hitStop>0?real*.12:real;g.hitStop=Math.max(0,(g.hitStop??0)-real);g.input.poll(real,true);g.time+=dt;g.updateCombat(dt,real);g.updateCamera(real);g.input.end();}return{action:!!g.action,time:g.action?.time,duration:g.action?.duration,hit:g.action?.hitIndex,yaw:g.player.root.rotation.y,z:g.player.root.position.z,clip:g.player.current,events:g.audioEvents};},n);
const rows=[];
for(const hero of [2,3]){
 await setup(hero);await page.mouse.click(500,280,{button:'left'});let s=await step();for(let i=0;i<180&&!(s.hit>0);i++)s=await step();assert.ok(s.hit>0,'normal mouse attack hit nearby enemies');const before=s;
 await page.keyboard.down('s');let frames=0;do{s=await step();frames++;}while(s.action&&frames<60);await step(30);s=await step();await page.keyboard.up('s');
 rows.push({hero,cancelSeconds:frames/60,reverseDistance:s.z-before.z,clip:s.clip,events:s.events});assert.ok(frames/60<.25&&s.z<before.z-1,'Reverse input must leave recovery and run immediately');assert.ok(s.events.includes('whoosh')&&s.events.includes('hit'));assert.ok(!s.events.includes('sword'));
 await page.evaluate(()=>document.exitPointerLock?.());
}
// Mouse view still turns during hit stop; movement uses the newly requested yaw.
await setup(2);await page.mouse.click(500,280);await step();await page.evaluate(()=>{window.__golfTest.hitStop=.08});await page.mouse.move(770,280);const camera=await step();const yaw=await page.evaluate(()=>window.__golfTest.cameraYaw);assert.ok(Math.abs(yaw)>.5,'mouse turns camera during impact freeze');
fs.mkdirSync('artifacts/reviews/combat-responsiveness',{recursive:true});fs.writeFileSync('artifacts/reviews/combat-responsiveness/normal-input-report.json',JSON.stringify({rows,cameraYaw:yaw,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({rows,cameraYaw:yaw,errors}));
}finally{await browser.close();}
