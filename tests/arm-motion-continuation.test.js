import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,AnimationMixer,Bone,Quaternion,QuaternionKeyframeTrack,VectorKeyframeTrack,LoopOnce} from 'three';
import {ArmMotionContinuation} from '../src/arm-motion-continuation.js';

const q=(angle=0)=>new Quaternion().setFromAxisAngle({x:0,y:0,z:1},angle).toArray();
const turn=(bone,a=0,b=a)=>new QuaternionKeyframeTrack(bone+'.quaternion',[0,1],[...q(a),...q(b)]);
function fixture(extra=[]){
 const bones={spine_03:new Bone(),neck_01:new Bone()};bones.spine_03.name='spine_03';bones.spine_03.add(bones.neck_01);
 for(const side of ['r','l']){
  let parent=bones.neck_01;
  for(const part of ['clavicle','upperarm','lowerarm','hand']){
   const bone=new Bone();bone.name=part+'_'+side;bone.position.y=.2;parent.add(bone);bones[bone.name]=bone;parent=bone;
  }
 }
 const rest=new Map(Object.values(bones).map(bone=>[bone,{position:bone.position.clone(),quaternion:bone.quaternion.clone(),scale:bone.scale.clone()}]));
 const mixer=new AnimationMixer(bones.spine_03),clip=new AnimationClip('cut',1,[turn('upperarm_r',0,.6),turn('upperarm_l',0,.6),...extra]);
 const action=mixer.clipAction(clip).setLoop(LoopOnce,1);action.clampWhenFinished=true;
 return{bones,rest,mixer,clip,action,layer:new ArmMotionContinuation(bones,rest)};
}
test('The arms follow incoming time while the chest retains its blended motion',()=>{
 const f=fixture([turn('spine_03',0,.2)]),guard=f.mixer.clipAction(new AnimationClip('guard',1,[turn('spine_03',.5),turn('upperarm_r'),turn('upperarm_l')]));
 guard.play();f.mixer.update(0);
 assert.equal(f.layer.begin(f.action,0,.07),true);
 guard.fadeOut(.07);f.action.reset().play().fadeIn(.07);f.mixer.update(.035);
 const before=f.bones.upperarm_r.quaternion.clone(),chest=f.bones.spine_03.quaternion.clone();
 assert.ok(before.angleTo(new Quaternion().fromArray(q(.6*f.action.time)))>1e-3);
 f.layer.apply(f.mixer.time);
 assert.ok(f.bones.upperarm_r.quaternion.angleTo(new Quaternion().fromArray(q(.6*f.action.time)))<1e-7);
 assert.deepEqual(f.bones.spine_03.quaternion.toArray(),chest.toArray());
 f.layer.apply(f.mixer.time);f.layer.restore();
 assert.deepEqual(f.bones.upperarm_r.quaternion.toArray(),before.toArray());
 f.mixer.update(.04);const final=f.bones.upperarm_r.quaternion.clone();f.layer.apply(f.mixer.time);
 assert.equal(f.layer.active,null);assert.deepEqual(f.bones.upperarm_r.quaternion.toArray(),final.toArray());
});
test('Missing arm channels use the captured bind transform and cannot hide a changed wrist',()=>{
 const f=fixture();
 assert.equal(f.layer.begin(f.action,0,.1),true);f.layer.clear();
 for(const [property,value]of [['quaternion',new Quaternion().fromArray(q(.02))],['position',f.bones.hand_l.position.clone().addScalar(.001)],['scale',f.bones.hand_l.scale.clone().multiplyScalar(.99)]]){
  f.bones.hand_l[property].copy(value);assert.equal(f.layer.begin(f.action,0,.1),false);
  f.bones.hand_l[property].copy(f.rest.get(f.bones.hand_l)[property]);
 }
 f.action.play();f.bones.hand_l.position.x=.03;f.layer.begin(f.action,0,.1);
 assert.equal(f.layer.active,null);
});
test('Both arms require the same chest parent and native joint order',()=>{
 for(const name of ['clavicle_l','upperarm_r','hand_l']){
  const f=fixture();new Bone().add(f.bones[name]);
  assert.equal(new ArmMotionContinuation(f.bones,f.rest).begin(f.action,0,.1),false);
 }
 const f=fixture();f.rest.delete(f.bones.hand_r);
 assert.equal(new ArmMotionContinuation(f.bones,f.rest).begin(f.action,0,.1),false);
});
test('Stop, interruption, and explicit clear restore the mixer pose',()=>{
 for(const cancel of [f=>f.action.stop(),f=>{f.action.enabled=false;},f=>f.layer.clear()]){
  const f=fixture();assert.equal(f.layer.begin(f.action,0,.1),true);f.action.play();f.mixer.update(.05);
  const underlying=f.bones.hand_l.position.clone();f.bones.hand_l.position.x=.03;const changed=f.bones.hand_l.position.clone();
  f.layer.apply(.05);assert.deepEqual(f.bones.hand_l.position.toArray(),underlying.toArray());
  f.layer.restore();assert.deepEqual(f.bones.hand_l.position.toArray(),changed.toArray());
  cancel(f);const before=f.bones.upperarm_r.quaternion.clone();f.layer.apply(.06);
  assert.equal(f.layer.active,null);assert.deepEqual(f.bones.upperarm_r.quaternion.toArray(),before.toArray());
 }
});
test('Invalid tracks cannot enable a continuation, and equivalent quaternion signs can',()=>{
 const late=turn('hand_r');late.times=new Float32Array([.1,1]);
 for(const track of [late,turn('upperarm_r'),new QuaternionKeyframeTrack('hand_r.quaternion',[0,1],[0,0,0,0,0,0,0,1]),new QuaternionKeyframeTrack('hand_r.quaternion',[0,1],[0,0,0,1,0,0,0,0]),new VectorKeyframeTrack('hand_r.position',[0,1],[NaN,0,0,0,0,0]),new VectorKeyframeTrack('hand_r.visible',[0,1],[0,0])]){
  const f=fixture([track]);assert.equal(f.layer.begin(f.action,0,.1),false);
 }
 const f=fixture([new QuaternionKeyframeTrack('hand_r.quaternion',[0,1],[0,0,0,-1,0,0,0,-1])]);
 assert.equal(f.layer.begin(f.action,0,.1),true);
});
test('An interrupted continuation fades from the displayed arms without snapping to the underlying blend',()=>{
 const f=fixture();assert.equal(f.layer.begin(f.action,0,.1),true);f.action.play();f.mixer.update(.04);
 f.bones.upperarm_r.quaternion.identity();f.layer.apply(.04);const displayed=f.bones.upperarm_r.quaternion.clone();
 f.layer.restore();assert.ok(f.bones.upperarm_r.quaternion.angleTo(displayed)>.01);
 f.layer.release(.04,.06);f.layer.apply(.04);
 assert.deepEqual(f.bones.upperarm_r.quaternion.toArray(),displayed.toArray());
 f.layer.restore();f.bones.upperarm_r.quaternion.fromArray(q(-.2));f.layer.apply(.07);
 const halfway=displayed.clone().slerp(new Quaternion().fromArray(q(-.2)),.5);
 assert.ok(f.bones.upperarm_r.quaternion.angleTo(halfway)<1e-7);
 const interrupted=f.bones.upperarm_r.quaternion.clone();f.layer.release(.07,.08);f.layer.apply(.07);
 assert.deepEqual(f.bones.upperarm_r.quaternion.toArray(),interrupted.toArray());
 f.layer.restore();f.bones.upperarm_r.quaternion.fromArray(q(-.4));f.layer.apply(.151);
 assert.equal(f.layer.active,null);assert.deepEqual(f.bones.upperarm_r.quaternion.toArray(),q(-.4));
});
