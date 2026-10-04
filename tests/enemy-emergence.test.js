import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {enemyEmergenceFrame,NINJA_EMERGENCE} from '../src/enemy-emergence.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy} from '../src/arm-anatomy.js';
import {calibrateWristAnatomy,captureWristPose,measureWristAnatomy} from '../src/wrist-anatomy.js';

test('scenery jumps retain takeoff and the complete planted landing',()=>{
 for(const kind of ['lantern','pagoda','rock','sand','water','tree']){
  const options={kind,duration:kind==='tree'?1.05:.85},first=enemyEmergenceFrame(0,options),end=enemyEmergenceFrame(first.duration,options);
  assert.equal(first.clip,kind==='tree'?'Ninja_Emerge_Flight':'Ninja_Emerge_Start');
  const contact=enemyEmergenceFrame(first.touchdown,options);
  assert.equal(contact.clip,'Ninja_Emerge_Land');assert.ok(Math.abs(contact.clipTime-NINJA_EMERGENCE.contact)<1e-7);
  assert.equal(contact.progress,1);assert.equal(contact.landed,true);assert.equal(contact.done,false);
  assert.equal(end.clip,'Ninja_Emerge_Land');assert.equal(end.clipTime,NINJA_EMERGENCE.land);assert.equal(end.done,true);
  assert.deepEqual(enemyEmergenceFrame(first.duration+10,options),end);
  for(const fps of [40,60,120]){
   let prior=0,sawStart=false,sawFlight=false,sawRecovery=false;
   for(let time=0;time<first.duration+1/fps;time+=1/fps){const f=enemyEmergenceFrame(time,options);assert.ok(f.progress>=prior);prior=f.progress;
    sawStart||=f.clip==='Ninja_Emerge_Start';sawFlight||=f.clip==='Ninja_Emerge_Flight';sawRecovery||=f.landed&&!f.done;
    if(f.landed)assert.equal(f.progress,1);
   }
   assert.equal(sawStart,kind!=='tree');assert.ok(sawFlight&&sawRecovery);
  }
 }
 assert.throws(()=>enemyEmergenceFrame(0,{duration:0,kind:'tree'}),/positive/);
 assert.throws(()=>enemyEmergenceFrame(NaN,{duration:1}),/finite/);
});

test('long water flights loop naturally and still finish the full landing',()=>{
 const options={kind:'water',duration:4},f=enemyEmergenceFrame(3.5,options);
 assert.equal(f.clip,'Ninja_Emerge_Flight');assert.ok(f.clipTime>=0&&f.clipTime<2);
 assert.equal(enemyEmergenceFrame(4,options).landed,true);
 assert.ok(enemyEmergenceFrame(4,options).duration>5);
});

test('native ninja emergence retains forward hinges, bounded twists, and complete matching clip endpoints',async()=>{
 const file=process.env.NINJA_EMERGENCE_MODEL??new URL('../public/models/enemy-cloth-ninja.glb',import.meta.url),g=await loadNativeSkin(file),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const legs={},arms={},wrists={};
 for(const side of ['r','l']){legs[side]=calibrateLegAnatomy(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);arms[side]=calibrateArmAnatomy(captureArmPose(bones,side));wrists[side]=calibrateWristAnatomy(captureWristPose(bones,side));}
 const snapshots={};
 for(const [name,duration]of [['Ninja_Emerge_Start',NINJA_EMERGENCE.start],['Ninja_Emerge_Flight',NINJA_EMERGENCE.flight],['Ninja_Emerge_Land',NINJA_EMERGENCE.land]]){
  const c=g.animations.find(c=>c.name===name);assert.ok(c,'Missing '+name);assert.ok(Math.abs(c.duration-duration)<1e-6);
  for(const track of c.tracks){assert.ok(Math.abs(track.times.at(-1)-c.duration)<1e-6);assert.ok(track.values.every(Number.isFinite));}
  g.mixer.stopAllAction();const action=g.mixer.clipAction(c).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  const frames=Math.ceil(c.duration*120);
  for(let i=0;i<=frames;i++){
   action.time=i/frames*c.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   for(const s of ['r','l']){
    const l=measureLegAnatomy(legs[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]),a=measureArmAnatomy(arms[s],captureArmPose(bones,s)),w=measureWristAnatomy(wrists[s],captureWristPose(bones,s));
    const message=JSON.stringify({name,time:action.time,side:s,leg:l,arm:a,wrist:w.totalDegrees});
    assert.ok(l.kneeFlexion>0&&l.kneeFlexion<165&&l.kneeDeviation<.05,message);
    assert.ok(Math.abs(l.hipTwist)<35&&Math.abs(l.ankleTwist)<15,message);
    assert.ok(a.signedFlexionDegrees>=0&&a.signedFlexionDegrees<130&&a.hingeDeviationDegrees<.05,message);
    assert.ok(Math.abs(a.humeralRollDegrees)<85&&Math.abs(a.forearmTwistDegrees)<30&&w.totalDegrees<30,message);
   }
   if(i===0||i===frames)snapshots[name+(i?'End':'Start')]=Object.fromEntries(Object.values(bones).map(b=>[b.name,{p:b.position.clone(),q:b.quaternion.clone()}]));
  }
 }
 for(const [a,b]of [['Ninja_Emerge_StartEnd','Ninja_Emerge_FlightStart'],['Ninja_Emerge_FlightEnd','Ninja_Emerge_FlightStart'],['Ninja_Emerge_FlightStart','Ninja_Emerge_LandStart']])for(const [name,pose]of Object.entries(snapshots[a])){
  assert.ok(pose.p.distanceTo(snapshots[b][name].p)<1e-5,`${a}/${b}: ${name} translation`);
  assert.ok(pose.q.angleTo(snapshots[b][name].q)<.002,`${a}/${b}: ${name} rotation`);
 }
});
