#!/usr/bin/env node
// Dense checks for the review candidate; the public model remains untouched.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../tests/native-skin-helper.mjs';
const {values}=parseArgs({options:{model:{type:'string'},before:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/check-native-cleave.mjs --model CANDIDATE.glb [--before ORIGINAL.glb] [--output REPORT.json]\nChecks anatomical hinges, grip continuity, skin clearance, and preservation of unrelated assets.');process.exit(0);}
if(!values.model)throw Error('Supply --model. See --help.');
const g=await loadNativeSkin(values.model),groups=skinGroups(g),clip=g.animations.find(c=>c.name==='Ronin_Heavy_Cleave');assert(clip,'Candidate must contain Ronin_Heavy_Cleave.');g.mixer.clipAction(clip).play();
const bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});const point=n=>bones[n].getWorldPosition(new T.Vector3());let previous={},lastHand=null,lastTime=0;
const report={maxJointStep:{},maxForearmTorso:{r:0,l:0},maxElbowFold:{r:0,l:0},maxHandSpeed:0,frames:[]};
for(let i=0;i<=92;i++){
 const time=Math.min(i/120,.76);g.mixer.setTime(time);g.scene.updateMatrixWorld(true);const frame={time};
 for(const side of ['r','l']){
  const shoulder=point('upperarm_'+side),elbow=point('lowerarm_'+side),wrist=point('hand_'+side),upper=elbow.clone().sub(shoulder).normalize(),forearm=wrist.clone().sub(elbow).normalize();
  const skin=measureArmSkin(g,groups,side);frame[side]={elbowFlexion:upper.angleTo(forearm)*180/Math.PI,metacarpalBend:forearm.angleTo(point('middle_01_'+side).sub(wrist).normalize())*180/Math.PI,skin};
  report.maxForearmTorso[side]=Math.max(report.maxForearmTorso[side],skin['forearmTorso_'+side].pairs);report.maxElbowFold[side]=Math.max(report.maxElbowFold[side],skin['fold_'+side].maxRadialPenetration);
  for(const part of ['upperarm','lowerarm','hand']){
   const name=part+'_'+side,q=bones[name].quaternion.clone().normalize();if(previous[name]){const degrees=q.angleTo(previous[name])*180/Math.PI;if(degrees>(report.maxJointStep[name]?.degrees??0))report.maxJointStep[name]={degrees,time};}previous[name]=q;
  }
 }
 if(lastHand)report.maxHandSpeed=Math.max(report.maxHandSpeed,point('hand_r').distanceTo(lastHand)/(time-lastTime));lastHand=point('hand_r');lastTime=time;report.frames.push(frame);
}
const unpack=file=>{const raw=fs.readFileSync(file),size=raw.readUInt32LE(12);return{doc:JSON.parse(raw.subarray(20,20+size)),bin:raw.subarray(28+size)};};
const original=unpack(values.before??new URL('../public/models/ronin.glb',import.meta.url)),candidate=unpack(values.model);
assert(candidate.bin.subarray(0,original.bin.length).equals(original.bin),'Original binary payload changed.');
for(const field of ['meshes','nodes','skins','materials','textures','images'])assert.deepEqual(candidate.doc[field],original.doc[field],`${field} changed.`);
const replaced=new Set(['Ready','Ronin_Ready','Heavy_Cleave','Ronin_Heavy_Cleave']);
assert.equal(candidate.doc.animations.length,original.doc.animations.filter(a=>!replaced.has(a.name)).length+2,'Animation count changed outside the two native replacements.');
assert.deepEqual(candidate.doc.animations.filter(a=>replaced.has(a.name)).map(a=>a.name).sort(),['Ronin_Heavy_Cleave','Ronin_Ready']);
for(const animation of original.doc.animations)if(!replaced.has(animation.name))assert.deepEqual(candidate.doc.animations.find(a=>a.name===animation.name),animation,`${animation.name} changed.`);
report.preservedOriginalBytes=original.bin.length;
if(values.output)fs.writeFileSync(values.output,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,frames:undefined},null,2));
for(const [name,step]of Object.entries(report.maxJointStep))assert(step.degrees<25,`${name} jumps ${step.degrees.toFixed(1)}° at ${step.time}s.`);
assert(report.maxForearmTorso.r===0&&report.maxForearmTorso.l===0,'Forearm intersects torso.');assert(report.maxElbowFold.r<.01&&report.maxElbowFold.l<.01,'Elbow skin folds into itself.');
assert(report.maxHandSpeed<12.5,`Hand speed ${report.maxHandSpeed.toFixed(2)}m/s exceeds the animation brief.`);
