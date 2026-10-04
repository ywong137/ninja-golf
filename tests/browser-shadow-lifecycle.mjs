import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5174');
 await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 const report=await page.evaluate(async()=>{
  const g=window.__golfTest,{SceneryCollision}=await import('/src/scenery-collision.js'),{heightAt}=await import('/src/course.js');
  g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(1,0);
  const reset=()=>{g.clearEnemies();g.effects.clear();g.input.clear();g.phase='combat';g.mode='game';g.paused=false;g.time+=10;g.spawnTime=999;g.dodgeTimer=0;g.invincible=999;g.playerVelocity={x:0,z:0};g.player.root.rotation.set(0,0,0);g.player.root.position.set(0,heightAt(g.course,0,45),45);g.ball.position.set(0,0,190);g.startAttack('musou');};
  const tick=dt=>{g.time+=dt;g.updateCombat(dt);g.effects.update(dt);g.input.end();};
  const originalCollision=g.world.collision;
  const rows=[];
  for(const rate of [40,60,144]){
   g.world.collision=new SceneryCollision([], [{id:'shadow-wall',kind:'box',x:1.2,z:45,halfWidth:.1,halfDepth:20,minY:-100,maxY:100}]);
   reset();let maximumX=-Infinity,inside=false,hiddenFrames=0;
   while(g.action){tick(1/rate);maximumX=Math.max(maximumX,g.player.root.position.x);inside ||= g.world.collision.blocked(g.player.root.position);if(!g.player.root.visible)hiddenFrames++;}
   rows.push({rate,maximumX,inside,hiddenFrames,visible:g.player.root.visible});
  }
  g.world.collision=originalCollision;reset();
  while(g.player.root.visible)tick(1/60);
  const hiddenTime=g.action.time,position=g.player.root.position.clone();
  g.togglePause();for(let i=0;i<4;i++){g.previousTime=performance.now()-16;g.frame();}
  const pause={timeUnchanged:g.action.time===hiddenTime,positionUnchanged:position.equals(g.player.root.position),stillHidden:!g.player.root.visible};g.togglePause();
  g.clearEnemies();const clear={visible:g.player.root.visible,action:!!g.action};tick(1/60);clear.visibleAfterUpdate=g.player.root.visible;
  reset();while(g.player.root.visible)tick(1/60);
  // loadHole is the real restart path and must restore the golfer immediately.
  g.loadHole(0);const restart={visible:g.player.root.visible,phase:g.phase,action:!!g.action};
  return{rows,pause,clear,restart};
 });
 for(const r of report.rows){assert.equal(r.inside,false);assert.ok(r.maximumX<1.1,JSON.stringify(r));assert.ok(r.hiddenFrames>0);assert.equal(r.visible,true);}
 assert.deepEqual(report.pause,{timeUnchanged:true,positionUnchanged:true,stillHidden:true});
 assert.deepEqual(report.clear,{visible:true,action:false,visibleAfterUpdate:true});
 assert.deepEqual(report.restart,{visible:true,phase:'aim',action:false});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({...report,errors}));
}finally{await browser.close();}
