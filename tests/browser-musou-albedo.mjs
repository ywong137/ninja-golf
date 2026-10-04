import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
const output=process.env.REVIEW_OUTPUT??'artifacts/musou-albedo';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.url().includes('sora-snarl')&&!r.ok())failed.push(r.status());});
 await disableHmr(page);await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5184');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 await page.evaluate(async()=>{const g=window.__golfTest;g.audio.pause();g.audio.enabled=false;g.frame=()=>{};await g.world.waitForAssets();g.clearEnemies();g.selectWarrior(5);g.mode='game';g.phase='combat';g.paused=false;g.resolve=100;g.ui.showScreen('game');g.player.root.rotation.y=0;g.attack('musou');for(let i=0;i<135;i++){g.time+=1/60;g.updateCombat(1/60);g.updateCamera(1/60);}g.portraitLights.visible=true;g.portraitLights.position.copy(g.player.root.position);for(const a of document.getAnimations()){a.pause();a.currentTime=2250;}});
 const rows=[];
 for(const theme of ['japanese','highlands','desert','cyberpunk'])for(const quality of ['high','balanced','low']){
  const result=await page.evaluate(({theme,quality})=>{
   const g=window.__golfTest,a=g.player;g.world.applyTheme({theme});g.scene.userData.courseTheme=theme;g.setQuality(quality);
   const weight=a.musouAlbedo.weight.value;g.rendering.render(quality);
   const gl=g.renderer.getContext(),size=120,x=Math.floor(gl.drawingBufferWidth/2-size/2),y=Math.floor(gl.drawingBufferHeight/2-size/2),before=new Uint8Array(size*size*4),after=new Uint8Array(before.length);
   gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,before);
   a.musouAlbedo.set(0);g.rendering.render(quality);gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,after);
   let changed=0,sum=0;for(let i=0;i<before.length;i+=4){const d=Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2]);sum+=d;if(d>6)changed++;}
   a.musouAlbedo.set(weight);g.rendering.render(quality);
   return {theme,quality,weight,changedPixels:changed,meanChannelDelta:sum/(size*size*3),maps:a.musouAlbedo.materials.map(m=>({normal:!!m.normalMap,roughness:!!m.roughnessMap,neutralWidth:m.map.image.width})),programs:g.renderer.info.programs.length};
  },{theme,quality});
  rows.push(result);assert.ok(result.weight>.99);assert.ok(result.changedPixels>2000,'The actual facial pixels must visibly use the angry texture');assert.ok(result.maps.every(m=>m.roughness&&m.neutralWidth>=1024));
  if(quality==='high')await page.screenshot({path:`${output}/${theme}.png`});
 }
 const recovery=await page.evaluate(()=>{
  const g=window.__golfTest,a=g.player;g.cinematic=0;g.action=null;g.attackTimer=0;
  for(let i=0;i<60;i++)a.update(g.time+i/60,1/60,{});const combat=a.musouAlbedo.weight.value;
  a.facialPose.apply(.1,{musou:1});a.update(g.time,.016,{golf:true});const golf=a.musouAlbedo.weight.value;
  a.facialPose.apply(.1,{musou:1});a.update(g.time,.016,{dodge:1});const dodge=a.musouAlbedo.weight.value;
  g.selectWarrior(0);const other=g.player.musouAlbedo;g.selectWarrior(5);const fresh=g.player.musouAlbedo.weight.value;
  return {combat,golf,dodge,other,fresh};
 });
 assert.ok(recovery.combat<.0001);assert.equal(recovery.golf,0);assert.equal(recovery.dodge,0);assert.equal(recovery.other,null);assert.equal(recovery.fresh,0);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({rows,recovery,errors,failed},null,2));console.log(JSON.stringify({rows,recovery,errors}));
}finally{await browser.close();}
