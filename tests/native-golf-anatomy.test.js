import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';

const profiles=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
const degrees=T.MathUtils.radToDeg;
const peak=()=>({value:0});
function retain(metric,value,time,side){if(value>metric.value)Object.assign(metric,{value,time,side});}

for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${hero}: dense golf samples preserve arm anatomy and the shared grip`,async t=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url);
 const g=await loadNativeSkin(file),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const point=n=>bones[n].getWorldPosition(new T.Vector3());
 const worldQ=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
 const neutral=Object.fromEntries(['r','l'].map(s=>[s,bones['hand_'+s].quaternion.clone()]));
 const wristBasis=Object.fromEntries(['r','l'].map(side=>{
  const q=worldQ('hand_'+side).invert(),long=point('middle_01_'+side).sub(point('hand_'+side)).applyQuaternion(q).normalize();
  const across=point('index_01_'+side).sub(point('pinky_01_'+side)).applyQuaternion(q);across.addScaledVector(long,-across.dot(long)).normalize();
  const normal=new T.Vector3().crossVectors(long,across).normalize(),forearm=point('hand_'+side).sub(point('lowerarm_'+side)).applyQuaternion(q).normalize();
  return [side,{long,across,normal,restFlex:Math.atan2(forearm.dot(normal),forearm.dot(long)),restSide:Math.atan2(forearm.dot(across),forearm.dot(long))}];
 }));
 const measured=Object.fromEntries(['leadBend','trailBend','leadElbow','wristTwist','leadSideBend','trailSideBend','trailFlexion','palmGap','relativeGripTurn','armFrameStep120'].map(n=>[n,peak()]));
 let referenceAddress=null;
 for(const name of ['Golf_Address','Golf_Swing']){
  const clip=g.animations.find(c=>c.name===name);assert.ok(clip,`${hero}: missing ${name}`);
  g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  let previous={},referenceGrip=null;
  // 480 Hz includes the midpoints of the authored 240 Hz samples.
  for(let frame=0;frame<=Math.round(clip.duration*480);frame++){
   const time=Math.min(frame/480,clip.duration);action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   const palms={},axes={},hands={};
   for(const side of ['r','l']){
    const shoulder=point('upperarm_'+side),elbow=point('lowerarm_'+side),wrist=point('hand_'+side);
    const forearm=wrist.clone().sub(elbow),knuckle=point('middle_01_'+side).sub(wrist);
    const bend=degrees(forearm.angleTo(knuckle)),flex=degrees(elbow.clone().sub(shoulder).angleTo(forearm));
    retain(measured[side==='r'?'leadBend':'trailBend'],bend,time,side);
    const basis=wristBasis[side],localForearm=forearm.clone().normalize().applyQuaternion(worldQ('hand_'+side).invert());
    const sideAngle=Math.atan2(localForearm.dot(basis.across),localForearm.dot(basis.long))-basis.restSide;
    const flexAngle=Math.atan2(localForearm.dot(basis.normal),localForearm.dot(basis.long))-basis.restFlex;
    const wrapped=value=>degrees(Math.abs(Math.atan2(Math.sin(value),Math.cos(value))));
    retain(measured[side==='r'?'leadSideBend':'trailSideBend'],wrapped(sideAngle),time,side);
    if(side==='l')retain(measured.trailFlexion,wrapped(flexAngle),time,side);
    if(side==='r'&&(name==='Golf_Address'||time<=1.57))retain(measured.leadElbow,flex,time,side);
    // Measure axial rotation relative to the imported neutral hand.
    const delta=bones['hand_'+side].quaternion.clone().multiply(neutral[side].clone().invert()).normalize();
    const forearmAxis=bones['hand_'+side].position.clone().normalize();
    const twist=degrees(2*Math.atan2(Math.abs(new T.Vector3(delta.x,delta.y,delta.z).dot(forearmAxis)),Math.abs(delta.w)));
    retain(measured.wristTwist,twist,time,side);
    const entry=profiles[hero].golf[side];hands[side]=worldQ('hand_'+side);
    palms[side]=bones['hand_'+side].localToWorld(new T.Vector3().fromArray(entry.center));
    axes[side]=new T.Vector3().fromArray(entry.axis).applyQuaternion(hands[side]);
    for(const part of ['upperarm','lowerarm']){
     const key=part+'_'+side,current=worldQ(key);
     if(previous[key])retain(measured.armFrameStep120,degrees(previous[key].angleTo(current))*4,time,key);
     previous[key]=current;
    }
   }
   const relative=hands.r.clone().invert().multiply(hands.l);referenceGrip??=relative.clone();
   retain(measured.relativeGripTurn,degrees(referenceGrip.angleTo(relative)),time);
   retain(measured.palmGap,palms.l.distanceTo(palms.r.clone().addScaledVector(axes.r,.09)),time);
   if(frame===0){
    const address=Object.fromEntries(['pelvis','spine_03','hand_r','hand_l'].map(n=>[n,{p:point(n),q:worldQ(n)}]));
    if(name==='Golf_Address')referenceAddress=address;
    else for(const n of Object.keys(address)){
     assert.ok(address[n].p.distanceTo(referenceAddress[n].p)<.001,`${n}: swing starts away from the address`);
     assert.ok(address[n].q.angleTo(referenceAddress[n].q)<.005,`${n}: swing starts with a different rotation`);
    }
   }
   if(name==='Golf_Swing'&&Math.abs(time-1.4)<1e-8){
    const tip=palms.r.clone().addScaledVector(axes.r,Math.hypot(.625,.722));
    assert.ok(tip.distanceTo(new T.Vector3(0,.118,.945))<.003,`${hero}: the native club misses the ball`);
   }
  }
 }
 t.diagnostic(JSON.stringify(measured));
 assert.ok(measured.leadBend.value<=40,`Lead wrist folds: ${JSON.stringify(measured.leadBend)}`);
 assert.ok(measured.trailBend.value<=75,`Trail wrist exceeds the golf cocking range: ${JSON.stringify(measured.trailBend)}`);
 assert.ok(measured.leadElbow.value<=20,`Lead arm collapses before release: ${JSON.stringify(measured.leadElbow)}`);
 assert.ok(measured.wristTwist.value<=3,`Axial rotation remains in the wrist: ${JSON.stringify(measured.wristTwist)}`);
 assert.ok(measured.leadSideBend.value<=35,`Lead wrist bends sideways: ${JSON.stringify(measured.leadSideBend)}`);
 assert.ok(measured.trailSideBend.value<=35,`Trail wrist bends sideways: ${JSON.stringify(measured.trailSideBend)}`);
 assert.ok(measured.trailFlexion.value<=65,`Trail wrist flexion is excessive: ${JSON.stringify(measured.trailFlexion)}`);
 assert.ok(measured.palmGap.value<=.0015,`Hands separate between authored frames: ${JSON.stringify(measured.palmGap)}`);
 assert.ok(measured.relativeGripTurn.value<=2,`Hands rotate independently on the grip: ${JSON.stringify(measured.relativeGripTurn)}`);
 assert.ok(measured.armFrameStep120.value<=25,`Arm frame changes abruptly: ${JSON.stringify(measured.armFrameStep120)}`);
});
