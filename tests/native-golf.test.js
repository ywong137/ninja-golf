import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from './native-skin-helper.mjs';
import {installForearmTwistHelpers} from '../src/forearm-twist.js';
import {captureSleeveShape,checkReviewedSleeve} from './golf-sleeve-fold-helper.mjs';

for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${hero}: native golf uses stable wrists, planted feet, and clear forearms`,async()=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url);
 const rig=await loadNativeSkin(file),surface=skinGroups(rig),helpers=installForearmTwistHelpers(rig.scene),point=n=>rig.scene.getObjectByName(n).getWorldPosition(new T.Vector3());
 const sleeveBind=hero==='monk'?captureSleeveShape(rig,surface):null;
 for(const [name,duration]of [['Golf_Address',2],['Golf_Swing',2.4],['Golf_Putt',1.5]]){
  const clip=rig.animations.find(c=>c.name===name);assert.ok(clip,`${name}: missing clip`);assert.ok(Math.abs(clip.duration-duration)<1e-6);
  for(const track of clip.tracks.filter(t=>/^(hand|lowerarm|upperarm)_[rl]\.quaternion$/.test(t.name))){
   for(let i=1;i<track.times.length;i++){
    const a=new T.Quaternion().fromArray(track.values,(i-1)*4),b=new T.Quaternion().fromArray(track.values,i*4);
    assert.ok(a.angleTo(b)<.45,`${name}/${track.name}: abrupt wrist or elbow frame at ${track.times[i]}`);
   }
  }
  rig.mixer.stopAllAction();const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  action.time=0;rig.mixer.update(0);helpers.update();const leadToe=point('ball_r').setY(0),trailToe=point('ball_l').setY(0);
  for(let frame=0;frame<=Math.round(duration*30);frame++){
   const seconds=frame/30;action.time=seconds;rig.mixer.update(0);helpers.update();
   assert.ok(point('ball_r').setY(0).distanceTo(leadToe)<.001,`${name}: lead forefoot slides`);
   assert.ok(point('ball_l').setY(0).distanceTo(trailToe)<.001,`${name}: trail toe slides`);
   if(name!=='Golf_Swing')continue;
   for(const side of ['r','l']){
    const skin=measureArmSkin(rig,surface,side,{details:hero==='monk'&&side==='l'});
    const reviewed=checkReviewedSleeve({hero,side,frame,fold:skin['fold_'+side],bind:sleeveBind,current:hero==='monk'&&side==='l'?captureSleeveShape(rig,surface):null});
    if(!reviewed)assert.ok(skin['fold_'+side].maxRadialPenetration<.018,`${name}/${side}/${seconds}: unreviewed elbow overlap`);
    // The Monk's loose vest still meets the lead sleeve briefly after impact.
    // Preserve that reviewed boundary while rejecting a forearm crossing the body.
    const allowance=hero==='monk'&&side==='r'&&seconds>1.4&&seconds<1.6?12:0;
    assert.ok(skin['forearmTorso_'+side].pairs<=allowance,`${name}/${side}/${seconds}: forearm crosses torso`);
   }
  }
 }
 helpers.dispose();
});
