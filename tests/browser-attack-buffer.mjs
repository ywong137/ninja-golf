import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

// Software rendering keeps this deterministic gameplay check off the shared GPU.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:400,height:300}});await disableHmr(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>!!window.__golfTest);
 const result=await page.evaluate(async()=>{
  const {heightAt}=await import('/src/course.js'),{createPlayerGuard}=await import('/src/combat.js');
  const g=window.__golfTest,dt=1/240,rows=[];g.paused=true;g.audio.pause();
  const setup=hero=>{
   g.clearEnemies();g.selectWarrior(hero);g.phase='combat';g.spawnTime=999;g.combatTime=0;g.time+=10;
   g.player.root.position.set(0,heightAt(g.course,0,45),45);g.ball.position.set(0,heightAt(g.course,0,190),190);
   g.input.clear();g.guard=createPlayerGuard();g.dodgeTimer=0;g.invincible=999;g.paused=false;
  };
  const tick=()=>{g.time+=dt;g.updateCombat(dt);g.input.end();};
  const finish=token=>{for(let i=0;i<1500&&g.action?.token===token;i++)tick();};
  for(let hero=0;hero<6;hero++)for(const first of ['light','heavy'])for(const next of ['light','heavy']){
   setup(hero);g.attack(first);const token=g.action.token,duration=g.action.duration;
   for(let i=0;i<3;i++)tick();g.attack(next);
   const stillFirst=g.action.token===token;finish(token);
   const row={hero,first,next,duration,stillFirst,followKind:g.action?.kind,followStep:g.action?.step,followToken:g.action?.token,expectedToken:token+1,bufferCleared:g.attackBuffer===null};
   if(g.action)finish(g.action.token);row.extraAction=!!g.action;rows.push(row);
  }
  setup(2);g.attack('light');const token=g.action.token;g.attack('light');g.attack('heavy');finish(token);
  const replacement={kind:g.action?.kind,token:g.action?.token,expectedToken:token+1};
  setup(2);g.attack('heavy');g.attack('light');g.input.pressed.add('Dodge');tick();
  const canceled={action:!!g.action,buffer:!!g.attackBuffer,dodging:g.dodgeTimer>0};
  for(let i=0;i<360;i++)tick();canceled.lateAction=!!g.action;
  setup(2);g.startAttack('musou');const special=g.action.token;g.attack('light');finish(special);
  const earlyMusouFollow=!!g.action;
  setup(2);g.startAttack('musou');const lateSpecial=g.action.token;
  while(g.action.token===lateSpecial&&g.attackTimer>.2)tick();g.attack('heavy');finish(lateSpecial);
  const lateMusouFollow=g.action?.kind;
  g.clearEnemies();g.paused=true;g.audio.pause();return{rows,replacement,canceled,earlyMusouFollow,lateMusouFollow};
 });
 for(const row of result.rows){
  assert.ok(row.stillFirst,JSON.stringify(row));assert.equal(row.followKind,row.next,JSON.stringify(row));
  assert.equal(row.followStep,row.first==='light'&&row.next==='light'?1:0,JSON.stringify(row));
  assert.equal(row.followToken,row.expectedToken,JSON.stringify(row));assert.ok(row.bufferCleared&&!row.extraAction,JSON.stringify(row));
 }
 assert.equal(result.replacement.kind,'heavy');assert.equal(result.replacement.token,result.replacement.expectedToken);
 assert.deepEqual(result.canceled,{action:false,buffer:false,dodging:true,lateAction:false});
 assert.equal(result.earlyMusouFollow,false);assert.equal(result.lateMusouFollow,'heavy');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({cases:result.rows.length,replacement:result.replacement,canceled:result.canceled,earlyMusouFollow:result.earlyMusouFollow,lateMusouFollow:result.lateMusouFollow}));
}finally{await browser.close();}
