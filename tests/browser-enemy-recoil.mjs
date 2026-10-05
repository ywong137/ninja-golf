import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {disableHmr} from '../tools/disable-hmr.mjs';
const baseline=process.argv.includes('--baseline');
const out=pathToFileURL(path.resolve(process.env.REVIEW_OUTPUT??`artifacts/reviews/enemy-recoil/${baseline?'baseline':'candidate'}`)+path.sep);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);
 if(baseline)await page.route('**/src/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('if(e.hp>0)e.recoil();','').replace('attacker.recoil();','')});});
 await page.goto(process.env.NINJA_BASE_URL??'http://localhost:5173');await page.waitForSelector('#play',{state:'visible',timeout:120000});
 await page.evaluate(async()=>{
  const g=window.__golfTest,T=await import('/node_modules/three/build/three.module.js'),{heightAt}=await import('/src/course.js');
  g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.begin(0,0);await g.world.waitForAssets();
  g.mode='game';g.phase='combat';g.paused=false;g.ui.showScreen('game');g.input.clear();g.invincible=999;g.spawnTime=999;
  g.player.root.position.set(0,heightAt(g.course,0,25),25);g.player.root.rotation.y=0;g.attackYaw=0;g.ball.position.set(0,heightAt(g.course,0,200),200);
  window.recoilFixture={g,T,heightAt,roles:(await import('/src/combat.js')).ENEMY_TYPES,enemy:null,
   setup(type=0){
    for(const e of g.enemies)e.dispose();g.clearEnemies();g.effects.clear();g.spawnTime=999;g.enemyBudget=80;g.enemiesSpawned=[0,2,4,6][type];
    for(const site of g.world.ambushSites)site.readyAt=0;g.spawnWave(1);
    const e=g.enemies[0];if(!e||e.type!==type)throw Error('Missing role '+type);
    this.enemy=e;e.emerging=null;e.root.visible=true;e.root.position.set(0,heightAt(g.course,0,27.5),27.5);e.root.rotation.y=Math.PI;
    e.hp=1000;e.cooldown=999;e.readyAt=99999;e.stun=0;e.play('Sword_Idle',0);e.update(g.time,0,{});
    g.scene.add(e.root);g.crowd.update(g.enemies);return e;
   },
   hit(kind='light',damage=1){g.strike({kind,damage,reach:6,arc:Math.PI,hitIndex:0,hits:[0],style:'sword'});},
   tick(dt){g.time+=dt;g.updateCombat(dt);g.effects.update(dt);g.crowd.update(g.enemies);},
   state(){const e=this.enemy;return{type:e.type,hp:e.hp,stun:e.stun,clip:e.current,time:e.actions.get(e.current).time,oneShot:e.oneShot,dead:e.dead,attacking:!!e.enemyAction,weapon:e.weapon.visible};},
   render(){const e=this.enemy;g.player.root.visible=false;const p=e.root.position;g.camera.position.set(p.x+4,p.y+2.4,p.z-4);g.camera.lookAt(p.x,p.y+1.05,p.z);g.world.update(g.time,0,p,g.camera.position);g.rendering.render('balanced');},
  };
 });
 const rows=[];
 for(const hz of [40,60,144])for(const type of [0,1,2,3]){
  const row=await page.evaluate(({hz,type})=>{
   const f=window.recoilFixture,e=f.setup(type);f.hit(f.roles[type].armor?'heavy':'light');const start=f.state();
   const samples=[];for(let i=0;i<Math.ceil(.48*hz);i++){f.tick(1/hz);samples.push(f.state());}
   return{hz,type,start,samples};
  },{hz,type});
  if(!baseline){assert.equal(row.start.clip,'Hit_Chest',JSON.stringify({hz,type,start:row.start}));assert.ok(row.start.stun>=.333);assert.ok(row.samples.some(s=>s.clip==='Hit_Chest'&&s.time>.15));assert.notEqual(row.samples.at(-1).clip,'Hit_Chest');}
  rows.push(row);
 }
 const special=await page.evaluate(async()=>{
  const f=window.recoilFixture,g=f.g;
  let e=f.setup(f.roles.findIndex(r=>r.armor));f.hit('light');const blocked=f.state();
  e=f.setup(0);f.hit();f.tick(.12);const first=f.state();f.hit();const repeated=f.state();f.tick(.02);const repeatedNext=f.state();
  f.hit('heavy',20000);f.tick(1/60);const fatal=f.state();
  e=f.setup(0);const{ENEMY_TYPES,createPlayerGuard}=await import('/src/combat.js');
  e.enemyAction={token:'review',time:.1,hitIndex:0,duration:ENEMY_TYPES[0].duration,yaw:Math.PI,target:g.player.root.position.clone()};e.update(g.time,0,{enemyAction:e.enemyAction});
  f.hit();const interrupted=f.state();
  e=f.setup(0);g.invincible=0;g.guard=createPlayerGuard();g.guard.active=true;g.guard.parryUntil=g.time+.18;
  const health=g.health;g.hurt(1,e.root.position,e);const parry={...f.state(),healthLost:health-g.health};g.invincible=999;
  return{blocked,first,repeated,repeatedNext,fatal,interrupted,parry};
 });
 assert.notEqual(special.blocked.clip,'Hit_Chest');assert.equal(special.fatal.clip,'Death01');assert.equal(special.fatal.weapon,false);
 if(!baseline){
  assert.equal(special.repeated.clip,'Hit_Chest');assert.ok(special.repeated.time<special.first.time);
  assert.ok(special.repeatedNext.time>0&&special.repeatedNext.time<.04);
  assert.equal(special.interrupted.clip,'Hit_Chest');assert.equal(special.interrupted.attacking,false);
  assert.equal(special.parry.clip,'Hit_Chest');assert.equal(special.parry.healthLost,0);assert.ok(special.parry.stun>=1.19);
 }
 await page.addStyleTag({content:'#app>:not(canvas){display:none!important}'});
 await page.evaluate(()=>{const f=window.recoilFixture;f.setup(0);f.hit();});
 let elapsed=0;
 for(const time of [0,.08,.16,.28,.48]){
  await page.evaluate(dt=>{const f=window.recoilFixture;for(let left=dt;left>1e-8;){const d=Math.min(1/120,left);f.tick(d);left-=d;}f.render();},time-elapsed);elapsed=time;
  await page.screenshot({path:new URL(`recoil-${time.toFixed(2)}.png`,out).pathname});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(new URL('report.json',out),JSON.stringify({baseline,rows,special,errors,muted:true},null,2)+'\n');
 console.log(JSON.stringify({baseline,cases:rows.length,scenarios:Object.keys(special),errors}));
}finally{await browser.close();}
