import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,AnimationMixer,Bone,Group,LoopOnce,Vector3,VectorKeyframeTrack} from 'three';
import {createMotionUnitRoot} from '../tools/load-mixamo-motion.mjs';

const near=(actual,expected)=>assert.ok(actual.distanceTo(new Vector3(...expected))<1e-7,JSON.stringify(actual.toArray()));

test('Animated FBX root scale retains centimeter conversion throughout playback',()=>{
 const imported=new Group();imported.name='SKM_Manny_Simple';
 const pelvis=new Bone();pelvis.name='pelvis';pelvis.position.set(0,90,0);imported.add(pelvis);
 imported.animations=[new AnimationClip('advance',1,[
  new VectorKeyframeTrack('SKM_Manny_Simple.scale',[0,1],[1,1,1,2,2,2]),
  new VectorKeyframeTrack('SKM_Manny_Simple.position',[0,1],[0,0,0,100,50,0]),
 ])];
 const scene=createMotionUnitRoot(imported),mixer=new AnimationMixer(scene),action=mixer.clipAction(scene.animations[0]).setLoop(LoopOnce);
 action.clampWhenFinished=true;action.play();
 for(const [time,expected]of [[0,[0,.9,0]],[.5,[.5,1.6,0]],[1,[1,2.3,0]]]){
  action.time=time;mixer.update(0);scene.updateMatrixWorld(true);
  near(pelvis.getWorldPosition(new Vector3()),expected);
  near(scene.scale,[.01,.01,.01]);
 }
});

test('Unanimated scene roots preserve authored transforms, bone lookup, and source clips',()=>{
 const imported=new Group();imported.position.set(100,0,0);imported.rotation.x=Math.PI/2;
 const bone=new Bone();bone.name='hand';bone.position.set(0,0,100);imported.add(bone);
 const clip=new AnimationClip('turn',1,[]);imported.animations=[clip];
 const scene=createMotionUnitRoot(imported);
 near(bone.getWorldPosition(new Vector3()),[1,-1,0]);
 near(imported.scale,[1,1,1]);assert.equal(scene.getObjectByName('hand'),bone);assert.equal(scene.animations[0],clip);
});

test('Invalid source scenes and unit scales fail before mutation',()=>{
 const source=new Group();
 for(const scale of [0,-1,NaN,Infinity])assert.throws(()=>createMotionUnitRoot(source,scale),/positive unit scale/);
 assert.equal(source.parent,null);assert.throws(()=>createMotionUnitRoot(null),/imported scene/);
});
