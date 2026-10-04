import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
// Verify the rendered pixels in the same frame that changes resolution.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

if(process.argv.includes('--help')){
 console.log('Usage: node tests/browser-resolution-frame.mjs [VITE_URL]\nChecks resolution decreases, increases, and stable frames. Audio stays muted.');
 process.exit(0);
}
const url=process.argv[2]||'http://localhost:5173';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await disableHmr(page);await page.goto(url);
 await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 const rows=await page.evaluate(async()=>{
  const g=window.__golfTest;
  g.audio.enabled=false;g.audio.pause();g.renderer.setAnimationLoop(null);
  g.begin(0,0);g.audio.pause();await g.portraitReady;
  const rows=[];g.quality='balanced';g.paused=false;
  for(const [initial,frames,expected]of [[1,24,.85],[.85,84,.95],[1,69,1]]){
   // Cross each FPS threshold, then execute the actual application frame.
   g.renderer.setPixelRatio(initial);g.renderer.setSize(innerWidth,innerHeight);g.rendering.resize();
   g.resolutionChangedAt=0;g.time=100;g.frameCount=frames;g.fpsTime=1.25;
   g.previousTime=performance.now()-16.667;g.frame();
   const gl=g.renderer.getContext(),pixels=new Uint8Array(32*32*4);
   gl.readPixels(Math.floor(gl.drawingBufferWidth/2)-16,Math.floor(gl.drawingBufferHeight/2)-16,32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   let opaque=0,color=0;
   for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]===255)opaque++;color+=pixels[i]+pixels[i+1]+pixels[i+2];}
   rows.push({initial,expected,actual:g.renderer.getPixelRatio(),opaque,total:1024,color});
  }
  return rows;
 });
 for(const row of rows){
  assert.ok(Math.abs(row.actual-row.expected)<1e-6,JSON.stringify(row));
  assert.equal(row.opaque,row.total,'Resolution change cleared the rendered scene: '+JSON.stringify(row));
  assert.ok(row.color>0,'Resolution change produced a black frame: '+JSON.stringify(row));
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({rows,errors}));
}finally{await browser.close();}
