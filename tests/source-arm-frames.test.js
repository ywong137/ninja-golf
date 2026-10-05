import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,AnimationMixer,Bone,Group,Quaternion,QuaternionKeyframeTrack,Vector3} from 'three';
import {captureSourceArmHinges,createSourceArmFrames} from '../tools/source-arm-frames.mjs';
const Z=new Vector3(0,0,1),q=a=>new Quaternion().setFromAxisAngle(Z,a);
const point=b=>b.getWorldPosition(new Vector3());
function rig(bend=0,roll=0){
 const scene=new Group(),bones={};
 for(const [side,sign]of [['r',-1],['l',1]]){
  const upper=new Bone(),lower=new Bone(),hand=new Bone();upper.name='upperarm_'+side;lower.name='lowerarm_'+side;hand.name='hand_'+side;
  upper.position.set(sign*.2,1.4,0);scene.add(upper);upper.add(lower);lower.add(hand);
  upper.quaternion.setFromAxisAngle(new Vector3(sign,0,0),roll);lower.position.set(sign*.3,0,0);
  lower.quaternion.copy(upper.quaternion).invert().multiply(q(bend));hand.position.set(sign*.28,0,0);
  for(const b of [upper,lower,hand])bones[b.name]=b;
 }
 scene.updateMatrixWorld(true);return {scene,bones,mixer:new AnimationMixer(scene)};
}
function reference(){return new AnimationClip('bent',1,['r','l'].map(s=>new QuaternionKeyframeTrack('lowerarm_'+s+'.quaternion',[0,1],[...q(.6).toArray(),...q(1.2).toArray()])));}
const directions=(bones,s)=>[point(bones['lowerarm_'+s]).sub(point(bones['upperarm_'+s])).normalize(),point(bones['hand_'+s]).sub(point(bones['lowerarm_'+s])).normalize()];

test('Near-straight elbow noise cannot determine the signed reference plane',()=>{
 const source=rig(1e-10),target=rig(.35);
 source.bones.lowerarm_l.quaternion.copy(q(-1e-10));source.scene.updateMatrixWorld(true);
 assert.throws(()=>createSourceArmFrames(source.scene,target.scene),/bent-pose reference/);
 const hinges=captureSourceArmHinges(source,reference(),.5);
 for(const side of ['r','l'])assert.ok(hinges[side].dot(Z)>1-1e-10);
});

test('Bent reference keeps elbow direction across bind rolls and full-body turns',()=>{
 const source=rig(1e-10),target=rig(.35,1.3),hinges=captureSourceArmHinges(source,reference());
 const transfer=createSourceArmFrames(source.scene,target.scene,{sourceHinges:hinges});
 const targetHinges=Object.fromEntries(['r','l'].map(s=>{const [u,v]=directions(target.bones,s);return [s,u.cross(v).normalize().applyQuaternion(target.bones['upperarm_'+s].getWorldQuaternion(new Quaternion()).invert())];}));
 for(const angle of [.05,.6,1.8]){
  source.scene.rotation.set(.2,angle,-.3);target.scene.rotation.set(-.1,.7,.2);
  for(const s of ['r','l']){source.bones['upperarm_'+s].rotation.set(.3,-.2,.4);source.bones['lowerarm_'+s].quaternion.copy(q(angle));}
  source.scene.updateMatrixWorld(true);target.scene.updateMatrixWorld(true);transfer.apply();
  for(const s of ['r','l']){
   const a=directions(source.bones,s),b=directions(target.bones,s);a.forEach((d,i)=>assert.ok(d.distanceTo(b[i])<1e-7));
   const normal=b[0].clone().cross(b[1]).normalize(),hinge=targetHinges[s].clone().applyQuaternion(target.bones['upperarm_'+s].getWorldQuaternion(new Quaternion()));assert.ok(normal.dot(hinge)>1-1e-7);
  }
 }
});

test('Reference sampling preserves all source transforms and existing action state',()=>{
 const source=rig(),clip=reference(),action=source.mixer.clipAction(clip).play();action.time=.27;action.weight=.42;
 source.scene.position.set(4,2,-1);source.scene.scale.setScalar(.8);source.scene.updateMatrixWorld(true);
 const saved=[];source.scene.traverse(b=>saved.push([b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]));
 captureSourceArmHinges(source,clip,.7);
 for(const [b,p,q,s]of saved){assert.deepEqual(b.position,p);assert.deepEqual(b.quaternion.toArray(),q.toArray());assert.deepEqual(b.scale,s);}
 assert.equal(action.time,.27);assert.equal(action.weight,.42);assert.ok(action.isRunning());
});

test('Invalid or straight references fail and restore the scene',()=>{
 const source=rig(),clip=new AnimationClip('straight',1,[]),before=source.bones.lowerarm_r.quaternion.clone();
 assert.throws(()=>captureSourceArmHinges(source,clip),/bend 15/);assert.deepEqual(source.bones.lowerarm_r.quaternion.toArray(),before.toArray());
 for(const time of [-1,2,NaN])assert.throws(()=>captureSourceArmHinges(source,reference(),time),/in-range/);
 for(const hinge of [new Vector3(NaN,0,1),new Vector3(),new Vector3(1,0,0)])assert.throws(()=>createSourceArmFrames(source.scene,rig(.35).scene,{sourceHinges:{r:hinge,l:Z}}),/finite|degenerate/);
});
