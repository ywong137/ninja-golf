import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as THREE from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';

test('Shinobi attacks keep the deformed forearms clear and the elbows continuous',async t=>{
 const directory=process.env.NINJA_TWIN_NATIVE_DIR;
 const g=await loadNativeSkin(directory?path.join(directory,'shinobi.glb'):new URL('../public/models/shinobi.glb',import.meta.url));
 const groups=skinGroups(g),point=name=>g.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 const clips=g.animations.filter(c=>/^Twin_(Cut_|Heavy_|Musou_|Ready$)/.test(c.name));
 assert.equal(clips.length,10,'Cover all nine attacks and their shared ready pose');
 const boundaryBones=['Head','pelvis','spine_03','upperarm_r','upperarm_l','lowerarm_r','lowerarm_l','hand_r','hand_l','foot_r','foot_l'];
 g.mixer.clipAction(clips.find(c=>c.name==='Twin_Ready')).reset().play();g.mixer.update(0);g.scene.updateMatrixWorld(true);
 // The old procedural clips retain their common endpoints. Gameplay now blends
 // captured attacks into a separate relaxed ready pose.
 const legacy=clips.find(c=>c.name==='Twin_Cut_Diagonal');g.mixer.stopAllAction();g.mixer.clipAction(legacy).reset().play();g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const ready=Object.fromEntries(boundaryBones.map(name=>[name,point(name)]));
 const report=[];
 for(const clip of clips){
  g.mixer.stopAllAction();
  const action=g.mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
  const worst={clip:clip.name,inset:0,crossings:0,elbowSpeed:0},previous={};
  for(let i=0;i<=Math.ceil(clip.duration*120);i++){
   const seconds=Math.min(clip.duration,i/120);action.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   for(const side of ['r','l']){
    const skin=measureArmSkin(g,groups,side),relative=point('lowerarm_'+side).sub(point('upperarm_'+side));
    const dt=previous[side]?seconds-previous[side].seconds:0;
    const values={inset:skin['fold_'+side].maxRadialPenetration,crossings:skin['forearmTorso_'+side].pairs,elbowSpeed:dt>1e-7?relative.distanceTo(previous[side].relative)/dt:0};
    for(const key of Object.keys(values))if(values[key]>worst[key]){worst[key]=values[key];worst[key+'At']={seconds,side};}
    previous[side]={seconds,relative};
   }
  }
  worst.readyGap=Math.max(...boundaryBones.map(name=>point(name).distanceTo(ready[name])));
  report.push(worst);t.diagnostic(JSON.stringify(worst));
 }
 for(const worst of report){
  assert.ok(worst.inset<=.003,`Forearm folds into the upper-arm skin: ${JSON.stringify(worst)}`);
  assert.equal(worst.crossings,0,`Forearm intersects torso triangles: ${JSON.stringify(worst)}`);
  assert.ok(worst.elbowSpeed<=8,`Elbow reverses abruptly: ${JSON.stringify(worst)}`);
  if(worst.clip!=='Twin_Ready')assert.ok(worst.readyGap<=.003,`Attack ends outside its matching ready pose: ${JSON.stringify(worst)}`);
 }
});
