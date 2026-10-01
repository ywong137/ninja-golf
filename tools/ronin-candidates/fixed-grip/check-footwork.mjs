import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../../tests/native-skin-helper.mjs';
import {measureTriangleHeadClearance} from '../../../tools/blade-head-surface.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../../../src/leg-anatomy.js';
import {verifyAnimationReplacement} from '../../../tools/verify-animation-replacement.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},before:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/check-footwork.mjs --candidate DIRECTORY --before SOURCE.glb\nChecks the first light cut: native leg limits, full leg surfaces, shoe height, sole/toe support, cutting edge, matching endpoints, and unrelated asset preservation.');process.exit(0);}
if(!values.candidate||!values.before)throw Error('Supply --candidate DIRECTORY and --before SOURCE.glb. See --help.');
const dir=path.resolve(values.candidate)+path.sep,source=path.resolve(values.before);
const g=await loadNativeSkin(dir+'ronin.glb'),bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o});g.scene.updateMatrixWorld(true);
const p=n=>bones[n].getWorldPosition(new T.Vector3()),q=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize();
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const surfaces={r:[],l:[]},shoes=[];
g.scene.traverse(mesh=>{
 if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
 const {skinIndex:ids,skinWeight:weights,position}=mesh.geometry.attributes,index=mesh.geometry.index;
 const weight=(i,re)=>{let v=0;for(let k=0;k<4;k++)if(re.test(mesh.skeleton.bones[ids.getComponent(i,k)].name))v+=weights.getComponent(i,k);return v;};
 const vertices=Array.from({length:position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
 shoes.push({mesh,ids:vertices.flatMap((_,i)=>weight(i,/^(foot|ball)_[rl]$/)>.8?[i]:[])});
 for(const s of ['r','l']){
  const hip=p('thigh_'+s),axis=p('calf_'+s).sub(hip),triangles=[];
  for(let i=0;i<(index?index.count:position.count);i+=3){const v=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(v.some(j=>weight(j,new RegExp('^(thigh|calf|foot|ball)_'+s+'$'))<.65))continue;
   const center=v.reduce((a,j)=>a.add(vertices[j]),new T.Vector3()).multiplyScalar(1/3);
   if(center.clone().sub(hip).dot(axis)/axis.lengthSq()>=.2)triangles.push(v);
  }
  if(triangles.length)surfaces[s].push({mesh,triangles});
 }
});
const name='Ronin_Cut_Diagonal',clip=g.animations.find(c=>c.name===name),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const record=JSON.parse(fs.readFileSync(dir+'diagonal.json'))[name],profiles=JSON.parse(fs.readFileSync(dir+'grips.json')).ronin.sword;
const report={preservation:verifyAnimationReplacement(source,dir+'ronin.glb',[[name,name]]),samples:0,crossings:0,minLegClearance:.1,maxPlantDrift:0,maxPlantRotation:0,maxToeDrift:0,minShoeHeight:Infinity,maxHipTwist:0,maxAnkleTwist:0,maxKneeDeviation:0,minKneeFlexion:180,violations:[],edgeAlignment:[],endpoints:{}};
const support=new Map(),snapshot=()=>Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone().normalize(),s:b.scale.clone()}]));
const sample=t=>{action.time=Math.min(t,clip.duration);g.mixer.update(0);g.scene.updateMatrixWorld(true);};
for(let i=0;i<=576;i++){
 const t=record.duration*i/576;sample(t);report.samples++;
 for(const s of ['r','l']){
  const m=measureLegAnatomy(cal[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);
  report.maxHipTwist=Math.max(report.maxHipTwist,Math.abs(m.hipTwist));report.maxAnkleTwist=Math.max(report.maxAnkleTwist,Math.abs(m.ankleTwist));report.maxKneeDeviation=Math.max(report.maxKneeDeviation,m.kneeDeviation);report.minKneeFlexion=Math.min(report.minKneeFlexion,m.kneeFlexion);
  if(m.kneeDeviation>.1||m.kneeFlexion<0||Math.abs(m.hipTwist)>36||Math.abs(m.ankleTwist)>10)report.violations.push({t,s,...m});
  for(const kind of ['foot','toe']){const intervals=record[kind==='foot'?'footPlants':'toePlants'][s]??[],index=intervals.findIndex(([a,b])=>t>=a&&t<=b);if(index<0)continue;
   const key=s+kind+index,pos=p((kind==='foot'?'foot_':'ball_')+s),rotation=q('foot_'+s);if(!support.has(key))support.set(key,{pos,rotation});const before=support.get(key),drift=pos.distanceTo(before.pos);
   if(kind==='toe')report.maxToeDrift=Math.max(report.maxToeDrift,drift);else {report.maxPlantDrift=Math.max(report.maxPlantDrift,drift);report.maxPlantRotation=Math.max(report.maxPlantRotation,rotation.angleTo(before.rotation));}
  }
 }
 const query={left:[]};for(const {mesh,triangles}of surfaces.l){mesh.skeleton.update();const cache=new Map();for(const ids of triangles)query.left.push(ids.map(i=>{if(!cache.has(i))cache.set(i,mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));return cache.get(i)}));}
 const separation=measureTriangleHeadClearance(surfaces.r,query,{distanceCap:.1});report.crossings+=separation.crossings;report.minLegClearance=Math.min(report.minLegClearance,separation.minimumClearance);
 for(const {mesh,ids}of shoes){mesh.skeleton.update();for(const index of ids)report.minShoeHeight=Math.min(report.minShoeHeight,mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld).y);}
}
const center=t=>{sample(t);const rotation=q('hand_r').multiply(new T.Quaternion().fromArray(profiles.r.frame));return {position:bones.hand_r.localToWorld(new T.Vector3().fromArray(profiles.r.center)).add(new T.Vector3(.08,.80,0).applyQuaternion(rotation)),edge:new T.Vector3(1,0,0).applyQuaternion(rotation)};};
for(let t=record.impacts[0]-.025;t<=record.impacts[0]+.025;t+=.002){const v=center(t+.0005).position.sub(center(t-.0005).position).normalize();report.edgeAlignment.push({t,alignment:v.dot(center(t).edge)});}
sample(0);const first=snapshot();sample(clip.duration);const last=snapshot();
for(const [n,a]of Object.entries(first)){const b=last[n];report.endpoints[n]={position:a.p.distanceTo(b.p),angle:a.q.angleTo(b.q),scale:a.s.distanceTo(b.s)};}
fs.writeFileSync(dir+'footwork-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,endpoints:undefined,edgeAlignment:Math.min(...report.edgeAlignment.map(x=>x.alignment)),violations:report.violations.slice(0,3),violationCount:report.violations.length}));
assert.equal(report.violations.length,0);assert.equal(report.crossings,0);assert.ok(report.minLegClearance>.003);assert.ok(report.maxPlantDrift<.001&&report.maxPlantRotation<.005&&report.maxToeDrift<.001);
assert.ok(report.minShoeHeight>-.003,'Shoe penetrates the native floor.');assert.ok(report.edgeAlignment.every(x=>x.alignment>.8));
for(const [n,v]of Object.entries(report.endpoints))assert.ok(v.position<.0001&&v.angle<.001&&v.scale<.00001,'Endpoint mismatch: '+n);
