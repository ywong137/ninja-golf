import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {FacialPose,FACIAL_LIMITS} from '../src/facial-pose.js';
import {loadFace,measureFace} from '../tools/audit-facial-pose.mjs';

test('Authored musou expressions deform each face, retain both eyes, and restore the accepted likeness',async()=>{
 for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){
  const rig=await loadFace(hero),pose=new FacialPose(rig.bones,{identity:hero,model:rig.scene}),meter=measureFace(rig),rest=meter.measure();
  assert.ok(pose.morphs.length,`${hero}: authored face target is missing`);
  const brow=rig.bones.Bip01_RInnerEyebrow,restBrow=brow.position.clone();
  for(const weight of [.25,.5,.75,1]){
   pose.anger=weight;pose.apply(0,{musou:weight});const result=meter.measure();
   assert.equal(result.flippedTriangles,0,`${hero} at ${weight}: folded face surface`);
   assert.ok(result.penetrationIncrease<.0008,`${hero}: eyelid/eye overlap exceeds 0.8 mm`);
   for(const side of ['R','L'])assert.ok(result.eyes[side].openFraction>.60,`${hero}: ${side} eye closes`);
   assert.deepEqual(brow.position.toArray(),restBrow.toArray(),'The legacy bone frown must not stack on the authored expression');
   if(weight===1){assert.ok(result.regionDisplacement.mouth>.004,`${hero}: lips must visibly snarl`);assert.ok(result.openFraction<.85,`${hero}: eyes must visibly narrow`);}
   pose.restore();rig.update();assert.deepEqual(meter.measure(),rest,`${hero}: neutral likeness changed`);
  }
  for(const sign of [-1,1]){
   pose.yaw=sign*FACIAL_LIMITS.gazeYaw;pose.pitch=sign*FACIAL_LIMITS.gazePitch;pose.anger=1;pose.apply(0,{musou:1});
   const result=meter.measure();assert.equal(result.flippedTriangles,0,hero);for(const side of ['R','L'])assert.ok(result.eyes[side].openFraction>.60,`${hero}: gaze closes ${side} eye`);pose.restore();
  }
  pose.apply(.1,{musou:1});pose.apply(.1,{enabled:false});rig.update();assert.deepEqual(meter.measure(),rest,`${hero}: disabled expression does not restore`);
 }
});

test('Musou target does not move the costume or accumulate across repeated attacks',async()=>{
 const rig=await loadFace('sora'),pose=new FacialPose(rig.bones,{identity:'sora',model:rig.scene}),body=rig.meshes.find(m=>m.name==='Mesh');
 assert.ok(body);const before=body.getVertexPosition(0,new Vector3());
 for(let i=0;i<180;i++){pose.restore();pose.apply(1/60,{musou:1});}
 rig.update();assert.ok(before.distanceTo(body.getVertexPosition(0,new Vector3()))<1e-12);
 assert.ok(pose.morphs.every(m=>m.mesh.morphTargetInfluences[m.index]>.99));
 for(let i=0;i<180;i++){pose.restore();pose.apply(1/60,{musou:0});}
 assert.ok(pose.morphs.every(m=>m.mesh.morphTargetInfluences[m.index]<1e-9));
 pose.restore();assert.ok(pose.morphs.every(m=>m.mesh.morphTargetInfluences[m.index]===0));
});
