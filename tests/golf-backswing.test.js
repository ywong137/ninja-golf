import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../tools/native-arm-anatomy.mjs';

const profiles=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${hero}: folds the trail arm and sets the club across the top of the backswing`,async t=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url);
 const g=await loadNativeSkin(file),p=n=>g.scene.getObjectByName(n).getWorldPosition(new T.Vector3());
 const clip=g.animations.find(c=>c.name==='Golf_Swing'),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
 const frame=new T.Quaternion().fromArray(profiles[hero].golf.r.frame),rows=[];
 for(const time of [.99,1.05,1.1]){
  action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const hand=g.scene.getObjectByName('hand_r'),shaft=new T.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()).multiply(frame));
  const flex=s=>180-p('upperarm_'+s).sub(p('lowerarm_'+s)).angleTo(p('hand_'+s).sub(p('lowerarm_'+s)))*180/Math.PI;
  const trail=flex('l'),lead=flex('r'),elevation=Math.asin(shaft.y)*180/Math.PI;
  // These are bounds for this reviewed short backswing, not all golf styles.
  // The previous animation extended both arms and left the shaft near vertical.
  assert.ok(trail>70&&trail<110,'Trail elbow extends instead of folding at the top.');
  assert.ok(lead<trail-20,'The lead arm lost its longer reach.');
  assert.ok(lead<(hero==='monk'?28:22),'The lead elbow folds too far at the reviewed top poses.');
  assert.ok(elevation>5&&elevation<35,'The club has not set across the shoulders.');
  assert.ok(shaft.x<-.7,'The shaft points away from the target at the top.');
  rows.push({time,trailFlexion:trail,leadFlexion:lead,shaftElevation:elevation});
 }
 // A still top must not alternate between different IK solutions each frame.
 // This is a curvature bound for the reviewed animation, not a human speed limit.
 const elbows=[];
 for(let i=68;i<=167;i++){
  action.time=i/120;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  elbows.push({time:i/120,r:p('lowerarm_r'),l:p('lowerarm_l')});
 }
 let peakElbowSecondDifference=0,peakRisingDifference=0,peakWindowDifference=0;
 for(let i=1;i<elbows.length-1;i++)if(elbows[i].time>=.58&&elbows[i].time<=1.38){
  for(const side of ['r','l']){
   const midpoint=elbows[i-1][side].clone().add(elbows[i+1][side]).multiplyScalar(.5);
   const difference=elbows[i][side].distanceTo(midpoint);
   peakWindowDifference=Math.max(peakWindowDifference,difference);
   if(elbows[i].time>=.75&&elbows[i].time<=.90)peakRisingDifference=Math.max(peakRisingDifference,difference);
   if(elbows[i].time>=.95&&elbows[i].time<=1.1)peakElbowSecondDifference=Math.max(peakElbowSecondDifference,difference);
  }
 }
 assert.ok(peakElbowSecondDifference<.003,'The elbow zigzags around the backswing peak.');
 assert.ok(peakRisingDifference<.004,'The rising elbow regained its alternating steps.');
 assert.ok(peakWindowDifference<.015,'An abrupt elbow deviation appeared in the corrected swing window.');
 t.diagnostic(JSON.stringify({top:rows,peakElbowSecondDifference,peakRisingDifference,peakWindowDifference}));
});

test('Vice President raises the trail elbow without the previous roll reversal',async t=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,'monk.glb'):new URL('../public/models/monk.glb',import.meta.url);
 const g=await loadNativeSkin(file),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
 const calibration=calibrateArmAnatomy(captureArmPose(bones,'l'));
 const action=g.mixer.clipAction(g.animations.find(c=>c.name==='Golf_Swing')).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
 let minimumRoll=Infinity,reversal=0,previous=null,peakElbowSpeed=0;
 for(let i=336;i<=528;i++){
  const time=i/480;action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const pose=captureArmPose(bones,'l'),{humeralRollDegrees:roll}=measureArmAnatomy(calibration,pose);
  if(time>=.78&&time<=.93){minimumRoll=Math.min(minimumRoll,roll);reversal=Math.max(reversal,roll-minimumRoll);}
  if(previous)peakElbowSpeed=Math.max(peakElbowSpeed,pose.elbow.distanceTo(previous.elbow)*480);
  previous=pose;
 }
 // These bounds preserve this reviewed rising backswing, not a general motion limit.
 assert.ok(reversal<1,'The trail upper arm reverses its roll while the elbow rises.');
 assert.ok(peakElbowSpeed<3,'The reviewed rising elbow regained its abrupt shift.');
 t.diagnostic(JSON.stringify({rollReversalDegrees:reversal,peakElbowSpeed}));
});
