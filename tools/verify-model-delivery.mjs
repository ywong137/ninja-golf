// Test the built app through its public UI. Run against Vite preview or the deployed release.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from 'playwright';
import {WARRIOR_ASSET_NAMES} from '../src/warrior-assets.js';

const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('Usage: node tools/verify-model-delivery.mjs URL OUTPUT_DIRECTORY [--fallback]\nBuild first. Verifies the deployed bundle, exact model bytes, six selections, and a golf-to-combat transition.\n--fallback disables DecompressionStream to test the original GLB loader.');process.exit(0);
}
const [url,output]=args.filter(a=>!a.startsWith('--')),fallback=args.includes('--fallback');
if(!url||!output||args.some(a=>a.startsWith('--')&&a!=='--fallback'))throw Error('Usage: node tools/verify-model-delivery.mjs URL OUTPUT_DIRECTORY [--fallback]');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),hash=data=>createHash('sha256').update(data).digest('hex');
const html=await fs.readFile(path.join(root,'dist/index.html'),'utf8'),script=html.match(/src="([^\"]+\.js)"/)[1];
const expected={bundle:hash(await fs.readFile(path.join(root,'dist',script)))};
for(const name of WARRIOR_ASSET_NAMES)expected[name]=hash(await fs.readFile(path.join(root,'public/models',name+'.glb')));
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const errors=[],actual={},resources=[],jobs=[],selections=[],report={url,fallback,expected,actual,resources,selections,errors};
try{
 const probe=await browser.newPage(),userAgent=(await probe.evaluate(()=>navigator.userAgent)).replace('HeadlessChrome/','Chrome/');await probe.close();
 const context=await browser.newContext({userAgent,viewport:{width:1440,height:900}});
 if(fallback)await context.addInitScript(()=>{globalThis.DecompressionStream=undefined;});
 const page=await context.newPage(),network=await context.newCDPSession(page),requests=new Map();
 await network.send('Network.enable',{maxResourceBufferSize:67108864,maxTotalBufferSize:536870912});await network.send('Network.setCacheDisabled',{cacheDisabled:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 network.on('Network.responseReceived',event=>{
  const pathname=new URL(event.response.url).pathname;
  const name=WARRIOR_ASSET_NAMES.find(name=>pathname.endsWith('/'+name+'.glb')||pathname.endsWith('/'+name+'.glb.gz'))||(pathname.endsWith('/'+path.basename(script))?'bundle':null);
  if(name)requests.set(event.requestId,{name,url:event.response.url,status:event.response.status});
 });
 network.on('Network.loadingFinished',event=>{
  const item=requests.get(event.requestId);if(!item)return;
  jobs.push(network.send('Network.getResponseBody',{requestId:event.requestId}).then(body=>{
   const bytes=Buffer.from(body.body,body.base64Encoded?'base64':'utf8'),gzip=bytes[0]===0x1f&&bytes[1]===0x8b,decoded=gzip?gunzipSync(bytes):bytes;
   resources.push({...item,bodyBytes:bytes.length,decodedBytes:decoded.length,encodedBytes:event.encodedDataLength,gzip});actual[item.name]=hash(decoded);
  }).catch(e=>errors.push(item.name+': '+e.message)));
 });
 const started=performance.now();await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForSelector('#play',{state:'visible',timeout:180000});
 report.readyMilliseconds=performance.now()-started;
 await page.click('#play');
 for(let i=0;i<6;i++){
  await page.click(`[data-warrior="${i}"]`);await page.waitForFunction(i=>window.ninjaGolf?.state().playerIndex===i&&window.ninjaGolf.state().showcase?.time>.15,i,{timeout:15000});
  const state=await page.evaluate(()=>window.ninjaGolf.state());selections.push({hero:i,stage:state.showcase.stage,time:state.showcase.time});
 }
 await page.screenshot({path:path.join(output,'selection.png')});
 await page.click('#begin');await page.click('#start-round');await page.locator('#asset-curtain').waitFor({state:'detached',timeout:120000});
 await page.waitForFunction(()=>window.ninjaGolf.state().phase==='aim');
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().charging&&window.ninjaGolf.state().power>.62);
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='flight',{timeout:10000});await page.keyboard.press('Space');
 await page.waitForFunction(()=>window.ninjaGolf.state().phase==='combat',{timeout:45000});
 await page.keyboard.down('KeyW');await page.waitForTimeout(1000);await page.keyboard.up('KeyW');
 await page.waitForFunction(()=>window.ninjaGolf.state().enemies>0,{timeout:20000});
 await page.mouse.click(720,450);await page.waitForTimeout(500);await page.screenshot({path:path.join(output,'combat.png')});
 report.finalState=await page.evaluate(()=>window.ninjaGolf.state());
 await Promise.all(jobs);
 for(const row of resources.filter(r=>r.name!=='bundle'))assert.equal(new URL(row.url).pathname.endsWith('.gz'),!fallback,'Wrong model delivery path: '+row.url);
 assert.equal(resources.length,WARRIOR_ASSET_NAMES.length+1,'Each expected model and bundle must load exactly once');
 assert.deepEqual(actual,expected,'Loaded content must exactly match the local release');assert.deepEqual(errors,[]);
 report.modelBodyBytes=resources.filter(r=>r.name!=='bundle').reduce((n,r)=>n+r.bodyBytes,0);
 report.modelDecodedBytes=resources.filter(r=>r.name!=='bundle').reduce((n,r)=>n+r.decodedBytes,0);
 report.modelNetworkBytes=resources.filter(r=>r.name!=='bundle').reduce((n,r)=>n+r.encodedBytes,0);
 report.passed=true;
 console.log(JSON.stringify({url,fallback,verifiedModels:WARRIOR_ASSET_NAMES.length,modelBodyBytes:report.modelBodyBytes,modelDecodedBytes:report.modelDecodedBytes,modelNetworkBytes:report.modelNetworkBytes,readyMilliseconds:report.readyMilliseconds,phase:report.finalState.phase,errors}));
}finally{
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();
}
