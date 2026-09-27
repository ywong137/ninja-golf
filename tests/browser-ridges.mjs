import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 await page.evaluate(()=>{const g=window.__golfTest;g.frame=()=>{};g.paused=true;g.audio.pause();});
 for(let theme=0;theme<3;theme++){
  await page.evaluate(async theme=>{
   const g=window.__golfTest;g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;
   const {landscapeHorizon}=await import('/src/landscape-horizon.js'),{landscapeHeight}=await import('/src/regional-terrain.js'),c=g.course,region=g.world.regions[c.theme];
   window.__ridgeAfter=g.world.horizon.geometry;window.__ridgeBefore=landscapeHorizon(c,region,{refine:false});
   const p=window.__ridgeBefore.attributes.position,n=window.__ridgeBefore.attributes.normal;
   for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),nx=landscapeHeight(c,region,x-.2,z)-landscapeHeight(c,region,x+.2,z),nz=landscapeHeight(c,region,x,z-.2)-landscapeHeight(c,region,x,z+.2),length=Math.hypot(nx,.4,nz);n.setXYZ(i,nx/length,.4/length,nz/length);}n.needsUpdate=true;
  },theme);
  for(const view of ['tee','aerial']){
   await page.evaluate(async view=>{const g=window.__golfTest,{heightAt}=await import('/src/course.js'),c=g.course;
    if(view==='aerial'){g.camera.position.set(58,42,-42);g.camera.lookAt(0,5,135);}else{const [x,z]=c.layout.route[1];g.camera.position.set(0,heightAt(c,0,-9)+2.4,-9);g.camera.lookAt(x,heightAt(c,x,z)+1,z);}
    g.camera.fov=48;g.camera.updateProjectionMatrix();g.world.update(g.time,0,g.camera.position,g.camera.position);
   },view);
   for(const stage of ['before','after']){
    await page.evaluate(stage=>{const g=window.__golfTest;g.world.horizon.geometry=stage==='before'?window.__ridgeBefore:window.__ridgeAfter;g.rendering.render(g.quality);},stage);
    await page.screenshot({path:`/tmp/ninja-ridge-${stage}-${theme}-${view}.png`});
   }
  }
  await page.evaluate(()=>window.__ridgeBefore.dispose());
 }
 assert.deepEqual(errors,[]);console.log('Identical-camera, identical-material terrain geometry comparisons passed for all three regional datasets.');
}finally{await browser.close();}
