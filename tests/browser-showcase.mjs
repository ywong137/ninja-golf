import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 await page.evaluate(async()=>{
  const g=window.__golfTest,{Vector3}=await import('/node_modules/three/build/three.module.js');g.audio.pause();
  const original=g.selectScreen;
  g.selectScreen=function(){
   original.call(this);this.player.root.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
   window.firstSelectionFrame=['Head','foot_r','foot_l'].map(name=>this.player.bones[name].getWorldPosition(new Vector3()).project(this.camera).toArray());
   this.selectScreen=original;
  };
 });
 await page.click('#play');await page.waitForFunction(()=>Array.isArray(window.firstSelectionFrame));
 for(const [x,y,z]of await page.evaluate(()=>window.firstSelectionFrame)){
  assert.ok(x>.1&&x<.98&&Math.abs(y)<.96&&Math.abs(z)<1,'The head and feet must occupy the portrait area before the first selection frame.');
 }
 await page.keyboard.press('c');await page.waitForFunction(()=>document.getElementById('showcase-console-toggle').getAttribute('aria-expanded')==='true');assert.equal(await page.locator('#showcase-console-toggle').getAttribute('aria-expanded'),'true');
 await page.locator('#showcase-speed').fill('0.1');assert.equal(await page.locator('#showcase-speed-value').textContent(),'0.1×');
 await page.click('#showcase-pause');const paused=await page.evaluate(()=>window.__golfTest.showcase.state);await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>window.__golfTest.showcase.state),paused);
 await page.click('[data-warrior="2"]');await page.waitForFunction(()=>window.__golfTest.playerIndex===2);assert.equal(await page.evaluate(()=>window.__golfTest.showcase.clock.speed),.1);assert.equal(await page.locator('#showcase-pause').textContent(),'Go');
 await page.click('#showcase-pause');await page.waitForFunction(()=>window.__golfTest.showcase.state.time>0);await page.click('#showcase-pause');
 // Direct selection and scrubbing must change the pose even while paused.
 await page.selectOption('#showcase-stage','heavy');
 assert.equal(await page.locator('#showcase-pause').textContent(),'Go');
 await page.locator('#showcase-position').fill('0.4');
 assert.ok(Math.abs((await page.evaluate(()=>window.__golfTest.showcase.state.time))-.4)<1e-8);
 const pose=()=>page.evaluate(()=>{const a=window.__golfTest.player;return ['pelvis','spine_03','upperarm_r','lowerarm_r','hand_r'].flatMap(name=>a.bones[name].quaternion.toArray());});
 const first=await pose();
 await page.selectOption('#showcase-stage','swing');await page.locator('#showcase-position').fill('0.7');
 assert.notDeepEqual(await pose(),first);
 await page.selectOption('#showcase-stage','heavy');await page.locator('#showcase-position').fill('0.4');
 const repeated=await pose();assert.ok(first.every((v,i)=>Math.abs(v-repeated[i])<1e-5),'Seeking the same pose must not depend on the previous clip.');
 await page.click('#showcase-forward');assert.ok(Math.abs((await page.evaluate(()=>window.__golfTest.showcase.state.time))-(.4+1/60))<1e-8);
 await page.click('#showcase-back');assert.ok(Math.abs((await page.evaluate(()=>window.__golfTest.showcase.state.time))-.4)<1e-8);
 await page.selectOption('#showcase-stage','light');await page.click('#showcase-back');assert.equal(await page.evaluate(()=>window.__golfTest.showcase.state.time),0);
 await page.click('#showcase-pause');await page.waitForFunction(()=>window.__golfTest.showcase.state.time>0);await page.click('#showcase-pause');
 const results=await page.evaluate(async()=>{
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.pause();await g.world.waitForAssets();const rows=[];
  for(let hero=0;hero<6;hero++)for(const rate of [60,120]){
   g.selectWarrior(hero);g.showcase.clock.paused=false;g.showcase.clock.setSpeed(1);const stages=new Set(),weapons=[];
   for(let f=0,frames=Math.ceil(g.showcase.clock.stages.reduce((sum,stage)=>sum+stage.duration,0)*rate)+2;f<frames;f++){g.showcase.update(1/rate);const s=g.showcase.state;stages.add(s.stage);if(f%12===0)weapons.push({stage:s.stage,golf:g.player.club.visible,sword:g.player.weapon.visible});
    for(const b of Object.values(g.player.bones))assertFinite([...b.position,...b.quaternion,...b.scale]);
   }
   if(g.showcase.clock.cycle<1)throw Error('Showcase never looped');
   for(const w of weapons){const golf=['address','swing','follow','golf-out','golf-in'].includes(w.stage);if(w.golf!==golf||w.sword===golf)throw Error('Wrong held object in '+w.stage);}
   rows.push({hero,rate,stages:[...stages],cycle:g.showcase.clock.cycle});
  }
  g.selectWarrior(2);g.showcase.clock.paused=false;g.showcase.clock.setSpeed(1);g.showcase.update(.1);g.updateShowcaseUI();g.updateCamera(10);g.portraitLights.visible=true;g.portraitLights.position.copy(g.player.root.position);g.rendering.render('balanced');
  function assertFinite(values){if(!values.every(Number.isFinite))throw Error('Non-finite showcase skeleton');}
  return rows;
 });
 await page.screenshot({path:process.env.SHOWCASE_SCREENSHOT??'/tmp/ninja-showcase-selection.png'});
 for(const row of results)for(const stage of ['address','swing','follow','ready','light','heavy'])assert.ok(row.stages.includes(stage),`${row.hero} missing ${stage}`);
 await page.click('#begin');await page.waitForFunction(()=>window.__golfTest.showcase===null);assert.equal(await page.evaluate(()=>window.__golfTest.showcase===null),true);assert.equal(await page.locator('#selection').isVisible(),false);
 await page.click('#back-warriors');await page.waitForFunction(()=>window.__golfTest.showcase?.state.stage==='address');assert.equal(await page.evaluate(()=>window.__golfTest.showcase.state.stage),'address');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({characters:results,controls:'C, speed, pause, resume, direct motion selection, exact scrubbing, frame stepping, retained settings and cleanup pass'}));
}finally{await browser.close();}
