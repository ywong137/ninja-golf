import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Quaternion,Vector3} from 'three';
import {gripFrame} from '../src/hand-grip.js';

function handFixture(){
 const hand=new Bone(),knuckle=new Bone();knuckle.position.set(0,.08,.02);hand.add(knuckle);hand.updateMatrixWorld(true);
 return{hand_r:hand,middle_01_r:knuckle};
}

test('An explicit golf grip frame remains independent of the combat frame',()=>{
 const bones=handFixture(),axis=new Vector3(.8,.3,.5).normalize();
 const initial=gripFrame(bones,{axis:axis.toArray(),center:[.01,.04,.02],radius:.012,rotations:{}},'r');
 const golf={axis:axis.toArray(),center:[.01,.04,.02],radius:.012,rotations:{},frame:initial.frame.toArray()};
 const combat=initial.frame.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),1.43));
 const actual=gripFrame(bones,golf,'r',combat);
 assert.ok(actual.frame.angleTo(initial.frame)<1e-7,'Changing the combat mount rotated the golf club.');
 assert.deepEqual(actual.center.toArray(),golf.center);
 assert.ok(new Vector3(0,1,0).applyQuaternion(actual.frame).distanceTo(axis)<1e-12);
 const sword=gripFrame(bones,{...golf,frame:undefined},'r',combat);
 assert.ok(sword.frame.angleTo(combat)<1e-7,'The sword must retain its own mounting frame.');
 assert.ok(sword.frame.angleTo(actual.frame)>1.4);
});

test('A refitted shaft preserves the explicit mounting roll',()=>{
 const bones=handFixture(),oldFrame=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7);
 const axis=new Vector3(.1,1,0).normalize();
 const actual=gripFrame(bones,{axis:axis.toArray(),center:[0,0,0],radius:.012,rotations:{},frame:oldFrame.toArray()},'r');
 assert.ok(new Vector3(0,1,0).applyQuaternion(actual.frame).distanceTo(axis)<1e-12);
 assert.ok(Math.abs(oldFrame.angleTo(actual.frame)-Math.atan(.1))<1e-12);
});
