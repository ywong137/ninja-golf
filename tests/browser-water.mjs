import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 const results=await page.evaluate(async()=>{
  const C=await import('/src/course.js'),{findWaterEmergence}=await import('/src/water-emergence.js'),g=window.__golfTest;g.frame=()=>{};g.begin(0,0);g.paused=true;g.audio.pause();const reports=[];
  for(const [theme,hole]of [[0,1],[0,6],[0,8],[1,4],[2,5],[3,7]]){
   g.setCourse(theme);g.loadHole(hole);await g.world.waitForAssets();const c=g.course,sites=g.world.ambushSites,site=sites.find(s=>s.kind==='water'&&findWaterEmergence(c,s,{x:0,z:0},g.world.collision));if(!site)throw Error(`${c.name}: no safe water entrance`);
   const entry=findWaterEmergence(c,site,{x:0,z:0},g.world.collision),surface=C.waterSurfaceAt(c,site.x,site.z),planes=g.world.pond.children.map(m=>m.position.y);
   const original=g.penalty.bind(g);let contact=null;g.penalty=message=>{contact={message,position:g.ball.position.toArray()};original(message);};
   g.ball.position.set(site.x,surface+2,site.z);g.club=0;g.power=0;g.launchBall();g.shotOrigin.set(0,C.heightAt(c,0,0)+.13,0);g.shotStartLie='Tee';g.phase='flight';g.rolling=false;g.flightTime=0;g.velocity.set(0,0,0);g.strokes=1;g.penalties=0;g.stillTime=0;
   for(let i=0;i<240&&g.phase==='flight';i++)g.updateBall(1/120);g.penalty=original;
   const penalty={contact,strokes:g.strokes,count:g.penalties,phase:g.phase,reset:g.ball.position.distanceTo(g.shotOrigin)};
   g.phase='combat';g.player.root.position.copy(entry.landing);g.player.root.position.x+=12;g.player.root.position.y=C.heightAt(c,g.player.root.position.x,g.player.root.position.z);g.ball.position.copy(g.player.root.position).add({x:0,y:0,z:30});g.world.ambushSites=[{...site,readyAt:0}];g.enemyBudget=10;g.enemiesSpawned=0;g.spawnTime=999;g.health=1e6;g.spawnWave(6);g.world.ambushSites=sites;
   if(!g.enemies.length)throw Error(`${c.name}: main loop did not spawn from water`);const count=g.enemies.length;let minClearance=Infinity,frames=0;
   while(g.enemies.some(e=>e.emerging)&&frames++<300){g.time+=1/120;g.updateCombat(1/120);for(const e of g.enemies)if(e.root.visible)minClearance=Math.min(minClearance,e.root.position.y-C.heightAt(c,e.root.position.x,e.root.position.z));}
   const dry=g.enemies.every(e=>!e.emerging&&C.waterSurfaceAt(c,e.root.position.x,e.root.position.z)==null),trunksOnBridges=g.world.vegetation.records.filter(t=>c.layout.bridgeSegments.some(s=>{const dx=s[2]-s[0],dz=s[3]-s[1],u=Math.max(0,Math.min(1,((t.x-s[0])*dx+(t.z-s[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(t.x-s[0]-dx*u,t.z-s[1]-dz*u)<s[4]+(s[5]-s[4])*u+3;})).length;
   g.camera.position.set(site.x+22,surface+17,site.z-24);g.camera.lookAt(site.x,surface,site.z);g.world.update(g.time,0,null,g.camera.position);g.rendering.render('high');g.rendering.render('high');reports.push({name:c.name,surface,planes,penalty,count,minClearance,dry,trunksOnBridges});g.clearEnemies();
  }return reports;
 });
 for(const r of results){assert.ok(r.planes.includes(r.surface));assert.ok(r.penalty.contact?.message.startsWith('Water'));assert.equal(r.penalty.strokes,2);assert.equal(r.penalty.count,1);assert.equal(r.penalty.phase,'aim');assert.ok(r.penalty.reset<1e-8);assert.equal(r.count,6);assert.ok(r.minClearance>-.03,JSON.stringify(r));assert.ok(r.dry);assert.equal(r.trunksOnBridges,0);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results,null,2));console.log('Rendered local water, live penalties, main-loop water entrances, and bridge clearance passed.');
}finally{await browser.close();}
