import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../tools/native-leg-anatomy.mjs';
import {headingKnee,kneeBendOffset} from '../src/knee-alignment.js';
const names=['Ronin_Ready','Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Ronin_Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam'];

test('Ronin ready and eight attacks preserve native knee hinges without excess hip or ankle twist',async t=>{
 const g=await loadNativeSkin(new URL('../public/models/ronin.glb',import.meta.url)),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o});g.scene.updateMatrixWorld(true);
 const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const peak={hip:0,ankle:0,knee:0,samples:0};
 for(const name of names){
  assert.equal(motions[name].nativeKneeHinges,true);assert.equal(motions[name].nativeKneeHeading,true);
  g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
  for(let i=0;i<=Math.ceil(clip.duration*480);i++){
   const time=Math.min(i/480,clip.duration);a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   for(const s of ['r','l']){
    const m=measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);peak.samples++;
    peak.hip=Math.max(peak.hip,Math.abs(m.hipTwist));peak.ankle=Math.max(peak.ankle,Math.abs(m.ankleTwist));peak.knee=Math.max(peak.knee,m.kneeDeviation);
    assert.ok(Math.abs(m.hipTwist)<36&&Math.abs(m.ankleTwist)<10&&m.kneeDeviation<.1,`${name} ${time} ${s}: ${JSON.stringify(m)}`);
    assert.ok(m.kneeFlexion>0&&m.kneeFlexion<120,`${name}: backward or overfolded knee`);
   }
  }
 }
 t.diagnostic(JSON.stringify(peak));
});

test('Terrain adaptation retains the authored knee plane instead of restoring a zero-offset pole',()=>{
 const hip=new T.Vector3(.15,.85,0),ankle=new T.Vector3(.42,.09,.17),forward=new T.Vector3(.25,0,1).normalize();
 for(const angle of [-.2,0,.2])for(const rotation of [0,.8,2.7]){
  const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),rotation),h=hip.clone().applyQuaternion(q),f=ankle.clone().applyQuaternion(q),direction=forward.clone().applyQuaternion(q);
  const k=headingKnee(h,f,.45,.43,direction,angle),offset=kneeBendOffset(h,k,f,direction);
  assert.ok(Math.abs(offset-angle)<1e-8);
  const raised=f.clone().add(new T.Vector3(0,.08,0)),next=headingKnee(h,raised,.45,.43,direction,offset);
  assert.ok(Math.abs(kneeBendOffset(h,next,raised,direction)-angle)<1e-8);
  assert.ok(Math.abs(next.distanceTo(h)-.45)<1e-8&&Math.abs(next.distanceTo(raised)-.43)<1e-8);
 }
});
