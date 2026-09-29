import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Bone,Group,Quaternion,Vector3} from 'three';
import {HandGrip,compatibleNativePair} from '../src/hand-grip.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const grips=read('../src/grip-data.json'),motions=read('../src/motion-data.json');
const golfNames=['Golf_Address','Golf_Swing','Golf_Putt'];
function fixture(hero,Grip=HandGrip){
 const root=new Group(),club=new Group(),weapon=new Group(),bones={};root.add(club,weapon);
 root.position.set(3,.5,-2);root.rotation.set(.2,.7,-.1);root.scale.setScalar(1.1);
 for(const side of ['r','l']){
  const hand=new Bone();hand.name='hand_'+side;root.add(hand);bones[hand.name]=hand;
  const names=new Set(['middle_01_'+side,...Object.keys(grips[hero].golf[side].rotations),...Object.keys(grips[hero].sword[side].rotations)]);
  for(const name of names){const bone=new Bone();bone.name=name;bone.position.set(0,.05,0);hand.add(bone);bones[name]=bone;}
 }
 const actor={root,bones,club,weapon,current:'Golf_Address',running:false,offhand:null,heldBlend:null,mixer:{time:0},palmGrips:{r:new Vector3(),l:new Vector3()},shaftAxes:{r:new Vector3(),l:new Vector3()},golfClubFit:{shaftLengthNative:1.0},setGolfClubLength(){}};
 const grip=new Grip(actor,grips[hero]);grip.prepare(true);
 const origin=new Vector3(.15,.9,.4),frame=new Quaternion().setFromAxisAngle(new Vector3(.1,.2,1).normalize(),.6);
 for(const side of ['r','l']){
  const profile=grip.active[side],q=frame.clone().multiply(profile.frame.clone().invert());
  bones['hand_'+side].quaternion.copy(q);
  const palm=new Vector3(0,side==='r'?0:-grip.active.gripSpacing,0).applyQuaternion(frame).add(origin);
  bones['hand_'+side].position.copy(palm.sub(profile.center.clone().applyQuaternion(q)));
 }
 root.updateMatrixWorld(true);
 const calls={legacy:0,pair:0};grip.solveSecondary=()=>calls.legacy++;
 const pair=grip.attachPair.bind(grip);grip.attachPair=(...args)=>{calls.pair++;pair(...args);};
 return{actor,grip,calls,frame};
}
for(const hero of Object.keys(grips)){
 test(`${hero}: paired golf preserves both complete hand frames and signed stations`,()=>{
  const {actor,grip,calls,frame}=fixture(hero);grip.engage(true);
  const beforeHands=['r','l'].map(s=>actor.bones['hand_'+s].quaternion.clone());
  grip.apply(null,true,motions.Golf_Address);
  assert.equal(calls.legacy,0);assert.equal(calls.pair,1);
  assert.ok(actor.club.quaternion.angleTo(frame)<1e-7);
  for(const [i,side]of ['r','l'].entries()){
   const hand=actor.bones['hand_'+side],profile=grip.active[side];
   const station=side==='r'?0:-grip.active.gripSpacing;
   assert.ok(hand.localToWorld(profile.center.clone()).distanceTo(actor.club.localToWorld(new Vector3(0,station,0)))<1e-9);
   const mounted=hand.getWorldQuaternion(new Quaternion()).multiply(profile.frame);
   assert.ok(mounted.angleTo(actor.club.getWorldQuaternion(new Quaternion()))<1e-7);
   assert.ok(beforeHands[i].angleTo(hand.quaternion)<1e-7);
  }
 });
 test(`${hero}: partial golf entry never invokes legacy arm IK`,()=>{
  const {actor,grip,calls}=fixture(hero);grip.engage(false);grip.engage(true,.18);actor.mixer.time=.09;
  const originals=['r','l'].map(s=>({p:actor.bones['hand_'+s].position.clone(),q:actor.bones['hand_'+s].quaternion.clone()}));
  grip.apply(null,true,motions.Golf_Address);
  assert.equal(grip.secondaryWeight,.5);assert.equal(calls.legacy,0);assert.equal(calls.pair,0);
  for(const [i,side]of ['r','l'].entries()){
   assert.deepEqual(actor.bones['hand_'+side].position,originals[i].p);
   assert.ok(actor.bones['hand_'+side].quaternion.angleTo(originals[i].q)<1e-7);
  }
 });
}
test('Golf profiles define the reviewed per-hero station and native pair metadata',()=>{
 const spacing={ronin:-.1076654357910156,shinobi:-.107666259765625,monk:-.107666015625,kaede:-.10564755249023437,ayame:-.10863854980468751,sora:-.10870422363281249};
 for(const [hero,value]of Object.entries(spacing))assert.equal(grips[hero].golf.gripSpacing,value);
 for(const name of golfNames){
  assert.equal(motions[name].nativeAttachment,true);assert.equal(motions[name].twoHanded,true);
  assert.equal(motions[name].pairedGrip,true);assert.equal(motions[name].primaryGrip,0);
 }
});
test('Native compatibility resolves the same per-hero pair contract; opposite sign is incompatible',()=>{
 for(const hero of Object.keys(grips)){
  const clips=golfNames.map(name=>({...motions[name],gripSpacing:grips[hero].golf.gripSpacing}));
  for(const from of clips)for(const to of clips)assert.equal(compatibleNativePair(from,to,0),true);
  assert.equal(compatibleNativePair(clips[0],{...clips[0],gripSpacing:-clips[0].gripSpacing},0),false);
 }
});
test('The safeguard does not change non-native golf or combat fallback semantics',()=>{
 for(const [golf,clip]of [[true,{...motions.Golf_Address,nativeAttachment:false}],[false,{twoHanded:true,nativeAttachment:true,pairedGrip:false,gripSpacing:.09}]]){
  const {actor,grip,calls}=fixture('kaede');actor.weapon.userData.defaultGrip=0;
  grip.engage(false);grip.engage(true,.18);actor.mixer.time=.09;
  grip.apply(null,golf,clip);assert.equal(calls.legacy,1);
 }
});
