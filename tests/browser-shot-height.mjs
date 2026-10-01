import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
const output='/tmp/ninja-shot-height';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await page.locator('#asset-curtain').waitFor({state:'detached'});
 await page.click('#play');await page.click('#begin');await page.click('#start-round');
 const state=()=>page.evaluate(()=>window.ninjaGolf.state());
 const expectHeight=height=>page.waitForFunction(height=>window.ninjaGolf.state().shotHeight===height,height);
 await page.keyboard.press('KeyZ');await expectHeight('low');await page.keyboard.press('KeyX');await expectHeight('normal');await page.keyboard.press('KeyX');await expectHeight('high');
 await page.keyboard.press('KeyX');assert.equal((await state()).shotHeight,'high');
 await page.click('[data-shot-height="-1"]');await expectHeight('low');await page.keyboard.press('KeyE');assert.equal((await state()).shotHeight,'low');
 await page.click('[data-club="7"]');await expectHeight('normal');await page.waitForFunction(()=>[...document.querySelectorAll('[data-shot-height]')].every(el=>el.disabled));
 await page.keyboard.press('KeyX');assert.equal((await state()).shotHeight,'normal');await page.click('[data-club="0"]');
 await page.evaluate(()=>{window.__shotPad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__shotPad]});});
 const pad=async(button,pressed)=>{await page.evaluate(({button,pressed})=>{window.__shotPad.buttons[button]={pressed,value:pressed?1:0};},{button,pressed});await page.waitForTimeout(100);};
 await pad(12,true);await expectHeight('high');await page.waitForTimeout(200);assert.equal((await state()).shotHeight,'high');await pad(12,false);
 await pad(13,true);await expectHeight('normal');await pad(13,false);await pad(13,true);await expectHeight('low');await pad(13,false);
 await page.waitForFunction(()=>document.querySelector('#shot-height-keys').textContent.includes('D-PAD'));
 await page.evaluate(()=>{delete navigator.getGamepads;delete window.__shotPad;});
 await page.click('[data-shot-height="0"]');await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().charging);
 await page.keyboard.press('KeyX');await expectHeight('high');assert.equal((await state()).charging,false);assert.equal((await state()).power,1);
 await page.locator('[data-shot-height="-1"]').focus();await page.keyboard.press('Space');await expectHeight('low');assert.equal((await state()).charging,false);
 await page.click('[data-shot-height="1"]');
 await page.keyboard.press('KeyR');await page.waitForFunction(()=>window.ninjaGolf.state().survey);await page.waitForTimeout(900);
 const inspectSurvey=()=>page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),g=window.__golfTest;const panels=[...document.querySelectorAll('.club-panel,.swing-panel,.minimap-panel,.round-hud')].filter(el=>getComputedStyle(el).display!=='none').map(el=>el.getBoundingClientRect());return g.shotPreview.points.map(p=>{const q=new T.Vector3(p.x,p.y,p.z).project(g.camera),x=(q.x+1)*innerWidth/2,y=(1-q.y)*innerHeight/2;return[...q.toArray(),panels.some(r=>x>r.left&&x<r.right&&y>r.top&&y<r.bottom)];});});
 const survey=await inspectSurvey();
 assert.ok(survey.every(([x,y,z,covered])=>Math.abs(x)<.98&&Math.abs(y)<.98&&Math.abs(z)<1&&!covered),'The complete high-shot arc must fit the survey view outside the control panels.');
 await page.screenshot({path:`${output}/survey-high.png`});await page.keyboard.press('KeyR');await page.waitForFunction(()=>!window.ninjaGolf.state().survey);
 const layouts=[];
 for(const [width,height]of [[1440,900],[1280,720],[1024,640],[1280,600],[900,700]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  const layout=await page.evaluate(()=>{
   const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
   return{width:innerWidth,height:innerHeight,equipment:rect('.golf-equipment-panel'),round:rect('.round-hud'),lie:rect('.lie-readout'),clubs:rect('.club-panel'),swing:rect('.swing-panel')};
  });layouts.push(layout);
  assert.ok(layout.equipment.top>layout.round.bottom+8,JSON.stringify(layout));assert.ok(layout.equipment.bottom<height-35,JSON.stringify(layout));assert.ok(layout.lie.bottom<layout.clubs.top,JSON.stringify(layout));assert.ok(layout.clubs.right<layout.swing.left-8,JSON.stringify(layout));
  await page.screenshot({path:`${output}/controls-${width}x${height}.png`});
  await page.keyboard.press('KeyR');await page.waitForFunction(()=>window.ninjaGolf.state().survey);await page.waitForTimeout(900);const arc=await inspectSurvey();assert.ok(arc.every(([x,y,z,covered])=>Math.abs(x)<.98&&Math.abs(y)<.98&&Math.abs(z)<1&&!covered),JSON.stringify({width,height,arc}));await page.screenshot({path:`${output}/survey-${width}x${height}.png`});await page.keyboard.press('KeyR');await page.waitForFunction(()=>!window.ninjaGolf.state().survey);
 }
 await page.setViewportSize({width:1440,height:900});await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().charging);await page.waitForFunction(()=>window.ninjaGolf.state().power>.8);await page.keyboard.press('Space');
 await page.waitForFunction(()=>window.ninjaGolf.state().phase==='swing');await page.waitForFunction(()=>[...document.querySelectorAll('[data-shot-height]')].every(el=>el.disabled));
 await page.keyboard.press('KeyZ');assert.equal((await state()).shotHeight,'high');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='flight');await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='combat',null,{timeout:20000});assert.equal((await state()).strokes,1);
 const flights=await page.evaluate(async()=>{
  const g=window.__golfTest,{heightAt,CLUBS}=await import('/src/course.js'),{BALL_STEP,BALL_RADIUS}=await import('/src/golf-roll.js');
  g.renderer.setAnimationLoop(null);g.begin(0,0);g.audio.pause();const original={land:g.land,holed:g.holed,penalty:g.penalty},results=[];let outcome;
  const stop=kind=>{outcome={kind,position:g.ball.position.clone()};g.phase='aim';};g.land=()=>stop('land');g.holed=()=>stop('cup');g.penalty=message=>stop(message);
  try{for(const club of [0,1,2,3,4,5,6])for(const shotHeight of [-1,0,1]){
   const origin={x:0,y:heightAt(g.course,0,0)+BALL_RADIUS,z:0};g.ball.position.copy(origin);g.phase='aim';g.lie='Tee';g.selectClub(club);g.selectShotHeight(shotHeight);g.aim=.024;g.power=.8;g.charging=true;g.refreshAim();g.charging=false;
   const preview=structuredClone(g.shotPreview);outcome=null;const random=Math.random;try{Math.random=()=>.5;g.launchBall();}finally{Math.random=random;}
   let first=null,apex=origin.y;
   for(let i=0;i<4000&&g.phase==='flight';i++){g.updateBall(BALL_STEP);apex=Math.max(apex,g.ball.position.y);if(!first&&g.bounces)first=g.ball.position.clone();}
   if(!first||!outcome)throw Error(`Shot failed to land: ${CLUBS[club].short}/${shotHeight}: ${outcome?.kind}`);
   results.push({club:CLUBS[club].short,shotHeight,previewLie:preview.lie,previewDistance:preview.distance,error:first.distanceTo(preview.landing),apex:apex-origin.y,run:Math.hypot(outcome.position.x-first.x,outcome.position.z-first.z),outcome:outcome.kind});
  }}finally{Object.assign(g,original);}
  return results;
 });
 for(const flight of flights){assert.equal(flight.outcome,'land',JSON.stringify(flight));assert.ok(flight.error<.025,JSON.stringify(flight));}
 for(const club of ['DR','7I','SW']){const trio=flights.filter(f=>f.club===club);assert.ok(trio[0].apex<trio[1].apex&&trio[1].apex<trio[2].apex,JSON.stringify(trio));assert.ok(trio[0].run>trio[1].run&&trio[1].run>trio[2].run,JSON.stringify(trio));}
 assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/report.json`,JSON.stringify({layouts,flights,errors},null,2));console.log(JSON.stringify({layouts:layouts.length,flights,errors},null,2));
}finally{await browser.close();}
