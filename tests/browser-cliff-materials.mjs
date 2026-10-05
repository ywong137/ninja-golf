import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
if(process.argv.includes('--help')){console.log('Usage: node tests/browser-cliff-materials.mjs [DEV_URL] [OUTPUT_DIRECTORY]\nChecks delayed cliff maps, shared caching, failure fallback, and shader compilation. Audio stays muted.');process.exit(0);}
const [url='http://localhost:5184',out='/private/tmp/ninja-cliff-materials']=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']}),report={checks:[],errors:[],muted:true};
async function page(){const p=await browser.newPage({viewport:{width:1440,height:900}});await disableHmr(p);p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE.WebGL'))report.errors.push(m.text());});await p.addInitScript(()=>{let seed=7319;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);localStorage.setItem('ninja-golf-audio-settings',JSON.stringify({enabled:false,musicEnabled:false,volume:0}));});return p;}
async function ready(p){await p.goto(url);await p.waitForFunction(()=>window.__golfTest&&!document.querySelector('#asset-curtain'),null,{timeout:120000});await p.evaluate(()=>{const g=__golfTest;g.renderer.setAnimationLoop(null);g.paused=true;g.audio.enabled=false;g.audio.pause();});}
async function desert(p){await p.evaluate(async()=>{const g=__golfTest,{loadNature}=await import('/src/nature.js');await loadNature('desert');g.setCourse(2);g.loadHole(0);});}
async function render(p,name){const row=await p.evaluate(()=>{const g=__golfTest,s=g.world.landscapeRocks.get('desert');g.player.root.visible=false;g.camera.position.set(200,120,850);g.camera.lookAt(0,350,3000);g.world.update(120,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);return{available:s.available.value,colorFallback:s.color.value===g.world.rockColor,normalFallback:s.normal.value===g.world.rockNormal,colorSpace:s.color.value.colorSpace,normalSpace:s.normal.value.colorSpace,width:s.color.value.image?.width,height:s.normal.value.image?.height,samplerLimit:g.renderer.getContext().getParameter(g.renderer.getContext().MAX_TEXTURE_IMAGE_UNITS)};});await p.addStyleTag({content:'#app>:not(canvas){display:none!important}'});await p.screenshot({path:out+'/'+name+'.png'});return row;}
try{
 const p=await page();let release,seen;const gate=new Promise(r=>release=r),requested=new Promise(r=>seen=r),requests=[];
 await p.route('**/textures/sandstone-*-2k.jpg',async route=>{requests.push(route.request().url());if(requests.length===2)seen();await gate;await route.continue();});
 await ready(p);console.log('Initial course ready');assert.equal(await p.evaluate(()=>__golfTest.world.landscapeRocks.size),0);assert.equal(requests.length,0);
 await desert(p);console.log('Desert requested');await requested;await p.evaluate(()=>{window.assetsComplete=false;__golfTest.world.waitForAssets().then(()=>window.assetsComplete=true);});
 const pending=await render(p,'pending');assert.equal(pending.available,0);assert.ok(pending.colorFallback&&pending.normalFallback);assert.equal(await p.evaluate(()=>window.assetsComplete),false);
 await p.evaluate(()=>{__golfTest.setCourse(0);__golfTest.loadHole(0);});release();await p.waitForFunction(()=>window.assetsComplete);assert.equal(await p.evaluate(()=>__golfTest.course.theme),'japanese');
 await desert(p);await p.evaluate(()=>__golfTest.world.waitForAssets());const loaded=await render(p,'loaded');assert.equal(loaded.available,1);assert.ok(!loaded.colorFallback&&!loaded.normalFallback);assert.equal(loaded.width,2048);assert.equal(loaded.height,2048);assert.equal(loaded.colorSpace,'srgb');assert.equal(loaded.normalSpace,'');assert.equal(requests.length,2);report.loaded=loaded;report.checks.push('Maps load only for Arizona; pending pairs use existing maps; late responses preserve selection; revisits reuse both maps');await p.close();
 report.failures=[];
 for(const failed of ['color','normal']){
  const f=await page();await f.route(`**/textures/sandstone-${failed}-2k.jpg`,route=>route.abort('failed'));await ready(f);await desert(f);await f.evaluate(()=>__golfTest.world.waitForAssets());const row=await render(f,failed+'-failed');assert.equal(row.available,0);assert.ok(row.colorFallback&&row.normalFallback);report.failures.push({failed,...row});await f.close();
 }
 report.checks.push('Either failed map restores the complete fallback pair, without shader errors');assert.deepEqual(report.errors,[]);report.passed=true;
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
