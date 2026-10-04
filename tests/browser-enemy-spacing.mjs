import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 await page.locator('#asset-curtain').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const {heightAt,lieAt}=await import('/src/course.js'),{ENEMY_TYPES}=await import('/src/combat.js');
  const g=window.__golfTest,Warrior=g.player.constructor,dt=1/30;g.frame=()=>{};g.audio.enabled=false;g.audio.pause();g.begin(0,0);g.audio.pause();g.clearEnemies();g.paused=true;g.phase='combat';g.input.clear();g.ui.showScreen('game');g.spawnTime=1e6;g.invincible=1e6;
  const point=(x,z)=>({x,y:heightAt(g.course,x,z),z});
  const safe=p=>!['Water','Out of bounds'].includes(lieAt(g.course,p.x,p.z))&&!g.world.collision.blocked(p,.6,2);
  let center;
  for(let z=35;z<160&&!center;z+=10)for(let x=-20;x<=20&&!center;x+=5){const p=point(x,z);if(!safe(p))continue;let clear=true;for(let r=2;r<=12;r+=2)for(let a=0;a<Math.PI*2;a+=Math.PI/32)if(!safe(point(x+Math.sin(a)*r,z+Math.cos(a)*r)))clear=false;if(clear)center=p;}
  if(!center)throw Error('No clear lawn for the spacing fixture');
  g.player.root.position.copy(center);g.ball.position.copy(point(center.x,center.z+100));
  const positions=()=>g.enemies.map(e=>({x:e.root.position.x-center.x,z:e.root.position.z-center.z}));
  const sectors=points=>new Set(points.map(p=>Math.floor((Math.atan2(p.x,p.z)+Math.PI)/(Math.PI/2))%4)).size;
  for(let i=0;i<12;i++){
   const type=i%3,e=new Warrior(type,true,{family:i%3,palette:i%4}),a=-1.2+i*2.4/11;
   e.root.position.copy(point(center.x+Math.sin(a)*7.4,center.z+Math.cos(a)*7.4));
   Object.assign(e,{slot:i,role:ENEMY_TYPES[type].role,speed:ENEMY_TYPES[type].speed,hp:10000,cooldown:1000,readyAt:g.time+1000,knockback:g.player.root.position.clone().set(0,0,0),lift:0,verticalSpeed:0});g.enemies.push(e);
  }
  g.crowd.update(g.enemies);
  const initial=positions(),tick=()=>{g.time+=dt;g.updateCombat(dt);g.input.end();};
  let pacedFrames=0;
  for(let i=0;i<450;i++){
   tick();
   for(const e of g.enemies)if(e.repositioning&&e.current==='Jog_Fwd_Loop'&&e.actions.get(e.current).getEffectiveTimeScale()<.8)pacedFrames++;
  }
  let finalTravel=0,maxStep=0;
  for(let i=0;i<60;i++){const before=positions();tick();const after=positions();after.forEach((p,j)=>{const d=Math.hypot(p.x-before[j].x,p.z-before[j].z);finalTravel+=d;maxStep=Math.max(maxStep,d);});}
  const final=positions(),standby={initialSectors:sectors(initial),finalSectors:sectors(final),minRadius:Math.min(...final.map(p=>Math.hypot(p.x,p.z))),finalTravelPerEnemy:finalTravel/12,maxStep,waiting:g.enemies.filter(e=>!e.enemyAction).length,initial,final};
  g.crowd.update(g.enemies);g.camera.position.set(center.x,center.y+23,center.z-23);g.camera.lookAt(center.x,center.y,center.z);g.ui.update(g,1);g.world.update(g.time,0,g.player.root.position,g.camera.position);g.rendering.render('balanced');
  // Formation movement must still admit normal attackers without releasing the whole crowd.
  for(const e of g.enemies){e.cooldown=0;e.readyAt=0;}
  let attacks=0,maxMelee=0;const tokens=new Set();
  for(let i=0;i<180;i++){tick();const active=g.enemies.filter(e=>e.enemyAction);maxMelee=Math.max(maxMelee,active.length);for(const e of active)tokens.add(e.enemyAction.token);}
  attacks=tokens.size;
  // A waiting enemy also steps away when the player stops within touching distance.
  const close=g.enemies[0];for(const e of g.enemies){e.cooldown=1000;e.readyAt=g.time+1000;e.enemyAction=null;}
  close.slot=0;close.root.position.copy(point(center.x,center.z+1));
  for(let i=0;i<180;i++)tick();
  const closeRadius=Math.hypot(close.root.position.x-center.x,close.root.position.z-center.z);
  g.audio.pause();return{standby,attacks,maxMelee,pacedFrames,closeRadius};
 });
 await page.screenshot({path:'/tmp/ninja-enemy-spacing.png'});
 fs.writeFileSync('/tmp/ninja-enemy-spacing.json',JSON.stringify({...result,errors},null,2));
 console.log(JSON.stringify({standby:{...result.standby,initial:undefined,final:undefined},attacks:result.attacks,maxMelee:result.maxMelee,pacedFrames:result.pacedFrames,closeRadius:result.closeRadius,errors}));
 assert.equal(result.standby.initialSectors,2);
 assert.equal(result.standby.finalSectors,4,'Waiting enemies must spread around the hero after the pursuit stops');
 assert.ok(result.standby.minRadius>5.5,'Waiting enemies must leave space for attacks');
 assert.ok(result.standby.finalTravelPerEnemy<.2,'Waiting enemies must settle rather than orbit continuously');
 assert.equal(result.standby.waiting,12);
 assert.ok(result.attacks>=3,'Ready melee enemies still close in and attack');
 assert.ok(result.maxMelee<=3,'No more than three melee attackers commit together');
 assert.ok(result.pacedFrames>30,'Slower formation movement also slows the native running clip');
 assert.ok(result.closeRadius>5.5,'An idle enemy retreats when the player stops next to it');
 assert.deepEqual(errors,[]);
} finally {await browser.close();}
