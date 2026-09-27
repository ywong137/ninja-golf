import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=process.argv[2]?await chromium.connectOverCDP(process.argv[2]):await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,args:['--mute-audio']});
const page=process.argv[2]?browser.contexts()[0].pages().find(p=>p.url().includes('localhost:5173')):await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__golfTest);await page.click('#audio-toggle');await page.click('#play');await page.click('#begin');await page.click('#start-round');
await page.evaluate(()=>{const g=window.__golfTest;g.clearEnemies();g.phase='combat';g.spawnTime=100;g.enemyBudget=100;g.enemiesSpawned=0;g.combatTime=0;g.player.root.position.set(0,8,40);g.ball.position.set(15,8,190);g.cameraYaw=0;g.player.root.rotation.y=0;g.updateCamera(10);});
await page.keyboard.down('KeyC');await page.keyboard.down('KeyD');await page.waitForTimeout(400);await page.keyboard.up('KeyD');
let state=await page.evaluate(()=>window.ninjaGolf.state());assert.ok(state.player[0]<-1);assert.ok(Math.abs(state.facing)<.08,'Focused strafe keeps facing forward');
const before=state.player[2];await page.keyboard.down('KeyS');await page.waitForTimeout(400);await page.keyboard.up('KeyS');await page.keyboard.up('KeyC');state=await page.evaluate(()=>window.ninjaGolf.state());assert.ok(state.player[2]<before-1);assert.ok(Math.abs(state.facing)<.08,'Focused backpedal keeps facing forward');
// Pointer capture permits mouse look while WASD and both attack buttons remain available.
await page.mouse.click(720,440);await page.waitForFunction(()=>document.pointerLockElement);await page.waitForFunction(()=>window.__golfTest.action?.kind==='light');
const yaw=await page.evaluate(()=>window.__golfTest.cameraYaw);await page.mouse.move(790,440);await page.waitForTimeout(150);assert.notEqual(await page.evaluate(()=>window.__golfTest.cameraYaw),yaw);
await page.waitForFunction(()=>!window.__golfTest.action);await page.evaluate(()=>{window.__golfTest.lightChain=0;});
// Buffer the second light attack, then branch to its heavy finisher.
await page.mouse.click(720,440,{button:'left'});await page.waitForTimeout(160);await page.mouse.click(720,440,{button:'left'});await page.waitForFunction(()=>window.__golfTest.action?.step===1);await page.mouse.click(720,440,{button:'right'});await page.waitForFunction(()=>window.__golfTest.action?.kind==='heavy');assert.equal(await page.evaluate(()=>window.__golfTest.action.name),'Skyward finish');
await page.waitForFunction(()=>!window.__golfTest.action);
await page.evaluate(()=>{const g=window.__golfTest;g.resolve=100;});await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.__golfTest.cinematic>0);await page.waitForTimeout(250);await page.screenshot({path:'/tmp/ninja-musou.png'});await page.waitForFunction(()=>window.__golfTest.action?.kind==='musou');await page.waitForTimeout(350);await page.screenshot({path:'/tmp/ninja-musou-strike.png'});await page.waitForFunction(()=>!window.__golfTest.action);
// Every emergence has a real site and a finite trajectory, including hazards.
for(const kind of ['lantern','pagoda','rock','tree','sand','water']){
 const result=await page.evaluate(async kind=>{const {lieAt}=await import('/src/course.js');const g=window.__golfTest;g.paused=true;g.clearEnemies();g.time+=10;const site=g.world.ambushSites.find(s=>s.kind===kind);const saved=g.world.ambushSites;g.world.ambushSites=[site];g.player.root.position.set(site.x,site.y,site.z-25);g.ball.position.set(site.x,site.y,site.z+50);g.enemiesSpawned=0;g.spawnWave(1);g.world.ambushSites=saved;const e=g.enemies[0];if(!e)return {missing:kind};const initial={visible:e.root.visible,site:e.spawnSite};for(let i=0;i<90;i++)g.updateCombat(1/60);g.crowd.update(g.enemies);return{...initial,kind,emerged:!e.emerging,finite:e.root.position.toArray().every(Number.isFinite),lie:lieAt(g.course,e.root.position.x,e.root.position.z)};},kind);
 assert.ok(!result.missing,JSON.stringify(result));assert.equal(result.visible,false);assert.ok(result.site.startsWith(kind));assert.ok(result.emerged);assert.ok(result.finite);assert.notEqual(result.lie,'Water');
}
// Standard gamepad: LT strafe, X light, Y heavy, RB Musou.
await page.evaluate(()=>{const g=window.__golfTest;g.clearEnemies();g.player.root.position.set(0,8,45);g.ball.position.set(0,8,180);g.cameraYaw=0;g.player.root.rotation.y=0;g.updateCamera(10);g.spawnTime=100;g.paused=false;window.testPad={axes:[1,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};window.testPad.buttons[6].pressed=true;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});});
await page.waitForTimeout(300);assert.ok(Math.abs((await page.evaluate(()=>window.ninjaGolf.state())).facing)<.08);await page.evaluate(()=>{window.testPad.axes[0]=0;window.testPad.buttons[3].pressed=true;});await page.waitForFunction(()=>window.__golfTest.action?.kind==='heavy');await page.evaluate(()=>{window.testPad.buttons[3].pressed=false;});await page.waitForFunction(()=>!window.__golfTest.action);await page.evaluate(()=>{window.__golfTest.resolve=100;window.testPad.buttons[5].pressed=true;});await page.waitForFunction(()=>window.__golfTest.cinematic>0);await page.evaluate(()=>{delete navigator.getGamepads;window.__golfTest.paused=true;window.__golfTest.audio.pause();});
// Exercise the female styles through the actual combat loop, including the hook's pull.
const styles=await page.evaluate(async()=>{
 const {heightAt}=await import('/src/course.js');const g=window.__golfTest,Warrior=g.player.constructor,rows=[];g.input.clear();
 for(const index of [3,4,5]){
  g.clearEnemies();g.selectWarrior(index);g.phase='combat';g.spawnTime=999;g.player.root.position.set(0,heightAt(g.course,0,45),45);g.player.root.rotation.y=0;g.cameraYaw=0;g.invincible=999;g.time+=1;
  const enemy=new Warrior(0,true);enemy.root.position.copy(g.player.root.position);enemy.root.position.z+=5;Object.assign(enemy,{hp:10000,slot:0,cooldown:999,readyAt:99999,knockback:g.player.root.position.clone().set(0,0,0),verticalSpeed:0,lift:0});g.enemies.push(enemy);g.crowd.update(g.enemies);
  g.startAttack('heavy');for(let i=0;i<23;i++)g.updateCombat(1/60);
  rows.push({hero:index,style:g.action.style,clip:g.player.current,name:g.action.name,hurt:enemy.hp<10000,knockback:enemy.knockback.z});
  g.clearEnemies();g.resolve=100;g.startAttack('musou');for(let i=0;i<205;i++)g.updateCombat(1/60);rows.at(-1).finished=!g.action;
 }
 g.clearEnemies();g.crowd.update([]);return rows;
});
assert.deepEqual(styles.map(x=>x.style),['fan','ring','sickle']);assert.deepEqual(styles.map(x=>x.clip),['Fan_Heavy_Cleave','Ring_Heavy_Cleave','Sickle_Heavy_Cleave']);assert.ok(styles.every(x=>x.hurt&&x.finished));assert.ok(styles[0].knockback>0&&styles[1].knockback>0&&styles[2].knockback<0,JSON.stringify(styles));
assert.deepEqual(errors,[]);console.log('Focused strafe/backpedal, buffered finishers, Musou, six scenery entrances, gamepad controls, and distinct female combat styles passed');await browser.close();
