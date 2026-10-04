import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const out=process.env.REVIEW_OUT||'/tmp/ninja-control-prompts';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
const errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto((process.env.GAME_URL||'http://localhost:5173')+'/tools/tree-bake.html');
 await page.evaluate(async()=>{
  document.body.innerHTML='<div id="app"></div>';await import('/src/style.css');const {UI}=await import('/src/ui.js'),{Input}=await import('/src/input.js'),T=await import('/node_modules/three/build/three.module.js'),{COURSE_SETS,WARRIORS}=await import('/src/course.js');
  const ui=window.ui=new UI(new Proxy({},{get:()=>()=>{}})),pad=window.pad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});const input=new Input(ui.canvas),course=COURSE_SETS[1].holes[0];
  window.g={input,course,warrior:WARRIORS[3],roundCourse:COURSE_SETS[1],holes:COURSE_SETS[1].holes,hole:0,phase:'aim',lie:'Tee',ball:{position:new T.Vector3(0,7,0)},player:{root:{position:new T.Vector3(-1,7,0)}},camera:{getWorldDirection:v=>v.set(0,0,1)},world:{cup:new T.Vector3(course.greenX,7,course.length)},shotOrigin:new T.Vector3(0,7,0),club:0,shotHeight:0,scores:[],strokes:0,power:.5,health:105,resolve:100,guard:{strength:100,brokenUntil:0},time:10,kills:18,enemies:[],nearbyEnemies:()=>0};
  ui.showScreen('game');input.poll(.016,false);ui.update(g,.016);
 });
 const text=async selector=>page.locator(selector).textContent();
 assert.equal(await text('#swing-button kbd'),'SPACE','Idle connected controller must not replace keyboard prompts');
 await page.evaluate(()=>{pad.axes[0]=.7;g.input.poll(.016,false);ui.update(g,.016);pad.axes[0]=0;});assert.equal(await text('#swing-button kbd'),'A');assert.equal(await text('#survey-button kbd'),'Y');
 await page.screenshot({path:out+'/gamepad-golf.png'});
 await page.evaluate(()=>{g.survey=true;ui.update(g,.016);});assert.match(await text('#look-hint'),/LT \/ RT · ZOOM/);checks.push('golf and survey prompts follow active gamepad');
 await page.evaluate(()=>{ui.toast('Golf only',6000,'aim');g.survey=false;g.phase='flight';ui.update(g,.016);});assert.equal(await page.locator('#toast').evaluate(e=>e.classList.contains('visible')),false);assert.match(await text('#look-hint'),/A · FOLLOW BALL FASTER/);checks.push('golf toast clears before flight');
 await page.evaluate(()=>{g.phase='combat';g.input.setContext('combat');ui.update(g,.016);});assert.equal(await text('#interact kbd'),'A');assert.equal(await text('#musou-key'),'RB · MUSOU');assert.equal(await text('#guard-key'),'GUARD · LB');assert.match(await text('.combat-controls'),/RS CLICKFace waypoint/);assert.match(await text('#look-hint'),/RS · LOOK/);
 for(const [width,height]of [[1440,900],[960,640]]){await page.setViewportSize({width,height});await page.screenshot({path:`${out}/gamepad-combat-${width}.png`});const rect=await page.locator('.combat-controls').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width&&rect.y+rect.height<=height,'Controls fit '+width);}
 checks.push('all combat prompts and both layouts');
 await page.keyboard.press('KeyV');await page.evaluate(()=>{g.input.poll(.016,true);ui.update(g,.016);});assert.equal(await text('#musou-key'),'F · MUSOU');assert.equal(await text('#interact kbd'),'E');assert.match(await text('.combat-controls'),/LMBFast/);assert.match(await text('#input-device'),/KEYBOARD/);checks.push('keyboard activity restores all prompts despite connected idle pad');
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/browser-report.json',JSON.stringify({checks,errors,muted:true,scene:'UI-only fixture; no 3D rendering'},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}
