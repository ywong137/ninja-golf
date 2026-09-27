import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,args:['--mute-audio','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
try{
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.click('#audio-toggle');await page.click('#play');
 await page.evaluate(async()=>{const g=window.__golfTest;g.audio.pause();g.paused=true;g.frame=()=>{};await g.world.waitForAssets();window.__materialSaved=new Map();});
 for(const theme of ['japanese','highlands','desert','cyberpunk']){
  for(let hero=0;hero<6;hero++){
   await page.evaluate(({theme,hero})=>{
    const g=window.__golfTest;g.selectWarrior(hero);g.audio.pause();g.player.update(.2,0,{selection:true});g.world.applyTheme({theme});g.scene.userData.courseTheme=theme;g.portraitLights.visible=true;g.portraitLights.position.copy(g.player.root.position);g.player.root.updateMatrixWorld(true);
    const head=g.player.bones.Head.getWorldPosition(g.camera.position.clone());head.y+=.19;g.camera.fov=28;g.camera.updateProjectionMatrix();g.camera.position.copy(head).add({x:.22,y:.06,z:1.9});g.camera.lookAt(head);
    const offset=g.world.sun.position.clone().sub(g.world.sun.target.position);g.world.sun.target.position.copy(g.player.root.position);g.world.sun.position.copy(g.player.root.position).add(offset);g.world.sun.target.updateMatrixWorld();
    for(const e of document.querySelectorAll('.screen,#hud,#toast,#hole-banner'))e.style.visibility='hidden';
    g.player.model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.nativeSurfaceFinish&&!window.__materialSaved.has(m)){const record={};for(const key of ['roughness','roughnessMap','transparent','alphaTest','alphaToCoverage','forceSinglePass','depthWrite'])record[key]=m[key];window.__materialSaved.set(m,record);}});
   },{theme,hero});
   for(const finish of ['before','after']){
    const state=await page.evaluate(finish=>{const g=window.__golfTest;for(const [m,saved]of window.__materialSaved){Object.assign(m,saved);if(finish==='before'){m.roughness=.67;m.roughnessMap=null;if(m.name.endsWith('_opacity')){m.transparent=true;m.alphaTest=0;m.alphaToCoverage=false;m.forceSinglePass=false;m.depthWrite=true;}}m.needsUpdate=true;}g.rendering.render('high');return {maps:[...window.__materialSaved.keys()].filter(m=>m.roughnessMap).map(m=>[m.name,m.roughnessMap.image?.width,m.roughnessMap.flipY])};},finish);
    if(finish==='after')assert.ok(state.maps.every(([,width,flip])=>width>=512&&flip===false),'Authored surface maps must load with GLTF UV orientation');
    await page.screenshot({path:`/tmp/ninja-material-${theme}-${hero}-${finish}.png`});
   }
  }
  await page.evaluate(()=>{const g=window.__golfTest;g.selectWarrior(3);g.player.update(.2,0,{selection:true});const p=g.player.root.position;g.camera.fov=48;g.camera.updateProjectionMatrix();g.camera.position.set(p.x+1,p.y+2.4,p.z+9);g.camera.lookAt(p.x-2.6,p.y+1.9,p.z);for(const e of document.querySelectorAll('.screen'))e.style.visibility='';g.rendering.render('high');});
  await page.screenshot({path:`/tmp/ninja-material-selection-${theme}.png`});
 }
 assert.deepEqual(errors,[]);console.log('All six faces and selection screens captured under four actual course lighting themes.');
}finally{await browser.close();}
