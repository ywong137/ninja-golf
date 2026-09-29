import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3,LoopOnce} from 'three';
import {loadNativeSkin,skinGroups} from './native-skin-helper.mjs';
import {installForearmTwistHelpers} from '../src/forearm-twist.js';
import {captureSleeveShape,assertSleeveVolume} from './golf-sleeve-fold-helper.mjs';

test('The reviewed sleeve fold retains volume; added longitudinal twist fails',async()=>{
 const rig=await loadNativeSkin(new URL('../public/models/monk.glb',import.meta.url)),surface=skinGroups(rig),bind=captureSleeveShape(rig,surface),helpers=installForearmTwistHelpers(rig.scene);
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
