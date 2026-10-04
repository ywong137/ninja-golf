import {preloadWarriorFixtures} from './preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {disableHmr} from './disable-hmr.mjs';
const label=process.argv[2];
if(label==='--help'){console.log('Usage: node tools/capture-shorelines.mjs before|after\nCapture five pond environments in a muted browser. Output: /tmp/ninja-shorelines-LABEL.');process.exit(0);}
if(!['before','after'].includes(label)||process.argv.length>3)throw Error('Choose before or after. See --help.');
const directory=`/tmp/ninja-shorelines-${label}`;await mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],reports=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);await page.locator('#asset-curtain').waitFor({state:'detached'});await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 for(const [theme,hole,angle]of [[2,1,Math.PI],[2,5,0],[1,4,Math.PI/2],[0,1,-Math.PI/2],[3,7,0]]){
  const result=await page.evaluate(async({theme,hole,angle})=>{
   const g=window.__golfTest,C=await import('/src/course.js');g.frame=()=>{};g.begin(0,theme);g.loadHole(hole);g.paused=true;g.audio.pause();await g.world.waitForAssets();g.player.root.visible=false;g.ball.visible=false;g.aimLine.visible=false;g.aimMarker.visible=false;g.ballBeacon.visible=false;g.trail.visible=false;g.puttingGuide.hide?.();g.portraitLights.visible=false;
   const c=g.course,b=c.pond,water=C.waterSurfaceAt?.(c,b[0],b[1])??3.1,look=[b[0],water,b[1]],radius=Math.max(b[2],b[3]);
   const views={aerial:{camera:[b[0]+radius*.45,water+radius*1.15,b[1]-radius*1.65],look,fov:52},shore:{camera:[b[0]+Math.cos(angle)*(b[2]+15),C.heightAt(c,b[0]+Math.cos(angle)*(b[2]+15),b[1]+Math.sin(angle)*(b[3]+15))+3,b[1]+Math.sin(angle)*(b[3]+15)],look:[b[0]-Math.cos(angle)*b[2]*.3,water+.5,b[1]-Math.sin(angle)*b[3]*.3],fov:60}};
   return {theme,hole,name:c.name,basin:b,water,views};
  },{theme,hole,angle});
  for(const [view,spec]of Object.entries(result.views)){
   await page.evaluate(spec=>{const g=window.__golfTest;g.camera.fov=spec.fov;g.camera.updateProjectionMatrix();g.camera.position.fromArray(spec.camera);g.camera.lookAt(...spec.look);g.world.update(12.5,0,null,g.camera.position);g.rendering.render('high');g.rendering.render('high');},spec);
   await page.screenshot({path:`${directory}/${theme}-${hole+1}-${view}.png`});
  }reports.push(result);
 }
 if(errors.length)throw Error(errors.join('\n'));await writeFile(`${directory}/report.json`,JSON.stringify(reports,null,2));console.log(`Captured ${reports.length*2} shoreline views: ${directory}`);
}finally{await browser.close();}
