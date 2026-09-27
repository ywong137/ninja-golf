import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const label=process.argv[2]||'after',browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});await page.evaluate(()=>{const g=window.__golfTest;g.frame=()=>{};g.paused=true;g.audio.pause();});
 for(const [theme,hole]of [[1,2],[2,6]]){
  const result=await page.evaluate(async({theme,hole})=>{const g=window.__golfTest;g.setCourse(theme);g.loadHole(hole);await g.world.waitForAssets();g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.puttingGuide.root.visible=false;const c=g.course;g.camera.fov=48;g.camera.updateProjectionMatrix();g.camera.position.set(150,c.length*1.2,c.length*.02);g.camera.lookAt(-10,8,c.length*.48);g.world.update(g.time,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);return{name:c.name,segments:c.layout.segments.length,drawCalls:g.renderer.info.render.calls};},{theme,hole});await page.screenshot({path:`/tmp/fairway-curves-${label}-${theme}.png`});console.log(JSON.stringify(result));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
