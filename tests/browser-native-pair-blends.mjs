// Native paired fades must not add an independent elbow solve.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage();await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const report=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {motions}=await import('/src/motion.js');await loadWarriorAssets();
  const ready='Ethan_Naginata_Ready',guard='Naginata_Guard_Loop';
  const attacks=Object.keys(motions).filter(name=>name.startsWith('Ethan_Naginata_')&&name!==ready);
  const cases=attacks.flatMap(name=>[[ready,name],[guard,name],[name,ready],[name,guard],[name,name]]);
  cases.push([guard,'Naginata_Guard_Impact'],[guard,'Naginata_Guard_Break'],['Naginata_Guard_Impact',guard],['Naginata_Guard_Break',guard]);
  const rows=[];
  for(const rate of [60,240])for(const [from,to]of cases)for(const fromTime of from===ready||from===guard?[.4,motions[from].duration-1e-5]:[motions[from].duration-1e-5]){
   const actor=new Warrior(2);actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';
   actor.play(from,0,true);actor.actions.get(from).time=fromTime;
   actor.mixer.update(0);actor.syncHeldObjects();actor.play(to,.07,true);
   const row={rate,from,to,fromTime,preserved:!!actor.heldBlend?.preservePair,maxArmChange:0,maxPalmGap:0,samples:0};
   for(let frame=0;frame<=Math.ceil(.10*rate);frame++){
    actor.handGrip.restore();actor.mixer.update(1/rate);actor.root.updateMatrixWorld(true);
    const names=['upperarm_r','lowerarm_r','hand_r','upperarm_l','lowerarm_l','hand_l'];
    const before=names.map(name=>actor.bones[name].quaternion.clone().normalize());
    actor.syncHeldObjects();row.samples++;
    for(let i=0;i<names.length;i++)row.maxArmChange=Math.max(row.maxArmChange,before[i].angleTo(actor.bones[names[i]].quaternion.clone().normalize()));
    for(const side of ['r','l']){
     const palm=actor.bones['hand_'+side].localToWorld(actor.handGrip.active[side].center.clone());
     const station=actor.weapon.userData.primaryGrip-(side==='l'?motions[to].gripSpacing:0);
     const shaft=actor.weapon.localToWorld(new T.Vector3(0,station,0));
     row.maxPalmGap=Math.max(row.maxPalmGap,palm.distanceTo(shaft)/actor.root.scale.x);
    }
   }
   rows.push(row);actor.dispose();
  }
  const exclusions=[];
  for(const condition of ['run','carry','guardWalk','partialGrip','earlierBlend','golf','legacyWalk']){
   const actor=new Warrior(2);actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';
   actor.play(ready,0);actor.mixer.update(0);actor.syncHeldObjects();
   if(condition==='run')actor.running=true,actor.runActions=[];
   if(condition==='carry')actor.travelPose.weight=.2;
   if(condition==='guardWalk')actor.guardWalking=true,actor.guardWalkActions=[];
   if(condition==='partialGrip')actor.handGrip.secondaryWeight=.9;
   if(condition==='earlierBlend')actor.heldBlend={start:actor.mixer.time,duration:1};
   if(condition==='golf')actor.current='Golf_Address';
   actor.play(condition==='legacyWalk'?'Naginata_Guard_Walk_Forward':attacks[0],.07,true);
   exclusions.push({condition,preserved:!!actor.heldBlend?.preservePair});actor.dispose();
  }
  return{rows,exclusions};
 });
 for(const row of report.rows){
  assert.ok(row.preserved,JSON.stringify(row));
  assert.ok(row.maxArmChange<1e-7,`The grip solver changes an authored arm: ${JSON.stringify(row)}`);
  assert.ok(row.maxPalmGap<.003,`The blended palms leave the handle: ${JSON.stringify(row)}`);
 }
 for(const row of report.exclusions)assert.equal(row.preserved,false,JSON.stringify(row));
 console.log(JSON.stringify({cases:report.rows.length,exclusions:report.exclusions,maxArmChange:Math.max(...report.rows.map(r=>r.maxArmChange)),maxPalmGap:Math.max(...report.rows.map(r=>r.maxPalmGap))}));
}finally{await browser.close();}
