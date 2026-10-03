import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {disableHmr} from '../tools/disable-hmr.mjs';
import {routeModelDirectory} from '../tools/route-model-directory.mjs';

const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--mute-audio','--disable-gpu']});
try{
 const page=await browser.newPage();await disableHmr(page);
 await routeModelDirectory(page,process.env.NINJA_GUARD_MODEL_DIR);
 if(process.env.NINJA_GUARD_RECORD)await page.route('**/src/motion-data.json*',r=>r.fulfill({body:'export default '+fs.readFileSync(process.env.NINJA_GUARD_RECORD,'utf8'),contentType:'text/javascript'}));
 await page.goto((process.env.GAME_URL||'http://localhost:5173').replace(/\/$/,'')+'/tests/rig-stage.html');
 const reports=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{Warrior,loadWarriorAssets}=await import('/src/actors.js');
  const {WARRIORS}=await import('/src/warriors.js');
  const {motions}=await import('/src/motion.js'),{captureArmPose,calibrateArmAnatomy,measureArmAnatomy}=await import('/src/arm-anatomy.js');await loadWarriorAssets();
  const reports=[];
  for(let hero=0;hero<WARRIORS.length;hero++)for(const hz of [40,120,240])for(const direction of [0,Math.PI/2,Math.PI,-Math.PI/2]){
   const actor=new Warrior(hero),calibration={},saved=[];
   for(const[bone,rest]of actor.golfRestPose){saved.push([bone,bone.position.clone(),bone.quaternion.clone(),bone.scale.clone()]);bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);}
   actor.root.updateMatrixWorld(true);for(const side of ['r','l'])calibration[side]=calibrateArmAnatomy(captureArmPose(actor.bones,side));
   for(const[b,p,q,s]of saved){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}
   const row={hero,hz,direction,samples:0,wrist:0,hinge:0,shoulder:0,forearm:0,minFlexion:180,maxFlexion:0,palmGap:0,maxStep120:0};
   const previous={};let clock=0;
   function step(flags){
    actor.update(clock,1/hz,flags);clock+=1/hz;actor.root.updateMatrixWorld(true);row.samples++;
    for(const side of ['r','l']){
     const hand=actor.bones['hand_'+side],m=measureArmAnatomy(calibration[side],captureArmPose(actor.bones,side));
     row.wrist=Math.max(row.wrist,hand.quaternion.clone().normalize().angleTo(actor.neutralHandRotations[side].clone().normalize())*180/Math.PI);
     row.hinge=Math.max(row.hinge,m.hingeDeviationDegrees);row.forearm=Math.max(row.forearm,Math.abs(m.forearmTwistDegrees));row.shoulder=Math.max(row.shoulder,Math.abs(m.humeralRollDegrees));
     row.minFlexion=Math.min(row.minFlexion,m.signedFlexionDegrees);row.maxFlexion=Math.max(row.maxFlexion,m.signedFlexionDegrees);
     const spec=motions[actor.current],held=side==='l'&&actor.offhand?actor.offhand:actor.weapon;
     if(side==='r'||actor.offhand||spec.twoHanded&&actor.handGrip.secondaryWeight>.999){
      const station=held.userData.primaryGrip-(side==='l'&&!actor.offhand?spec.gripSpacing:0);
      row.palmGap=Math.max(row.palmGap,hand.localToWorld(actor.palmGrips[side].clone()).distanceTo(held.localToWorld(new T.Vector3(0,station,0)))/actor.root.scale.x);
     }
     for(const prefix of ['hand_','lowerarm_']){
      const name=prefix+side,q=actor.bones[name].getWorldQuaternion(new T.Quaternion()).normalize();
      if(previous[name])row.maxStep120=Math.max(row.maxStep120,q.angleTo(previous[name])*180/Math.PI*hz/120);previous[name]=q;
     }
    }
   }
   const walk={blocking:true,moving:true,focused:true,moveAngle:direction,moveSpeed:2.3};
   for(const[seconds,flags]of [[.5,{}],[.4,{blocking:true}],[.65,walk],[.2,{blocking:true}],[.3,walk],[.35,{blocking:true,guardHitToken:1}],[.45,{blocking:true,guardBreak:.4,guardHitToken:2}],[.3,{blocking:true}]])for(let i=0;i<Math.round(seconds*hz);i++)step(flags);
   reports.push(row);actor.dispose();
  }return reports;
 });
 console.log(JSON.stringify(reports,null,2));
 // Source clips retain exact hinges. Quaternion crossfades admit less than
 // one degree of transient deviation, including the four unchanged families.
 for(const r of reports){
  assert.ok(r.wrist<30&&r.hinge<1&&r.forearm<80&&r.shoulder<70&&r.minFlexion>=0&&r.maxFlexion<130,'Invalid guard joint: '+JSON.stringify(r));
  assert.ok(r.palmGap<.002,'Guard releases its grip: '+JSON.stringify(r));
  assert.ok(r.maxStep120<10,'Guard transition snaps: '+JSON.stringify(r));
 }
 console.log('All '+reports.length+' roster guard scenarios passed. Attack interruptions use their separate review.');
}finally{await browser.close();}
