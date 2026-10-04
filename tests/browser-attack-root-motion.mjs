import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:400,height:300}});await disableHmr(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 const report=await page.evaluate(async()=>{
  const g=window.__golfTest,{motions,combatMotionName}=await import('/src/motion.js'),{SceneryCollision}=await import('/src/scenery-collision.js');
  const {samplePlanarRoot,attackRootDelta}=await import('/src/attack-root-motion.js'),{heightAt}=await import('/src/course.js');
  g.frame=()=>{};g.paused=true;g.audio.pause();g.begin(3,0);g.selectWarrior(3);
  const name=combatMotionName(g.warrior,'heavy',1),motion=motions[name],original={...motion},collision=g.world.collision,originalStrike=g.strike;
  const path={duration:1.4,rows:[{time:0,x:0,z:0},{time:.17,x:-.12,z:.35},{time:.31,x:.08,z:.83},{time:1.4,x:.02,z:1.15}]};
  motion.planarRoot=path;motion.movementScale=0;const rows=[];let hitPositions=[];
  g.strike=function(a){hitPositions.push({x:this.player.root.position.x,z:this.player.root.position.z,time:a.time});return originalStrike.call(this,a)};
  const setup=yaw=>{g.clearEnemies();g.input.clear();g.phase='combat';g.spawnTime=999;g.dodgeTimer=0;g.invincible=999;g.time+=10;g.player.root.position.set(0,heightAt(g.course,0,45),45);g.player.root.rotation.y=yaw;g.cameraYaw=yaw;g.ball.position.set(0,heightAt(g.course,0,190),190);g.lightChain=2;g.chainExpires=g.time+10;hitPositions=[];g.startAttack('heavy');};
  const tick=dt=>{g.time+=dt;g.updateCombat(dt);g.input.end();};
  try{
   g.world.collision=new SceneryCollision();
   for(const hz of [30,40,50,60,120])for(const yaw of [0,.73,-2.6]){
    setup(yaw);const a=g.action;let phaseError=0,positionError=0;
    while(g.action===a){tick(1/hz);const expected=attackRootDelta(path,0,a.time,a.duration,yaw,g.player.root.scale.x),p=g.player.root.position;
     positionError=Math.max(positionError,Math.hypot(p.x-expected.x,p.z-45-expected.z));
     const playback=g.player.actions.get(name);phaseError=Math.max(phaseError,Math.abs(playback.time/playback.getClip().duration-Math.min(1,a.time/a.duration)));
    }
    const hitError=Math.max(...hitPositions.map(hit=>{const expected=attackRootDelta(path,0,hit.time,a.duration,yaw,g.player.root.scale.x);return Math.hypot(hit.x-expected.x,hit.z-45-expected.z)}));
    rows.push({hz,yaw,positionError,phaseError,hitError,hits:a.hitIndex,expectedHits:a.hits.length});
   }
   g.world.collision=new SceneryCollision([], [{id:'root-test-wall',kind:'box',x:0,z:45.8,halfWidth:5,halfDepth:.1,minY:-100,maxY:100}]);
   setup(0);const blockedAction=g.action;while(g.action===blockedAction)tick(1/40);
   const blocked={position:g.player.root.position.toArray(),inside:g.world.collision.blocked(g.player.root.position),hitPositions:[...hitPositions]};
   g.world.collision=new SceneryCollision();setup(0);tick(.1);const stopped=g.player.root.position.clone();
   g.input.pressed.add('Dodge');tick(1/60);const cancelled={action:!!g.action,travel:g.player.root.position.distanceTo(stopped)};
   for(let i=0;i<100;i++)tick(1/60);cancelled.lateTravel=g.player.root.position.distanceTo(stopped);
   // A new action starts at its own path origin after cancellation.
   g.lightChain=2;g.chainExpires=g.time+10;g.startAttack('heavy');const before=g.player.root.position.clone(),a=g.action;tick(1/60);
   const first=samplePlanarRoot(path,(1/60)/a.duration*path.duration);cancelled.restartError=Math.hypot(g.player.root.position.x-before.x-first.x*1.1,g.player.root.position.z-before.z-first.z*1.1);
   return{rows,blocked,cancelled};
  }finally{Object.keys(motion).forEach(k=>delete motion[k]);Object.assign(motion,original);g.world.collision=collision;g.strike=originalStrike;g.clearEnemies();g.audio.pause();}
 });
 assert.deepEqual(errors,[]);
 for(const row of report.rows){assert.ok(row.positionError<1e-8,JSON.stringify(row));assert.ok(row.phaseError<1e-6,JSON.stringify(row));assert.ok(row.hitError<1e-8,JSON.stringify(row));assert.equal(row.hits,row.expectedHits);}
 assert.equal(report.blocked.inside,false);assert.ok(report.blocked.position[2]<45.321&&report.blocked.position[2]>45.30,JSON.stringify(report.blocked));
 assert.ok(report.blocked.hitPositions.every(p=>p.z<45.321),'Impacts must use the collision-corrected position');
 assert.equal(report.cancelled.action,false);assert.ok(report.cancelled.travel<1e-8&&report.cancelled.lateTravel<1e-8,JSON.stringify(report.cancelled));assert.ok(report.cancelled.restartError<1e-8);
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
