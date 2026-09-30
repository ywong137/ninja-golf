import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';

test('Ace completes the high golf finish with the shaft lowered behind the head',async t=>{
  const file=process.env.NINJA_GOLF_MODEL_DIR
    ?path.join(process.env.NINJA_GOLF_MODEL_DIR,'kaede.glb')
    :new URL('../public/models/kaede.glb',import.meta.url);
  const g=await loadNativeSkin(file),point=n=>g.scene.getObjectByName(n).getWorldPosition(new T.Vector3());
  g.scene.updateMatrixWorld(true);
  const armLength=point('lowerarm_r').distanceTo(point('upperarm_r'))+point('hand_r').distanceTo(point('lowerarm_r'));
  const clip=g.animations.find(c=>c.name==='Golf_Swing');
  const action=g.mixer.clipAction(clip).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
  const frame=new T.Quaternion().fromArray(JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).kaede.golf.r.frame);
  let maximumShaftY=-Infinity,maximumElbowSpeed=0,previous=null;
  for(let i=0;i<=144;i++){
    const time=1.8+i/240;action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
    const elbows=['r','l'].map(s=>point('lowerarm_'+s));
    if(previous)for(let j=0;j<2;j++)maximumElbowSpeed=Math.max(maximumElbowSpeed,elbows[j].distanceTo(previous[j])*240);
    previous=elbows;
    if(time<2.25)continue;
    const hand=g.scene.getObjectByName('hand_r');
    const shaft=new T.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()).multiply(frame));
    const center=point('hand_r').add(point('hand_l')).multiplyScalar(.5);
    const shoulders=point('upperarm_r').add(point('upperarm_l')).multiplyScalar(.5);
    const elevation=(center.y-shoulders.y)/armLength;
    // This is the reviewed high finish, not a rule for every golf style.
    // The old animation stopped with the shaft rising in front of the head.
    assert.ok(shaft.y<0&&shaft.y>-.35,'Club has not settled into the lowered finish.');
    assert.ok(elevation>.45&&elevation<.85,'Hands lost the high, folded finish.');
    maximumShaftY=Math.max(maximumShaftY,shaft.y);
  }
  assert.ok(maximumElbowSpeed<3,'Elbow jumps while folding into the finish.');
  t.diagnostic(JSON.stringify({maximumShaftY,maximumElbowMetresPerSecond:maximumElbowSpeed}));
});
