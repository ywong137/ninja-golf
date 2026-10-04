import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const output=process.env.REVIEW_OUTPUT??'artifacts/reviews/musou-cutaway';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5174');await page.waitForFunction(()=>window.__golfTest);await preloadWarriorFixtures(page);await page.waitForSelector('#asset-curtain',{state:'detached',timeout:120000});
 await page.evaluate(()=>{const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.ui.showScreen('game');});
 const rows=[];
 for(const [course,hero]of [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,4],[2,4],[3,4]]){
  const row=await page.evaluate(async({course,hero})=>{
   const T=await import('/node_modules/three/build/three.module.js'),g=window.__golfTest;
   const prior={clip:g.renderer.localClippingEnabled,lights:g.portraitLights.visible,target:g.renderer.getRenderTarget()};
   g.begin(hero,course);g.audio.pause();await g.portraitReady;if(g.renderer.localClippingEnabled!==prior.clip||g.portraitLights.visible!==prior.lights||g.renderer.getRenderTarget()!==prior.target)throw Error('Preparation changed visible render state.');g.clearEnemies();g.ui.showScreen('game');g.mode='game';g.phase='combat';g.paused=false;g.resolve=100;g.shake=0;g.cameraYaw=0;g.player.root.rotation.y=0;g.updateCamera(10);g.attack('musou');
   for(let i=0;i<132;i++){g.time+=1/60;g.updateCombat(1/60);g.updateCamera(1/60);g.world.update(g.time,1/60,g.player.root.position,g.camera.position);}
   g.portraitLights.visible=true;g.portraitLights.position.copy(g.player.root.position);
   const focus=g.rendering.portraitFocus.clone(),direction=focus.clone().sub(g.camera.position).normalize();
   // Put a solid witness directly across the eyes. It must affect the untreated
   // image, disappear from the portrait, and remain visible outside that render.
   const witness=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0xff00ff,side:T.DoubleSide}));witness.position.copy(focus).addScaledVector(direction,-.18);witness.lookAt(g.camera.position);g.world.root.add(witness);
   const size=g.renderer.getDrawingBufferSize(new T.Vector2()),gl=g.renderer.getContext(),eye=focus.clone().project(g.camera),x=Math.round((eye.x*.5+.5)*size.x)-48,y=Math.round((eye.y*.5+.5)*size.y)-42;
   const capture=(quality,visible,enabled)=>{
    witness.visible=visible;const roots=g.rendering.portraitRoots;if(!enabled)g.rendering.portraitRoots=null;
    g.rendering.render(quality);const pixels=new Uint8Array(96*84*4);gl.readPixels(x,y,96,84,gl.RGBA,gl.UNSIGNED_BYTE,pixels);g.rendering.portraitRoots=roots;return pixels;
   };
   const difference=(a,b)=>{let pixels=0,max=0;for(let i=0;i<a.length;i+=4){let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(a[i+k]-b[i+k]));if(d>1)pixels++;max=Math.max(max,d);}return{pixels,max};};
   const qualities=[];
   for(const quality of ['high','balanced','low']){
    const start=performance.now(),reference=capture(quality,false,true),referenceMs=performance.now()-start;
    const obstructed=capture(quality,true,false),warm=performance.now(),corrected=capture(quality,true,true),correctedMs=performance.now()-warm;
    qualities.push({quality,referenceMs,correctedMs,withoutCutaway:difference(reference,obstructed),withCutaway:difference(reference,corrected)});
   }
   g.world.root.remove(witness);witness.geometry.dispose();witness.material.dispose();
   g.rendering.render('high');for(const a of document.getAnimations()){a.pause();a.currentTime=2200;}
   window.finishPortraitCase=()=>{
    for(let i=0;i<100&&g.cinematic>0;i++){g.time+=1/60;g.updateCombat(1/60);g.updateCamera(1/60);}
    const lingering=[];g.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.clippingPlanes?.length)lingering.push(o.name);});
    return{action:g.action?.kind,portrait:g.rendering.portraitRoots,localClipping:g.renderer.localClippingEnabled,lingering};
   };
   return{course,hero,qualities,anger:g.player.facialPose.anger,active:!!g.rendering.portraitRoots};
  },{course,hero});
  await page.screenshot({path:`${output}/course-${course}-hero-${hero}.png`});
  row.recovery=await page.evaluate(()=>window.finishPortraitCase());rows.push(row);
  for(const q of row.qualities){assert.ok(q.withoutCutaway.pixels>7000,JSON.stringify(row));assert.equal(q.withCutaway.pixels,0,JSON.stringify(row));assert.ok(q.withCutaway.max<=1,JSON.stringify(row));}
  assert.ok(row.active&&row.anger>.9);assert.deepEqual(row.recovery,{action:'musou',portrait:null,localClipping:false,lingering:[]});
 }
 fs.writeFileSync(output+'/browser-report.json',JSON.stringify({rows,errors},null,2));const interrupted=await page.evaluate(()=>{const g=window.__golfTest;g.clearEnemies();g.resolve=100;g.phase='combat';g.attack('musou');g.updateCamera(.1);const active=!!g.rendering.portraitRoots;g.clearEnemies();return{active,after:g.rendering.portraitRoots};});assert.deepEqual(interrupted,{active:true,after:null});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:rows.length,renderComparisons:rows.length*3,errors}));
}finally{await browser.close();}
