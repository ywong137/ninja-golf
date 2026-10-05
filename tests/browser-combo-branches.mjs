import{chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
import{disableHmr}from'../tools/disable-hmr.mjs';
import{preloadWarriorFixtures}from'../tools/preload-warrior-fixtures.mjs';
const output=(process.env.COMBO_REVIEW_OUTPUT??'artifacts/reviews/complete-combos').replace(/\/$/,'')+'/';fs.mkdirSync(output,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await disableHmr(p);await p.goto(process.env.GAME_URL??'http://localhost:5184');await p.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(p);
await p.evaluate(async()=>{const g=window.__golfTest,{motions,combatMotionName}=await import('/src/motion.js'),{Vector3}=await import('/node_modules/three/build/three.module.js');g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();window.comboReview={rows:[],hits:[],motions,combatMotionName,Vector3};const strike=g.strike.bind(g);g.strike=a=>{window.comboReview.hits.push({clip:a.motionName,index:a.hitIndex,time:a.time,planned:a.hits[a.hitIndex]});strike(a);};});
const setup=async hero=>p.evaluate(async hero=>{const g=window.__golfTest;g.begin(hero,0);g.audio.pause();g.clearEnemies();g.ui.showScreen('game');g.mode='game';g.phase='combat';g.paused=false;g.input.setContext('combat');g.input.clear();g.spawnTime=999;g.invincible=999;g.cameraYaw=0;g.player.root.rotation.y=0;g.player.root.position.set(0,0,45);g.ball.position.set(0,0,190);g.groundHeight=()=>0;g.slideOnLand=q=>{q.y=0;};g.time+=10;g.lightChain=0;g.dodgeTimer=0;g.cinematic=0;g.hitStop=0;g.playerVelocity={x:0,z:0};g.runAcceleration=null;window.comboReview.hits=[];window.comboReview.maxPalmGap=0;window.comboReview.hidden=0;window.comboReview.finite=true;return g.warrior.lightComboLength??4;},hero);
const tick=async(n=1)=>p.evaluate(n=>{const g=window.__golfTest,r=window.comboReview;for(let i=0;i<n;i++){g.input.poll(1/60,true);g.time+=1/60;g.updateCombat(1/60);g.input.end();if(g.action){const a=g.player,m=r.motions[g.action.motionName];a.root.updateMatrixWorld(true);for(const held of[a.weapon,...(a.offhand?[a.offhand]:[])])for(let o=held;o;o=o.parent)if(!o.visible&&!(o===a.root&&g.action.sequence&&g.action.sequence.kind!=='performance'&&g.action.sequence.segments.some((part,i)=>i>0&&g.action.time>=g.action.sequence.segments[i-1].end&&g.action.time<part.start)))r.hidden++;for(const bone of Object.values(a.bones))if(![...bone.position,...bone.quaternion,...bone.scale].every(Number.isFinite))r.finite=false;if(g.action.time>.25){const palm=a.bones.hand_r.localToWorld(a.palmGrips.r.clone()),station=a.weapon.localToWorld(new r.Vector3(0,a.weapon.userData.primaryGrip,0));r.maxPalmGap=Math.max(r.maxPalmGap,palm.distanceTo(station));}}}return{clip:g.action?.motionName,kind:g.action?.kind,step:g.action?.step,token:g.action?.token,time:g.action?.time,duration:g.action?.duration,hitIndex:g.action?.hitIndex,hits:g.action?.hits,expected:g.action&&r.combatMotionName(g.warrior,g.action.kind,g.action.step),pos:g.player.root.position.toArray()};},n);
const click=button=>p.mouse.click(700,370,{button});
const advance=async predicate=>{let s;for(let i=0;i<600;i++){s=await tick();if(predicate(s))return s;}throw Error('Input sequence timed out: '+JSON.stringify(s));};
const rows=[];
for(let hero=0;hero<6;hero++){
 const length=await setup(hero);
 for(const lightCount of [0,...Array.from({length},(_,i)=>i+1)]){
  await setup(hero);const clips=[];let s;
  for(let step=0;step<lightCount;step++){
   await click('left');s=await advance(s=>s.kind==='light'&&s.step===step);assert.equal(s.clip,s.expected);clips.push(s.clip);
   // Queue near the authored outgoing branch, before its matching recovery.
   const branch=await p.evaluate(()=>{const g=window.__golfTest,m=window.comboReview.motions[g.action.motionName];return m.continuations?.light?m.continuations.light.at/m.duration*g.action.duration-.06:null;});
   const lightToken=s.token;s=await advance(s=>s.token===lightToken&&(branch!==null&&step<lightCount-1?s.time>=branch:s.hitIndex===s.hits.length));
  }
  await click('right');s=await advance(s=>s.kind==='heavy');assert.equal(s.clip,s.expected);assert.equal(s.step,Math.max(0,lightCount-1));clips.push(s.clip);const token=s.token;
  await advance(s=>s.token===token&&s.hitIndex===s.hits.length);
  const before=await tick();await p.keyboard.down('s');let frames=0;do{s=await tick();frames++;}while(s.token===token&&frames<60);await tick(36);const after=await tick();await p.keyboard.up('s');assert.ok(frames<=15,'Late attack did not release control');assert.ok(after.pos[2]<before.pos[2]-.5,'Reverse input did not move away');
  const metrics=await p.evaluate(()=>{const r=window.comboReview;return{hits:r.hits,maxPalmGap:r.maxPalmGap,hidden:r.hidden,finite:r.finite};});assert.ok(metrics.maxPalmGap<.002&&!metrics.hidden&&metrics.finite,JSON.stringify(metrics));for(const h of metrics.hits)assert.ok(h.time>=h.planned&&h.time-h.planned<=1/60+1e-6);rows.push({hero,lightCount,clips,cancelSeconds:frames/60,...metrics});
 }
 console.log(JSON.stringify({hero,cases:rows.filter(r=>r.hero===hero).length}));
}
assert.deepEqual(errors,[]);fs.writeFileSync(output+'gameplay.json',JSON.stringify({rows,errors,muted:true},null,2));console.log({cases:rows.length,errors});
}finally{await b.close();}
