import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as THREE from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';

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

for(const name of ['Fan_Cut_Diagonal','Fan_Cut_Return','Fan_Cut_Rising','Fan_Cut_Sweep','Fan_Heavy_Cleave','Fan_Heavy_Rising','Fan_Heavy_Sweep','Fan_Heavy_Slam','Fan_Musou_Flow'])test(`${name}: Kaede keeps the free arm clear and its elbow continuous`,async t=>{
 const file=process.env.NINJA_NATIVE_ARM_DIR
  ?path.join(process.env.NINJA_NATIVE_ARM_DIR,'kaede.glb')
  :new URL('../public/models/kaede.glb',import.meta.url);
 const g=await loadNativeSkin(file),metadata=skinGroups(g);
 for(const group of ['upperarm_l','lowerarm_l','torso'])assert.ok(metadata.triangles.filter(t=>t.group===group).length>10,`Missing ${group} skin coverage`);
 const clip=g.animations.find(c=>c.name===name);assert.ok(clip,`Missing native ${name}`);
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
  rows.push({seconds,inset:skin.fold_l.maxRadialPenetration,forearmTorsoPairs:skin.forearmTorso_l.pairs,upperarmTorsoPairs:skin.upperarmTorso_l.pairs,
   elbowSpeed:dt>1e-7?elbow.distanceTo(previous.elbow)/dt:0,reach:wrist.length()/(elbow.length()+wrist.clone().sub(elbow).length())});
  previous={seconds,elbow};
 }
 const worst=key=>rows.reduce((a,b)=>b[key]>a[key]?b:a);
 t.diagnostic(JSON.stringify({samples:rows.length,maxInset:worst('inset'),maxElbowSpeed:worst('elbowSpeed'),maxReach:worst('reach')}));
 const failures=rows.filter(r=>r.inset>.003||r.forearmTorsoPairs>0||r.upperarmTorsoPairs>0||r.elbowSpeed>8||r.reach>.95);
 assert.equal(failures.length,0,`Free arm intersects the body, flips, or locks straight at ${failures.length} samples: ${JSON.stringify(failures.slice(0,8))}`);
});

for(const name of ['Fan_Cut_Diagonal','Fan_Cut_Return','Fan_Cut_Rising','Fan_Cut_Sweep','Fan_Heavy_Cleave','Fan_Heavy_Rising','Fan_Heavy_Sweep','Fan_Heavy_Slam'])test(`${name}: the fan forearm clears the torso during the cut`,async t=>{
 const file=process.env.NINJA_NATIVE_ARM_DIR?path.join(process.env.NINJA_NATIVE_ARM_DIR,'kaede.glb'):new URL('../public/models/kaede.glb',import.meta.url);
 const g=await loadNativeSkin(file),metadata=skinGroups(g),clip=g.animations.find(c=>c.name===name);assert.ok(clip,`Missing native ${name}`);
 const action=g.mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
 const point=name=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 let previous=null;const rows=[];
 for(let frame=0;frame<=Math.ceil(clip.duration*240);frame++){
  const seconds=Math.min(clip.duration,frame/240);action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const elbow=point('lowerarm_r').sub(point('upperarm_r')),dt=previous?seconds-previous.seconds:0,skin=measureArmSkin(g,metadata,'r');
  rows.push({seconds,inset:skin.fold_r.maxRadialPenetration,forearmTorsoPairs:skin.forearmTorso_r.pairs,elbowSpeed:dt>1e-7?elbow.distanceTo(previous.elbow)/dt:0});
  previous={seconds,elbow};
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
 assert.ok(maxSpeed.elbowSpeed<15,`Elbow plane jumps: ${JSON.stringify(maxSpeed)}`);
});
