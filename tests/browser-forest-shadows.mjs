import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});await page.evaluate(()=>{const g=window.__golfTest;g.frame=()=>{};g.paused=true;g.audio.pause();});
 for(let theme=0;theme<2;theme++){
  const count=await page.evaluate(async theme=>{const g=window.__golfTest;g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;return g.world.distantForest.records.length;},theme);
  assert.ok(count>200);
  for(const view of ['aerial','grove']){
   await page.evaluate(view=>{const g=window.__golfTest;
    if(view==='aerial'){g.camera.position.set(58,42,-42);g.camera.lookAt(0,5,135);}
    else{const p=g.world.distantForest.records.find(p=>p.x< -350&&p.y>10)||g.world.distantForest.records[0];g.camera.position.set(p.x+110,p.y+65,p.z-125);g.camera.lookAt(p.x,p.y+5,p.z);}
    g.camera.fov=48;g.camera.updateProjectionMatrix();g.world.update(g.time,0,g.camera.position,g.camera.position);
   },view);
   for(const state of ['before','after']){
    await page.evaluate(state=>{const g=window.__golfTest;g.world.distantForest.shadow.visible=state==='after';g.rendering.render(g.quality);},state);
    await page.screenshot({path:`/tmp/ninja-forest-shadows-${theme}-${view}-${state}.png`});
   }
  }
 }
 assert.deepEqual(errors,[]);console.log('Japanese and Highland forest silhouettes rendered in one static mesh without shader errors.');
}finally{await browser.close();}
