import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {COURSE_SETS} from '../src/course.js';
import {natureModelFilesForTheme} from '../src/nature-assets.js';
if(process.argv.includes('--help')){console.log('Usage: node tests/browser-course-loading.mjs [BUILT_APP_URL] [OUTPUT_DIRECTORY]\nChecks course-specific downloads, competing selections, retry, cancellation and saved rounds. Browser audio stays muted.');process.exit(0);}
const [url='http://127.0.0.1:4185/',out='/private/tmp/ninja-course-loading']=process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const report={url,audioMuted:true,checks:[],errors:[]};let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(90000);page.on('pageerror',error=>report.errors.push(error.message));
 await page.addInitScript(()=>{let seed=9127;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);localStorage.setItem('ninja-golf-audio-settings',JSON.stringify({enabled:false,musicEnabled:false,volume:0}));});
 const ready=()=>page.waitForFunction(()=>window.ninjaGolf&&(!document.querySelector('#asset-curtain')));
 const courseReady=index=>page.waitForFunction(id=>window.ninjaGolf.state().courseId===id&&document.querySelector('#course-loading').classList.contains('hidden'),COURSE_SETS[index].id);
 await page.goto(url);await ready();
 const start=await page.evaluate(()=>window.ninjaGolf.state()),initial=COURSE_SETS.findIndex(c=>c.id===start.courseId),loaded=new Set(natureModelFilesForTheme(COURSE_SETS[initial].theme));
 report.initialCourse=start.courseId;
 report.startup=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/models/nature/')&&r.name.includes('.glb')).map(r=>({name:new URL(r.name).pathname.split('/').at(-1).replace(/\.meshopt\.glb(\.gz)?$/,''),bytes:r.encodedBodySize})));
 assert.deepEqual(report.startup.map(r=>r.name).sort(),[...loaded].sort());report.checks.push('Title downloads only its course scenery');
 await page.click('#play');await page.click('#begin');await courseReady(initial);
 const next=COURSE_SETS.findIndex(c=>natureModelFilesForTheme(c.theme).some(name=>!loaded.has(name)));
 const delayed=natureModelFilesForTheme(COURSE_SETS[next].theme).find(name=>!loaded.has(name));
 let release,requested;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>requested=resolve);let delayedRequests=0;
 await page.route(`**/models/nature/${delayed}.meshopt.glb*`,async route=>{delayedRequests++;requested();await gate;await route.continue();});
 await page.click(`[data-course="${next}"]`);await started;
 assert.equal(await page.locator('#start-round').isDisabled(),true);assert.equal((await page.evaluate(()=>window.ninjaGolf.state())).courseId,COURSE_SETS[initial].id);
 await page.screenshot({path:out+'/loading.png'});
 await page.click('#course-cancel');assert.equal(await page.locator('#start-round').isDisabled(),false);
 assert.equal(await page.locator(`[data-course="${initial}"]`).getAttribute('class').then(s=>s.includes('selected')),true);
 await page.click(`[data-course="${next}"]`);await page.click(`[data-course="${initial}"]`);release();
 await page.waitForResponse(response=>response.url().includes(`${delayed}.meshopt.glb`));await page.waitForTimeout(1000);
 assert.equal((await page.evaluate(()=>window.ninjaGolf.state())).courseId,COURSE_SETS[initial].id);
 await page.click(`[data-course="${next}"]`);await courseReady(next);assert.equal(delayedRequests,1);
 natureModelFilesForTheme(COURSE_SETS[next].theme).forEach(name=>loaded.add(name));
 report.checks.push('Cancel restores the current choice; repeated requests share downloads; late loads cannot replace the new choice');
 // Reset the in-memory scenery cache. Shared assets can cover every course after two selections.
 await page.unroute(`**/models/nature/${delayed}.meshopt.glb*`);
 await page.reload();await ready();loaded.clear();natureModelFilesForTheme(COURSE_SETS[initial].theme).forEach(name=>loaded.add(name));
 await page.click('#play');await page.click('#begin');await courseReady(initial);
 const failIndex=COURSE_SETS.findIndex(c=>natureModelFilesForTheme(c.theme).some(name=>!loaded.has(name)));
 assert.ok(failIndex>=0);const failed=natureModelFilesForTheme(COURSE_SETS[failIndex].theme).find(name=>!loaded.has(name));let failures=0;
 await page.route(`**/models/nature/${failed}.meshopt.glb*`,route=>++failures===1?route.abort('failed'):route.continue());
 await page.click(`[data-course="${failIndex}"]`);await page.locator('#course-retry').waitFor({state:'visible'});assert.equal(await page.locator('#start-round').isDisabled(),true);
 await page.click('#course-retry');await courseReady(failIndex);assert.equal(failures,2);report.checks.push('Failed scenery downloads retry successfully');
 for(let index=0;index<4;index++){await page.click(`[data-course="${index}"]`);await courseReady(index);await page.waitForTimeout(350);await page.screenshot({path:`${out}/course-${index}.png`});}
 report.checks.push('All four completed previews render');
 // Seed completed-hole progress, reload with the same title seed, then use Continue.
 const savedIndex=next;
 await page.evaluate(({id})=>localStorage.setItem('ninja-golf-save',JSON.stringify({version:2,courseId:id,scores:[4],penalties:[0],playerIndex:0,kills:7,bestCombo:3,nextHole:1})),{id:COURSE_SETS[savedIndex].id});
 await page.reload();await ready();assert.equal((await page.evaluate(()=>window.ninjaGolf.state())).courseId,report.initialCourse);
 await page.click('#continue-round');await page.waitForFunction(id=>window.ninjaGolf.state().mode==='game'&&window.ninjaGolf.state().courseId===id,COURSE_SETS[savedIndex].id);
 const saved=await page.evaluate(()=>window.ninjaGolf.state());assert.equal(saved.hole,1);assert.deepEqual(saved.scores,[4]);assert.equal(saved.kills,7);
 report.checks.push('Continue loads a different course before restoring the saved round');
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().charging&&window.ninjaGolf.state().power>.94);await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='flight');await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='combat');
 report.checks.push('The restored round reaches combat through normal shot controls');assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(page&&!page.isClosed()){await page.screenshot({path:out+'/failure.png'});report.state=await page.evaluate(()=>window.ninjaGolf?.state());}throw error;}
finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
