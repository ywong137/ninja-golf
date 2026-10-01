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
