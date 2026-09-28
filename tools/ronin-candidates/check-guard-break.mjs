#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
const {values}=parseArgs({options:{before:{type:'string'},model:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/check-guard-break.mjs --before V5.glb --model V6.glb --output REPORT.json\nChecks the 0.40-second Break at 480 Hz: compression, planted feet, knee alignment, continuity, endpoints, and unchanged animation channels.');process.exit(0);}
for(const key of ['before','model','output'])if(!values[key])throw Error('Supply --'+key+'. See --help.');
const files=[values.before,values.model];
const models=await Promise.all(files.map(loadNativeSkin)),name='Odachi_Guard_Break',rate=480;
for(const g of models){const clip=g.animations.find(c=>c.name===name);assert.ok(clip&&Math.abs(clip.duration-.4)<1e-6,'Expected the 0.40-second native Guard Break.');const a=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();}
const point=(g,n)=>g.scene.getObjectByName(n).getWorldPosition(new T.Vector3()),quat=(g,n)=>g.scene.getObjectByName(n).getWorldQuaternion(new T.Quaternion()).normalize();
const report={source:values.before,candidate:values.model,units:{position:"metres",angle:"degrees",speed:"metres per second"},rate,passed:true,maxFootDifference:0,maxFootRotation:0,maxMedial:0,maxKneeSpeed:0,maxLegLengthChange:0,maxBoneStepDegreesPer120:0,maxPelvisSpeed:0,maxPelvisDropFromStart:0,maxPelvisBackFromStart:0,endPelvisDifference:0,maxEndpointPositionError:0,maxEndpointRotationDegrees:0,maxKneeFlexionIncreaseFromReference:{r:0,l:0},snapshots:[]};
let last=null,start=null;
const frames=g=>Object.fromEntries(['pelvis',...['r','l'].flatMap(s=>['thigh_','calf_','foot_','ball_'].map(n=>n+s))].map(n=>[n,{p:point(g,n),q:quat(g,n)}]));
for(let i=0;i<=192;i++){
 const t=i/rate;
 for(const g of models){g.mixer.setTime(Math.min(t,.4-1e-7));g.scene.updateMatrixWorld(true);}
 const [a,b]=models.map(frames);start??=b.pelvis.p.clone();const delta=b.pelvis.p.clone().sub(a.pelvis.p);report.maxPelvisDropFromStart=Math.max(report.maxPelvisDropFromStart,start.y-b.pelvis.p.y);report.maxPelvisBackFromStart=Math.max(report.maxPelvisBackFromStart,start.z-b.pelvis.p.z);
 if(i===192)report.endPelvisDifference=delta.length();
 if(i===0||i===192)for(const n of Object.keys(b)){report.maxEndpointPositionError=Math.max(report.maxEndpointPositionError,b[n].p.distanceTo(a[n].p));report.maxEndpointRotationDegrees=Math.max(report.maxEndpointRotationDegrees,b[n].q.angleTo(a[n].q)*180/Math.PI);}
 for(const side of ['r','l']){
  const sourceKnee=a['calf_'+side].p,hip=b['thigh_'+side].p,knee=b['calf_'+side].p,ankle=b['foot_'+side].p,toe=b['ball_'+side].p;
  const forward=toe.clone().sub(ankle).setY(0).normalize(),outward=new T.Vector3(0,1,0).cross(forward).multiplyScalar(side==='l'?1:-1);
  const medial=-knee.clone().sub(ankle).dot(outward);report.maxMedial=Math.max(report.maxMedial,medial);
  const flex=180-hip.clone().sub(knee).angleTo(ankle.clone().sub(knee))*180/Math.PI,oldFlex=180-a['thigh_'+side].p.clone().sub(sourceKnee).angleTo(a['foot_'+side].p.clone().sub(sourceKnee))*180/Math.PI;
  report.maxKneeFlexionIncreaseFromReference[side]=Math.max(report.maxKneeFlexionIncreaseFromReference[side],flex-oldFlex);
  for(const n of ['foot_','ball_'])report.maxFootDifference=Math.max(report.maxFootDifference,b[n+side].p.distanceTo(a[n+side].p));
  report.maxFootRotation=Math.max(report.maxFootRotation,b['foot_'+side].q.angleTo(a['foot_'+side].q)*180/Math.PI);
  for(const [n,m]of [['thigh_','calf_'],['calf_','foot_']])report.maxLegLengthChange=Math.max(report.maxLegLengthChange,Math.abs(b[n+side].p.distanceTo(b[m+side].p)-a[n+side].p.distanceTo(a[m+side].p)));
  if(last)report.maxKneeSpeed=Math.max(report.maxKneeSpeed,knee.distanceTo(last['calf_'+side].p)*rate);
 }
 if(last){for(const n of Object.keys(b))report.maxBoneStepDegreesPer120=Math.max(report.maxBoneStepDegreesPer120,b[n].q.angleTo(last[n].q)*180/Math.PI*4);report.maxPelvisSpeed=Math.max(report.maxPelvisSpeed,b.pelvis.p.distanceTo(last.pelvis.p)*rate);}
 if([0,24,48,77,120,168,192].includes(i))report.snapshots.push({time:t,pelvisDeltaFromReference:delta.toArray(),pelvis:b.pelvis.p.toArray(),kneeFlexion:Object.fromEntries(['r','l'].map(side=>{const k=b['calf_'+side].p;return[side,180-b['thigh_'+side].p.clone().sub(k).angleTo(b['foot_'+side].p.clone().sub(k))*180/Math.PI]})),rightHip:b.thigh_r.p.toArray(),rightKnee:b.calf_r.p.toArray(),rightAnkle:b.foot_r.p.toArray()});last=b;
}
const unpack=f=>{const raw=fs.readFileSync(f),length=raw.readUInt32LE(12);return{doc:JSON.parse(raw.subarray(20,20+length)),bin:raw.subarray(28+length)}};
const [before,after]=files.map(unpack),bytes=(d,i)=>{const a=d.doc.accessors[i],v=d.doc.bufferViews[a.bufferView],components={SCALAR:1,VEC3:3,VEC4:4}[a.type];return d.bin.subarray((v.byteOffset??0)+(a.byteOffset??0),(v.byteOffset??0)+(a.byteOffset??0)+a.count*components*4)};
let retainedClips=0,retainedBreakChannels=0;
for(const clip of before.doc.animations){const other=after.doc.animations.find(a=>a.name===clip.name);assert.ok(other);for(const c of clip.channels){const bone=before.doc.nodes[c.target.node].name,changed=clip.name===name&&(bone==='pelvis'&&c.target.path==='translation'||/^(thigh|calf|foot)_[rl]$/.test(bone)&&c.target.path==='rotation');if(changed)continue;const channel=other.channels.find(x=>x.target.node===c.target.node&&x.target.path===c.target.path);assert.ok(channel,clip.name+'/'+bone);const old=clip.samplers[c.sampler],next=other.samplers[channel.sampler];for(const key of ['input','output'])assert.ok(bytes(before,old[key]).equals(bytes(after,next[key])),clip.name+'/'+bone+'/'+key);if(clip.name===name)retainedBreakChannels++;}if(clip.name!==name)retainedClips++;}
report.preservation={retainedClips,retainedBreakChannels,changedBreakChannels:['pelvis.translation','thigh_r.rotation','calf_r.rotation','foot_r.rotation','thigh_l.rotation','calf_l.rotation','foot_l.rotation']};
assert.ok(report.maxFootDifference<.003,'Planted feet moved.');assert.ok(report.maxFootRotation<1,'Feet turned.');assert.ok(report.maxMedial<.020,'Knees collapse inward.');assert.ok(report.maxKneeSpeed<12,'Knee branch jump.');assert.ok(report.maxLegLengthChange<.0001,'Legs stretched.');assert.ok(report.maxBoneStepDegreesPer120<10,'Body rotation is discontinuous.');assert.ok(report.maxPelvisDropFromStart>=.035&&report.maxPelvisBackFromStart>=.040,'No visible whole-body give.');assert.ok(report.maxKneeFlexionIncreaseFromReference.r>3&&report.maxKneeFlexionIncreaseFromReference.l>3,'Both knees must compress.');assert.ok(report.endPelvisDifference<1e-5,'Body did not recover.');
assert.ok(report.maxEndpointPositionError<.00001,'A boundary moves the original body pose.');assert.ok(report.maxEndpointRotationDegrees<.001,'A boundary rotates the original body pose.');
fs.writeFileSync(values.output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
