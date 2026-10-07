import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
if(process.argv.includes('--help')){console.log('Usage: node tests/browser-crowd-weapons.mjs [DEV_URL] [OUTPUT_DIRECTORY]\nCompare instanced enemy weapons against original meshes, including shadows, AO and death fades. Audio stays muted.');process.exit(0);}
const [url='http://127.0.0.1:5173',output='/private/tmp/ninja-crowd-weapons']=process.argv.slice(2);await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
const rows=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);await disableHmr(page);
 await page.addInitScript(()=>localStorage.setItem('ninja-golf-audio-settings',JSON.stringify({enabled:false,musicEnabled:false,volume:0})));
 page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.__golfTest);await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.evaluate(async()=>{
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.pause();await g.begin(0,0);await g.world.waitForAssets();g.paused=true;g.phase='combat';g.enemyBudget=1000;g.enemiesSpawned=0;g.spawnWave(64);g.crowd.update(g.enemies);
  if(g.enemies.length!==64)throw Error('Crowd fixture needs 64 enemies.');
  for(const object of [g.ball,g.aimLine,g.aimMarker,g.puttingGuide.root,g.portraitLights,g.ballBeacon])object.visible=false;
  g.renderer.setPixelRatio(1);g.rendering.resize();g.camera.clearViewOffset();
 });
 for(const pose of ['Sprint_Loop','Enemy_Thrust','Death01'])for(const view of ['front','side']){
  const row=await page.evaluate(async({pose,view})=>{
   const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js'),p=g.player.root.position;
   g.crowd.update(g.enemies,{batchWeapons:false});
   g.enemies.forEach((e,i)=>{e.emerging=null;e.root.visible=true;e.dead=0;e.root.scale.setScalar(1.1);e.mixer.stopAllAction();e.current='';e.overlays=[];const x=p.x+(i%8-3.5)*2.6,z=p.z+5+Math.floor(i/8)*3.4;e.root.position.set(x,g.groundHeight(x,z),z);e.root.rotation.set(0,i*.7,0);e.update(12.5,1,{previewPose:{clip:pose,time:e.actions.get(pose).getClip().duration*.48}});if(pose==='Death01'&&i%2===0){e.dead=.3;e.setDeathFade(.6);}});
   g.enemies[0].root.visible=false;g.enemies[1].weapon.visible=false;
   g.camera.position.set(p.x+(view==='side'?16:0),p.y+4,p.z-9);g.camera.lookAt(p.x,p.y+1,p.z+12);g.world.update(12.5,0,p,g.camera.position);g.scene.userData.crowdCount=64;
   const gl=g.renderer.getContext(),size=g.renderer.getDrawingBufferSize(new T.Vector2());
   const capture=enabled=>{g.crowd.update(g.enemies,{batchWeapons:enabled});g.rendering.render('high');g.rendering.render('high');const pixels=new Uint8Array(size.x*size.y*4);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return{pixels,calls:g.renderer.info.render.calls};};
   const before=capture(false),after=capture(true);let changed=0,totalDelta=0,maxDelta=0;
   for(let i=0;i<before.pixels.length;i+=4){let delta=0;for(let k=0;k<3;k++){const d=Math.abs(before.pixels[i+k]-after.pixels[i+k]);delta=Math.max(delta,d);totalDelta+=d;}if(delta>2)changed++;maxDelta=Math.max(maxDelta,delta);}
   return{pose,view,changed,maxDelta,meanDelta:totalDelta/(size.x*size.y*3),pixels:size.x*size.y,callsBefore:before.calls,callsAfter:after.calls};
  },{pose,view});rows.push(row);console.log(JSON.stringify(row));
  // Instancing stores transforms as float32. Only subpixel triangle boundaries may differ.
  assert.ok(row.changed/row.pixels<.001,JSON.stringify(row));assert.ok(row.meanDelta<.04,JSON.stringify(row));assert.ok(row.callsAfter<row.callsBefore-100);
  if(pose==='Enemy_Thrust')await page.screenshot({path:`${output}/${view}.png`});
 }
 const lifecycle=await page.evaluate(()=>{const g=window.__golfTest;g.crowd.update(g.enemies,{batchWeapons:false});const original=g.enemies.every(e=>{let visible=true;e.weapon.traverse(o=>{if(o.isMesh&&!o.visible)visible=false;});return visible;});g.clearEnemies();g.crowd.update([]);return{original,batches:g.crowd.weapons.batches.size};});
 assert.equal(lifecycle.original,true);assert.equal(lifecycle.batches,0);assert.deepEqual(errors,[]);
 await fs.writeFile(output+'/report.json',JSON.stringify({rows,lifecycle,errors},null,2));
}finally{await fs.writeFile(output+'/partial.json',JSON.stringify({rows,errors},null,2));await browser.close();}
