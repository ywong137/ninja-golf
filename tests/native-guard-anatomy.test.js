import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {WARRIORS} from '../src/warriors.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations} from '../tools/native-arm-anatomy.mjs';

const records=JSON.parse(fs.readFileSync(process.env.NINJA_GUARD_RECORD||new URL('../src/motion-data.json',import.meta.url)));
for(const hero of WARRIORS)test(`${hero.model}: every guard uses native elbow hinges and bounded wrists`,async t=>{
 const candidate=process.env.NINJA_GUARD_MODEL_DIR&&path.join(process.env.NINJA_GUARD_MODEL_DIR,hero.model+'.glb');
 const rig=await loadNativeSkin(candidate&&fs.existsSync(candidate)?candidate:new URL('../public/models/'+hero.model+'.glb',import.meta.url));
 const bones={};rig.scene.traverse(b=>{if(b.isBone)bones[b.name]=b});
 const calibration=Object.fromEntries(['r','l'].map(side=>[side,calibrateArmAnatomy(captureArmPose(bones,side))]));
 const neutral=Object.fromEntries(['r','l'].map(side=>[side,bones['hand_'+side].quaternion.clone().normalize()]));
 const clips=rig.animations.filter(c=>/_Guard_(Loop|Impact|Break|Walk_(Forward|Backward|Right|Left))$/.test(c.name));
 assert.equal(clips.length,7,'Cover waiting, both reactions, and all four travel directions');
 const worst={samples:0,wrist:0,hinge:0,forearm:0,shoulder:0};
 for(const clip of clips){
  const record=records[clip.name];assert.equal(record?.nativeAttachment,true,clip.name+' still uses legacy wrist aiming');
  rig.mixer.stopAllAction();const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  for(let frame=0;frame<=Math.ceil(clip.duration*120);frame++){
   action.time=Math.min(frame/120,clip.duration);rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
   for(const side of ['r','l']){
    const m=measureArmAnatomy(calibration[side],captureArmPose(bones,side));
    const wrist=bones['hand_'+side].quaternion.clone().normalize().angleTo(neutral[side])*180/Math.PI;
    // Guard grips permit pronation up to 80 degrees. The attack authoring
    // bounds stay separate; a guard must never inherit an attack's extremes.
    assert.deepEqual(armAuthoringViolations(m,{maxForearmTwistDegrees:80,maxHingeDeviationDegrees:.1}),[],`${hero.model}/${clip.name}/${action.time}/${side}`);
    assert.ok(wrist<30,`${hero.model}/${clip.name}/${action.time}/${side}: wrist ${wrist.toFixed(2)} degrees`);
    worst.samples++;worst.wrist=Math.max(worst.wrist,wrist);worst.hinge=Math.max(worst.hinge,m.hingeDeviationDegrees);
    worst.forearm=Math.max(worst.forearm,Math.abs(m.forearmTwistDegrees));worst.shoulder=Math.max(worst.shoulder,Math.abs(m.humeralRollDegrees));
   }
  }
 }
 t.diagnostic(JSON.stringify(worst));
});
