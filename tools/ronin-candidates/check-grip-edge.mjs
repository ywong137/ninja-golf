#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {Vector3,Quaternion,LoopOnce} from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {measureGripEdgeAlignment,compareGripClock} from '../grip-edge-alignment.mjs';

const {values}=parseArgs({options:{model:{type:'string'},clip:{type:'string',multiple:true},output:{type:'string'},rate:{type:'string',default:'60'},help:{type:'boolean'}}});
if(values.help){
 console.log('node tools/ronin-candidates/check-grip-edge.mjs --model CANDIDATE.glb --clip CLIP [--clip CLIP] --output /tmp/grip-edge.json [--rate 60]\nMeasures PIP knuckle alignment with the cutting edge using the candidate Ronin grip patch. No anatomical pass threshold. Does not modify the model.');
 process.exit(0);
}
const rate=Number(values.rate);
if(!values.model?.endsWith('.glb')||!values.clip?.length||!values.output?.endsWith('.json'))throw new Error('Supply --model, --clip, and --output. See --help.');
if(!Number.isFinite(rate)||rate<1||rate>480)throw new Error('--rate must be between 1 and 480 Hz.');
const grips=JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword;
const g=await loadNativeSkin(values.model),bones={};
g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
for(const side of ['r','l'])for(const name of ['hand','index_02','middle_02','ring_02','pinky_02'])
 if(!bones[name+'_'+side])throw new Error('Missing PIP landmark bone '+name+'_'+side);
const position=name=>bones[name].getWorldPosition(new Vector3());
const reports=[];
for(const name of values.clip){
 const clip=g.animations.find(c=>c.name===name);if(!clip)throw new Error('Missing animation '+name);
 g.mixer.stopAllAction();
 const action=g.mixer.clipAction(clip).setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
 const times=Array.from({length:Math.ceil(clip.duration*rate)+1},(_,i)=>Math.min(clip.duration,i/rate));
 const rows=[];
 for(const time of times){
  g.mixer.setTime(time);g.scene.updateMatrixWorld(true);
  const weapon=bones.hand_r.getWorldQuaternion(new Quaternion()).multiply(new Quaternion().fromArray(grips.r.frame));
  const origin=bones.hand_r.localToWorld(new Vector3().fromArray(grips.r.center));
  const shaftAxis=new Vector3(0,1,0).applyQuaternion(weapon),edgeDirection=new Vector3(1,0,0).applyQuaternion(weapon);
  const hands={};
  for(const side of ['r','l'])hands[side]=measureGripEdgeAlignment({
   shaftOrigin:origin,shaftAxis,edgeDirection,
   knuckles:Object.fromEntries(['index','middle','ring','pinky'].map(f=>[f,position(f+'_02_'+side)])),
  });
  rows.push({time,hands,mirroredSupport:compareGripClock(hands.r,hands.l,{mirrorReference:true})});
 }
 const summary=Object.fromEntries(['r','l'].map(side=>[side,{
  minMeanClockDegrees:Math.min(...rows.map(row=>row.hands[side].meanClockDegrees)),
  maxMeanClockDegrees:Math.max(...rows.map(row=>row.hands[side].meanClockDegrees)),
  maxAbsoluteClockDegrees:Math.max(...rows.map(row=>row.hands[side].maxAbsoluteClockDegrees)),
 }]));
 summary.mirroredSupport={
  minRotationDegrees:Math.min(...rows.map(row=>row.mirroredSupport.rotationDegrees)),
  maxRotationDegrees:Math.max(...rows.map(row=>row.mirroredSupport.rotationDegrees)),
  maxShapeResidualDegrees:Math.max(...rows.map(row=>row.mirroredSupport.maxShapeResidualDegrees)),
 };
 reports.push({clip:name,summary,rows});console.log(JSON.stringify({clip:name,summary,samples:rows.length}));
}
fs.writeFileSync(values.output,JSON.stringify({model:path.resolve(values.model),rate,convention:'PIP radial angle relative to +X cutting edge; positive around +Y shaft',reports},null,2));
