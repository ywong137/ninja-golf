import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from './disable-hmr.mjs';
const output=path.resolve('artifacts/reviews/connected-sword-combo/gameplay');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 await page.goto('http://localhost:5174');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {motions}=await import('/src/motion.js'),{createPlayerGuard}=await import('/src/combat.js');
  const g=window.__golfTest;g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(5,0);g.audio.pause();
  const originalSlide=g.slideOnLand.bind(g),originalHeight=g.groundHeight;
  const rows=[],strike=g.strike.bind(g);let hits=[],entries=[];
  g.strike=a=>{hits.push({name:a.motionName,time:a.time,hit:a.hitIndex});};
  const reset=mode=>{
   g.clearEnemies();g.effects.clear();g.selectWarrior(5);g.phase='combat';g.mode='game';g.spawnTime=999;g.time+=10;g.combatTime=0;g.paused=false;g.hitStop=0;
   g.groundHeight=mode==='terrain'?originalHeight:()=>0;g.slideOnLand=mode==='terrain'?originalSlide:p=>{p.y=0;};
   g.player.root.position.set(0,0,45);g.player.root.rotation.set(0,0,0);g.ball.position.set(0,0,190);g.input.clear();g.input.setContext('combat');g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;g.playerVelocity={x:0,z:0};g.cameraYaw=0;
   hits=[];entries=[];
   const a=g.player,play=a.play.bind(a);
   a.play=(name,...args)=>{const from=a.current,time=a.actions.get(from)?.time,drift=[];
    if(from==='Closer_Combo_Return'&&name==='Closer_Combo_Finish')for(const track of a.actions.get(name).getClip().tracks){const dot=track.name.lastIndexOf('.'),bone=a.bones[track.name.slice(0,dot)],property=track.name.slice(dot+1);if(!bone||/thumb|index|middle|ring|pinky/.test(bone.name))continue;const error=property==='quaternion'?bone.quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(track.values).normalize()):bone[property]?.distanceTo(new T.Vector3().fromArray(track.values));if(error>1e-6)drift.push({name:track.name,error});}
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
  return{rows};
 });
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({...report,errors},null,2));
 for(const r of report.rows){
  assert.ok(r.finite&&!r.weaponHidden&&!r.remaining,JSON.stringify(r));
  const names=r.hits.map(h=>h.name);
  assert.equal(names[0],'Closer_Combo_Opening');
  if(r.mode==='none'||r.mode==='dodge')assert.equal(names.length,1,JSON.stringify(r));
  if(['pair','late'].includes(r.mode))assert.deepEqual(names,['Closer_Combo_Opening','Closer_Combo_Return']);
  if(['chain','moving','terrain'].includes(r.mode))assert.deepEqual(names,['Closer_Combo_Opening','Closer_Combo_Return','Closer_Combo_Finish']);
  if(['heavy','replace'].includes(r.mode))assert.deepEqual(names,['Closer_Combo_Opening','Sickle_Heavy_Cleave']);
  if(r.mode==='repeat')assert.equal(names[3],'Closer_Combo_Opening');
  if(r.mode==='moving')assert.ok(r.running);
 }
 for(const r of report.rows.filter(r=>r.mode==='chain'))for(const to of ['Closer_Combo_Return','Closer_Combo_Finish'])assert.equal(r.entries.find(e=>e.to===to).fade,0,JSON.stringify(r));
 if(process.argv.includes('--record')){
  const encoded=await page.evaluate(async()=>{
   const g=window.__golfTest;window.comboReset('terrain');g.cameraYaw=.8;g.cameraPitch=.18;g.audio.enabled=false;g.audio.pause();
   const canvas=g.renderer.domElement,chunks=[],stream=canvas.captureStream(60),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000});
   const done=new Promise(r=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=r;});
   const queued=new Set();g.previousTime=performance.now();g.renderer.setAnimationLoop(()=>{g.frame();const a=g.action;if(a?.kind==='light'&&a.step<2&&a.time>.1&&!queued.has(a.token)){g.attack('light');queued.add(a.token);}});
   const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(650);recorder.start();g.attack('light');await wait(3500);g.cameraYaw=-1.1;await wait(600);g.lightChain=0;g.attack('light');await wait(3500);recorder.stop();await done;g.renderer.setAnimationLoop(null);stream.getTracks().forEach(t=>t.stop());
   const data=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);
  });fs.writeFileSync(path.join(output,'closer-combo.webm'),Buffer.from(encoded,'base64'));
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({cases:report.rows.length,entries:report.rows.filter(r=>r.rate===60&&['pair','chain','late'].includes(r.mode)).map(r=>({mode:r.mode,entries:r.entries})),errors}));
}finally{await browser.close();}
