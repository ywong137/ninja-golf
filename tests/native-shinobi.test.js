import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {inspectNativeShinobi} from '../tools/check-native-shinobi.mjs';
import {SHINOBI_CLIPS} from '../tools/native-shinobi-profile.mjs';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {inspectNativeBladeHeadClearance} from '../tools/native-blade-head-clearance.mjs';
import {attackDefinition} from '../src/combat.js';

const candidate=process.env.NINJA_SHINOBI_CANDIDATE;
const model=candidate?candidate+'.glb':new URL('../public/models/shinobi.glb',import.meta.url);
const record=candidate?candidate+'.json':new URL('../src/motion-data.json',import.meta.url);
const motions=JSON.parse(fs.readFileSync(record));
const pending=!candidate&&!motions.Twin_Ready?.nativeShinobiVersion;
let report;

test('all Shinobi combat clips retain the corrected native leg frames',()=>{
 for(const name of SHINOBI_CLIPS){
  assert.equal(motions[name].nativeKneeHeading,true,name);
  assert.equal(motions[name].nativeKneeHinges,true,name);
 }
});

test('Shinobi damage events match the authored active-blade contacts', {skip:pending},()=>{
 const names={light:['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep'],heavy:['Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'],musou:['Musou_Flow']};
 for(const [kind,clips]of Object.entries(names))for(const [step,suffix]of clips.entries()){
  const authored=motions['Twin_'+suffix],attack=attackDefinition(kind,step,'twin');
  assert.ok(Math.abs(attack.duration-authored.duration)<1e-5,suffix+': controller duration differs from the animation.');
  assert.equal(attack.hits.length,authored.impacts.length);
  attack.hits.forEach((time,i)=>assert.ok(Math.abs(time-authored.impacts[i])<1e-5,suffix+': damage precedes or follows the blade contact.'));
 }
});

test('Shinobi keeps both native arm hinges, wrapped hands, clear blades, and planted feet', {skip:pending?'Native Shinobi candidate awaits integration.':false},async()=>{
 report=await inspectNativeShinobi({model,record,rate:480,skin:true});
 assert.equal(report.passed,true,JSON.stringify(report.violations));
});

test('Shinobi alternates active blades and cuts with the sharpened edge at every hit', {skip:pending},async()=>{
 report??=await inspectNativeShinobi({model,record,rate:480});
 let leftHits=0,rightHits=0;
 for(const name of SHINOBI_CLIPS){
  const spec=motions[name],clip=report.clips[name];
  if(!spec.impacts?.length)continue;
  assert.equal(spec.impactHands.length,spec.impacts.length);
  for(let i=0;i<spec.impacts.length;i++){
   const hand=spec.impactHands[i];assert.ok(hand==='r'||hand==='l');
   const hit=hand==='r'?clip.contacts[i]:clip.offhand.contacts[i];
   if(hand==='l')leftHits++;else rightHits++;
   assert.ok(hit.signedEdgeAlignment>.75,name+': the blunt edge leads the active cut.');
   assert.ok(hit.speed>4&&hit.fractionOfGlobalPeak>.5,name+': active blade stalls at the damage event.');
  }
 }
 assert.ok(leftHits>=6&&rightHits>=6,'Both weapons must attack across the full combo family.');
 for(const name of ['Twin_Cut_Sweep','Twin_Heavy_Sweep'])assert.deepEqual(motions[name].impactHands,['r','l']);
 assert.deepEqual(motions.Twin_Musou_Flow.impactHands,['r','l','r','l','r','l']);
});

test('Shinobi attacks return both arms to their common Ready pose', {skip:pending},async()=>{
 const g=await loadNativeSkin(model),names=['clavicle','upperarm','lowerarm','hand'].flatMap(part=>['r','l'].map(side=>part+'_'+side));
 const sample=(name,time)=>{
  g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();a.clampWhenFinished=true;a.time=Math.min(time,clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);
  return Object.fromEntries(names.map(n=>[n,g.scene.getObjectByName(n).quaternion.clone().normalize()]));
 };
 const ready=sample('Twin_Ready',0);
 for(const name of SHINOBI_CLIPS.filter(n=>motions[n].impacts?.length))for(const time of [0,motions[name].duration]){
  const pose=sample(name,time);for(const n of names)assert.ok(pose[n].angleTo(ready[n])<.002,name+'/'+n+': discontinuous Ready endpoint.');
 }
});

