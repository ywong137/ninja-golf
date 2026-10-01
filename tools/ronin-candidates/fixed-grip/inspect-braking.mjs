import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {chromium} from 'playwright';
import {routeFixedGripCandidate} from '../../../tools/ronin-candidates/fixed-grip/route.mjs';
import {disableHmr} from '../../../tools/disable-hmr.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/inspect-braking.mjs --candidate DIRECTORY [--output FILE.json]\nMeasures actual game translation during four run phases with movement held or released. Samples at 144 Hz on an isolated flat plane. Reports near-ground toe drift; this is a diagnostic, not a complete foot-contact acceptance check. Uses a muted headless browser.');process.exit(0);}
if(!values.candidate)throw Error('Supply --candidate. See --help.');
const output=values.output||path.join(values.candidate,'braking-inspection.json');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage();await disableHmr(page);await routeFixedGripCandidate(page,values.candidate,{withDiagonal:true,withGuards:true});
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const rows=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createPlayerGuard}=await import('/src/combat.js');
  const g=window.__golfTest;g.frame=()=>{};g.audio.enabled=false;g.audio.pause();const rows=[];const dt=1/144;
  for(const phase of [.25,.45,.65,.85])for(const release of [true,false]){
   g.paused=true;g.clearEnemies();g.selectWarrior(0);g.phase='combat';g.spawnTime=999;g.time+=10;g.groundHeight=()=>0;g.slideOnLand=p=>{p.y=0;};g.player.root.position.set(0,0,45);g.ball.position.set(0,0,190);g.input.clear();g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;
   g.camera.position.set(0,2,40);g.camera.lookAt(0,2,190);g.cameraYaw=0;g.player.root.rotation.y=0;
   const actor=g.player;actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';actor.play('Ronin_Ready',0);actor.mixer.update(0);actor.syncHeldObjects();
   const tick=()=>{g.time+=dt;g.updateCombat(dt);g.input.end();};for(let i=0;i<72;i++)tick();
   g.input.keys.add('KeyW');for(let i=0;i<Math.round(phase*144);i++)tick();
   const sample=t=>{actor.root.updateMatrixWorld(true);return {t,root:actor.root.position.toArray(),phase:actor.runPhase,feet:Object.fromEntries(['r','l'].map(s=>[s,{toe:actor.bones['ball_'+s].getWorldPosition(new T.Vector3()).toArray(),ankle:actor.bones['foot_'+s].getWorldPosition(new T.Vector3()).toArray(),weight:actor.footPlacement.report?.feet.find(x=>x.side===s)?.weight??0}]))};};
   const samples=[sample(0)];g.paused=false;if(release)g.input.keys.clear();g.attack('light');
   for(let i=1;i<=Math.round(.4*144);i++){tick();samples.push(sample(i*dt));}
   rows.push({phase,release,samples});
  }
  g.paused=true;g.audio.pause();return rows;
 });
 const observations=[];
 for(const row of rows){let max=0,travel=0;for(let i=1;i<row.samples.length&&row.samples[i].t<.18;i++)for(const s of ['r','l']){const a=row.samples[i-1].feet[s],b=row.samples[i].feet[s];if(a.weight>.95&&b.weight>.95&&Math.max(a.toe[1],b.toe[1])<.02){const delta=Math.hypot(b.toe[0]-a.toe[0],b.toe[2]-a.toe[2]);max=Math.max(max,delta*144);travel+=delta;}}observations.push({runSeconds:row.phase,release:row.release,maxNearGroundToeSpeed:max,totalNearGroundToeDrift:travel});}
 fs.writeFileSync(output,JSON.stringify({rate:144,nearGroundHeight:.02,window:.18,observations,rows}));console.log(JSON.stringify({output,observations}));
}finally{await browser.close();}
