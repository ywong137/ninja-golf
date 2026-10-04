import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:800,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await disableHmr(page);
try{
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);await page.click('#play');
 await page.evaluate(async()=>{const g=window.__golfTest;g.audio.pause();g.paused=true;g.frame=()=>{};await g.world.waitForAssets();g.ui.showScreen('game');});
 for(let hero=0;hero<6;hero++){
  const state=await page.evaluate(hero=>{
   const g=window.__golfTest;g.selectWarrior(hero);g.audio.pause();g.player.update(.25,0,{selection:true});g.player.root.updateMatrixWorld(true);
   g.portraitLights.visible=true;g.portraitLights.position.copy(g.player.root.position);
   const p=g.player.root.position;g.camera.fov=31;g.camera.updateProjectionMatrix();g.camera.position.set(p.x+.7,p.y+2.3,p.z+8.8);g.camera.lookAt(p.x,p.y+1.85,p.z);
   for(const e of document.querySelectorAll('.screen,#hud,#toast,#hole-banner'))e.style.visibility='hidden';
   const mats=[];g.player.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.outfitVariant)mats.push({name:m.name,width:m.map.image?.width,flipY:m.map.flipY});});
   g.rendering.render('high');return mats;
  },hero);
  assert.ok(state.length&&state.every(m=>m.width>=1024&&m.flipY===false),JSON.stringify(state));
  await page.screenshot({path:`/tmp/ninja-outfit-hero-${hero}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Six actual selection poses captured; outfit maps loaded, no shader/browser errors.');
}finally{await browser.close();}
