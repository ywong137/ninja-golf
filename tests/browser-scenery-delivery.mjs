import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {NATURE_ASSET_NAMES} from '../src/nature-assets.js';
if(process.argv.includes('--help')){console.log('Usage: node tests/browser-scenery-delivery.mjs [BUILT_APP_URL] [OUTPUT_DIRECTORY]\nBuild and start Vite preview first. Checks all four courses and the gzip fallback with audio muted.');process.exit(0);}
const [url='http://127.0.0.1:4184/',out='/private/tmp/ninja-scenery-delivery']=process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const report={url,audioMuted:true,cases:[]};
try{
 for(const fallback of [false,true]){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(fallback)await page.addInitScript(()=>{window.DecompressionStream=undefined;});
  await page.goto(url);await page.waitForFunction(()=>window.ninjaGolf,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached',timeout:120000});
  const suffix=fallback?'.meshopt.glb':'.meshopt.glb.gz';
  const assets=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).filter(name=>name.includes('/models/nature/')&&name.includes('.glb')));
  assert.deepEqual(assets.map(file=>file.split('/').at(-1)).sort(),NATURE_ASSET_NAMES.map(n=>n+suffix).sort());
  await page.click('#audio-toggle');await page.click('#play');await page.click('#begin');
  const courses=[];
  for(let i=0;i<(fallback?1:4);i++){
   await page.click(`[data-course="${i}"]`);await page.waitForTimeout(450);
   const state=await page.evaluate(()=>window.ninjaGolf.state());assert.equal(state.mode,'courses');assert.ok(state.triangles>10000);courses.push(state.courseId);
   if(!fallback)await page.screenshot({path:`${out}/course-${i}.png`});
  }
  if(!fallback)assert.equal(new Set(courses).size,4);
  await page.click('#start-round');await page.waitForFunction(()=>window.ninjaGolf.state().mode==='game'&&window.ninjaGolf.state().phase==='aim');assert.deepEqual(errors,[]);
  report.cases.push({fallback,assets,courses,errors});await page.close();
 }
 await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:['All eleven meshopt scenery files decode in the built game','All four course previews render','Browsers without gzip streams use the unwrapped meshopt files'],errors:[]}));
}finally{await browser.close();}
