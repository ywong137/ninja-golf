import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {inspectNativeCloser} from '../tools/check-native-closer.mjs';
import {CLOSER_CLIPS} from '../tools/native-closer-profile.mjs';
import {loadNativeSkin} from './native-skin-helper.mjs';

const candidate=process.env.NINJA_CLOSER_CANDIDATE;
const model=candidate?candidate+'.glb':new URL('../public/models/sora.glb',import.meta.url);
const record=candidate?candidate+'.json':new URL('../src/motion-data.json',import.meta.url);
const motions=JSON.parse(fs.readFileSync(record));
const pending=!candidate&&!motions.Sickle_Ready?.nativeCloserVersion;
let report;

test('Closer native arms preserve the hinge, wrist, grip, and actual skin clearance at half-frame intervals', {skip:pending?'Native Closer candidate awaits integration.':false}, async()=>{
 report=await inspectNativeCloser({model,record,rate:480,skin:true});
 assert.equal(report.passed,true,JSON.stringify(report.violations));
});

test('Closer cuts retain distinct blade paths and move through each damage event', {skip:pending}, async()=>{
 report??=await inspectNativeCloser({model,record,rate:480});
 const contacts=name=>report.clips[name].contacts;
 assert.ok(contacts('Sickle_Cut_Diagonal')[0].velocity[1]<-4,'The downward cut must move downward.');
 assert.ok(contacts('Sickle_Cut_Return')[0].velocity[0]<-3,'The lateral draw must cross toward the weapon side.');
 for(const name of ['Sickle_Cut_Rising','Sickle_Heavy_Rising']){
  const hit=contacts(name)[0];
  assert.ok(hit.velocity[1]>2&&hit.velocity[2]>1,`${name} must cut upward and forward.`);
 }
 for(const name of ['Sickle_Cut_Sweep','Sickle_Heavy_Sweep']){
  const hits=contacts(name);
  assert.equal(hits.length,2);
  assert.ok(hits[0].velocity[1]<-2&&hits[1].velocity[1]>2,`${name} must contain two opposed cuts.`);
 }
 for(const [name,clip]of Object.entries(report.clips))for(const hit of clip.contacts){
  assert.ok(hit.signedEdgeAlignment>.75,`${name}: the blunt edge cannot lead the hit.`);
  assert.ok(hit.speed>4,`${name}: the weapon cannot stop at the hit.`);
  assert.ok(hit.fractionOfGlobalPeak>.5,`${name}: hit speed must exceed half the full-clip peak.`);
 }
});

test('Closer attacks begin and recover with the same native arm pose as Ready', {skip:pending}, async()=>{
 const rig=await loadNativeSkin(model),names=['clavicle','upperarm','lowerarm','hand'].flatMap(part=>['r','l'].map(side=>part+'_'+side));
 const sample=(name,time)=>{
  rig.mixer.stopAllAction();
  const clip=rig.animations.find(c=>c.name===name),action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();
  action.clampWhenFinished=true;action.time=Math.min(time,clip.duration);rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
  return Object.fromEntries(names.map(name=>[name,rig.scene.getObjectByName(name).quaternion.clone().normalize()]));
 };
 const ready=sample('Sickle_Ready',0);
 for(const name of CLOSER_CLIPS.filter(name=>motions[name].impacts))for(const time of [0,motions[name].duration]){
  const pose=sample(name,time);
  for(const joint of names)assert.ok(pose[joint].angleTo(ready[joint])<.002,`${name}/${time}/${joint}: discontinuous Ready endpoint.`);
 }
});
