#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {createWeapon} from '../../src/weapons.js';
import {headSurfaceMetadata,measureTriangleHeadClearance} from '../blade-head-surface.mjs';

const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/check-return-weapon.mjs --model RETURN.glb --record RETURN.json [--output /tmp/report.json]\nChecks every weapon triangle against the skinned head, torso, and legs at 480 Hz. Uses the fixed reviewed mount. The larger production handle is a conservative bound.');process.exit(0);}
if(!values.model||!values.record)throw Error('Supply --model and --record. See --help.');
const g=await loadNativeSkin(values.model),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const surfaces=headSurfaceMetadata(g);
g.scene.traverse(mesh=>{
 if(!mesh.isSkinnedMesh)return;
 const a=mesh.geometry.attributes,index=mesh.geometry.index,weights=Array.from({length:a.position.count},(_,i)=>{
  let sum=0;for(let k=0;k<4;k++)if(/^(pelvis|spine_\d+|thigh_[rl]|calf_[rl]|foot_[rl]|ball_[rl])$/.test(mesh.skeleton.bones[a.skinIndex.getComponent(i,k)].name))sum+=a.skinWeight.getComponent(i,k);return sum;
 });
 const triangles=[];for(let i=0;i<(index?index.count:a.position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.some(j=>weights[j]>.5))triangles.push(ids);}if(triangles.length)surfaces.push({mesh,triangles});
});
const grip=JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword,record=JSON.parse(fs.readFileSync(values.record)).Ronin_Cut_Return;
assert(record?.pairedGrip&&record.nativeAttachment,'Supply the native paired Return record.');
const clip=g.animations.find(c=>c.name==='Ronin_Cut_Return');assert(clip,'Missing Ronin_Cut_Return.');
const action=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const weapon=createWeapon('odachi'),UP=new T.Vector3(0,1,0),rate=480,distanceCap=.03;
const times=[...new Set([...Array.from({length:Math.ceil(clip.duration*rate)+1},(_,i)=>Math.min(i/rate,clip.duration)),...record.impacts])].sort((a,b)=>a-b);
const report={rate,distanceCap,bodyAndHeadTriangles:surfaces.reduce((n,s)=>n+s.triangles.length,0),samples:times.length,minimumClearance:distanceCap,crossings:0,closest:null};
for(const time of times){
 action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const palm=side=>bones['hand_'+side].localToWorld(new T.Vector3().fromArray(grip[side].center)),primary=palm('r'),shaft=primary.clone().sub(palm('l')).normalize();
 const q=bones.hand_r.getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(grip.r.frame));q.premultiply(new T.Quaternion().setFromUnitVectors(UP.clone().applyQuaternion(q),shaft));
 weapon.quaternion.copy(q);weapon.position.copy(primary).addScaledVector(shaft,-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
 const triangles={};weapon.traverse(mesh=>{
  if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position,index=mesh.geometry.index,vertices=Array.from({length:a.count},(_,i)=>new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld)),rows=[];
  for(let i=0;i<(index?index.count:a.count);i+=3)rows.push([0,1,2].map(k=>vertices[index?index.getX(i+k):i+k]));triangles[mesh.uuid]=rows;
 });
 const hit=measureTriangleHeadClearance(surfaces,triangles,{distanceCap});report.crossings+=hit.crossings;if(hit.minimumClearance<report.minimumClearance){report.minimumClearance=hit.minimumClearance;report.closest={time,...hit.closest};}
}
if(values.output)fs.writeFileSync(values.output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert(report.crossings===0&&report.minimumClearance>=.005,'Weapon violates the 5 mm clearance bound.');
