import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=process.argv[2]?await chromium.connectOverCDP(process.argv[2]):await chromium.launch({headless:true});
const page=process.argv[2]?browser.contexts()[0].pages().find(p=>p.url().includes('localhost:5173')):await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__golfTest);await page.click('#audio-toggle');await page.click('#play');await page.click('#begin');
// Put each hazard into a controlled scenario, then let the actual frame loop resolve it.
for(const kind of ['water','bounds']){
  await page.evaluate(kind=>{const g=window.__golfTest;g.shotOrigin.copy(g.ball.position);g.shotStartLie=g.lie;g.strokes=1;g.phase='flight';g.flightTime=0;g.stillTime=0;g.rolling=false;g.bounces=0;g.velocity=g.ball.position.clone().set(0,-3,0);g.ball.position.set(kind==='water'?g.course.pond[0]:300,kind==='water'?3.2:1,kind==='water'?g.course.pond[1]:0);},kind);
  await page.waitForFunction(()=>window.ninjaGolf.state().phase==='aim');assert.equal(await page.evaluate(()=>window.ninjaGolf.state().strokes),2);assert.equal(await page.evaluate(()=>window.ninjaGolf.state().ball[2]),0);
}
console.log('Water and out-of-bounds penalties passed');
// Exercise crowd damage, multi-target hits, Resolve, and revival.
await page.evaluate(()=>{const g=window.__golfTest;g.phase='combat';g.enemyBudget=80;g.enemiesSpawned=0;g.spawnWave(24);g.combatTime=0;g.spawnTime=100;g.health=g.warrior.health;g.attackTimer=0;g.resolve=100;g.enemies.forEach((e,i)=>{e.emerging=null;e.root.visible=true;e.root.position.copy(g.player.root.position);e.root.position.x+=Math.sin(i)*3;e.root.position.z+=Math.cos(i)*3;});});
await page.keyboard.press('KeyL');await page.waitForFunction(()=>window.ninjaGolf.state().kills>=24);
assert.ok(await page.evaluate(()=>window.ninjaGolf.state().resolve>=0));console.log('24-enemy special attack passed');
await page.evaluate(()=>{window.__golfTest.health=0;});await page.waitForFunction(()=>window.ninjaGolf.state().health===110);console.log('Revival passed');
// A virtual standard gamepad checks shared actions without relying on a physical controller.
await page.evaluate(()=>{window.testPad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0})),mapping:'standard',connected:true};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});const g=window.__golfTest;g.clearEnemies();g.phase='aim';g.charging=false;g.power=1;});
await page.evaluate(()=>{window.testPad.buttons[5].pressed=true;});await page.waitForFunction(()=>window.ninjaGolf.state().club==='3W');await page.evaluate(()=>{window.testPad.buttons[5].pressed=false;window.testPad.buttons[0].pressed=true;});await page.waitForFunction(()=>window.ninjaGolf.state().charging);await page.evaluate(()=>{window.testPad.buttons[0].pressed=false;delete navigator.getGamepads;window.__golfTest.charging=false;});console.log('Standard gamepad club and swing actions passed');
// Seed a short putt, then use the real swing controls and ball physics to finish every hole.
for(let hole=0;hole<3;hole++){
  await page.evaluate(async hole=>{const {heightAt}=await import('/src/course.js');const g=window.__golfTest;if(g.hole!==hole)g.loadHole(hole);g.clearEnemies();g.phase='aim';g.charging=false;g.power=1;g.strokes=g.course.par-1;g.lie='Green';g.club=7;g.ball.visible=true;g.ball.position.copy(g.world.cup);g.ball.position.z-=3;g.ball.position.y=heightAt(g.course,g.ball.position.x,g.ball.position.z)+.13;g.placePlayer();g.aimAtPin();g.refreshAim();},hole);
  await page.keyboard.press('Space');await page.waitForFunction(()=>window.ninjaGolf.state().charging);await page.waitForFunction(()=>{const p=window.ninjaGolf.state().power;return p>.32&&p<.37;});await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.ninjaGolf.state().phase==='holed',{},{timeout:18000});assert.equal(await page.evaluate(()=>window.ninjaGolf.state().scores.length),hole+1);
  await page.waitForSelector('#next-hole');await page.screenshot({path:`/private/tmp/ninja-score-${hole+1}.png`});
  if(hole===0){await page.reload();await page.waitForSelector('#continue-round');await page.click('#audio-toggle');await page.click('#continue-round');assert.equal(await page.evaluate(()=>window.ninjaGolf.state().hole),1);console.log('Saved round resumes at hole 2');}
  else if(hole<2)await page.click('#next-hole');
}
console.log('All three cups and final scorecard passed',await page.evaluate(()=>window.ninjaGolf.state().scores));
console.log('Browser errors',errors);assert.deepEqual(errors,[]);await browser.close();
