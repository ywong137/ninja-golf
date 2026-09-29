import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await disableHmr(page);
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {WARRIORS}=await import('/src/warriors.js');
  await loadWarriorAssets();
  const rows=[];
  for(let hero=0;hero<WARRIORS.length;hero++) {
   const actor=new Warrior(hero);
   if(!actor.forearmTwist)throw Error('Missing forearm deformation helpers');
   const row={hero:WARRIORS[hero].model,clips:0,samples:0,branchCrossings:[],maxStep:0};
   for(const [name,action] of actor.actions) {
    actor.handGrip.restore();
    actor.mixer.stopAllAction();
    action.reset().setLoop(T.LoopOnce,1).play();
    action.clampWhenFinished=true;
    const duration=action.getClip().duration;
    let previous;
    for(let frame=0;frame<=Math.ceil(duration*40);frame++) {
     action.time=Math.min(duration,frame/40);
     actor.mixer.update(0);
     actor.forearmTwist.update({refreshMatrices:false});
     const angles=structuredClone(actor.forearmTwist.report.angles);
     if(previous)for(const side of ['r','l']) {
      const step=Math.abs(angles[side].principalDegrees-previous[side].principalDegrees);
      row.maxStep=Math.max(row.maxStep,step);
      if(step>180)row.branchCrossings.push({name,time:action.time,side,
       previous:previous[side].principalDegrees,current:angles[side].principalDegrees});
     }
     previous=angles;
     row.samples++;
    }
    row.clips++;
   }
   // Death returns before the usual held-object update. Its skin still needs an update.
   const updates=actor.forearmTwist.report.updates;
   actor.dead=1;
   actor.update(0,1/60,{});
   row.deathUpdates=actor.forearmTwist.report.updates-updates;
   actor.dispose();
   row.disposed=actor.forearmTwist.report.disposed;
   rows.push(row);
  }
  const enemy=new Warrior(0,true);
  const crowdUnchanged=enemy.forearmTwist===null;
  enemy.dispose();
  return {rows,crowdUnchanged};
 });
 fs.writeFileSync('/tmp/ninja-forearm-runtime-validation.json',JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);
 assert.equal(report.crowdUnchanged,true,'Crowds must not acquire private helper geometry.');
 for(const row of report.rows) {
  assert.deepEqual(row.branchCrossings,[],row.hero+': forearm skin flips at a twist branch');
  assert.equal(row.deathUpdates,1,row.hero+': death pose has stale forearm skin');
  assert.equal(row.disposed,true,row.hero+': private helper resources remain allocated');
 }
 console.log(JSON.stringify(report));
} finally {
 await browser.close();
}
