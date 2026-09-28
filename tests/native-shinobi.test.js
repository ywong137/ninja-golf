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

test('both Shinobi blades clear the deformed head throughout every combat clip', {skip:pending},async()=>{
 const frames=candidate?candidate+'.mount.json':{sword:JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).shinobi.sword};
 const result=await inspectNativeBladeHeadClearance({model,modelKey:'shinobi',weaponKind:'twin',frames,record,clips:SHINOBI_CLIPS,dualWield:true,rate:480});
 assert.equal(result.passed,true,JSON.stringify(result.clips));
});
