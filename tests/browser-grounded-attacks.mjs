import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];await disableHmr(page);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const reports=await page.evaluate(async()=>{
  const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js'),{heightAt}=await import('/src/course.js'),{combatMotionName,motions}=await import('/src/motion.js');
  g.frame=()=>{};g.begin(0,0);g.paused=true;g.audio.pause();const reports=[];
  for(const hero of [0,1,2,3,4,5])for(const [kind,step]of [['light',0],['heavy',0],['heavy',2]]){
   g.clearEnemies();g.selectWarrior(hero);g.phase='combat';g.spawnTime=999;g.input.clear();g.cameraYaw=0;g.player.root.rotation.y=0;
   g.player.root.position.set(0,heightAt(g.course,0,45),45);g.ball.position.set(0,heightAt(g.course,0,190),190);g.updateCamera(10);
   for(let i=0;i<30;i++)g.player.update(g.time,1/60,{groundHeight:g.groundHeight});
   g.lightChain=kind==='heavy'?step+1:step;g.chainExpires=g.time+10;g.startAttack(kind);
   const action=g.action,name=combatMotionName(g.warrior,kind,step),spec=motions[name],start=g.player.root.position.clone(),plants=new Map();let maxSupportDrift=0,maxRootTravel=0;
   for(let frame=0;frame<Math.ceil(action.duration*120);frame++){
    g.time+=1/120;g.updateCombat(1/120);g.player.root.updateMatrixWorld(true);
    maxRootTravel=Math.max(maxRootTravel,Math.hypot(g.player.root.position.x-start.x,g.player.root.position.z-start.z));
    const time=g.player.actions.get(name).time;
    for(const side of ['r','l'])for(const [index,[a,b]]of spec.footPlants[side].entries())if(time>Math.max(.10,a+.025)&&time<b-.025){
     const key=side+index,foot=g.player.bones['foot_'+side].getWorldPosition(new T.Vector3());if(!plants.has(key))plants.set(key,foot.clone());maxSupportDrift=Math.max(maxSupportDrift,foot.distanceTo(plants.get(key)));
    }
   }
   reports.push({hero,name,rootAdvance:action.rootAdvance,maxRootTravel,maxSupportDrift,hits:action.hitIndex,expectedHits:action.hits.length});
  }
  g.clearEnemies();g.phase='combat';g.spawnTime=999;g.input.clear();g.input.keys.add('KeyW');g.lightChain=0;g.startAttack('light');
  const start=g.player.root.position.clone();for(let i=0;i<20;i++){g.time+=1/60;g.updateCombat(1/60);}g.input.clear();reports.push({manualTravel:g.player.root.position.distanceTo(start)});
  g.clearEnemies();g.audio.pause();return reports;
 });
 fs.writeFileSync('/tmp/ninja-grounded-attacks.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));assert.deepEqual(errors,[]);
 for(const r of reports){
  if(r.manualTravel!==undefined){assert.ok(r.manualTravel>.25,'WASD movement remains available during an attack');continue;}
  assert.equal(r.rootAdvance,0);assert.ok(r.maxRootTravel<1e-5,`Automatic lunge slides the planted stance: ${JSON.stringify(r)}`);
  assert.ok(r.maxSupportDrift<.035,`Support foot slides during the actual game loop: ${JSON.stringify(r)}`);assert.equal(r.hits,r.expectedHits);
 }
}finally{await browser.close();}
