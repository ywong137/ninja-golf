import assert from 'node:assert/strict';import fs from 'node:fs';import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';import {preloadWarriorFixtures} from '../tools/preload-warrior-fixtures.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await disableHmr(page);await page.goto(process.env.GAME_URL??'http://localhost:5184');await page.waitForFunction(()=>window.__golfTest,null,{timeout:120000});await preloadWarriorFixtures(page);
 const rows=await page.evaluate(async()=>{
  const g=window.__golfTest,{combatSequenceFrame}=await import('/src/musou-sequence.js');
  g.renderer.setAnimationLoop(null);g.audio.enabled=false;g.audio.pause();g.clearEnemies();g.selectScreen();g.ui.showScreen('selection');const rows=[];
  for(let hero=0;hero<6;hero++){
   g.selectWarrior(hero);const showcase=g.showcase;
   const reference=new g.player.constructor(hero);reference.root.scale.copy(g.player.root.scale);reference.root.rotation.y=showcase.baseYaw;
   for(const choice of showcase.choices.filter(s=>showcase.performances[s.id])){
    const performance=showcase.performances[choice.id];
    // Every listed source is one the gameplay command actually selects.
    for(const part of performance.parts){
     g.lightChain=part.action.kind==='heavy'?part.action.step+1:part.action.step;g.chainExpires=g.time+100;g.startAttack(part.action.kind);
     if(g.action.motionName!==part.action.motionName||Math.abs(g.action.duration-part.action.duration)>1e-8||JSON.stringify(g.action.hits)!==JSON.stringify(part.action.hits))throw Error('Inspector differs from gameplay '+hero+' '+choice.id);
    }
    g.action=null;g.attackTimer=0;
    for(const fraction of [0,.15,.5,.85,1]){
     showcase.seek(choice.id,performance.duration*fraction);const p=g.player;
     // Read the corresponding gameplay action, not the preview's chosen clip.
     const part=performance.parts.find(part=>performance.duration*fraction<part.end)??performance.parts.at(-1);
     g.lightChain=part.action.kind==='heavy'?part.action.step+1:part.action.step;g.chainExpires=g.time+100;g.startAttack(part.action.kind);g.action.time=performance.duration*fraction-part.start;
     const frame=combatSequenceFrame(g.action),action={...(frame?.action??g.action),syncMotion:true};
     reference.handGrip.restore();reference.interruptAttack();reference.mixer.stopAllAction();reference.current='';reference.oneShot=0;reference.actionToken=null;reference.root.rotation.y=showcase.baseYaw+(frame?.heading??0);reference.root.position.copy(p.root.position);
     reference.update(showcase.clock.time,0,{action,groundHeight:()=>p.root.position.y});reference.root.updateMatrixWorld(true);p.root.updateMatrixWorld(true);
     let maxAngle=0;for(const name of ['pelvis','spine_01','spine_02','spine_03','upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'])maxAngle=Math.max(maxAngle,p.bones[name].quaternion.clone().normalize().angleTo(reference.bones[name].quaternion.clone().normalize()));
     const row={hero,id:choice.id,fraction,clip:p.current,gameClip:reference.current,maxAngle,hidden:!p.root.visible,expectedHidden:!!frame?.hidden};rows.push(row);
     if(p.current!==reference.current||maxAngle>.001||row.hidden!==row.expectedHidden)throw Error('Preview pose differs from gameplay '+JSON.stringify(row));
     g.action=null;g.attackTimer=0;
    }
   }
   // A direct seek and resume must preserve the selected motion, then stop.
   showcase.seek('musou',showcase.performances.musou.duration-.05);showcase.clock.setSpeed(.1);showcase.togglePause();showcase.update(2);
   if(!showcase.state.paused||showcase.state.stage!=='musou')throw Error('Inspector did not hold the final pose');
   showcase.togglePause();if(showcase.state.paused||showcase.state.time!==0)throw Error('Go did not replay the completed inspection');reference.dispose();
  }
  g.selectWarrior(3);g.showcase.seek('musou',1);g.updateShowcaseUI();g.updateCamera(0,{immediate:true});g.rendering.render('balanced');return rows;
 });
 await page.click('#showcase-console-toggle');await page.waitForFunction(()=>document.getElementById('showcase-console-toggle').getAttribute('aria-expanded')==='true');await page.selectOption('#showcase-stage','heavy-2');assert.equal(await page.locator('#showcase-pause').textContent(),'Go');await page.locator('#showcase-position').fill('0.4');assert.ok(Math.abs(await page.evaluate(()=>window.__golfTest.showcase.state.time)-.4)<1e-8);
 assert.deepEqual(errors,[]);if(process.env.REVIEW_OUTPUT)fs.writeFileSync(process.env.REVIEW_OUTPUT,JSON.stringify({rows,errors},null,2));console.log(JSON.stringify({poses:rows.length,maximumAngle:Math.max(...rows.map(r=>r.maxAngle)),errors}));
}finally{await browser.close();}
