import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const release=new URL('..',import.meta.url).pathname,out=process.argv[3]??'/tmp/ninja-emergence',url=process.argv[2]??'http://localhost:5173';
const {disableHmr}=await import(release+'/tools/disable-hmr.mjs');
fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(url);await page.waitForFunction(()=>window.__golfTest,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached',timeout:120000});
 await page.evaluate(()=>{const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.pause();g.paused=true;g.mode='game';g.setCourse(0);g.loadHole(0);g.phase='combat';g.input.clear();g.invincible=999;g.ui.showScreen('game');g.spawnTime=999;g.enemyBudget=999;});
 const report=[];
 for(const kind of ['lantern','pagoda','rock','tree','sand','water'])for(const fps of [40,60,120]){
  const init=await page.evaluate(async({kind,fps})=>{
   const g=window.__golfTest,{heightAt}=await import('/src/course.js'),{enemyEmergenceFrame}=await import('/src/enemy-emergence.js');g.clearEnemies();g.phase='combat';g.time+=10;g.spawnTime=999;g.enemiesSpawned=0;
   const sites=g.world.ambushSites,site=sites.find(s=>s.kind===kind);if(!site)throw Error('Missing '+kind);
   g.player.root.position.set(site.x,heightAt(g.course,site.x,site.z-25),site.z-25);g.ball.position.set(site.x,site.y,site.z+60);g.playerVelocity=g.player.root.position.clone().set(0,0,0);g.world.ambushSites=[site];g.spawnWave(1);g.world.ambushSites=sites;
   const e=g.enemies[0];if(!e)throw Error('No safe '+kind+' spawn');e.emerging.delay=0;const motion=enemyEmergenceFrame(0,{duration:e.emerging.duration,kind});
   window.emergenceReview={kind,fps,time:0,enemy:e,landing:e.emerging.landing.clone(),motion,rows:[],contactPositions:[]};
   g.camera.position.set(site.x+7,Math.max(site.y,e.emerging.landing.y)+(kind==='tree'?4.5:2.8),site.z+7);g.camera.lookAt(site.x+1,site.y+1.4,site.z);
   return {duration:motion.duration,touchdown:motion.touchdown};
  },{kind,fps});
  const snapshots=fps===60?[.1,.35,.75,init.touchdown,init.touchdown+.18,init.duration+.05]:[];let next=0;
  for(let t=0;t<init.duration+.2;t+=1/fps){
   const state=await page.evaluate(fps=>{const g=window.__golfTest,r=window.emergenceReview,e=r.enemy,dt=1/fps;g.time+=dt;r.time+=dt;g.updateCombat(dt);g.crowd.update(g.enemies);g.effects.update(dt,g.camera);const row={time:r.time,clip:e.current,clipTime:e.actions.get(e.current)?.time,emerging:!!e.emerging,landed:e.emerging?.landed??false,position:e.root.position.toArray(),weapon:e.weapon.visible,attack:!!e.enemyAction};r.rows.push(row);if(e.emerging?.landed)r.contactPositions.push(e.root.position.toArray());return row;},fps);
   if(next<snapshots.length&&state.time>=snapshots[next]){await page.evaluate(()=>{const g=window.__golfTest;g.ui.update(g,1/60);g.renderer.render(g.scene,g.camera);});await page.screenshot({path:out+`/${kind}-${next}.png`});next++;}
  }
  report.push(await page.evaluate(()=>{const r=window.emergenceReview;return{kind:r.kind,fps:r.fps,motion:r.motion,rows:r.rows,contactPositions:r.contactPositions,landing:r.landing.toArray()};}));
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify({report,errors},null,2));
 for(const r of report){assert.equal(r.rows.at(-1).emerging,false);assert.ok(r.rows.every(p=>p.position.every(Number.isFinite)&&p.weapon));assert.ok(r.rows.filter(p=>p.emerging).every(p=>!p.attack));assert.ok(r.rows.some(p=>p.clip==='Ninja_Emerge_Land'));assert.ok(r.contactPositions.every(p=>Math.hypot(...p.map((v,i)=>v-r.landing[i]))<1e-6),'Landing must remain stationary');if(r.kind!=='tree')assert.ok(r.rows.some(p=>p.clip==='Ninja_Emerge_Start'));}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:report.length,images:36,errors}));
}finally{await browser.close();}
