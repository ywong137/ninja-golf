import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
const out=process.env.REVIEW_OUTPUT??'artifacts/reviews/rock-musou';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await disableHmr(page);await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5184');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached',timeout:120000});await preloadWarriorFixtures(page);
await page.evaluate(()=>{const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(0,0);g.ui.showScreen('game');g.mode='game';g.phase='combat';g.paused=false;g.spawnTime=999;g.ball.position.set(0,0,200);g.input.setContext('combat');window.tickRock=()=>{g.time+=1/60;g.input.poll(1/60,true);g.updateCombat(1/60);g.effects.update(1/60);g.updateCamera(1/60);g.input.end();};});
const results=[];
for(const course of [0,1,2,3]){
 const result=await page.evaluate(async course=>{
  const g=window.__golfTest,{lieAt,heightAt}=await import('/src/course.js');g.setCourse(course);g.loadHole(0);await g.world.waitForAssets();g.clearEnemies();g.effects.clear();g.phase='combat';g.spawnTime=999;g.enemyBudget=0;
  const c=g.world.collision,dry=p=>!['Water','Out of bounds'].includes(lieAt(g.course,p.x,p.z));
  const rocks=c.rocks.filter(r=>Math.min(r.halfWidth,r.halfDepth)>1&&Math.max(r.halfWidth,r.halfDepth)<14&&r.maxY-heightAt(g.course,r.x,r.z)>2.5);
  let chosen;
  for(const r of rocks.sort((a,b)=>b.maxY-b.minY-a.maxY+a.minY))for(const offset of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const yaw=r.yaw+offset,extent=offset%Math.PI===0?r.halfDepth:r.halfWidth;
   const p={x:r.x+Math.sin(yaw)*(extent+3),z:r.z+Math.cos(yaw)*(extent+3)};p.y=heightAt(g.course,p.x,p.z);
   if(dry(p)&&!c.blocked(p)){chosen={r,p,yaw};break;}
   if(chosen)break;
  }
  if(!chosen)throw Error('No large reachable test rock on course '+course+' / '+rocks.length);
  const {r,p,yaw}=chosen;g.player.root.position.set(p.x,p.y,p.z);g.player.root.rotation.set(0,yaw+Math.PI,0);g.playerVelocity={x:0,z:0};g.cameraYaw=yaw+Math.PI;g.cameraPitch=.25;g.ball.position.copy(g.player.root.position).add({x:0,y:0,z:100});g.updateCamera(10);g.input.clear();
  window.rockCase={r,position:p};
  return{course,total:c.rocks.length,selected:r,from:p};
 },course);
 await page.keyboard.down('w');
 const walking=await page.evaluate(()=>{const g=window.__golfTest;let blocked=0;for(let i=0;i<120;i++){tickRock();if(g.world.collision.blocked(g.player.root.position,.375))blocked++;}return{blocked,position:g.player.root.position.toArray()};});
 await page.keyboard.down('Shift');await page.keyboard.press('Space');
 const dodge=await page.evaluate(()=>{const g=window.__golfTest;let blocked=0;for(let i=0;i<90;i++){tickRock();if(g.world.collision.blocked(g.player.root.position,.375))blocked++;}return{blocked,position:g.player.root.position.toArray()};});
 await page.keyboard.up('w');await page.keyboard.up('Shift');
 const camera=await page.evaluate(()=>{const g=window.__golfTest;let min=100;const rows=[];for(let i=0;i<32;i++){g.cameraYaw=i*Math.PI/16;for(let j=0;j<8;j++)g.updateCamera(1/60);const p=g.player.root.position,d=g.camera.position.distanceTo(p.clone().add({x:0,y:1.7,z:0}));min=Math.min(min,d);rows.push({yaw:g.cameraYaw,d});}return{min,rows};});
 await page.evaluate(()=>{const g=window.__golfTest;g.cameraYaw=Math.atan2(g.player.root.position.x-rockCase.r.x,g.player.root.position.z-rockCase.r.z)+Math.PI;g.updateCamera(10);g.ui.update(g,1/60);g.world.update(g.time,0,g.player.root.position,g.camera.position);g.rendering.render('balanced');});await page.screenshot({path:out+'/rock-'+course+'.png'});
 results.push({...result,walking,dodge,camera});assert.equal(walking.blocked,0);assert.equal(dodge.blocked,0);assert.ok(camera.min>=2.39,'Camera entered the hero');
 console.log(JSON.stringify({course,total:result.total,walking,dodge,cameraMinimum:camera.min}));
}
await page.evaluate(async()=>{const g=window.__golfTest;g.setCourse(0);g.loadHole(0);await g.world.waitForAssets();g.clearEnemies();g.effects.clear();g.selectWarrior(2);g.phase='combat';g.spawnTime=999;g.enemyBudget=0;g.input.clear();g.cameraYaw=0;g.player.root.position.set(0,g.groundHeight(0,45),45);g.player.root.rotation.set(0,0,0);g.ball.position.set(0,0,200);g.playerVelocity={x:0,z:0};g.startAttack('musou');g.updateCamera(10);});
const aura=[];
for(const seconds of [.4,1.5,3.6,6.6]){
 const row=await page.evaluate(seconds=>{const g=window.__golfTest;while(g.action&&g.action.time<seconds)tickRock();g.ui.update(g,1/60);g.scene.userData.musou=true;g.world.update(g.time,0,g.player.root.position,g.camera.position);g.rendering.render('balanced');return{time:g.action?.time,strength:g.effects.musouAura.strength,visible:g.effects.musouAura.root.visible,position:g.effects.musouAura.root.position.toArray(),hero:g.player.root.position.toArray(),vertices:g.effects.ribbon.geometry.drawRange.count};},seconds);
 assert.equal(row.strength,1);assert.equal(row.visible,true);assert.deepEqual(row.position,row.hero);aura.push(row);await page.screenshot({path:out+'/aura-'+seconds+'.png'});
}
const cleared=await page.evaluate(()=>{const g=window.__golfTest;while(g.action)tickRock();for(let i=0;i<20;i++)tickRock();return !g.effects.musouAura.root.visible;});assert.ok(cleared);assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({results,aura,cleared,errors},null,2));console.log('PASS aura and rock checks');
}finally{await browser.close();}
