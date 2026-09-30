import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';

const grips=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${hero}: head and club settle without repeated rebounds at the golf finish`,async t=>{
  const file=process.env.NINJA_GOLF_MODEL_DIR
    ?path.join(process.env.NINJA_GOLF_MODEL_DIR,hero+'.glb')
    :new URL('../public/models/'+hero+'.glb',import.meta.url);
  const g=await loadNativeSkin(file),clip=g.animations.find(c=>c.name==='Golf_Swing');
  const action=g.mixer.clipAction(clip).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
  const head=g.scene.getObjectByName('Head'),hand=g.scene.getObjectByName('hand_r');
  const grip=new T.Quaternion().fromArray(grips[hero].golf.r.frame);
  let previous=null,headTravel=0,shaftTravel=0;
  // The last 0.3 seconds are a settling pose. Total angular travel catches
  // back-and-forth movement that identical start/end poses would conceal.
  for(let i=0;i<=72;i++){
    action.time=2.1+i/240;g.mixer.update(0);g.scene.updateMatrixWorld(true);
    const rotation=head.getWorldQuaternion(new T.Quaternion());
    const shaft=new T.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()).multiply(grip));
    if(previous){headTravel+=rotation.angleTo(previous.rotation);shaftTravel+=shaft.angleTo(previous.shaft);}
    previous={rotation,shaft};
  }
  const degrees=180/Math.PI;headTravel*=degrees;shaftTravel*=degrees;
  t.diagnostic(JSON.stringify({headTravelDegrees:headTravel,shaftTravelDegrees:shaftTravel}));
  assert.ok(headTravel<20,`${hero}: the head travels ${headTravel.toFixed(1)} degrees during the final hold`);
  assert.ok(shaftTravel<20,`${hero}: the shaft travels ${shaftTravel.toFixed(1)} degrees during the final hold`);
  if(hero==='ronin'){
    const elbow=g.scene.getObjectByName('lowerarm_l');let previous=null,peakSpeed=0;
    for(let i=0;i<=144;i++){
      action.time=1.8+i/240;g.mixer.update(0);g.scene.updateMatrixWorld(true);
      const point=elbow.getWorldPosition(new T.Vector3());
      if(previous)peakSpeed=Math.max(peakSpeed,point.distanceTo(previous)*240);
      previous=point;
    }
    t.diagnostic(JSON.stringify({lateElbowPeakMetresPerSecond:peakSpeed}));
    assert.ok(peakSpeed<2.5,`Ronin's elbow jerks during the finish: ${peakSpeed.toFixed(2)} m/s`);
  }
});
