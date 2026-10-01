import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,Bone,QuaternionKeyframeTrack,VectorKeyframeTrack} from 'three';
import {matchesAnimationEntry} from '../src/animation-entry.js';

const turn=(name,q=[0,0,0,1])=>new QuaternionKeyframeTrack(`${name}.quaternion`,[0,1],[...q,...q]);
const move=(name,p=[0,0,0])=>new VectorKeyframeTrack(`${name}.position`,[0,1],[...p,...p]);
const clip=(...tracks)=>new AnimationClip('test',1,tracks);
test('Matching native poses can continue without blending, including quaternion sign changes',()=>{
 const bones={hand_r:new Bone(),hand_l:new Bone()},from=clip(turn('hand_r'));
 assert.equal(matchesAnimationEntry(bones,from,clip(turn('hand_r',[0,0,0,-1]),turn('hand_l'))),true);
});
test('A displaced hand, rotated elbow, or changed scale retains the transition',()=>{
 const bones={hand_r:new Bone(),lowerarm_r:new Bone()},from=clip(turn('lowerarm_r'),move('hand_r'));
 bones.hand_r.position.x=.001;
 assert.equal(matchesAnimationEntry(bones,from,from),false);
 bones.hand_r.position.x=0;bones.lowerarm_r.quaternion.setFromAxisAngle({x:0,y:1,z:0},.01);
 assert.equal(matchesAnimationEntry(bones,from,from),false);
 bones.lowerarm_r.quaternion.identity();bones.hand_r.scale.y=.99;
 assert.equal(matchesAnimationEntry(bones,from,clip(...from.tracks,new VectorKeyframeTrack('hand_r.scale',[0,1],[1,1,1,1,1,1]))),false);
});
test('Omitted outgoing properties, unknown bones, duplicate tracks, and invalid entries cannot skip a fade',()=>{
 const bones={hand_r:new Bone()},from=clip(turn('hand_r'),move('hand_r'));
 for(const to of [clip(turn('hand_r')),clip(...from.tracks,turn('missing')),clip(...from.tracks,turn('hand_r')),clip(...from.tracks,new VectorKeyframeTrack('hand_r.visible',[0,1],[1,1])),clip(move('hand_r'),turn('hand_r',[NaN,0,0,1]))])
  assert.equal(matchesAnimationEntry(bones,from,to),false);
 const delayed=turn('hand_r');delayed.times=new Float32Array([.1,1]);
 assert.equal(matchesAnimationEntry(bones,clip(turn('hand_r')),clip(delayed)),false);
 assert.equal(matchesAnimationEntry(bones,clip(),clip()),false);
});
test('The shared grip can own finger rotation without concealing a wrist mismatch',()=>{
 const bones={hand_r:new Bone(),index_01_r:new Bone()},from=clip(turn('hand_r'),turn('index_01_r'));
 bones.index_01_r.quaternion.setFromAxisAngle({x:0,y:1,z:0},.5);
 const options={overriddenTracks:new Set(['index_01_r.quaternion'])};
 assert.equal(matchesAnimationEntry(bones,from,from),false);
 assert.equal(matchesAnimationEntry(bones,from,from,options),true);
 bones.hand_r.quaternion.setFromAxisAngle({x:0,y:1,z:0},.01);
 assert.equal(matchesAnimationEntry(bones,from,from,options),false);
});

test('An omitted toe track can continue only after returning to the captured nonidentity rest rotation',()=>{
 const bones={hand_r:new Bone(),ball_l:new Bone()};
 bones.ball_l.quaternion.setFromAxisAngle({x:1,y:0,z:0},.17);
 const rest=bones.ball_l.quaternion.clone(),restPose=new Map([[bones.ball_l,{quaternion:rest}]]);
 const from=clip(turn('hand_r'),turn('ball_l')),to=clip(turn('hand_r'));
 assert.equal(matchesAnimationEntry(bones,from,to),false,'No bind data must retain the fade.');
 assert.equal(matchesAnimationEntry(bones,from,to,{restPose}),true);
 assert.deepEqual(rest.toArray(),bones.ball_l.quaternion.toArray(),'The comparison must not alter the saved rest rotation.');
 bones.ball_l.quaternion.setFromAxisAngle({x:1,y:0,z:0},.18);
 assert.equal(matchesAnimationEntry(bones,from,to,{restPose}),false,'An unfinished toe pivot still needs a transition.');
 bones.ball_l.quaternion.identity();
 assert.equal(matchesAnimationEntry(bones,from,to,{restPose}),false,'Identity is not this toe’s rest rotation.');
});

test('Omitted translation and scale tracks require their own captured rest values',()=>{
 const bones={pelvis:new Bone(),hand_r:new Bone()},restPose=new Map([[bones.pelvis,{position:bones.pelvis.position.clone(),scale:bones.pelvis.scale.clone()}]]);
 const from=clip(turn('hand_r'),move('pelvis'),new VectorKeyframeTrack('pelvis.scale',[0,1],[1,1,1,1,1,1])),to=clip(turn('hand_r'));
 assert.equal(matchesAnimationEntry(bones,from,to,{restPose}),true);
 bones.pelvis.position.y=.002;
 assert.equal(matchesAnimationEntry(bones,from,to,{restPose}),false);
 bones.pelvis.position.y=0;bones.pelvis.scale.x=1.001;
 assert.equal(matchesAnimationEntry(bones,from,to,{restPose}),false);
 bones.pelvis.scale.x=1;restPose.get(bones.pelvis).position.x=NaN;
 assert.equal(matchesAnimationEntry(bones,from,to,{restPose}),false);
});
