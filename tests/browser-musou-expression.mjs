import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const output=process.env.REVIEW_OUTPUT??'artifacts/musou-review';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await disableHmr(page);
 await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest);await preloadWarriorFixtures(page);
 await page.evaluate(async()=>{const g=window.__golfTest;g.audio.pause();g.audio.enabled=false;g.frame=()=>{};await g.world.waitForAssets();g.ui.showScreen('game');});
 const reports=[];
 for(let hero=0;hero<6;hero++){
  const report=await page.evaluate(async hero=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const g=window.__golfTest;g.clearEnemies();g.selectWarrior(hero);g.mode='game';g.phase='combat';g.paused=false;g.resolve=100;g.player.root.rotation.y=0;
   g.updateCamera(10);g.attack('musou');const duration=g.cinematic;
   // Step through the real cinematic, including its slowed body clock.
   let angerAtQuarterSecond=0;
   for(let frame=0;frame<135;frame++){
    g.time+=1/60;g.updateCombat(1/60);g.updateCamera(1/60);
    if(frame===14)angerAtQuarterSecond=g.player.facialPose.anger;
   }
   g.portraitLights.visible=true;g.portraitLights.position.copy(g.player.root.position);
   g.rendering.render('high');
   for(const animation of document.getAnimations()){animation.pause();animation.currentTime=2250;}
   const eye=g.player.bones.Bip01_REye.getWorldPosition(new T.Vector3()).add(g.player.bones.Bip01_LEye.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
   const screen=eye.clone().project(g.camera),clip=g.player.current;
   return {hero,duration,remaining:g.cinematic,angerAtQuarterSecond,anger:g.player.facialPose.anger,nativeMorphs:g.player.facialPose.morphs.map(m=>m.mesh.morphTargetInfluences[m.index]),eyeScreen:[screen.x,screen.y],cameraDistance:g.camera.position.distanceTo(eye),clip};
  },hero);
  await page.screenshot({path:`${output}/hero-${hero}.png`});reports.push(report);
  assert.ok(report.duration>=2.8&&report.remaining>0,'The close-up must retain its full duration');
  assert.ok(report.nativeMorphs.length>0&&report.nativeMorphs.every(w=>w>.99),'The native face must use its angry mesh target');
  assert.ok(report.angerAtQuarterSecond>.9,'The face must react on real time, not the slowed body clock');
  assert.ok(Math.abs(report.eyeScreen[0])<.15&&Math.abs(report.eyeScreen[1])<.15,'Camera centers the actual eyes');
  assert.ok(report.cameraDistance>.4&&report.cameraDistance<.8,'Camera shows a facial close-up');
  await page.evaluate(()=>{const g=window.__golfTest;for(let i=0;i<60&&g.cinematic>0;i++){g.time+=1/60;g.updateCombat(1/60);}if(g.action?.kind!=='musou')throw Error('Cinematic did not enter the musou attack');g.clearEnemies();});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/report.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();}
