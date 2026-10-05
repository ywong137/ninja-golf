// Real UI coverage for production asset delivery, cancellation, retry, and saved rounds.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {WARRIOR_ASSET_NAMES} from '../src/warrior-assets.js';

if(process.argv.includes('--help')){console.log('Usage: node tests/browser-character-loading.mjs [BUILT_APP_URL] [OUTPUT_DIRECTORY] [--baseline]\nBuild and start Vite preview first. Checks real selection, download retries, saved rounds, and combat with audio muted.\n--baseline measures startup without asserting lazy loading.');process.exit(0);}
const [url='http://127.0.0.1:4184',output='/private/tmp/ninja-character-loading',flag]=process.argv.slice(2);
if(flag&&flag!=='--baseline')throw new Error('Usage: node tests/browser-character-loading.mjs URL OUTPUT_DIRECTORY [--baseline]');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const report={url,baseline:flag==='--baseline',errors:[],checks:[]};
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(120000);
 page.on('pageerror',error=>report.errors.push(error.message));
 const session=await page.context().newCDPSession(page);await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
 const started=performance.now();await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.ninjaGolf);report.titleMilliseconds=performance.now()-started;
 await page.locator('#asset-curtain').waitFor({state:'detached'});report.readyMilliseconds=performance.now()-started;
 report.startup=await page.evaluate(names=>performance.getEntriesByType('resource').filter(r=>names.some(name=>new URL(r.name).pathname.endsWith('/'+name+'.glb.gz')||new URL(r.name).pathname.endsWith('/'+name+'.glb'))).map(r=>({url:r.name,bytes:r.encodedBodySize,networkBytes:r.transferSize})),WARRIOR_ASSET_NAMES);
 report.modelBytes=report.startup.reduce((sum,r)=>sum+r.bytes,0);
 await page.screenshot({path:path.join(output,'title.png')});
 if(!report.baseline){
  const loaded=report.startup.map(r=>new URL(r.url).pathname.split('/').at(-1).replace(/\.glb(\.gz)?$/,''));
  assert.deepEqual(loaded,[],'The aerial title needs no character models');
  assert.equal(report.modelBytes,0);report.checks.push('Title downloads no hidden hero, enemies, or motion source models');
  let motionFailures=0;await page.route('**/assets/motion-ronin-*.json',route=>++motionFailures===1?route.abort('failed'):route.continue());
  await page.click('#audio-toggle');await page.click('#play');
  await page.locator('#character-retry').waitFor({state:'visible'});await page.click('#character-cancel');
  assert.equal(await page.evaluate(()=>window.ninjaGolf.state().mode),'home');await page.click('#play');
  const ready=index=>page.waitForFunction(i=>window.ninjaGolf.state().playerIndex===i&&!!window.ninjaGolf.state().showcase&&document.querySelector('#character-loading').classList.contains('hidden'),index);
  await ready(0);assert.equal(motionFailures,2);report.checks.push('The first hero can cancel and retry an interrupted motion download without an existing player model');
  let releaseMonk,monkRequested;const monkGate=new Promise(resolve=>releaseMonk=resolve),monkStarted=new Promise(resolve=>monkRequested=resolve);
  await page.route('**/models/monk.glb*',async route=>{monkRequested();await monkGate;await route.continue();});
  await page.click('[data-warrior="2"]');await monkStarted;
  assert.equal(await page.locator('#begin').isDisabled(),true);await page.screenshot({path:path.join(output,'loading.png')});
  await page.click('[data-warrior="1"]');await ready(1);const monkResponse=page.waitForResponse(response=>response.url().includes('/models/monk.glb'));releaseMonk();
  // Wait for the delayed model to finish, then give its parse/material work time to complete.
  await monkResponse;
  await page.waitForTimeout(2500);assert.equal(await page.evaluate(()=>window.ninjaGolf.state().playerIndex),1);
  report.checks.push('A late download cannot replace the latest selection');
  let failures=0;await page.route('**/models/ayame.glb*',route=>++failures===1?route.abort('failed'):route.continue());
  await page.click('[data-warrior="4"]');await page.locator('#character-retry').waitFor({state:'visible'});
  assert.equal(await page.locator('#begin').isDisabled(),true);await page.click('#character-retry');await ready(4);assert.equal(failures,2);
  report.checks.push('Interrupted model downloads show a working retry');
  // Kaede uses f003_body; a failed surface must not poison another character's readiness.
  let textureFailures=0;await page.route('**/textures/outfits/f003_body-outfit.webp',route=>++textureFailures===1?route.abort('failed'):route.continue());
  await page.click('[data-warrior="3"]');await page.locator('#character-retry').waitFor({state:'visible'});
  await page.click('[data-warrior="1"]');await ready(1);
  await page.click('[data-warrior="3"]');await ready(3);assert.equal(textureFailures,2);
  report.checks.push('A failed outfit can retry and does not block other heroes');
  let releaseSora,soraRequested;const soraGate=new Promise(resolve=>releaseSora=resolve),soraStarted=new Promise(resolve=>soraRequested=resolve);
  await page.route('**/models/sora.glb*',async route=>{soraRequested();await soraGate;await route.continue();});
  await page.click('[data-warrior="5"]');await soraStarted;await page.click('#back-home');const soraResponse=page.waitForResponse(response=>response.url().includes('/models/sora.glb'));releaseSora();
  await soraResponse;await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(()=>window.ninjaGolf.state().mode),'home');assert.equal(await page.locator('#character-loading').isVisible(),false);
  report.checks.push('Leaving selection cancels its UI without a late screen change');
  await page.click('#play');for(let i=0;i<6;i++){await page.click(`[data-warrior="${i}"]`);await ready(i);}
  await page.screenshot({path:path.join(output,'selection.png')});report.checks.push('All six characters remain selectable');
  // Save an unloaded-on-next-boot hero, then use the actual Continue control after a reload.
  await page.click('[data-warrior="2"]');await ready(2);
  let releaseEnemy,enemyRequested;const enemyGate=new Promise(resolve=>releaseEnemy=resolve),enemyStarted=new Promise(resolve=>enemyRequested=resolve);
  await page.route('**/models/enemy-cloth-ninja.glb*',async route=>{enemyRequested();await enemyGate;await route.continue();});
  await page.click('#begin');await enemyStarted;await page.click('#start-round');
  await page.locator('#character-loading').waitFor({state:'visible'});
  await page.click('[data-course="0"]');await page.waitForFunction(()=>document.querySelector('#character-loading').classList.contains('hidden'));
  const enemyResponse=page.waitForResponse(response=>response.url().includes('/models/enemy-cloth-ninja.glb'));releaseEnemy();await enemyResponse;await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(()=>window.ninjaGolf.state().mode),'courses');
  report.checks.push('A changed course cancels a pending round while its enemy model loads');
  await page.click('#start-round');
  await page.waitForFunction(()=>window.ninjaGolf.state().mode==='game');
  // Resume is offered only after a completed hole. Seed that saved-progress fixture.
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('ninja-golf-save'));Object.assign(save,{scores:[4],penalties:[0],nextHole:1});localStorage.setItem('ninja-golf-save',JSON.stringify(save));});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ninjaGolf);await page.locator('#asset-curtain').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.ninjaGolf.state().playerIndex),0);
  await page.click('#audio-toggle');await page.click('#continue-round');await page.waitForFunction(()=>window.ninjaGolf.state().mode==='game'&&window.ninjaGolf.state().playerIndex===2);
  report.checks.push('Continue loads the saved hero before restoring the round');
  await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().charging&&window.ninjaGolf.state().power>.94);
  await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='flight');await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.ninjaGolf.state().phase!=='flight');assert.equal(await page.evaluate(()=>window.ninjaGolf.state().phase),'combat',JSON.stringify(await page.evaluate(()=>window.ninjaGolf.state())));await page.waitForFunction(()=>window.ninjaGolf.state().enemies>0);
  await page.mouse.click(720,450);await page.waitForTimeout(300);await page.screenshot({path:path.join(output,'combat.png')});
  report.finalState=await page.evaluate(()=>window.ninjaGolf.state());report.checks.push('A normal golf shot reaches combat with ninjas and attacks');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
 console.log(JSON.stringify({modelBytes:report.modelBytes,titleMilliseconds:report.titleMilliseconds,readyMilliseconds:report.readyMilliseconds,checks:report.checks,errors:report.errors}));
}catch(error){report.failure=error.message;if(page&&!page.isClosed()){report.finalState=await page.evaluate(()=>window.ninjaGolf?.state());await page.screenshot({path:path.join(output,'failure.png')});}throw error;}finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
