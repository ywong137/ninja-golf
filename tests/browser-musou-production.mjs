import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
if(process.argv.includes('--help')){console.log('Usage: node tests/browser-musou-production.mjs [BUILT_APP_URL] [OUTPUT_DIRECTORY]\nBuild and start Vite preview first. Exercises real input, with audio muted.');process.exit(0);}
const url=process.argv[2]??'http://127.0.0.1:4184',out=process.argv[3]??'artifacts/reviews/musou-production';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],responses=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('musou/'))responses.push({url:r.url(),status:r.status()});});
 await page.goto(url);await page.waitForSelector('#play',{state:'visible',timeout:180000});await page.click('#play');await page.click('[data-warrior="5"]');await page.click('#begin');await page.click('#start-round');await page.locator('#asset-curtain').waitFor({state:'detached',timeout:120000});
 await page.keyboard.press('Space');await page.waitForTimeout(700);await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='flight',{},{timeout:15000});await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='combat',{},{timeout:45000});
 let ready=false;
 for(let i=0;i<160;i++){
  const s=await page.evaluate(()=>window.ninjaGolf.state());
  if(s.resolve>=100){ready=true;break;}
  await page.mouse.click(720,450,{button:i%3===2?'right':'left'});await page.waitForTimeout(380);
 }
 if(!ready)throw Error('Normal combat did not fill Resolve within review window');
 await page.waitForTimeout(3000);await page.keyboard.press('KeyF');await page.waitForTimeout(1200);
 const portrait=await page.locator('.cinema-portrait').evaluate(async el=>{const css=getComputedStyle(el),background=css.backgroundImage,image=new Image();image.src=JSON.parse(background.slice(4,-1));await image.decode();return{background,decodedWidth:image.naturalWidth,decodedHeight:image.naturalHeight,opacity:Number(css.opacity),box:el.getBoundingClientRect().toJSON()};});
 assert.ok(portrait.decodedWidth>0&&portrait.decodedHeight>0,'The actual CSS portrait URL must decode as an image, not an HTML fallback');
 assert.ok(portrait.opacity>.8,'The angry portrait must be visible during the close-up');assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'/musou.png'});fs.writeFileSync(out+'/report.json',JSON.stringify({url,portrait,responses,errors,state:await page.evaluate(()=>window.ninjaGolf.state())},null,2));console.log(JSON.stringify({portrait,responses,errors}));
}finally{await browser.close();}
