import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {disableHmr} from '../tools/disable-hmr.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage();await disableHmr(page);await page.goto('http://localhost:5173/tests/rig-stage.html');
 const reports=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js');await loadWarriorAssets();const {ATTACKS}=await import('/src/combat.js');const reports=[];
  for(const rate of [60,120,240])for(let hero=0;hero<6;hero++)for(const mode of ['address','swing','guard','light','heavy']){
   const p=new Warrior(hero),control=new Warrior(hero);control.travelPose=null;
   const tip=actor=>{actor.root.updateMatrixWorld(true);const held=mode==='address'||mode==='swing'?actor.club:actor.weapon;return held.localToWorld(new T.Vector3(...(held.userData.tip||[.047,1.12,0])));};
   for(let frame=0;frame<rate;frame++)for(const actor of [p,control])actor.update(frame/rate,1/rate,{moving:true,moveSpeed:5.6});
   const recovery=hero===0&&mode==='heavy',end=recovery?ATTACKS.heavy[0].duration+.25:mode==='swing'?1.5:.4;
   let previous=tip(p),priorControl=tip(control),maxGolfPathError=0,maxTipStep=0,maxExcessStep=0,contactError=0,maxControlTipStep=0,maxShaftError=0,impactError=0,maxRecoveryBend=0,maxRecoveryGripWeight=0;const firstFrames=[];
   for(let frame=0;frame<=Math.ceil(end*rate);frame++){
    const flags=mode==='address'?{golf:true}:mode==='swing'?{golf:true,swing:(frame+1)/rate}:mode==='guard'?{blocking:true}:{action:{kind:mode,step:0,token:999,time:frame/rate,duration:ATTACKS[mode][0].duration}};
    if(recovery&&frame/rate>=ATTACKS.heavy[0].duration){flags.action=null;flags.moving=true;flags.moveSpeed=5.6;}
    for(const actor of [p,control])actor.update(2+frame/rate,1/rate,flags);
    if(recovery&&p.running){
     const wrist=p.bones.hand_l.getWorldPosition(new T.Vector3()),forearm=wrist.clone().sub(p.bones.lowerarm_l.getWorldPosition(new T.Vector3())),hand=p.bones.middle_01_l.getWorldPosition(new T.Vector3()).sub(wrist);
     maxRecoveryBend=Math.max(maxRecoveryBend,forearm.angleTo(hand));maxRecoveryGripWeight=Math.max(maxRecoveryGripWeight,p.handGrip.secondaryWeight);
    }
    const current=tip(p),reference=tip(control),step=current.distanceTo(previous),controlStep=reference.distanceTo(priorControl);
    if(mode==='address'||mode==='swing'){maxGolfPathError=Math.max(maxGolfPathError,current.distanceTo(reference));if(frame===Math.round(1.4*rate)-1)contactError=current.distanceTo(reference);}
    else if(frame/rate<(mode==='guard'?1/3:mode==='light'?.15:.3)){maxControlTipStep=Math.max(maxControlTipStep,controlStep);
     if(p.travelPose.weight>0){const axis=p.shaftAxes.r.clone().applyQuaternion(p.bones.hand_r.getWorldQuaternion(new T.Quaternion())),weaponAxis=new T.Vector3(0,1,0).applyQuaternion(p.weapon.getWorldQuaternion(new T.Quaternion()));maxShaftError=Math.max(maxShaftError,axis.angleTo(weaponAxis));}
maxTipStep=Math.max(maxTipStep,step);maxExcessStep=Math.max(maxExcessStep,step-controlStep);firstFrames.push({frame,step,controlStep,weight:p.travelPose.weight});}
    if(ATTACKS[mode]&&flags.action&&(frame+1)/rate>=ATTACKS[mode][0].hits[0])impactError=Math.max(impactError,current.distanceTo(reference));
    previous=current;priorControl=reference;
   }
   reports.push({rate,hero,mode,maxGolfPathError,contactError,maxTipStep,maxControlTipStep,maxExcessStep,maxShaftError,impactError,maxRecoveryBend,maxRecoveryGripWeight,firstFrames});p.dispose();control.dispose();
  }return reports;
 });
 console.log(JSON.stringify(reports.map(({firstFrames,...r})=>r),null,2));for(const r of reports){assert.ok(r.maxShaftError<1e-5);assert.ok(r.impactError<1e-8);assert.ok(r.maxRecoveryBend<.4&&r.maxRecoveryGripWeight===0,`Free hand remains attached during recovery: ${JSON.stringify(r)}`);assert.ok(r.maxGolfPathError<1e-8,`Golf path changed: ${JSON.stringify(r)}`);assert.ok(r.maxTipStep<(r.mode==='guard'?.30*60/r.rate:r.maxControlTipStep+.05*60/r.rate),`Abrupt tip movement: ${JSON.stringify(r)}`);assert.ok(r.maxExcessStep<((r.mode==='guard'?.25:.45)*60/r.rate),`Carry adds a tip jump: ${JSON.stringify(r)}`);}
}finally{await browser.close();}