test('musou recovery transfers weight before the final closing step',async()=>{
 const g=await loadNativeSkin(model),clip=g.animations.find(c=>c.name==='Twin_Musou_Flow'),a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
 const at=time=>{a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);return Object.fromEntries(['pelvis','foot_r','foot_l','thigh_r','calf_r'].map(n=>[n,g.scene.getObjectByName(n).getWorldPosition(new T.Vector3())]));};
 const start=at(0),receive=at(2.82),prepare=at(3),step=at(3.1),finish=at(3.3);
 const supportGap=p=>p.pelvis.clone().sub(p.foot_l).setY(0).length();
 assert.ok(prepare.pelvis.x-receive.pelvis.x>.08,'Shift the body toward the left support before lifting the right foot.');
 assert.ok(supportGap(step)<.05,'Keep the pelvis above the left support during the closing step.');
 for(let time=2.98;time<=3.2;time+=1/120){const p=at(time),flexion=180-p.thigh_r.clone().sub(p.calf_r).angleTo(p.foot_r.clone().sub(p.calf_r))*180/Math.PI;assert.ok(flexion>15,'The rear knee must stay flexed before and during the closing step.');}
 assert.ok(step.foot_r.y-prepare.foot_r.y>.04,'Lift the closing foot instead of sliding it.');
 for(let time=2.82;time<3.3;time+=1/120)assert.ok(at(time).foot_l.distanceTo(receive.foot_l)<.001,'Keep the left support planted through recovery.');
 for(const name of ['pelvis','foot_r','foot_l'])assert.ok(finish[name].distanceTo(start[name])<.001,'Return to the original Ready position: '+name);
});

test('both Shinobi blades clear the deformed head throughout every combat clip', {skip:pending},async()=>{
 const frames=candidate?candidate+'.mount.json':{sword:JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).shinobi.sword};
 const result=await inspectNativeBladeHeadClearance({model,modelKey:'shinobi',weaponKind:'twin',frames,record,clips:SHINOBI_CLIPS,dualWield:true,rate:480});
 assert.equal(result.passed,true,JSON.stringify(result.clips));
});

test('revised Shinobi Sweep keeps torso continuation, comparable cuts, and space around the head', {
 skip:pending||(motions.Twin_Cut_Sweep?.nativeShinobiBodyPilotVersion??0)<2,
},async()=>{
 const name='Twin_Cut_Sweep';
 const data=report??await inspectNativeShinobi({model,record,rate:480,clips:[name]});
 const clip=data.clips[name],right=clip.contacts[0],left=clip.offhand.contacts[1];
 assert.ok(Math.max(right.speed,left.speed)/Math.min(right.speed,left.speed)<1.6,
  'The second blade must not snap through contact at several times the first blade speed.');
 for(const hit of [right,left])assert.ok(hit.fractionOfGlobalPeak>.6,
  'The active blade slows too far before the damage event.');
 const frames=candidate?candidate+'.mount.json':{sword:JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).shinobi.sword};
 const head=await inspectNativeBladeHeadClearance({model,modelKey:'shinobi',weaponKind:'twin',frames,record,
  clips:[name],dualWield:true,rate:480,distanceCap:.06});
 assert.ok(head.clips[name].minimumClearance>=.05,'The revised preparation needs visible clearance around the head.');
 const g=await loadNativeSkin(model),chest=g.scene.getObjectByName('spine_03');
 const ready=g.mixer.clipAction(g.animations.find(c=>c.name==='Twin_Ready')).reset().play();
 ready.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const reference=chest.getWorldQuaternion(new T.Quaternion()).normalize().invert();
 g.mixer.stopAllAction();const action=g.mixer.clipAction(g.animations.find(c=>c.name===name)).reset().play();
 const yaw=time=>{
  action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const delta=chest.getWorldQuaternion(new T.Quaternion()).normalize().multiply(reference);
  const forward=new T.Vector3(0,0,1).applyQuaternion(delta);
  return Math.atan2(forward.x,forward.z)*180/Math.PI;
 };
 for(const [start,end,sign]of [[.260,.300,1],[.512,.555,-1]]){
  let previous=yaw(start),minimumSpeed=Infinity;
  for(let time=start;time<end;){const next=Math.min(time+1/480,end),value=yaw(next);
   minimumSpeed=Math.min(minimumSpeed,sign*(value-previous)/(next-time));previous=value;time=next;
  }
  assert.ok(minimumSpeed>10,'The chest stops during the former impact plateau.');
  assert.ok(sign*(yaw(end)-yaw(start))>2.5,'The torso must continue through the braced hit.');
 }
});
