import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {ENEMY_TYPES} from '../src/combat.js';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';

test('The one-sword scout has one matching damage event and a clear empty-hand guard',async t=>{
 const spec=ENEMY_TYPES[0],source=JSON.parse(readFileSync(new URL('../src/enemy-motion.json',import.meta.url)))[spec.clip];
 assert.equal(spec.clip,'Ninja_Stepping_Cut');assert.equal(spec.dualWield,false);assert.equal(source.twoHanded,false);
 assert.equal(source.impacts.length,1);assert.equal(spec.hits.length,1);
 assert.ok(Math.abs(spec.hits[0]-source.impacts[0]/source.duration*spec.duration)<1e-8,'Damage must coincide with the visible sword strike');
 const g=await loadNativeSkin(new URL('../public/models/enemy-cloth-ninja.glb',import.meta.url)),groups=skinGroups(g);
 const clip=g.animations.find(c=>c.name===spec.clip);assert.ok(clip);
 assert.ok(!g.animations.some(c=>c.name==='Twin_Cut_Diagonal'),'Scout must not retain the obsolete paired-sword attack');
 const a=g.mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();a.clampWhenFinished=true;
 const point=n=>g.scene.getObjectByName(n).getWorldPosition(new THREE.Vector3()),worst={inset:0,crossings:0,elbowSpeed:0,upperAngularSpeed:{r:0,l:0}},previous={};
 for(let i=0;i<=Math.ceil(clip.duration*120);i++){
  const seconds=Math.min(clip.duration,i/120);a.time=seconds;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  for(const side of ['r','l']){
   const skin=measureArmSkin(g,groups,side),relative=point('lowerarm_'+side).sub(point('upperarm_'+side)),old=previous[side],dt=old?seconds-old.seconds:0;
   worst.inset=Math.max(worst.inset,skin['fold_'+side].maxRadialPenetration);
   worst.crossings=Math.max(worst.crossings,skin['forearmTorso_'+side].pairs);
   if(dt>1e-7){worst.elbowSpeed=Math.max(worst.elbowSpeed,relative.distanceTo(old.relative)/dt);worst.upperAngularSpeed[side]=Math.max(worst.upperAngularSpeed[side],relative.angleTo(old.relative)/dt);}
   previous[side]={seconds,relative};
  }
 }
 t.diagnostic(JSON.stringify(worst));
 assert.ok(worst.inset<=.003,'Scout forearm folds into its upper-arm skin');
 assert.equal(worst.crossings,0,'Scout forearm intersects the torso');
 // The new full-body cut rotates faster than the former short arm stroke.
 // Compare angular speed with UAL2 Sword_Regular_A, measured at 240 Hz,
 // instead of retaining a world-speed limit fitted to the discarded motion.
 const sourcePeak={r:54.706115,l:43.019981};
 for(const side of ['r','l'])assert.ok(worst.upperAngularSpeed[side]<=sourcePeak[side]*1.03,'Retargeting added an elbow discontinuity on '+side);
});
