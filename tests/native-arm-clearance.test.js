import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';
import {WARRIORS} from '../src/warriors.js';

const motions=JSON.parse(readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const ace=WARRIORS.find(hero=>hero.model==='kaede');
const aceClip=name=>ace.motionOverrides?.[name]||name;

test('Ronin overhead cleave keeps both forearms clear through preparation and contact',async t=>{
 const file=process.env.NINJA_NATIVE_ARM_DIR?path.join(process.env.NINJA_NATIVE_ARM_DIR,'ronin.glb'):new URL('../public/models/ronin.glb',import.meta.url);
 const g=await loadNativeSkin(file),metadata=skinGroups(g),clip=g.animations.find(c=>c.name==='Ronin_Heavy_Cleave');
 const action=g.mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
 const point=name=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 const previous={},worst={inset:0,torsoPairs:0,elbowSpeed:0};
 for(let frame=0;frame<=Math.ceil(clip.duration*240);frame++){
  const seconds=Math.min(frame/240,clip.duration);action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  for(const side of ['r','l']){
   const elbow=point('lowerarm_'+side).sub(point('upperarm_'+side)),old=previous[side],dt=old?seconds-old.seconds:0;
   if(dt>1e-7)worst.elbowSpeed=Math.max(worst.elbowSpeed,elbow.distanceTo(old.elbow)/dt);
   // Inspect the loaded windup, cut, and follow-through. The matching ready
   // pose also receives the dense native attack audit.
   if(seconds>=.10&&seconds<=.60){
    const skin=measureArmSkin(g,metadata,side);
    worst.inset=Math.max(worst.inset,skin['fold_'+side].maxRadialPenetration);
    worst.torsoPairs=Math.max(worst.torsoPairs,skin['forearmTorso_'+side].pairs);
   }
   previous[side]={seconds,elbow};
  }
 }
 t.diagnostic(JSON.stringify(worst));
 assert.ok(worst.inset<=.003,'Cleave preparation folds a forearm into its upper arm');
 assert.equal(worst.torsoPairs,0,'Cleave passes a forearm through the torso');
 assert.ok(worst.elbowSpeed<12,'Cleave has an abrupt elbow-plane reversal');
});

// The same actual-skin check must reject the independent pre-fix model.
const asset=process.env.NINJA_NATIVE_ARM_DIR
 ?path.join(process.env.NINJA_NATIVE_ARM_DIR,'ayame.glb')
 :new URL('../public/models/ayame.glb',import.meta.url);

test('Ayame cleave windup keeps the forearm outside its upper arm and torso',async t=>{
 const g=await loadNativeSkin(asset),metadata=skinGroups(g);
 for(const group of ['upperarm_r','lowerarm_r','torso'])assert.ok(metadata.triangles.filter(t=>t.group===group).length>10,`Missing ${group} skin coverage`);
 const clip=g.animations.find(c=>c.name==='Ring_Heavy_Cleave');assert.ok(clip,'Missing native Ring_Heavy_Cleave');
 const action=g.mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
 const point=name=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 // The explicit defect fixture remains even if sampling cadence changes.
 const times=[...Array.from({length:37},(_,i)=>i===7?.0583333333:i/120),.305];
 const rows=[];let previous=null;
 for(const seconds of times){
  action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const elbow=point('lowerarm_r').sub(point('upperarm_r')),dt=previous?seconds-previous.seconds:0;
  const skin=measureArmSkin(g,metadata,'r');
  rows.push({seconds,inset:skin.fold_r.maxRadialPenetration,interiorVertices:skin.fold_r.interiorForearmVertices,forearmTorsoPairs:skin.forearmTorso_r.pairs,elbowSpeed:dt>1e-7?elbow.distanceTo(previous.elbow)/dt:0});
  previous={seconds,elbow};
 }
 const worst=(key)=>rows.reduce((a,b)=>b[key]>a[key]?b:a);
 t.diagnostic(JSON.stringify({samples:rows.length,maxInset:worst('inset'),maxTorsoCrossing:worst('forearmTorsoPairs'),maxElbowSpeed:worst('elbowSpeed'),fixture:rows.find(r=>r.seconds===.0583333333)}));
 const failures=rows.filter(r=>r.inset>.003||r.forearmTorsoPairs>0||r.elbowSpeed>8);
 // Three millimeters allows surface/interpolation noise, not visible limb burial.
 // Eight m/s limits elbow displacement to 6.67 cm per 120 Hz native sample.
 assert.equal(failures.length,0,`Deformed windup skin or elbow continuity failed at ${failures.length} samples: ${JSON.stringify(failures.slice(0,8))}`);
});

for(const name of ['Fan_Cut_Diagonal','Fan_Cut_Return','Fan_Cut_Rising','Fan_Cut_Sweep','Fan_Heavy_Cleave','Fan_Heavy_Rising','Fan_Heavy_Sweep','Fan_Heavy_Slam','Fan_Musou_Flow'])test(`${name}: Kaede keeps the left arm clear and its elbow continuous`,async t=>{
 const file=process.env.NINJA_NATIVE_ARM_DIR
  ?path.join(process.env.NINJA_NATIVE_ARM_DIR,'kaede.glb')
  :new URL('../public/models/kaede.glb',import.meta.url);
 const g=await loadNativeSkin(file),metadata=skinGroups(g);
 for(const group of ['upperarm_l','lowerarm_l','torso'])assert.ok(metadata.triangles.filter(t=>t.group===group).length>10,`Missing ${group} skin coverage`);
 const clip=g.animations.find(c=>c.name===aceClip(name));assert.ok(clip,`Missing native ${aceClip(name)}`);
 const action=g.mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
 const point=name=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 let previous=null;
 const rows=[];
 // Native keys and intermediate samples both matter. A 60 Hz scan missed the
 // short fold near 2.058 s during development, so retain this 240 Hz sweep.
 for(let frame=0;frame<=Math.ceil(clip.duration*240);frame++){
  const seconds=Math.min(clip.duration,frame/240);action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const shoulder=point('upperarm_l'),elbow=point('lowerarm_l').sub(shoulder),wrist=point('hand_l').sub(shoulder);
  const dt=previous?seconds-previous.seconds:0,skin=measureArmSkin(g,metadata,'l');
  const bodyElbow=elbow.clone().applyQuaternion(g.scene.getObjectByName('upperarm_l').parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  rows.push({seconds,inset:skin.fold_l.maxRadialPenetration,forearmTorsoPairs:skin.forearmTorso_l.pairs,upperarmTorsoPairs:skin.upperarmTorso_l.pairs,
   elbowSpeed:dt>1e-7?elbow.distanceTo(previous.elbow)/dt:0,bodyElbowSpeed:dt>1e-7?bodyElbow.distanceTo(previous.bodyElbow)/dt:0,reach:wrist.length()/(elbow.length()+wrist.clone().sub(elbow).length())});
  previous={seconds,elbow,bodyElbow};
 }
 const worst=key=>rows.reduce((a,b)=>b[key]>a[key]?b:a);
 t.diagnostic(JSON.stringify({samples:rows.length,maxInset:worst('inset'),maxElbowSpeed:worst('elbowSpeed'),maxBodyElbowSpeed:worst('bodyElbowSpeed'),maxReach:worst('reach')}));
 // The source balancing arm extends farther while retaining positive elbow
 // flexion. Keep skin and velocity checks; reject a nearly locked arm.
 const sourceMotion=motions[clip.name]?.nativeSourceMotion;
 const reachLimit=sourceMotion ? .985 : .95;
 // A full body turn moves the elbow even with a steady shoulder joint.
 // Measure that joint in its parent frame; retain the weapon-arm world
 // speed ceiling as a separate guard against discontinuous body motion.
 const failures=rows.filter(r=>r.inset>.003||r.forearmTorsoPairs>0||r.upperarmTorsoPairs>0||
  (sourceMotion ? r.bodyElbowSpeed>8||r.elbowSpeed>15 : r.elbowSpeed>8)||r.reach>reachLimit);
 assert.equal(failures.length,0,`Left arm intersects the body, flips, or locks straight at ${failures.length} samples: ${JSON.stringify(failures.slice(0,8))}`);
});

for(const name of ['Fan_Cut_Diagonal','Fan_Cut_Return','Fan_Cut_Rising','Fan_Cut_Sweep','Fan_Heavy_Cleave','Fan_Heavy_Rising','Fan_Heavy_Sweep','Fan_Heavy_Slam'])test(`${name}: the fan forearm clears the torso during the cut`,async t=>{
 const file=process.env.NINJA_NATIVE_ARM_DIR?path.join(process.env.NINJA_NATIVE_ARM_DIR,'kaede.glb'):new URL('../public/models/kaede.glb',import.meta.url);
 const g=await loadNativeSkin(file),metadata=skinGroups(g),clip=g.animations.find(c=>c.name===aceClip(name));assert.ok(clip,`Missing native ${aceClip(name)}`);
 const action=g.mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
 const point=name=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 let previous=null;const rows=[];
 for(let frame=0;frame<=Math.ceil(clip.duration*240);frame++){
  const seconds=Math.min(clip.duration,frame/240);action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const elbow=point('lowerarm_r').sub(point('upperarm_r')),dt=previous?seconds-previous.seconds:0,skin=measureArmSkin(g,metadata,'r');
  const bodyElbow=elbow.clone().applyQuaternion(g.scene.getObjectByName('upperarm_r').parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  rows.push({seconds,inset:skin.fold_r.maxRadialPenetration,forearmTorsoPairs:skin.forearmTorso_r.pairs,elbowSpeed:dt>1e-7?elbow.distanceTo(previous.elbow)/dt:0,bodyElbowSpeed:dt>1e-7?bodyElbow.distanceTo(previous.bodyElbow)/dt:0});
  previous={seconds,elbow,bodyElbow};
 }
 // The existing Ready pose compresses this mesh at the elbow. Test active
 // strokes separately from the initial 60 ms and final 100 ms of returning
 // to that unchanged pose. Forearm/torso intersections remain forbidden
 // throughout. Upper-arm/shoulder skin contact needs a separate deformation pass.
 const active=rows.filter(r=>r.seconds>=.06&&r.seconds<=clip.duration-.10);
 assert.ok(active.length>=30,'Insufficient active-cut samples');
 const maxInset=active.reduce((a,b)=>b.inset>a.inset?b:a),maxSpeed=rows.reduce((a,b)=>b.elbowSpeed>a.elbowSpeed?b:a);
 t.diagnostic(JSON.stringify({name,samples:rows.length,maxActiveInset:maxInset,maxElbowSpeed:maxSpeed}));
 assert.ok(active.every(r=>r.inset<=.003),`Forearm folds into upper arm: ${JSON.stringify(maxInset)}`);
 assert.ok(rows.every(r=>r.forearmTorsoPairs===0),'Forearm crosses the torso');
 // Fast cross-body cuts may exceed the free-arm speed. This bound rejects
 // the former 20–46 m/s bend-plane jumps. Recovery has a separate 8 m/s test.
 const sourceMotion=motions[clip.name]?.nativeSourceMotion;
 assert.ok(sourceMotion?rows.every(r=>r.bodyElbowSpeed<15&&r.elbowSpeed<20):maxSpeed.elbowSpeed<15,`Elbow plane jumps: ${JSON.stringify(maxSpeed)}`);
});
