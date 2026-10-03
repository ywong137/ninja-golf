import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {routeModelDirectory} from '../tools/route-model-directory.mjs';

const output='artifacts/reviews/enemy-gait-transfer';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await routeModelDirectory(page,process.env.NINJA_MODEL_DIR);
 await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5174');await page.waitForFunction(()=>window.__golfTest);
 const rows=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{heightAt}=await import('/src/course.js');
  const {calibrateLegAnatomy,measureLegAnatomy}=await import('/src/leg-anatomy.js');
  const g=window.__golfTest,rows=[];g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(0,0);g.audio.pause();
  for(let hero=0;hero<6;hero++)for(const hz of [40,60]){
   g.clearEnemies();g.effects.clear();g.selectWarrior(hero);g.action=null;g.attackTimer=0;g.attackBuffer=null;g.runAcceleration=null;
   g.phase='combat';g.paused=false;g.spawnTime=999;g.combatTime=0;g.dodgeTimer=0;g.invincible=999;g.lightChain=0;g.chainExpires=0;
   g.playerVelocity={x:0,z:0};g.input.clear();g.input.setContext('combat');g.cameraYaw=0;
   g.player.root.position.set(0,heightAt(g.course,0,5),5);g.player.root.rotation.set(0,0,0);g.ball.position.set(0,heightAt(g.course,0,300),300);
   g.camera.position.set(0,4,-5);g.camera.lookAt(0,4,5);g.camera.updateMatrixWorld(true);
   const p=g.player,saved=[];
   for(const [b,rest]of p.golfRestPose)if(b.isBone){saved.push([b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]);b.position.copy(rest.position);b.quaternion.copy(rest.quaternion);b.scale.copy(rest.scale);}
   p.root.updateMatrixWorld(true);const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(...['thigh','calf','foot'].map(n=>p.bones[n+'_'+s]))]));
   for(const [b,v,q,s]of saved){b.position.copy(v);b.quaternion.copy(q);b.scale.copy(s);}
   const row={hero,hz,runSamples:0,sprintSamples:0,maxStepsPerSecond:0,minKneeFlex:180,maxHinge:0,clips:new Set(),attacks:0};
   for(let i=0;i<12*hz;i++){
    const t=i/hz;g.input.keys.clear();
    if(t<8||t>=10)g.input.keys.add('KeyW');
    if(t>=2.5&&t<4.5)g.input.keys.add('ShiftLeft');
    if(t>=4.5&&t<6){g.input.keys.add('KeyC');g.input.keys.add('KeyD');}
    if(i===6*hz)g.input.pressed.add('LightAttack');if(i===7*hz)g.input.pressed.add('HeavyAttack');
    g.time+=1/hz;g.updateCombat(1/hz);g.effects.update(1/hz);g.input.end();p.root.updateMatrixWorld(true);
    row.clips.add(p.current);if(g.action)row.attacks++;
    const steady=t>1&&t<2.4||t>3.1&&t<4.4||t>11;
    if(steady&&p.sourceRun){
     row[p.current==='Sprint_Forward'?'sprintSamples':'runSamples']++;
     row.maxStepsPerSecond=Math.max(row.maxStepsPerSecond,2*p.sourceRun.phaseRate);
     for(const s of ['r','l']){const m=measureLegAnatomy(cal[s],...['thigh','calf','foot'].map(n=>p.bones[n+'_'+s]));row.minKneeFlex=Math.min(row.minKneeFlex,m.kneeFlexion);row.maxHinge=Math.max(row.maxHinge,m.kneeDeviation);}
    }
    for(const b of Object.values(p.bones))if([...b.position,...b.quaternion].some(v=>!Number.isFinite(v)))throw Error('Non-finite pose: '+JSON.stringify({hero,t,bone:b.name}));
   }
   row.clips=[...row.clips];rows.push(row);
  }return rows;
 });
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/runtime-report.json',JSON.stringify({errors,rows},null,2));
 assert.deepEqual(errors,[]);assert.equal(rows.length,12);
 for(const r of rows){assert.ok(r.runSamples>60&&r.sprintSamples>30&&r.attacks>0,JSON.stringify(r));assert.ok(r.maxStepsPerSecond<4&&r.minKneeFlex>-.1&&r.maxHinge<1,JSON.stringify(r));assert.ok(r.clips.includes('Run_Directional_Forward')||r.clips.includes('Run_Right'),JSON.stringify(r));}
 console.log(JSON.stringify({cases:rows.length,maxStepsPerSecond:Math.max(...rows.map(r=>r.maxStepsPerSecond)),errors}));
}finally{await browser.close();}
