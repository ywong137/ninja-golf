import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=process.argv[2]?await chromium.connectOverCDP(process.argv[2]):await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,args:['--mute-audio']});
const page=process.argv[2]?browser.contexts()[0].pages().find(p=>p.url().includes('localhost:5173')):await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__golfTest);await page.click('#audio-toggle');await page.click('#play');await page.click('#begin');
// The same screen-right input must turn a shot right and move a warrior right.
const initialAim=await page.evaluate(()=>window.ninjaGolf.state().aim);
await page.keyboard.down('KeyD');await page.waitForTimeout(250);await page.keyboard.up('KeyD');
assert.ok(await page.evaluate(()=>window.ninjaGolf.state().aim)<initialAim,'D aims right');
await page.keyboard.down('KeyA');await page.waitForTimeout(500);await page.keyboard.up('KeyA');
assert.ok(await page.evaluate(()=>window.ninjaGolf.state().aim)>initialAim,'A aims left');
for(const yaw of [0,Math.PI/2,Math.PI,-.71]){
  await page.evaluate(yaw=>{const g=window.__golfTest;g.clearEnemies();g.phase='combat';g.spawnTime=100;g.cameraYaw=yaw;g.player.root.position.set(0,7.5,40);g.ball.position.set(0,7.5,130);g.attackTimer=0;g.dodgeTimer=0;g.updateCamera(10);},yaw);
  const before=await page.evaluate(()=>{const g=window.__golfTest;const dir=g.player.root.position.clone();g.camera.getWorldDirection(dir);return{player:g.player.root.position.toArray(),yaw:Math.atan2(dir.x,dir.z)}});
  await page.keyboard.down('KeyD');await page.waitForTimeout(200);await page.keyboard.up('KeyD');
  const after=await page.evaluate(()=>window.ninjaGolf.state().player);const dx=after[0]-before.player[0],dz=after[2]-before.player[2];
  assert.ok(-dx*Math.cos(before.yaw)+dz*Math.sin(before.yaw)>.3,`D moves camera-right at yaw ${yaw}`);
  await page.keyboard.down('KeyA');await page.waitForTimeout(400);await page.keyboard.up('KeyA');
  const left=await page.evaluate(()=>window.ninjaGolf.state().player);
  assert.ok(-(left[0]-after[0])*Math.cos(before.yaw)+(left[2]-after[2])*Math.sin(before.yaw)<-.5,`A moves camera-left at yaw ${yaw}`);
}
assert.equal(await page.locator('#map-title').textContent(),'COMBAT RADAR');
await page.keyboard.press('KeyQ');const stopped=await page.evaluate(()=>window.ninjaGolf.state().player);await page.waitForTimeout(400);
assert.deepEqual(await page.evaluate(()=>window.ninjaGolf.state().player),stopped,'Q faces the waypoint without autorunning');
// Enemies behind the warrior do not turn the warrior or receive a forward slash.
await page.evaluate(()=>{const g=window.__golfTest;g.clearEnemies();g.enemyBudget=2;g.enemiesSpawned=0;g.spawnWave(2);g.spawnTime=100;g.player.root.rotation.y=0;for(const [i,e]of g.enemies.entries()){e.emerging=null;e.root.visible=true;e.root.position.copy(g.player.root.position);e.root.position.z+=i? -2.5:2.5;e.hp=30;e.speed=0;e.cooldown=100;}g.kills=0;g.attackTimer=0;});
await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.ninjaGolf.state().facing),0,'No implicit enemy facing');
await page.mouse.click(720,440,{button:'left'});await page.waitForFunction(()=>window.ninjaGolf.state().kills===1);
assert.equal(await page.evaluate(()=>window.ninjaGolf.state().enemies),1,'Forward slash leaves the enemy behind alive');
await page.evaluate(()=>{const g=window.__golfTest;g.clearEnemies();g.player.root.position.copy(g.ball.position);g.player.root.position.x-=1;});await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.ninjaGolf.state().phase==='aim');
await page.waitForFunction(()=>document.querySelector('#map-title').textContent==='KAZEKAGE COAST');
assert.equal(await page.locator('#combat-hud').isVisible(),false);assert.equal(await page.locator('#swing-button').isVisible(),true);
assert.deepEqual(errors,[]);console.log('Camera-relative A/D, manual facing, directional slashes, waypoint, and HUD transition passed');await browser.close();
