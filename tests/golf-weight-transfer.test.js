import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';

test('Ace extends the lead leg through contact and finishes over its supporting foot',async()=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,'kaede.glb'):new URL('../public/models/kaede.glb',import.meta.url);
 const g=await loadNativeSkin(file),b={};g.scene.traverse(n=>{if(n.isBone)b[n.name]=n;});g.scene.updateMatrixWorld(true);
 const c=calibrateLegAnatomy(b.thigh_r,b.calf_r,b.foot_r),point=n=>b[n].getWorldPosition(new T.Vector3());
 const action=g.mixer.clipAction(g.animations.find(c=>c.name==='Golf_Swing')).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
 const samples=[1.25,1.4,1.5,1.8,2.4].map(time=>{
  action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  return{time,pelvis:point('pelvis'),support:point('thigh_r').sub(point('foot_r')),trailAnkle:point('foot_l'),knee:measureLegAnatomy(c,b.thigh_r,b.calf_r,b.foot_r).kneeFlexion};
 });
 const [before,impact,release,,finish]=samples;
 assert.ok(impact.knee>=20&&impact.knee<=35,'The lead leg must extend before impact without locking');
 assert.ok(release.knee>=12&&release.knee<=29,'The lead leg must support the release instead of staying crouched');
 assert.ok(finish.knee>=5&&finish.knee<=16,'The finish must stand on a softly extended lead leg');
 assert.ok(release.pelvis.y-before.pelvis.y>.025,'The pelvis must rise out of the downswing crouch');
 assert.ok(finish.pelvis.y-before.pelvis.y<.12,'The pelvis must not jump upward during the finish');
 for(const s of samples.slice(1))assert.ok(Math.abs(s.support.x)<.04&&Math.hypot(s.support.x,s.support.z)<.10,`The lead hip moves away from its supporting shoe at ${s.time}`);
 assert.ok(finish.trailAnkle.y-before.trailAnkle.y>.065,'The unloaded rear heel must lift as the body turns');
});
