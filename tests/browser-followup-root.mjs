import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 const report=await page.evaluate(async()=>{
  const g=window.__golfTest,{heightAt}=await import('/src/course.js'),{SceneryCollision}=await import('/src/scenery-collision.js'),{attackRootDelta}=await import('/src/attack-root-motion.js'),{ENEMY_TYPES}=await import('/src/combat.js');
  g.frame=()=>{};g.audio.enabled=false;g.audio.pause();g.paused=true;const rows=[];
  for(const hero of [4,5]){
   g.begin(hero,0);await g.world.waitForAssets();g.audio.pause();g.phase='combat';g.world.collision=new SceneryCollision();
   const tick=dt=>{g.time+=dt;g.updateCombat(dt);g.input.end();};
   const setup=yaw=>{g.clearEnemies();g.input.clear();g.action=null;g.attackTimer=0;g.attackBuffer=null;g.hitStop=0;g.dodgeTimer=0;g.player.interruptAttack();g.time+=10;g.player.root.position.set(0,heightAt(g.course,0,45),45);g.player.root.rotation.y=yaw;g.cameraYaw=yaw;g.ball.position.set(0,heightAt(g.course,0,200),200);g.spawnTime=999;g.invincible=999;for(let i=0;i<30;i++)tick(1/60);g.lightChain=2;g.chainExpires=g.time+20;g.startAttack('heavy');return g.action;};
   for(const hz of [40,60,144])for(const yaw of [0,.9,-2.4]){
    const a=setup(yaw),start=g.player.root.position.clone(),e=new g.player.constructor(0,true,{family:0,palette:0});
    e.root.position.copy(start);e.root.position.x+=Math.sin(yaw)*2.5;e.root.position.z+=Math.cos(yaw)*2.5;e.root.position.y=heightAt(g.course,e.root.position.x,e.root.position.z);Object.assign(e,{slot:0,role:ENEMY_TYPES[0].role,speed:0,hp:1000,cooldown:999,readyAt:g.time+999,lift:0,verticalSpeed:0,knockback:start.clone().set(0,0,0)});g.enemies.push(e);
    let maxRootError=0;
    while(g.action===a){tick(1/hz);const expected=attackRootDelta(a.planarRoot,0,a.time,a.duration,yaw,g.player.root.scale.x);maxRootError=Math.max(maxRootError,Math.hypot(g.player.root.position.x-start.x-expected.x,g.player.root.position.z-start.z-expected.z));}
    const end=g.player.bones.pelvis.getWorldPosition(start.clone());for(let i=0;i<Math.ceil(hz*.4);i++)tick(1/hz);const recovery=g.player.bones.pelvis.getWorldPosition(start.clone());
    rows.push({hero,hz,yaw,clip:a.motionName,maxRootError,recoverySlide:Math.hypot(end.x-recovery.x,end.z-recovery.z),damage:1000-e.hp,hits:a.hitIndex,expectedHits:a.hits.length});
   }
   g.clearEnemies();g.world.collision=new SceneryCollision([],[{id:'followup-wall',kind:'box',x:0,z:45.68,halfWidth:5,halfDepth:.1,minY:-100,maxY:100}]);const a=setup(0);while(g.action===a)tick(1/60);rows.push({hero,wall:true,z:g.player.root.position.z,inside:g.world.collision.blocked(g.player.root.position)});
   g.world.collision=new SceneryCollision();setup(0);tick(.1);g.cancelAttackForControl();const before=g.player.root.position.clone();for(let i=0;i<60;i++)tick(1/60);rows.push({hero,cancel:true,travel:g.player.root.position.distanceTo(before),action:!!g.action});
  }
  g.audio.pause();g.clearEnemies();return rows;
 });
 for(const row of report){const context=JSON.stringify(row);if(row.wall){assert.equal(row.inside,false,context);assert.ok(row.z<45.21,context);}else if(row.cancel){assert.ok(row.travel<1e-8,context);assert.equal(row.action,false,context);}else{assert.ok(row.maxRootError<1e-6,context);assert.ok(row.recoverySlide<.1,context);assert.ok(row.damage>0,context);assert.equal(row.hits,row.expectedHits,context);}}
 assert.deepEqual(errors,[]);if(process.env.REVIEW_OUTPUT)fs.writeFileSync(process.env.REVIEW_OUTPUT,JSON.stringify({rows:report,errors},null,2));console.log(JSON.stringify({cases:report.length,maximumRecoverySlide:Math.max(...report.filter(r=>!r.wall&&!r.cancel).map(r=>r.recoverySlide)),errors}));
}finally{await browser.close();}
