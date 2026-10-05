import {disableHmr} from '../tools/disable-hmr.mjs';
import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await disableHmr(page);await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5184');await page.waitForFunction(()=>window.__golfTest);await preloadWarriorFixtures(page);
 const rows=await page.evaluate(async()=>{
  const g=window.__golfTest,{heightAt}=await import('/src/course.js'),{createPlayerGuard}=await import('/src/combat.js');
  g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.ui.showScreen('game');const rows=[];
  for(const hero of [0,1,2,3,4,5])for(const kind of ['light','heavy'])for(const hz of [40,144]){
   g.clearEnemies();g.selectWarrior(hero);g.mode='game';g.phase='combat';g.paused=false;g.input.clear();g.guard=createPlayerGuard();g.time+=10;g.spawnTime=999;g.dodgeTimer=0;g.invincible=999;g.cameraYaw=0;g.playerVelocity={x:0,z:0};g.player.root.rotation.y=0;
   g.player.root.position.set(0,heightAt(g.course,0,45),45);g.ball.position.set(0,heightAt(g.course,0,195),195);g.player.update(g.time,1/60,{});g.updateCamera(10);g.attack(kind);
   const dt=1/hz,token=g.action.token;const tick=()=>{g.time+=dt;g.updateCombat(dt);g.input.end();};
   // Reverse at the contact marker: retain the hit, then leave its recovery.
   while(g.action&&g.action.time<g.action.hits[0])tick();
   const request=g.action.time,duration=g.action.duration;g.input.keys.add('KeyS');
   let ticks=0;while(g.action?.token===token&&ticks++<hz)tick();
   const canceled=!g.action,latency=ticks*dt;const p=g.player.root.position.clone();
   for(let i=0;i<hz*.5;i++)tick();
   const displacement=g.player.root.position.clone().sub(p);
   rows.push({hero,kind,hz,canceled,latency,request,duration,backward:displacement.z,yaw:g.player.root.rotation.y,clip:g.player.current,stale:!!g.action});
  }
  g.input.clear();return rows;
 });
 fs.mkdirSync('artifacts/reviews/combat-responsiveness',{recursive:true});fs.writeFileSync('artifacts/reviews/combat-responsiveness/control-report.json',JSON.stringify({rows,errors},null,2));
 for(const r of rows){assert.ok(r.canceled&&r.latency<=.150001,JSON.stringify(r));assert.ok(r.backward<-.5&&!r.stale,JSON.stringify(r));}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:rows.length,maxCancelLatency:Math.max(...rows.map(r=>r.latency)),leastBackward:Math.max(...rows.map(r=>r.backward)),errors}));
}finally{await browser.close();}
