import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage(),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const reports=await page.evaluate(async()=>{
  const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js');g.frame=()=>{};g.begin(0,0);g.paused=true;g.audio.pause();g.clearEnemies();g.groundHeight=()=>0;g.slideOnLand=p=>{p.y=0;};const reports=[];
  const directions=[['KeyW'],['KeyW','KeyD'],['KeyD'],['KeyS','KeyD'],['KeyS'],['KeyS','KeyA'],['KeyA'],['KeyW','KeyA']];
  for(let hero=0;hero<6;hero++){
   g.selectWarrior(hero);
   for(const kind of ['light','heavy'])for(const [direction,keys]of directions.entries()){
    g.action=null;g.player.oneShot=0;g.player.actionToken=-1;g.player.attackLocomotion.reset();g.input.clear();g.player.root.position.set(0,0,45);g.player.root.rotation.set(0,0,0);g.phase='combat';g.spawnTime=999;g.dodgeTimer=0;g.cinematic=0;g.ball.position.set(0,0,200);g.camera.position.set(0,4,36);g.camera.lookAt(0,0,45);
    for(let i=0;i<30;i++)g.player.update(g.time,1/60,{groundHeight:g.groundHeight});
    g.lightChain=0;g.chainExpires=g.time+10;g.startAttack(kind);const action=g.action,start=g.player.root.position.clone();for(const key of keys)g.input.keys.add(key);
    let min=Infinity,max=-Infinity,maxReachError=0,maxPalmGap=0,maxFootJump=0,previous=null,activeFrames=0;
    for(let frame=0;frame<Math.floor(action.duration*60);frame++){
     g.time+=1/60;g.updateCombat(1/60);g.effects.update(1/60);g.player.root.updateMatrixWorld(true);const foot=g.player.bones.foot_r.getWorldPosition(new T.Vector3());min=Math.min(min,foot.y);max=Math.max(max,foot.y);
     if(previous)maxFootJump=Math.max(maxFootJump,foot.distanceTo(previous));previous=foot;
     const layer=g.player.attackLocomotion.report;if(layer){activeFrames++;for(const f of layer.feet)maxReachError=Math.max(maxReachError,f.error);}
     const palm=g.player.bones.hand_r.localToWorld(g.player.palmGrips.r.clone());maxPalmGap=Math.max(maxPalmGap,palm.distanceTo(g.player.weapon.localToWorld(new T.Vector3(0,g.player.weapon.userData.primaryGrip,0))));
    }
    reports.push({hero,kind,direction,travel:g.player.root.position.distanceTo(start),lift:max-min,maxReachError,maxPalmGap,maxFootJump,activeFrames});g.input.clear();
   }
  }
  g.clearEnemies();g.audio.pause();return reports;
 });
 fs.writeFileSync('/tmp/ninja-moving-attacks.json',JSON.stringify(reports,null,2));assert.deepEqual(errors,[]);
 for(const r of reports){assert.ok(r.travel>.3,`Movement unavailable: ${JSON.stringify(r)}`);assert.ok(r.lift>.035,`Legs remain parked: ${JSON.stringify(r)}`);assert.ok(r.activeFrames>10);assert.ok(r.maxReachError<.10,`Leg target unreachable: ${JSON.stringify(r)}`);assert.ok(r.maxPalmGap<1e-6,`Weapon leaves hand: ${JSON.stringify(r)}`);assert.ok(r.maxFootJump<.25,`Foot discontinuity: ${JSON.stringify(r)}`);}
 console.log(`Passed ${reports.length} moving attack scenarios: six characters, eight directions, light/heavy attacks.`);
}finally{await browser.close();}
