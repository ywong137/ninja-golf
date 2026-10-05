import fs from 'node:fs';import assert from 'node:assert/strict';import{chromium}from'playwright';
import{disableHmr}from'../tools/disable-hmr.mjs';
if(process.argv.includes('--help')){console.log('Usage: node tests/browser-regional-imagery.mjs [DEV_URL] [OUTPUT_DIRECTORY]\nChecks course-specific imagery, delayed responses, caching, failures and GPU shader limits. Audio stays muted.');process.exit(0);}
const [url='http://localhost:5184',out='/private/tmp/ninja-regional-imagery']=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});const report={muted:true,errors:[],checks:[]};
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});await disableHmr(p);p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE.WebGL'))report.errors.push(m.text());});
 await p.addInitScript(()=>{let seed=7319;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);localStorage.setItem('ninja-golf-audio-settings',JSON.stringify({enabled:false,musicEnabled:false,volume:0}));});
 await p.goto(url);await p.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await p.locator('#asset-curtain').waitFor({state:'detached'});
 const initial=await p.evaluate(()=>{const g=__golfTest;g.renderer.setAnimationLoop(null);g.paused=true;g.audio.enabled=false;g.audio.pause();return{theme:g.course.theme,images:[...g.world.regionalImages.keys()]};});report.initial=initial;
 assert.ok(initial.images.every(t=>t===initial.theme));report.checks.push('Only the initial course requests its regional image');
 const delayed=initial.theme==='highlands'?'desert':'highlands',index=delayed==='highlands'?1:2;
 let release,seen;const gate=new Promise(r=>release=r),requested=new Promise(r=>seen=r);let count=0;
 await p.route(`**/terrain/${delayed}-color-2k.jpg`,async route=>{count++;seen();await gate;await route.continue();});
 await p.evaluate(async index=>{const g=__golfTest,{loadNature}=await import('/src/nature.js');await loadNature(index===1?'highlands':'desert');g.setCourse(index);g.loadHole(0);window.imageWaitDone=false;g.world.waitForAssets().then(()=>window.imageWaitDone=true);},index);await requested;
 assert.deepEqual(await p.evaluate(theme=>({ready:__golfTest.world.regionalImages.get(theme).available.value,waitDone:window.imageWaitDone}),delayed),{ready:0,waitDone:false});
 // A late response may complete after another course becomes current.
 await p.evaluate(()=>{const g=__golfTest;g.setCourse(0);g.loadHole(0);});release();await p.waitForFunction(()=>window.imageWaitDone);
 assert.equal(await p.evaluate(()=>__golfTest.course.theme),'japanese');
 await p.evaluate(async index=>{const g=__golfTest;g.setCourse(index);g.loadHole(0);await g.world.waitForAssets();},index);assert.equal(count,1);
 report.loaded=await p.evaluate(theme=>{const s=__golfTest.world.regionalImages.get(theme);return{ready:s.available.value,width:s.map.value.image.width,height:s.map.value.image.height};},delayed);assert.deepEqual(report.loaded,{ready:1,width:2048,height:2048});report.checks.push('Slow images use fallback until ready; late completion preserves selection; revisits share the texture');
 await p.close();
 const f=await b.newPage({viewport:{width:1440,height:900}});await disableHmr(f);f.on('pageerror',e=>report.errors.push(e.message));f.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE.WebGL'))report.errors.push(m.text());});
 await f.addInitScript(()=>localStorage.setItem('ninja-golf-audio-settings',JSON.stringify({enabled:false,musicEnabled:false,volume:0})));
 await f.route('**/terrain/*-color-2k.jpg',route=>route.abort('failed'));
 await f.goto(url);await f.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await f.locator('#asset-curtain').waitFor({state:'detached'});await f.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 report.fallback=[];
 for(const [index,theme]of [[1,'highlands'],[2,'desert'],[3,'cyberpunk']]){
 const row=await f.evaluate(async({index,theme})=>{const g=__golfTest;g.renderer.setAnimationLoop(null);g.paused=true;g.audio.enabled=false;g.audio.pause();const {loadNature}=await import('/src/nature.js');await loadNature(theme);g.setCourse(index);g.loadHole(0);await g.world.waitForAssets();g.player.root.visible=false;g.camera.position.set(68,55,-55);g.camera.lookAt(0,10,180);g.world.update(120,0,g.camera.position,g.camera.position);g.rendering.render(g.quality);return{theme,ready:g.world.regionalImages.get(theme)?.available.value??null,triangles:g.world.horizon.geometry.index.count/3,samplerLimit:g.renderer.getContext().getParameter(g.renderer.getContext().MAX_TEXTURE_IMAGE_UNITS)};},{index,theme});
 assert.equal(row.ready,index===3?null:0);assert.ok(row.triangles>1000);report.fallback.push(row);await f.screenshot({path:out+'/'+theme+'-fallback.png'});
 }
 assert.deepEqual(report.errors,[]);report.checks.push('Both failed images retain visible terrain; all theme shaders fit the 16-sampler GPU limit');report.passed=true;
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await b.close();console.log(JSON.stringify(report));}
