import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {disableHmr} from '../tools/disable-hmr.mjs';

const output='/tmp/ninja-selection-framing';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 await page.evaluate(async()=>{
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();await g.world.waitForAssets();
  g.ui.showScreen('selection');g.selectScreen();
  const {measureShowcaseBounds}=await import('/tools/showcase-bound-sampling.mjs');
  // A different sampling grid checks between the 60 Hz bake frames.
  window.measuredPreview={};
  for(let hero=0;hero<6;hero++){
   g.selectWarrior(hero);g.stopShowcase();window.measuredPreview[hero]=measureShowcaseBounds(g.player,{rate:43});
  }
 });
 const rows=[];
 for(const [width,height]of [[1440,900],[1280,720],[1280,600],[1024,768],[1920,1080]]){
  await page.setViewportSize({width,height});
  // Let the actual resize listener and ResizeObserver run before drawing.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  for(const expanded of [false,true]){
   await page.evaluate(expanded=>{const g=window.__golfTest;if((g.ui.$('showcase-console-toggle').getAttribute('aria-expanded')==='true')!==expanded)g.ui.toggleShowcaseConsole();},expanded);
   const result=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js'),g=window.__golfTest;
    const box=el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const contains=(outer,inner)=>inner.left>=outer.left-1&&inner.top>=outer.top-1&&inner.right<=outer.right+1&&inner.bottom<=outer.bottom+1;
    const cards=[...document.querySelectorAll('.warrior-card')];
    for(const card of cards)for(const child of card.querySelectorAll('.warrior-top,h3,.warrior-title,.stats'))if(!contains(box(card),box(child)))throw Error('Card content escapes '+JSON.stringify({viewport:[innerWidth,innerHeight],card:box(card),child:box(child),className:child.className,expanded:g.ui.$('showcase-console-toggle').getAttribute('aria-expanded')}));
    const roster=box(document.querySelector('.selection-roster')),stage=box(g.ui.$('selection-stage')),controls=box(document.querySelector('.showcase-controls')),footer=box(document.querySelector('#selection .selection-bottom'));
    if(roster.right>=stage.left||controls.bottom>footer.top||stage.bottom>footer.top||footer.bottom>innerHeight)throw Error('Selection regions overlap or leave the viewport');
    const viewport={left:0,top:0,right:innerWidth,bottom:innerHeight};
    for(const selector of ['#showcase-console-toggle','#showcase-pause','#begin','#back-home']){
     const el=document.querySelector(selector);if(el.getClientRects().length&&!contains(viewport,box(el)))throw Error(selector+' is unreachable');
    }
    const fits=[];
    for(let hero=0;hero<6;hero++){
     g.selectWarrior(hero);g.ui.previewRect=null;g.updateCamera(0,{immediate:true});g.camera.updateMatrixWorld(true);g.player.root.updateMatrixWorld(true);
     const screen=new T.Box3(),p=new T.Vector3();
     for(const point of window.measuredPreview[hero].hull){p.fromArray(point).applyMatrix4(g.player.root.matrixWorld).project(g.camera);screen.expandByPoint(p);}
     const r={left:(screen.min.x+1)*innerWidth/2,right:(screen.max.x+1)*innerWidth/2,top:(1-screen.max.y)*innerHeight/2,bottom:(1-screen.min.y)*innerHeight/2};
     if(!contains(stage,r))throw Error('Complete weapon/character preview leaves its region: '+JSON.stringify({hero,stage,r}));
     fits.push({hero,margin:Math.min(r.left-stage.left,stage.right-r.right,r.top-stage.top,stage.bottom-r.bottom)});
    }
    return{viewport:[innerWidth,innerHeight],expanded:g.ui.$('showcase-console-toggle').getAttribute('aria-expanded'),fits};
   });rows.push(result);
   // Every roster card remains reachable, including when the console takes space.
   for(const hero of [0,3,1,4,2,5])await page.locator(`[data-warrior="${hero}"]`).click();
   await page.evaluate(()=>{const g=window.__golfTest;g.selectWarrior(2);g.showcase.clock.paused=false;g.showcase.clock.setSpeed(1);g.showcase.update(6.3);g.updateCamera(0,{immediate:true});g.world.update(g.time,.01,g.player.root.position,g.camera.position);g.portraitLights.visible=true;g.portraitLights.position.copy(g.player.root.position);g.updateShowcaseUI();g.rendering.render(g.quality);});
   await page.screenshot({path:`${output}/layout-${width}-${height}-${expanded?'open':'closed'}.png`});
  }
 }
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const courses=[];
 for(let course=0;course<4;course++){
  courses.push(await page.evaluate(async course=>{
   const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js');
   g.setCourse(course);g.loadHole(g.roundCourse.preview?.hole||0);await g.world.waitForAssets();g.selectScreen();g.selectWarrior(2);g.updateCamera(0,{immediate:true});
   // Exercise the production frame, including its cascaded shadows and camera clamp.
   g.previousTime=performance.now();g.frame();g.camera.updateMatrixWorld(true);g.player.root.updateMatrixWorld(true);
   const shadow=g.world.sun.shadow;for(const name of ['Head','foot_r','foot_l']){const point=g.player.bones[name].getWorldPosition(new T.Vector3());if(!Array.from({length:shadow.getViewportCount()},(_,i)=>shadow.getFrustum(i).containsPoint(point)).some(Boolean))throw Error('Selection shadows exclude '+name);}
   const rect=g.ui.selectionViewport(),p=new T.Vector3();let margin=Infinity;
   for(const point of window.measuredPreview[2].hull){p.fromArray(point).applyMatrix4(g.player.root.matrixWorld).project(g.camera);const x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;margin=Math.min(margin,x-rect.left,rect.left+rect.width-x,y-rect.top,rect.top+rect.height-y);}
   if(margin<0)throw Error('Course terrain changes preview framing: '+course+' '+margin);
   return{course,margin};
  },course));
  await page.screenshot({path:`${output}/course-${course}.png`});
 }
 await page.click('#begin');await page.waitForFunction(()=>window.__golfTest.mode==='courses');await page.evaluate(()=>{const g=window.__golfTest;g.updateCamera(0,{immediate:true});});
 assert.equal(await page.evaluate(()=>!!window.__golfTest.camera.view?.enabled),false,'Course camera must discard the portrait projection');
 await page.click('#back-warriors');await page.waitForFunction(()=>window.__golfTest.mode==='selection');await page.click('#back-home');await page.waitForFunction(()=>window.__golfTest.mode==='home');await page.evaluate(()=>window.__golfTest.updateCamera(0,{immediate:true}));
 assert.equal(await page.evaluate(()=>!!window.__golfTest.camera.view?.enabled),false,'Title camera must discard the portrait projection');
 await page.click('#play');await page.waitForFunction(()=>window.__golfTest.mode==='selection');await page.click('#begin');await page.waitForFunction(()=>window.__golfTest.mode==='courses');await page.click('#start-round');await page.waitForFunction(()=>window.__golfTest.mode==='game');await page.evaluate(()=>window.__golfTest.updateCamera(0,{immediate:true}));
 assert.equal(await page.evaluate(()=>!!window.__golfTest.camera.view?.enabled),false,'Gameplay camera must discard the portrait projection');
 assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/regression.json`,JSON.stringify({rows,courses,errors},null,2));
 console.log(JSON.stringify({layouts:rows.length,fullLoops:6,courses,errors}));
}finally{await browser.close();}
