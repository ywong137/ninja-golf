import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest);await page.waitForSelector('#asset-curtain',{state:'detached'});
 await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});await mkdir('public/images',{recursive:true});
 for(let index=0;index<4;index++){
  const id=await page.evaluate(index=>{const g=window.__golfTest;g.paused=true;g.audio.pause();g.mode='courses';g.previewCourse(index);g.paused=true;g.camera.position.set(index===3?75:80,68,5);g.camera.lookAt(0,9,g.course.length*.57);g.world.update(g.time,.01,g.camera.position,g.camera.position);g.rendering.render(g.quality);return g.roundCourse.id;},index);
  await page.waitForTimeout(600);await page.evaluate(()=>{const g=window.__golfTest;g.rendering.render(g.quality)});await page.screenshot({path:`public/images/course-${id}.jpg`,type:'jpeg',quality:90});console.log(id);
 }
}finally{await browser.close();}
