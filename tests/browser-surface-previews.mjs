import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
if(process.argv.includes('--help')){console.log('Usage: node tests/browser-surface-previews.mjs [DEV_URL]\nChecks preview dimensions, background upgrades, and original pixels. Audio stays muted.');process.exit(0);}
const base=process.argv[2]||'http://127.0.0.1:5173',browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage();await disableHmr(page);await page.goto(base+'/favicon.svg');
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{ProgressiveTextures}=await import('/src/progressive-textures.js'),manifest=await fetch('/textures/previews/manifest.json').then(r=>r.json()),loader=new T.TextureLoader();
  const delivery=new ProgressiveTextures({loader,base:'/textures/',manifest});
  let ready;const previewReady=new Promise(resolve=>ready=resolve),texture=delivery.load('turf-normal-2k.jpg',ready);texture.repeat.set(7,11);texture.wrapS=T.RepeatWrapping;await previewReady;
  const preview={width:texture.image.width,height:texture.image.height};delivery.start();
  await new Promise((resolve,reject)=>{const end=performance.now()+15000;const check=()=>{if(!delivery.active&&!delivery.queue.length)resolve();else if(performance.now()>end)reject(Error('Detail upgrade timed out.'));else setTimeout(check,30);};check();});
  const original=await loader.loadAsync('/textures/turf-normal-2k.jpg');
  const pixels=image=>{const canvas=new OffscreenCanvas(image.width,image.height);const c=canvas.getContext('2d');c.drawImage(image,0,0);return c.getImageData(0,0,canvas.width,canvas.height).data;};
  const a=pixels(texture.image),b=pixels(original.image);let mismatches=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])mismatches++;
  const result={preview,full:{width:texture.image.width,height:texture.image.height},mismatches,repeat:texture.repeat.toArray(),repeatWrap:texture.wrapS===T.RepeatWrapping};texture.dispose();original.dispose();return result;
 });
 assert.deepEqual(result.preview,{width:1024,height:1024});assert.deepEqual(result.full,{width:2048,height:2048});assert.equal(result.mismatches,0);assert.deepEqual(result.repeat,[7,11]);assert.equal(result.repeatWrap,true);console.log(JSON.stringify(result));
}finally{await browser.close();}
