import {preloadWarriorFixtures} from './preload-warrior-fixtures.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {parseArgs} from 'node:util';
import {WARRIORS} from '../src/warriors.js';
import {disableHmr} from './disable-hmr.mjs';
const {values}=parseArgs({options:{hero:{type:'string',default:'sora'},output:{type:'string'},record:{type:'boolean'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/playtest-connected-combo.mjs [--hero MODEL] [--output DIRECTORY] [--record]\nCheck complete, partial, late, interrupted, moving, and terrain combos at 40, 60, and 144 Hz. All audio stays muted.');process.exit(0);}
const hero=WARRIORS.findIndex(w=>w.model===values.hero);
if(hero<0||WARRIORS[hero].lightComboLength!==3)throw Error('--hero requires an existing three-cut character.');
const output=path.resolve(values.output??'artifacts/reviews/connected-sword-combo/gameplay');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto('http://localhost:5174');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 const report=await page.evaluate(async(hero)=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {motions,combatMotionName}=await import('/src/motion.js'),{createPlayerGuard}=await import('/src/combat.js');
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(hero,0);g.audio.pause();
  const names={opening:combatMotionName(g.warrior,'light',0),returning:combatMotionName(g.warrior,'light',1),finish:combatMotionName(g.warrior,'light',2),heavy:combatMotionName(g.warrior,'heavy',0)};
  const originalSlide=g.slideOnLand.bind(g),originalHeight=g.groundHeight;
  const rows=[],strike=g.strike.bind(g);let hits=[],entries=[];
  g.strike=a=>{
   const facing=g.attackYaw+(a.headings?.[a.hitIndex]??0),targets=g.enemies.slice(0,2);
   for(const [i,e]of targets.entries()){e.root.position.copy(g.player.root.position).add(new T.Vector3(Math.sin(facing),0,Math.cos(facing)).multiplyScalar(i?-3:3));e.hp=100000;e.dead=0;e.emerging=0;e.type=0;}
   strike(a);hits.push({name:a.motionName,time:a.time,hit:a.hitIndex,damage:targets.map(e=>100000-e.hp)});
  };
  const reset=mode=>{
   g.clearEnemies();g.effects.clear();g.selectWarrior(hero);g.phase='combat';g.mode='game';g.spawnTime=999;g.time+=10;g.combatTime=0;g.paused=false;g.hitStop=0;
   g.groundHeight=mode==='terrain'?originalHeight:()=>0;g.slideOnLand=mode==='terrain'?originalSlide:p=>{p.y=0;};
   g.player.root.position.set(0,0,45);g.player.root.rotation.set(0,0,0);g.ball.position.set(0,0,190);g.input.clear();g.input.setContext('combat');g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;g.playerVelocity={x:0,z:0};g.cameraYaw=0;
   hits=[];entries=[];g.enemiesSpawned=0;g.enemyBudget=1000;
   for(const site of g.world.ambushSites)site.readyAt=0;g.spawnWave(8);g.spawnTime=999;
   if(g.enemies.length<2)throw Error('Expected two real enemy actors for damage verification.');
   for(const e of g.enemies){e.readyAt=1e9;e.cooldown=999;e.stun=999;e.emerging=0;}
   const a=g.player,play=a.play.bind(a);
   a.play=(name,...args)=>{const from=a.current,time=a.actions.get(from)?.time,drift=[];
    if(from===names.returning&&name===names.finish)for(const track of a.actions.get(name).getClip().tracks){const dot=track.name.lastIndexOf('.'),bone=a.bones[track.name.slice(0,dot)],property=track.name.slice(dot+1);if(!bone||/thumb|index|middle|ring|pinky/.test(bone.name))continue;const error=property==='quaternion'?bone.quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(track.values).normalize()):bone[property]?.distanceTo(new T.Vector3().fromArray(track.values));if(error>1e-6)drift.push({name:track.name,error});}
    const result=play(name,...args);if(name!==from)entries.push({from,to:name,time,fade:a.poseFade?.duration??0,held:a.heldBlend?.duration??0,...(drift.length?{drift}:{} )});return result;};
  };
  window.comboReset=reset;
  for(const rate of [40,60,144])for(const mode of ['none','pair','chain','late','heavy','replace','dodge','repeat','moving','terrain']){
   reset(mode);const row={rate,mode,clips:[],weaponHidden:0,finite:true,positions:[]};
   const tick=()=>{g.time+=1/rate;g.updateCombat(1/rate);g.effects.update(1/rate);g.input.end();if(g.action){if(row.clips.at(-1)!==g.action.motionName)row.clips.push(g.action.motionName);if(!g.player.weapon.visible)row.weaponHidden++;}for(const b of Object.values(g.player.bones))if(![...b.position,...b.quaternion].every(Number.isFinite))row.finite=false;};
   for(let i=0;i<rate/2;i++)tick();
   if(mode==='moving'){g.input.keys.add('KeyW');for(let i=0;i<rate;i++)tick();}
   g.attack('light');const start=g.time,sent=new Set();let replaced=false;
   for(let i=0;i<6*rate;i++){
    const a=g.action;
    if(a&&!sent.has(a.token)){
     const allowed=mode==='repeat'||['chain','moving','terrain'].includes(mode)&&a.step<2||mode==='pair'&&a.step===0||['heavy','replace','dodge','late'].includes(mode)&&a.step===0;
     if(allowed&&a.kind==='light'&&a.time>=(mode==='late'?.45:.10)&&(mode!=='repeat'||g.time-start<2.5)){
      g.attack(mode==='heavy'?'heavy':'light');sent.add(a.token);
     }
    }
    if(!replaced&&g.time-start>=.26&&['replace','dodge'].includes(mode)){if(mode==='replace')g.attack('heavy');else g.input.pressed.add('Dodge');replaced=true;}
    tick();
   }
   row.hits=hits;row.entries=entries;row.remaining=!!(g.action||g.attackBuffer);row.position=g.player.root.position.toArray();row.running=g.player.running;rows.push(row);
  }
  g.strike=strike;reset('none');
  return{rows,names,heavyHits:motions[names.heavy].impacts.length};
 },hero);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({...report,errors},null,2));
 const {names}=report;
 for(const r of report.rows){
  assert.ok(r.finite&&!r.weaponHidden&&!r.remaining,JSON.stringify(r));
  for(const hit of r.hits){assert.ok(hit.damage[0]>0,'The forward enemy must receive actual damage: '+JSON.stringify(hit));assert.equal(hit.damage[1],0,'These directional cuts must not damage the enemy behind the player.');}
  const hitNames=r.hits.map(h=>h.name);
  assert.equal(hitNames[0],names.opening);
  if(r.mode==='none'||r.mode==='dodge')assert.equal(hitNames.length,1,JSON.stringify(r));
  if(['pair','late'].includes(r.mode))assert.deepEqual(hitNames,[names.opening,names.returning]);
  if(['chain','moving','terrain'].includes(r.mode))assert.deepEqual(hitNames,[names.opening,names.returning,names.finish]);
  if(['heavy','replace'].includes(r.mode))assert.deepEqual(hitNames,[names.opening,...Array(report.heavyHits).fill(names.heavy)]);
  if(r.mode==='repeat')assert.equal(hitNames[3],names.opening);
  if(r.mode==='moving')assert.ok(r.running);
 }
 for(const r of report.rows.filter(r=>r.mode==='chain'))for(const to of [names.returning,names.finish])assert.equal(r.entries.find(e=>e.to===to).fade,0,JSON.stringify(r));
 if(values.record){
  const encoded=await page.evaluate(async()=>{
   const g=window.__golfTest;window.comboReset('terrain');g.cameraYaw=.8;g.cameraPitch=.18;g.audio.enabled=false;g.audio.pause();
   const canvas=g.renderer.domElement,chunks=[],stream=canvas.captureStream(60),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
   const done=new Promise(r=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=r;});
   const queued=new Set();g.previousTime=performance.now();g.renderer.setAnimationLoop(()=>{g.frame();const a=g.action;if(a?.kind==='light'&&a.step<2&&a.time>.1&&!queued.has(a.token)){g.attack('light');queued.add(a.token);}});
   const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(650);recorder.start();g.attack('light');await wait(3500);g.cameraYaw=-1.1;await wait(600);g.lightChain=0;g.attack('light');await wait(3500);recorder.stop();await done;g.renderer.setAnimationLoop(null);stream.getTracks().forEach(t=>t.stop());
   const data=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);
  });fs.writeFileSync(path.join(output,values.hero+'-combo.webm'),Buffer.from(encoded,'base64'));
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({cases:report.rows.length,entries:report.rows.filter(r=>r.rate===60&&['pair','chain','late'].includes(r.mode)).map(r=>({mode:r.mode,entries:r.entries})),errors}));
}finally{await browser.close();}
