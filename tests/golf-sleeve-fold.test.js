import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {Quaternion,Vector3,LoopOnce} from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';
import {installForearmTwistHelpers} from '../src/forearm-twist.js';
import {captureSleeveShape,assertSleeveVolume,checkReviewedSleeve,intersectionSegmentLength} from './golf-sleeve-fold-helper.mjs';
const model=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,'monk.glb'):new URL('../public/models/monk.glb',import.meta.url);

test('The reviewed sleeve fold retains volume; added longitudinal twist fails',async()=>{
 const rig=await loadNativeSkin(model),surface=skinGroups(rig),bind=captureSleeveShape(rig,surface),helpers=installForearmTwistHelpers(rig.scene);
 try{
  const action=rig.mixer.clipAction(rig.animations.find(clip=>clip.name==='Golf_Swing')).reset().setLoop(LoopOnce,1).play();
  action.time=26/30;rig.mixer.update(0);helpers.update();
  assert.doesNotThrow(()=>assertSleeveVolume(bind,captureSleeveShape(rig,surface)));
  const lower=rig.scene.getObjectByName('lowerarm_l'),hand=rig.scene.getObjectByName('hand_l');
  const axis=lower.worldToLocal(hand.getWorldPosition(new Vector3())).normalize();
  lower.quaternion.multiply(new Quaternion().setFromAxisAngle(axis,170*Math.PI/180));helpers.update();
  assert.throws(()=>assertSleeveVolume(bind,captureSleeveShape(rig,surface)),/loses radius/);
 }finally{helpers.dispose();}
});

test('The sleeve edge check measures crossings even when every vertex is outside',()=>{
 const a=[[-2,-2,0],[2,-2,0],[0,2,0]].map(p=>new Vector3(...p));
 const b=[[0,0,-1],[0,-1,1],[0,1,1]].map(p=>new Vector3(...p));
 assert.ok(Math.abs(intersectionSegmentLength(a,b)-1)<1e-10);
 assert.equal(intersectionSegmentLength(a,b.map(p=>p.clone().add(new Vector3(10,0,0)))),0);
});

test('Vice President backswing keeps the reviewed sleeve crease within its measured bounds',async t=>{
 const rig=await loadNativeSkin(model),surface=skinGroups(rig),bind=captureSleeveShape(rig,surface),helpers=installForearmTwistHelpers(rig.scene);
 try{
  const clip=rig.animations.find(c=>c.name==='Golf_Swing'),times=new Set([23/30,1]);
  for(let i=368;i<=480;i++)times.add(i/480);
  for(const track of clip.tracks)for(let i=0;i<track.times.length;i++){
   const time=track.times[i];if(time>=23/30&&time<=1)times.add(time);
   if(i){const mid=(track.times[i-1]+time)/2;if(mid>=23/30&&mid<=1)times.add(mid);}
  }
  const action=rig.mixer.clipAction(clip).setLoop(LoopOnce).play();action.clampWhenFinished=true;
  let maxPairs=0,maxDepth=0;
  for(const time of times){
   action.time=time;rig.mixer.update(0);helpers.update();
   const fold=measureArmSkin(rig,surface,'l',{details:true}).fold_l;
   assert.equal(checkReviewedSleeve({hero:'monk',side:'l',frame:time*30,fold,bind,current:captureSleeveShape(rig,surface),surfaces:surface}),true);
   maxPairs=Math.max(maxPairs,fold.pairs);maxDepth=Math.max(maxDepth,fold.maxRadialPenetration);
  }
  t.diagnostic(JSON.stringify({samples:times.size,maxPairs,maxRadialProxy:maxDepth}));
 }finally{helpers.dispose();}
});
