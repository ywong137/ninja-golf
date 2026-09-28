// Check the native elbow hinge on both arms, including the unarmed running arm.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage();await disableHmr(page);
 await page.goto('http://localhost:5173/tests/rig-stage.html');
 const rows=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {calibrateArmAnatomy,captureArmPose,measureArmAnatomy}=await import('/tools/native-arm-anatomy.mjs');
  await loadWarriorAssets();
  const rows=[],rate=480,dt=1/rate;
  for(let hero=0;hero<6;hero++)for(const direction of [0,Math.PI/2,Math.PI,-Math.PI/2,'turn']){
   const actor=new Warrior(hero);
   actor.handGrip.restore();actor.mixer.stopAllAction();actor.current='';actor.root.updateMatrixWorld(true);
   const calibration=Object.fromEntries(['r','l'].map(side=>[side,calibrateArmAnatomy(captureArmPose(actor.bones,side))]));
   const row={hero,direction,hinge:0,shoulderRoll:0,forearmTwist:0,wrist:0,heldWrist:0,minFlex:Infinity,maxFlex:0,entryStep120:0,activeStep120:0};
   const previous={};
   for(let frame=0;frame<rate*2;frame++){
    const time=frame*dt,angle=direction==='turn'?time*Math.PI:direction;
    actor.update(time,dt,{moving:true,moveSpeed:5.6,moveAngle:angle});
    for(const side of ['r','l']){
     const measured=measureArmAnatomy(calibration[side],captureArmPose(actor.bones,side));
     row.hinge=Math.max(row.hinge,measured.hingeDeviationDegrees);
     row.shoulderRoll=Math.max(row.shoulderRoll,Math.abs(measured.humeralRollDegrees));
     row.forearmTwist=Math.max(row.forearmTwist,Math.abs(measured.forearmTwistDegrees));
     row.minFlex=Math.min(row.minFlex,measured.signedFlexionDegrees);
     row.maxFlex=Math.max(row.maxFlex,measured.signedFlexionDegrees);
     const hand=actor.bones['hand_'+side];
     const wrist=hand.quaternion.clone().normalize().angleTo(actor.neutralHandRotations[side].clone().normalize())*180/Math.PI;
     row.wrist=Math.max(row.wrist,wrist);
     if(time>.15&&(side==='r'||actor.offhand))row.heldWrist=Math.max(row.heldWrist,wrist);
     for(const prefix of ['upperarm_','lowerarm_','hand_']){
      const name=prefix+side,rotation=actor.bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
      if(previous[name]){
       const step=previous[name].angleTo(rotation)*180/Math.PI/dt/120;
       const key=time<.3?'entryStep120':'activeStep120';row[key]=Math.max(row[key],step);
      }
      previous[name]=rotation;
     }
    }
   }
   rows.push(row);actor.dispose();
  }
  return rows;
 });
 for(const row of rows){
  const context=JSON.stringify(row);
  assert.ok(Object.values(row).every(value=>typeof value!=='number'||Number.isFinite(value)),context);
  assert.ok(row.hinge<.001,`Elbow leaves its native hinge: ${context}`);
  assert.ok(row.shoulderRoll<=68.001&&row.forearmTwist<=90.001,`Arm exceeds its rotation range: ${context}`);
  assert.ok(row.minFlex>0&&row.maxFlex<135,`Elbow folds backward or too tightly: ${context}`);
  assert.ok(row.wrist<20&&row.heldWrist<.001,`Carry bends the wrist: ${context}`);
  assert.ok(row.entryStep120<15&&row.activeStep120<15,`Carry adds an abrupt arm rotation: ${context}`);
 }
 const maximum=key=>Math.max(...rows.map(row=>row[key]));
 console.log(JSON.stringify({cases:rows.length,samplesPerCase:960,hinge:maximum('hinge'),shoulderRoll:maximum('shoulderRoll'),forearmTwist:maximum('forearmTwist'),wrist:maximum('wrist'),entryStep120:maximum('entryStep120'),activeStep120:maximum('activeStep120')}));
}finally{await browser.close();}
