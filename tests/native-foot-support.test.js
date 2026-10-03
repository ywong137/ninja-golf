import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {bakeNativeFootSupport} from '../tools/bake-native-foot-support.mjs';
import {samplePlanarRoot} from '../src/attack-root-motion.js';

const record=new URL(process.env.NINJA_MOTION_RECORD||'../src/motion-data.json',import.meta.url);
const motions=JSON.parse(fs.readFileSync(record));
const modelPath=hero=>process.env.NINJA_KNEE_MODEL_DIR?path.join(process.env.NINJA_KNEE_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url);
function player(g,clip){
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 return time=>{action.time=Math.min(time,clip.duration);g.mixer.update(0);const root=motions[clip.name]?.planarRoot?samplePlanarRoot(motions[clip.name].planarRoot,time):{x:0,z:0};g.scene.position.set(root.x,0,root.z);g.scene.updateMatrixWorld(true);};
}

for(const [hero,prefix]of [['sora','Sickle_'],['kaede','Fan_']])test(`${hero}: retimed attacks retain support through exact lift and landing boundaries`,async t=>{
 const g=await loadNativeSkin(modelPath(hero)),point=n=>g.scene.getObjectByName(n).getWorldPosition(new T.Vector3());
 const worst={drift:0,turn:0,kneeSpeed:0,ankleSpeed:0};let intervals=0;
 for(const clip of g.animations.filter(c=>c.name.startsWith(prefix)&&/_(Cut|Heavy|Musou)/.test(c.name))){
  const spec=motions[clip.name],sample=player(g,clip);
  for(const side of ['r','l'])for(const [start,end]of spec.footPlants[side]){
   sample(start);const ankle=point('foot_'+side),foot=g.scene.getObjectByName('foot_'+side),rotation=foot.getWorldQuaternion(new T.Quaternion()).normalize();intervals++;
   const times=[...new Set([start,end,...Array.from({length:Math.ceil((end-start)*480)},(_,i)=>Math.min(end,start+i/480))])].sort((a,b)=>a-b);
   for(const time of times){sample(time);worst.drift=Math.max(worst.drift,ankle.distanceTo(point('foot_'+side)));worst.turn=Math.max(worst.turn,rotation.angleTo(foot.getWorldQuaternion(new T.Quaternion()).normalize()));}
  }
  const previous={};
  for(let frame=0;frame<=Math.ceil(spec.duration*480);frame++){
   const time=Math.min(frame/480,spec.duration);sample(time);
   for(const side of ['r','l']){const knee=point('calf_'+side),ankle=point('foot_'+side),old=previous[side];if(old){const dt=time-old.time;worst.kneeSpeed=Math.max(worst.kneeSpeed,knee.distanceTo(old.knee)/dt);worst.ankleSpeed=Math.max(worst.ankleSpeed,ankle.distanceTo(old.ankle)/dt);}previous[side]={time,knee,ankle};}
  }
 }
 t.diagnostic(JSON.stringify({intervals,...worst}));
 assert.ok(intervals>=20,'Exercise the complete attack family, including both feet.');
 assert.ok(worst.drift<=.003,'A foot moves before its declared support ends: '+worst.drift);
 assert.ok(worst.turn<=.020,'A planted sole turns during support: '+worst.turn);
 assert.ok(worst.kneeSpeed<=12&&worst.ankleSpeed<=12,'Support correction creates an abrupt leg movement.');
});

test('support baking preserves the body, arms, golf, and model data',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ninja-support-regression-'));
 try{
  const input=modelPath('sora'),output=path.join(folder,'sora.glb'),name='Sickle_Cut_Diagonal';
  const report=await bakeNativeFootSupport({model:input,output,record,clips:[name]});
  const original=await loadNativeSkin(input);
  assert.equal(report.preservation.preservedAnimations,original.animations.length-1);
  assert.ok(report.preservation.preservedChannels>200,'Preserve the non-leg channels inside the changed clip.');
  const before=await loadNativeSkin(input),after=await loadNativeSkin(output),sampleBefore=player(before,before.animations.find(c=>c.name===name)),sampleAfter=player(after,after.animations.find(c=>c.name===name));
  for(let frame=0;frame<=120;frame++){
   const time=motions[name].duration*frame/120;sampleBefore(time);sampleAfter(time);
   for(const bone of ['pelvis','spine_03','Head','upperarm_r','lowerarm_r','hand_r','hand_l']){
    const a=before.scene.getObjectByName(bone),b=after.scene.getObjectByName(bone);
    assert.ok(a.getWorldPosition(new T.Vector3()).distanceTo(b.getWorldPosition(new T.Vector3()))<1e-9,bone+' position changed');
    assert.ok(a.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(b.getWorldQuaternion(new T.Quaternion()).normalize())<1e-6,bone+' rotation changed');
   }
  }
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
