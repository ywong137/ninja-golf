import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {extractPlanarRoot} from '../tools/extract-planar-root.mjs';
import {samplePlanarRoot} from '../src/attack-root-motion.js';

function rig(){
 const scene=new T.Group(),parent=new T.Group(),pelvis=new T.Bone(),hand=new T.Bone();
 parent.name='native_basis';parent.rotation.set(.1,.7,-.2);parent.position.set(.3,.4,-.2);parent.scale.setScalar(.8);
 pelvis.name='pelvis';pelvis.position.set(.2,1.2,.1);hand.name='hand';hand.position.set(.3,.4,.2);
 scene.add(parent);parent.add(pelvis);pelvis.add(hand);scene.updateMatrixWorld(true);
 const clip=new T.AnimationClip('step',1,[
  new T.VectorKeyframeTrack('pelvis.position',[0,.35,1],[.2,1.2,.1,.3,.8,.7,.1,1.3,1.4]),
  new T.QuaternionKeyframeTrack('pelvis.quaternion',[0,.35,1],[0,0,0,1,0,.247403959,0,.968912422,0,0,0,1]),
 ]);
 return{scene,parent,pelvis,hand,clip};
}
const pose=scene=>{const result=[];scene.traverse(o=>result.push([o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));return result;};
function play(scene,clip,time){const mixer=new T.AnimationMixer(scene),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce);action.clampWhenFinished=true;action.play();mixer.setTime(time);scene.updateMatrixWorld(true);return mixer;}

test('Extracted travel reconstructs every child under a rotated, scaled native parent',()=>{
 const original=rig(),before=pose(original.scene),source=original.clip.toJSON(),result=extractPlanarRoot(original.scene,original.clip);
 assert.deepEqual(pose(original.scene),before);assert.deepEqual(original.clip.toJSON(),source);
 for(let i=0;i<=100;i++){
  const a=rig(),b=rig(),t=i/100;
  play(a.scene,a.clip,t);play(b.scene,result.clip,t);const shift=samplePlanarRoot(result.path,t);b.scene.position.set(shift.x,0,shift.z);b.scene.updateMatrixWorld(true);
  for(const n of ['pelvis','hand']){
   const x=a[n].getWorldPosition(new T.Vector3()),y=b[n].getWorldPosition(new T.Vector3());assert.ok(x.distanceTo(y)<2e-7);
   assert.ok(a[n].getWorldQuaternion(new T.Quaternion()).angleTo(b[n].getWorldQuaternion(new T.Quaternion()))<1e-6);
  }
 }
});

test('Extraction rejects an animated parent and restores the supplied pose on failure',()=>{
 const g=rig(),before=pose(g.scene);g.clip.tracks.push(new T.VectorKeyframeTrack('native_basis.position',[0,1],[.3,.4,-.2,.5,.4,-.2]));
 assert.throws(()=>extractPlanarRoot(g.scene,g.clip),/parent moves/);assert.deepEqual(pose(g.scene),before);
 const hidden=rig();hidden.clip.tracks.push(new T.VectorKeyframeTrack('native_basis.position',[0,.17,.35,1],[.3,.4,-.2,.5,.4,-.2,.3,.4,-.2,.3,.4,-.2]));
 assert.throws(()=>extractPlanarRoot(hidden.scene,hidden.clip),/parent moves/);
});

test('Nonlinear, incomplete and duplicate pelvis keys cannot silently produce a path',()=>{
 const g=rig();g.clip.tracks[0].setInterpolation(T.InterpolateSmooth);assert.throws(()=>extractPlanarRoot(g.scene,g.clip),/linear pelvis/i);
 for(const times of [[.1,.35,1],[0,.35,.9],[0,.35,.35]]){const a=rig();a.clip.tracks[0].times=Float32Array.from(times);assert.throws(()=>extractPlanarRoot(a.scene,a.clip),/complete clip|increasing/);}
});

test('A ready anchor removes only the initial horizontal offset from the complete performance',()=>{
 const original=rig(),anchor={x:-.2,z:.4},result=extractPlanarRoot(original.scene,original.clip,{anchor});
 assert.deepEqual(result.path.rows[0],{time:0,x:0,z:0});
 for(let i=0;i<=100;i++){
  const a=rig(),b=rig(),t=i/100;
  play(a.scene,a.clip,t);play(b.scene,result.clip,t);const shift=samplePlanarRoot(result.path,t);b.scene.position.set(shift.x,0,shift.z);b.scene.updateMatrixWorld(true);
  for(const name of ['pelvis','hand']){
   const expected=a[name].getWorldPosition(new T.Vector3()).sub(new T.Vector3(result.offset.x,0,result.offset.z));
   assert.ok(expected.distanceTo(b[name].getWorldPosition(new T.Vector3()))<2e-7);
  }
  if(i===0){const p=b.pelvis.getWorldPosition(new T.Vector3());assert.ok(Math.abs(p.x-anchor.x)<2e-7&&Math.abs(p.z-anchor.z)<2e-7);}
 }
 assert.throws(()=>extractPlanarRoot(original.scene,original.clip,{anchor:{x:NaN,z:0}}),/finite world/);
});
