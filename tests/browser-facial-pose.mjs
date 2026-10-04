import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,args:['--mute-audio','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
try{
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);await page.click('#play');
 await page.evaluate(async()=>{const g=window.__golfTest;g.audio.pause();g.paused=true;g.frame=()=>{};await g.world.waitForAssets();window.FacialPose=(await import('/src/facial-pose.js')).FacialPose;const T=await import('/node_modules/three/build/three.module.js');window.faceNeutral=new T.Group();window.faceNeutral.add(new T.HemisphereLight(0xffffff,0x777777,2));const key=new T.DirectionalLight(0xffffff,2);key.position.set(-2,4,5);window.faceNeutral.add(key);g.scene.add(window.faceNeutral);window.faceNeutral.visible=false;});
 for(let hero=0;hero<6;hero++){
  await page.evaluate(hero=>{const g=window.__golfTest;g.selectWarrior(hero);g.player.update(.2,0,{selection:true});g.player.facialPose?.restore();g.player.facialPose=null;window.facePose=new window.FacialPose(g.player.bones);g.player.root.updateMatrixWorld(true);g.world.applyTheme({theme:'japanese'});g.scene.userData.courseTheme='japanese';g.portraitLights.visible=true;g.portraitLights.position.copy(g.player.root.position);const eye=g.player.bones.Bip01_REye.getWorldPosition(g.camera.position.clone()),left=g.player.bones.Bip01_LEye.getWorldPosition(g.camera.position.clone());eye.add(left).multiplyScalar(.5);window.faceTarget=eye;g.camera.fov=23;g.camera.updateProjectionMatrix();for(const e of document.querySelectorAll('.screen,#hud,#toast,#hole-banner'))e.style.visibility='hidden';},hero);
  for(const angle of ['front','side'])for(const [state,lighting]of [['rest','neutral'],['gaze','neutral'],['effort','neutral'],['effort','selection'],['effort','course']]){
   await page.evaluate(({angle,state,lighting})=>{const g=window.__golfTest,p=window.facePose;p.restore();p.yaw=p.pitch=p.effort=p.anger=0;const inputs=state==='gaze'?{gazeYaw:.07,gazePitch:.035}:state==='effort'?{exertion:1,musou:1}:{enabled:false};for(let i=0;i<90;i++){p.restore();p.apply(1/60,inputs);}g.player.root.updateMatrixWorld(true);g.portraitLights.visible=lighting==='selection';g.world.sun.visible=lighting!=='neutral';g.world.hemisphere.visible=lighting!=='neutral';window.faceNeutral.visible=lighting==='neutral';g.camera.position.copy(window.faceTarget).add({x:angle==='side'?.85:.08,y:.015,z:angle==='side'?.9:1.2});g.camera.lookAt(window.faceTarget);g.rendering.render('high');},{angle,state,lighting});
   await page.screenshot({path:`/tmp/ninja-face-pose-${hero}-${angle}-${state}-${lighting}.png`});
  }
 }
 assert.deepEqual(errors,[]);console.log('Six native facial overlays captured from front and side; no browser errors.');
}finally{await browser.close();}
