import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3,LoopOnce} from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {WARRIORS} from '../src/warriors.js';
import {validatePlanarRoot} from '../src/attack-root-motion.js';
const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
for(const warrior of WARRIORS)test(warrior.name+': active attacks cannot hide permanent forward travel inside the body',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+warrior.model+'.glb',import.meta.url)),pelvis=g.scene.getObjectByName('pelvis');
 const names=new Set(['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'].map(s=>{const key=(warrior.motionPrefix||'')+s;return warrior.motionOverrides?.[key]??key;}));
 const point=(clip,time)=>{g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).setLoop(LoopOnce,1).play();action.clampWhenFinished=true;action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);return pelvis.getWorldPosition(new Vector3());};
 for(const name of names){
  const clip=g.animations.find(c=>c.name===name);assert.ok(clip,name);const motion=motions[name];
  if(motion.planarRoot)validatePlanarRoot(motion.planarRoot);
  const start=point(clip,0),end=point(clip,clip.duration);
  assert.ok(Math.hypot(end.x-start.x,end.z-start.z)<.15,`${name}: permanent travel must move the gameplay root, not disappear on recovery`);
  if(motion.rootAnchor){const ready=g.animations.find(c=>c.name===motion.rootAnchor.clip);assert.ok(ready);const anchor=point(ready,0);assert.ok(Math.hypot(start.x-anchor.x,start.z-anchor.z)<1e-6,`${name}: displaced starting body`);}
 }
});
