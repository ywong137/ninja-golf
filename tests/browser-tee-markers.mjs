import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});await page.evaluate(()=>{const g=window.__golfTest;g.frame=()=>{};g.paused=true;g.audio.pause();});
 for(let theme=0;theme<4;theme++){
  const draws=await page.evaluate(async theme=>{const g=window.__golfTest;g.setCourse(theme);g.loadHole(0);await g.world.waitForAssets();g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;return g.world.root.getObjectByName('Tee markers')?.children.length;},theme);assert.equal(draws,4);
  for(const view of ['tee','detail']){
   await page.evaluate(async view=>{const g=window.__golfTest,{heightAt,routePoint}=await import('/src/course.js'),{Vector3}=await import('/node_modules/three/build/three.module.js');
    if(view==='tee'){const route=routePoint(g.course,.1);g.camera.fov=48;g.camera.position.set(0,heightAt(g.course,0,-9)+2.4,-9);g.camera.lookAt(route.x,heightAt(g.course,route.x,route.z)+1,route.z);}
    else{const frame=g.world.root.getObjectByName('Tee markers').userData.frames[0],p=new Vector3().setFromMatrixPosition(frame),up=new Vector3().setFromMatrixColumn(frame,1),forward=new Vector3().setFromMatrixColumn(frame,2),right=new Vector3().setFromMatrixColumn(frame,0);g.camera.fov=38;g.camera.position.copy(p).addScaledVector(forward,-.95).addScaledVector(up,.45).addScaledVector(right,.4);g.camera.lookAt(p.addScaledVector(up,.075));}
    g.camera.updateProjectionMatrix();g.world.update(g.time,0,g.camera.position,g.camera.position);g.rendering.render('high');
   },view);
   await page.screenshot({path:`/tmp/ninja-tee-markers-${theme}-${view}.png`});
  }
 }
 assert.deepEqual(errors,[]);console.log('All four tee marker finishes and ground contact captured without shader errors.');
}finally{await browser.close();}
