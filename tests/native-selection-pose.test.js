import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as THREE from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';

const roster=[['ronin','Ronin'],['shinobi','Twin'],['monk','Naginata'],['kaede','Fan'],['ayame','Ring'],['sora','Sickle']];
const point=(g,name)=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
function soleVertices(g){
 const feet={r:[],l:[]};
 g.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex,skinWeight,position}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++)for(const side of ['r','l']){
   let weight=0;
   for(let k=0;k<4;k++)if(['foot_'+side,'ball_'+side].includes(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))weight+=skinWeight.getComponent(i,k);
   if(weight>.5)feet[side].push([mesh,i]);
  }
 });
 return feet;
}

for(const [hero,prefix]of roster)test(`${hero}: native selection loop has relaxed arms and grounded, clear skin`,async t=>{
 const file=process.env.NINJA_SELECTION_MODEL_DIR?path.join(process.env.NINJA_SELECTION_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url);
 const g=await loadNativeSkin(file),metadata=skinGroups(g),soles=soleVertices(g),name=prefix+'_Selection_Idle';
 const clip=g.animations.find(c=>c.name===name);assert.ok(clip,`Missing native ${name}`);
 for(const side of ['r','l']){
  assert.ok(soles[side].length>20,`${hero}: missing weighted shoe geometry`);
  assert.ok(metadata.triangles.filter(q=>q.group==='lowerarm_'+side).length>10,`${hero}: missing forearm skin coverage`);
 }
 const bones=[];g.scene.traverse(o=>{if(o.isBone)bones.push(o);});
 const action=g.mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
 const starts={},previous={},worst={armElevation:0,palmAboveShoulder:-Infinity,kneeFlex:0,supportKneeFlex:0,soleGap:0,solePenetration:0,footDrift:0,footTurn:0,foldInset:0,torsoPairs:0,elbowSpeed:0,loopPosition:0,loopRotation:0};
 let firstBones;
 const times=Array.from({length:Math.floor(clip.duration*120)+1},(_,i)=>i/120);if(clip.duration-times.at(-1)>1e-7)times.push(clip.duration);
 for(const seconds of times){
  action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  for(const mesh of metadata.meshes)mesh.skeleton.update();
  if(!firstBones)firstBones=bones.map(b=>({position:b.position.clone(),rotation:b.quaternion.clone()}));
  const kneeFlex=[];
  for(const side of ['r','l']){
   const shoulder=point(g,'upperarm_'+side),elbow=point(g,'lowerarm_'+side),relative=elbow.clone().sub(shoulder),palm=point(g,'PalmGrip_'+side),foot=point(g,'foot_'+side),rotation=g.scene.getObjectByName('foot_'+side).getWorldQuaternion(new THREE.Quaternion());
   const hip=point(g,'thigh_'+side),knee=point(g,'calf_'+side);
   kneeFlex.push(knee.clone().sub(hip).angleTo(foot.clone().sub(knee))*180/Math.PI);
   // A relaxed upper arm points predominantly down, not sideways or overhead.
   worst.armElevation=Math.max(worst.armElevation,relative.angleTo(new THREE.Vector3(0,-1,0))*180/Math.PI);
   worst.palmAboveShoulder=Math.max(worst.palmAboveShoulder,(palm.y-shoulder.y)/relative.length());
   const bottom=Math.min(...soles[side].map(([mesh,i])=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).y));
   worst.soleGap=Math.max(worst.soleGap,bottom);worst.solePenetration=Math.max(worst.solePenetration,-bottom);
   starts[side]??={foot:foot.clone(),rotation:rotation.clone()};worst.footDrift=Math.max(worst.footDrift,foot.distanceTo(starts[side].foot));worst.footTurn=Math.max(worst.footTurn,rotation.angleTo(starts[side].rotation));
   const skin=measureArmSkin(g,metadata,side);worst.foldInset=Math.max(worst.foldInset,skin['fold_'+side].maxRadialPenetration);worst.torsoPairs=Math.max(worst.torsoPairs,skin['forearmTorso_'+side].pairs);
   const old=previous[side],dt=old?seconds-old.seconds:0;if(dt>1e-7)worst.elbowSpeed=Math.max(worst.elbowSpeed,relative.distanceTo(old.relative)/dt);previous[side]={seconds,relative};
  }
  worst.kneeFlex=Math.max(worst.kneeFlex,...kneeFlex);
  worst.supportKneeFlex=Math.max(worst.supportKneeFlex,Math.min(...kneeFlex));
 }
 bones.forEach((bone,i)=>{worst.loopPosition=Math.max(worst.loopPosition,bone.position.distanceTo(firstBones[i].position));worst.loopRotation=Math.max(worst.loopRotation,bone.quaternion.angleTo(firstBones[i].rotation));});
 t.diagnostic(JSON.stringify({hero,name,samples:times.length,...worst}));
 assert.ok(worst.armElevation<35,'Selection elbow is too far from a relaxed hanging upper arm');
 assert.ok(worst.palmAboveShoulder<0,'Selection palm rises to shoulder/chin height');
 assert.ok(worst.kneeFlex<23&&worst.supportKneeFlex<18,'The resting pose crouches instead of standing on a nearly straight support leg');
 assert.ok(worst.soleGap<=.012&&worst.solePenetration<=.012,'Actual weighted shoe surface floats or sinks more than 12 mm');
 assert.ok(worst.footDrift<=.005&&worst.footTurn<=.035,'The standing selection loop slides or turns a support foot');
 assert.ok(worst.foldInset<=.003,'Actual forearm skin folds into the upper arm');
 assert.equal(worst.torsoPairs,0,'Actual forearm skin intersects the torso');
 assert.ok(worst.elbowSpeed<1,'The idle loop has an abrupt elbow movement');
 assert.ok(worst.loopPosition<.003&&worst.loopRotation<.015,'Native selection loop has a visible endpoint discontinuity');
});
