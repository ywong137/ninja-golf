import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {routeModelDirectory} from '../tools/route-model-directory.mjs';

// Exercise input release and guard through the real controller. A rig-stage
// transition cannot reveal root motion continuing under a stopped animation.
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await routeModelDirectory(page,process.env.NINJA_MODEL_DIRECTORY);
 await page.goto(process.env.GAME_URL??'http://localhost:5173');await page.waitForFunction(()=>!!window.__golfTest,null,{timeout:120000});
 const rows=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{heightAt}=await import('/src/course.js');
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(0,0);g.audio.pause();
  const dt=1/120,rows=[];
  for(let hero=0;hero<6;hero++)for(const releaseAfter of [0,.05,.1,.2,.4,'guard','turn']){
   g.clearEnemies();g.effects.clear();g.selectWarrior(hero);g.action=null;g.attackTimer=0;g.attackBuffer=null;g.runAcceleration=null;
   g.phase='combat';g.paused=false;g.spawnTime=999;g.combatTime=0;g.dodgeTimer=0;g.invincible=999;
   g.lightChain=0;g.chainExpires=0;g.playerVelocity={x:0,z:0};g.input.clear();g.input.setContext('combat');
   g.player.root.position.set(0,heightAt(g.course,0,5),5);g.player.root.rotation.set(0,0,0);g.cameraYaw=0;
   g.ball.position.set(0,heightAt(g.course,0,150),150);g.camera.position.set(0,4,-5);g.camera.lookAt(0,4,5);g.camera.updateMatrixWorld(true);
   g.input.padX=0;g.input.padY=0;
   const step=()=>{g.time+=dt;g.updateCombat(dt);g.effects.update(dt);g.input.end();};
   for(let i=0;i<36;i++)step();
   g.input.keys.add('KeyC');g.input.keys.add('KeyS');
   const row={hero,releaseAfter,attackEnded:null,maxFootSpeed:0,maxSlowFootSpeed:0,maxTransferExitSpeed:0,maxYaw:0,missingSteps:0,transferFrames:0,transfersEnded:0};
   let attacked=false,sawAttack=false,previousFeet=null,previousTransfer=null;
   for(let frame=0;frame<600;frame++){
    const t=frame*dt;
    if(!attacked&&t>=.9){attacked=true;g.input.pressed.add('HeavyAttack');}
    if(row.attackEnded!==null){
     const since=t-row.attackEnded;
     if(releaseAfter==='guard'){
      if(since<.3)g.input.keys.add('KeyV');else g.input.keys.delete('KeyV');
      if(since>=.8)g.input.keys.delete('KeyS');
     }else if(releaseAfter==='turn'){
      g.input.keys.delete('KeyC');
      if(since>=.8)g.input.keys.delete('KeyS');
     }else if(since>=releaseAfter)g.input.keys.delete('KeyS');
    }
    step();
    if(g.action)sawAttack=true;
    else if(sawAttack)row.attackEnded??=t;
    const w=g.player,transfer=w.attackLocomotion?.contactTransfer;
    const feet=['r','l'].map(s=>w.bones['foot_'+s].getWorldPosition(new T.Vector3()));
    if(row.attackEnded!==null&&previousFeet){
     const speed=Math.max(...feet.map((p,i)=>p.distanceTo(previousFeet[i])/dt));
     const rootSpeed=Math.hypot(g.playerVelocity.x,g.playerVelocity.z);
     row.maxYaw=Math.max(row.maxYaw,Math.abs(w.root.rotation.y));
     row.maxFootSpeed=Math.max(row.maxFootSpeed,speed);
     if(rootSpeed<=3)row.maxSlowFootSpeed=Math.max(row.maxSlowFootSpeed,speed);
     if(transfer)row.transferFrames++;
     if(previousTransfer&&!transfer){row.transfersEnded++;row.maxTransferExitSpeed=Math.max(row.maxTransferExitSpeed,speed);}
     // updateCombat clears the action after evaluating its final pose. The
     // next frame is the first one which can display a recovery animation.
     if(t>row.attackEnded+dt*.5&&!g.action&&Math.hypot(g.playerVelocity.x,g.playerVelocity.z)>.1&&!w.running&&!w.guardWalking&&!transfer&&!w.startingRun&&!w.turningRun&&!w.recordedStopping)row.missingSteps++;
     if(speed===row.maxFootSpeed)row.peak={t,since:t-row.attackEnded,clip:w.current,transfer:!!transfer,running:w.running,rootSpeed,footPositions:feet.map(p=>p.toArray())};
    }
    previousFeet=feet;previousTransfer=transfer;
    if(row.attackEnded!==null&&t-row.attackEnded>1.7)break;
   }
   row.finalSpeed=Math.hypot(g.playerVelocity.x,g.playerVelocity.z);rows.push(row);
  }
  return rows;
 });
 fs.writeFileSync(process.env.NINJA_EXIT_CONTROL_REPORT??'/tmp/ninja-attack-exit-controls.json',JSON.stringify({errors,rows},null,2));
 assert.deepEqual(errors,[]);assert.equal(rows.length,42);
 for(const row of rows){
  assert.notEqual(row.attackEnded,null,JSON.stringify(row));
  assert.equal(row.missingSteps,0,JSON.stringify(row));
  assert.ok(row.finalSpeed<.01,JSON.stringify(row));
  if(row.releaseAfter==='turn')assert.ok(row.maxYaw>2.4,'Releasing focus did not exercise the body turn: '+JSON.stringify(row));
  // The existing recovery bound covers walking and settling. A full running
  // stride can exceed it when the root travels at more than twice that speed.
  // Keep that measurement, but test handoff discontinuities at every speed.
  assert.ok(row.maxSlowFootSpeed<12&&row.maxTransferExitSpeed<12,JSON.stringify(row));
 }
 console.log(JSON.stringify({cases:rows.length,maxFootSpeed:Math.max(...rows.map(r=>r.maxFootSpeed)),maxTransferExitSpeed:Math.max(...rows.map(r=>r.maxTransferExitSpeed))}));
}finally{await browser.close();}
