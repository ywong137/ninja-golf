import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../tools/native-arm-anatomy.mjs';

// These limits reject the reviewed release wobble. They are not human motion limits.
const cases=[['kaede',1.6]];
for(const [hero,maxRollResidual]of cases)test(`${hero}: golf release avoids the previous rapid elbow-roll reversal`,async t=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,hero+'.glb'):new URL(`../public/models/${hero}.glb`,import.meta.url);
 const g=await loadNativeSkin(file),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
 const calibration=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
 const action=g.mixer.clipAction(g.animations.find(c=>c.name==='Golf_Swing')).play();
 const rows=[];
 for(let i=685;i<=817;i++){
  const time=i/480;action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  rows.push({time,arms:Object.fromEntries(['r','l'].map(s=>{
   const pose=captureArmPose(bones,s);
   return[s,{roll:measureArmAnatomy(calibration[s],pose).humeralRollDegrees,upper:pose.upperArmQuaternion.normalize()}];
  }))});
 }
 let residual=0,upperRate=0,lateResidual=0;
 for(let i=1;i<rows.length-1;i++)if(rows[i].time>=1.43&&rows[i].time<=1.70){
  for(const s of ['r','l']){
   const a=rows[i-1].arms[s],b=rows[i].arms[s],c=rows[i+1].arms[s];
   const difference=Math.abs(b.roll-(a.roll+c.roll)/2);
   residual=Math.max(residual,difference);
   if(rows[i].time>=1.56)lateResidual=Math.max(lateResidual,difference);
   upperRate=Math.max(upperRate,a.upper.angleTo(b.upper)*180/Math.PI*480);
  }
 }
 assert.ok(residual<maxRollResidual,`Release roll alternates abruptly: ${residual}° midpoint residual.`);
 assert.ok(lateResidual<1.2,`The later release regained its alternating roll: ${lateResidual}°.`);
 assert.ok(upperRate<1600,`The Ace regained the previous arm-frame spike: ${upperRate}°/s.`);
 t.diagnostic(JSON.stringify({residualDegrees:residual,lateResidualDegrees:lateResidual,upperRateDegreesPerSecond:upperRate}));
});
