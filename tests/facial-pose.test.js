import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {FacialPose,FACIAL_LIMITS} from '../src/facial-pose.js';
import {loadFace,measureFace} from '../tools/audit-facial-pose.mjs';

test('Native facial overlay restores animated transforms and never accumulates',async()=>{
 const {bones}=await loadFace('kaede'),pose=new FacialPose(bones),before=new Map(pose.entries.map(e=>[e.bone,[e.bone.position.clone(),e.bone.quaternion.clone()]]));
 for(let frame=0;frame<240;frame++){pose.restore();for(const [b,[p,q]]of before){assert.ok(b.position.distanceTo(p)<1e-12);assert.deepEqual(b.quaternion.toArray(),q.toArray());}pose.apply(1/60,{gazeYaw:100,gazePitch:-100,exertion:2,musou:2});}
 assert.ok(pose.yaw<=FACIAL_LIMITS.gazeYaw);assert.ok(pose.pitch>=-FACIAL_LIMITS.gazePitch);assert.ok(pose.effort<=1);pose.restore();
 const eye=bones.Bip01_REye;eye.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.05));const animated=eye.quaternion.clone();pose.apply(1/60,{exertion:1});pose.restore();assert.ok(1-Math.abs(eye.quaternion.dot(animated))<1e-12);
 pose.apply(1/60,{gazeYaw:NaN,gazePitch:Infinity});pose.apply(1/60,{enabled:false});assert.ok(1-Math.abs(eye.quaternion.dot(animated))<1e-12);
});

test('All six native faces retain eye clearance and triangle orientation at facial limits',async()=>{
 // Reviewed narrower eyelids preserve Ethan's likeness and The Closer's glare.
 const minimumAperture={monk:.92,sora:.80};
 for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){
  const rig=await loadFace(hero),pose=new FacialPose(rig.bones,{identity:hero}),meter=measureFace(rig),rest=meter.measure();assert.ok(rest.restSamples>400,`${hero}: aperture sampler must see both eyes`);assert.ok(meter.eyeTriangles>200);
  for(const [yawSign,pitchSign]of [[-1,-1],[-1,1],[1,-1],[1,1]]){for(let frame=0;frame<90;frame++){pose.restore();pose.apply(1/60,{gazeYaw:yawSign*FACIAL_LIMITS.gazeYaw,gazePitch:pitchSign*FACIAL_LIMITS.gazePitch,exertion:1,musou:1});}const result=meter.measure();assert.equal(result.flippedTriangles,0,hero);assert.ok(result.penetrationIncrease<.0005,`${hero}: eye clearance regression ${result.penetrationIncrease}`);assert.ok(result.maxLidDisplacement<.0015,hero);assert.ok(result.maxLongEdgeStretch<1.5,`${hero}: facial edge stretch ${result.maxLongEdgeStretch}`);assert.ok(result.minEdgeRatio>.5,`${hero}: facial edge compression ${result.minEdgeRatio}`);assert.ok(result.openFraction>(minimumAperture[hero]??.95),`${hero}: eye aperture ${result.openFraction}`);}
  pose.restore();rig.update();assert.deepEqual(meter.measure(),rest);
 }
});

test('Expression moves real jaw vertices while preserving unowned facial bones',async()=>{
 const rig=await loadFace('ronin'),pose=new FacialPose(rig.bones),jaw=rig.bones.Bip01_MJaw,lid=rig.bones.Bip01_REyeBlinkTop,restLid=lid.position.clone();
 const mesh=rig.meshes.find(m=>m.name==='Mesh_1'),joint=mesh.skeleton.bones.indexOf(jaw),si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;let vertex=-1;for(let i=0;i<si.count;i++){for(let k=0;k<4;k++)if(si.getComponent(i,k)===joint&&sw.getComponent(i,k)>.8)vertex=i;if(vertex>=0)break;}assert.ok(vertex>=0);
 const before=mesh.getVertexPosition(vertex,new Vector3());for(let i=0;i<90;i++){pose.restore();pose.apply(1/60,{exertion:1});}rig.update();const distance=before.distanceTo(mesh.getVertexPosition(vertex,new Vector3()));assert.ok(distance>.0001&&distance<.003);assert.deepEqual(lid.position.toArray(),restLid.toArray());
});
