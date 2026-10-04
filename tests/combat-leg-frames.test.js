import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {WARRIORS} from '../src/warriors.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../tools/native-leg-anatomy.mjs';
const root=new URL('../',import.meta.url).pathname;
const motions=JSON.parse(fs.readFileSync(process.env.NINJA_MOTION_RECORD||path.join(root,'src/motion-data.json')));
for(const model of ['kaede','ayame','sora'])test(`${model}: every standard attack preserves native knees without excessive hip or ankle twist`,async t=>{
 const hero=WARRIORS.find(w=>w.model===model),g=await loadNativeSkin(path.join(process.env.NINJA_KNEE_MODEL_DIR||path.join(root,'public/models'),model+'.glb')),b={};g.scene.traverse(n=>{if(n.isBone)b[n.name]=n;});g.scene.updateMatrixWorld(true);
 const calibration=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const names=[hero.readyClip,...['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'].map(n=>hero.motionOverrides?.[hero.motionPrefix+n]??hero.motionPrefix+n)],peak={hip:0,ankle:0,hinge:0,samples:0};
 for(const name of names){
  assert.equal(motions[name].nativeKneeHinges,true,name);assert.equal(motions[name].nativeKneeHeading,true,name);
  const clip=g.animations.find(c=>c.name===name);assert.ok(clip,name);g.mixer.stopAllAction();const a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
  for(let i=0;i<=Math.ceil(clip.duration*480);i++){
   const time=Math.min(i/480,clip.duration);a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   for(const side of ['r','l']){
    const m=measureLegAnatomy(calibration[side],b['thigh_'+side],b['calf_'+side],b['foot_'+side]),label=`${name} ${time} ${side} ${JSON.stringify(m)}`;
    peak.hip=Math.max(peak.hip,Math.abs(m.hipTwist));peak.ankle=Math.max(peak.ankle,Math.abs(m.ankleTwist));peak.hinge=Math.max(peak.hinge,m.kneeDeviation);peak.samples++;
    // Source motion uses the shoe's bind frame; retain a bounded ankle turn
    // while testing the same native knee and hip constraints.
    const ankleLimit=motions[name].nativeSourceMotion?22:15;
    assert.ok(Math.abs(m.hipTwist)<45&&Math.abs(m.ankleTwist)<ankleLimit&&m.kneeDeviation<.01,label);
    // These characters use the same reviewed UAL2 return lunge. It reaches
    // 124.47 degrees. Keep unrelated attacks at their existing 120 limit.
    const kneeLimit=['Hustler_Diagonal_Cut','Closer_Combo_Return','Closer_Combo_Finish','Ace_Combo_Return','Ace_Combo_Finish'].includes(name)?125:120;
    assert.ok(m.kneeFlexion>0&&m.kneeFlexion<kneeLimit,label);
   }
  }
 }
 t.diagnostic(JSON.stringify(peak));
});
