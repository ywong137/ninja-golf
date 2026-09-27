import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await disableHmr(page);await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest||document.body.innerText.includes('The course could not load.'),{},{timeout:60000});if(!await page.evaluate(()=>!!window.__golfTest))throw new Error(errors.join('\n')||'Game startup failed');await page.waitForSelector('#asset-curtain',{state:'detached'});
 await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});await mkdir('public/images',{recursive:true});
 for(let index=0;index<4;index++){
  const id=await page.evaluate(async index=>{const g=window.__golfTest;g.paused=true;g.audio.pause();g.mode='courses';g.previewCourse(index);g.paused=true;const {routePoint,heightAt}=await import('/src/course.js');const look=routePoint(g.course,.46);g.camera.position.set(68,55,-55);g.camera.lookAt(look.x,heightAt(g.course,look.x,look.z)+5,look.z);g.world.update(g.time,.01,g.camera.position,g.camera.position);g.rendering.render(g.quality);return g.roundCourse.id;},index);
  await page.waitForTimeout(600);await page.evaluate(()=>{const g=window.__golfTest;g.rendering.render(g.quality)});await page.screenshot({path:`public/images/course-${id}.jpg`,type:'jpeg',quality:90});console.log(id);
 }
}finally{await browser.close();}
