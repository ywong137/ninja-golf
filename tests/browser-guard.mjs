import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await disableHmr(page);await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest);await preloadWarriorFixtures(page);await page.waitForSelector('#asset-curtain',{state:'detached'});
 await page.click('#audio-toggle');await page.click('#play');await page.click('#begin');await page.click('#start-round');
 const result=await page.evaluate(async()=>{
  const {createPlayerGuard}=await import('/src/combat.js'),{heightAt,COURSE_BOUNDS}=await import('/src/course.js'),g=window.__golfTest;
  g.paused=true;g.audio.pause();g.clearEnemies();g.phase='combat';g.spawnTime=999;g.combatTime=0;g.input.clear();g.input.setContext('combat');g.guard=createPlayerGuard();g.time=10;g.invincible=0;g.dodgeTimer=0;g.cameraYaw=0;g.player.root.rotation.y=0;g.player.root.position.set(0,heightAt(g.course,0,20),20);g.ball.position.set(0,8,120);g.updateCamera(10);
  const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
  const tick=(dt=.016)=>{g.time+=dt;g.input.poll(dt,true);g.updateCombat(dt);g.input.end();};
  key('keydown','KeyV');tick();const active=g.guard.active,health=g.health,resolve=g.resolve,source=g.player.root.position.clone();source.z+=3;
  const attacker={dead:0,stun:0,enemyAction:{},strike:1,oneShot:1,cooldown:0};g.hurt(8,source,attacker);
  const parry={health:g.health,resolve:g.resolve,stun:attacker.stun,cancelled:!attacker.enemyAction,cue:document.querySelector('#combat-cue').textContent};
  tick(.2);g.hurt(8,source,attacker);const block={health:g.health,strength:g.guard.strength};
  source.z-=6;g.hurt(8,source,attacker);const rear=g.health;
  g.invincible=0;source.z+=6;g.guard.strength=10;g.hurt(8,source,attacker);const broken=!g.guard.active&&g.guard.strength===0&&g.guard.brokenUntil>g.time;
  key('keyup','KeyV');tick(1.2);tick(.1);const recovered=g.guard.strength>0;
  key('keydown','ShiftLeft');tick();const shiftDodges=g.dodgeTimer>0;key('keyup','ShiftLeft');key('keydown','Space');tick();const spaceDodges=g.dodgeTimer>0;key('keyup','Space');tick(.6);
  key('keydown','KeyV');tick();g.startAttack('light');const attackExits=!!g.action&&!g.guard.active;key('keyup','KeyV');g.clearEnemies();g.invincible=0;g.guard=createPlayerGuard();
  window.guardPad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.guardPad]});window.guardPad.buttons[4].pressed=true;tick();const lbGuards=g.guard.active;
  const projectileSource=g.player.root.position.clone();projectileSource.y+=1;projectileSource.z+=2;const target=g.player.root.position.clone();target.y+=1;g.projectiles.spawn(projectileSource,target,4,attacker);const preProjectile=g.health;g.time+=.05;g.projectiles.update(.15,g.player.root.position,(damage,position,owner)=>g.hurt(damage,position,owner));const projectileBlocked=g.health===preProjectile&&g.projectiles.items.length===0;
  window.guardPad.buttons[4].pressed=false;window.guardPad.buttons[6].pressed=true;tick();const ltFocuses=g.focused&&!g.guard.active;window.guardPad.buttons[6].pressed=false;window.guardPad.buttons[1].pressed=true;tick();const bDodges=g.dodgeTimer>0,bSprints=g.input.padSprint;window.guardPad.buttons[1].pressed=false;tick(.6);window.guardPad.buttons[10].pressed=true;tick();const stickSprints=g.input.padSprint&&!g.dodgeTimer;
  delete navigator.getGamepads;g.input.clear();g.dodgeTimer=0;g.invincible=0;g.guard.active=true;g.guard.parryUntil=-Infinity;g.guard.strength=10;g.hurt(8,source,attacker);g.paused=false;g.attack('heavy');const breakBuffers=!g.action&&g.guardBufferedAttack?.kind==='heavy';tick(.1);const breakHolds=!g.action;tick(.13);const bufferedAttackStarts=g.action?.kind==='heavy';g.clearEnemies();g.paused=true;g.phase='aim';g.input.setContext('aim');key('keydown','Space');const golfSpace=g.input.tap('Space')&&!g.input.tap('Dodge');key('keyup','Space');g.input.clear();g.ui.update(g,.2);
  // A diagonal request at the boundary produces forward travel. Feet must follow it.
  g.begin(0,2);g.paused=true;g.phase='combat';g.input.setContext('combat');g.spawnTime=999;g.cameraYaw=0;g.cameraPitch=.2;g.shake=0;g.player.root.position.set(COURSE_BOUNDS.maxX,heightAt(g.course,COURSE_BOUNDS.maxX,-20),-20);g.ball.position.copy(g.player.root.position);g.ball.position.z+=100;g.updateCamera(10);key('keydown','KeyV');key('keydown','KeyW');key('keydown','KeyA');tick(.05);const collisionStride=g.player.current.endsWith('_Guard_Walk_Forward')&&g.player.root.position.x===COURSE_BOUNDS.maxX&&g.player.root.position.z>-20;g.input.clear();
  return{active,health,resolve,parry,block,rear,broken,recovered,shiftDodges,spaceDodges,attackExits,lbGuards,projectileBlocked,ltFocuses,bDodges,bSprints,stickSprints,breakBuffers,breakHolds,bufferedAttackStarts,golfSpace,collisionStride,collisionDetails:{clip:g.player.current,position:g.player.root.position.toArray(),guard:g.guard.active,camera:g.camera.position.toArray()}};
 });
 if(!result.collisionStride)console.error(result.collisionDetails);assert.equal(result.active,true);assert.equal(result.parry.health,result.health);assert.equal(result.parry.resolve,result.resolve+10);assert.equal(result.parry.stun,1.2);assert.equal(result.parry.cancelled,true);assert.match(result.parry.cue,/PARRY/);assert.equal(result.block.health,result.health);assert.ok(result.block.strength<100);assert.equal(result.rear,result.health-8);
 for(const name of ['broken','recovered','spaceDodges','attackExits','lbGuards','projectileBlocked','ltFocuses','bDodges','stickSprints','breakBuffers','breakHolds','bufferedAttackStarts','golfSpace','collisionStride'])assert.equal(result[name],true,name);assert.equal(result.shiftDodges,false);assert.equal(result.bSprints,false);assert.deepEqual(errors,[]);
 console.log('Guard/parry, rear exposure, break/recovery, attacks, projectiles, V/LB, Space/B, Shift, LT, and golf Space passed');
}finally{await browser.close();}
