import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Vector3} from 'three';
import {createSourceHandRetarget} from '../tools/source-hand-retarget.mjs';

function rig(roll,size){
 const root=new Group(),bones={};
 for(const side of ['r','l']){
  const parent=new Bone(),hand=new Bone();parent.name='lowerarm_'+side;hand.name='hand_'+side;
  root.add(parent);parent.add(hand);hand.position.set(side==='r'?-1:1,1,0);
  hand.quaternion.setFromAxisAngle(new Vector3(0,1,0),roll);
  for(const [name,p] of [['middle_01',[0,.1,0]],['index_01',[.04,.09,0]],['pinky_01',[-.04,.08,0]]]){
   const bone=new Bone();bone.name=name+'_'+side;
   bone.position.fromArray(p).multiplyScalar(size).applyQuaternion(hand.quaternion.clone().invert());
   hand.add(bone);bones[bone.name]=bone;
  }
  bones[parent.name]=parent;bones[hand.name]=hand;
 }
 root.updateMatrixWorld(true);return {root,bones};
}
const position=b=>b.getWorldPosition(new Vector3());
function directions(bones,side){
 return [position(bones['middle_01_'+side]).sub(position(bones['hand_'+side])).normalize(),
  position(bones['index_01_'+side]).sub(position(bones['pinky_01_'+side])).normalize()];
}

test('matches both palm directions across different bind rolls and hand sizes',()=>{
 const source=rig(.15,1),target=rig(1.2,1.6),transfer=createSourceHandRetarget(source.root,target.root);
 for(const angle of [0,.6,2,-1]){
  for(const side of ['r','l']){
   source.bones['hand_'+side].quaternion.setFromAxisAngle(new Vector3(1,2,3).normalize(),angle);
   target.bones['lowerarm_'+side].quaternion.setFromAxisAngle(new Vector3(0,0,1),angle*.7);
  }
  source.root.updateMatrixWorld(true);target.root.updateMatrixWorld(true);transfer.apply();
  for(const side of ['r','l']){
   const a=directions(source.bones,side),b=directions(target.bones,side);
   a.forEach((v,i)=>assert.ok(v.angleTo(b[i])<1e-6));
  }
 }
});

test('rejects missing hand landmarks',()=>{
 assert.throws(()=>createSourceHandRetarget(new Group(),rig(0,1).root),/requires hand_r/);
});
