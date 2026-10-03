import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,VectorKeyframeTrack,QuaternionKeyframeTrack,Quaternion,Vector3} from 'three';
import {joinSourceMotions} from '../tools/join-source-motions.mjs';

test('source attack and recovery retain their poses and move together on the joined clock',()=>{
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7).toArray();
 const first=new AnimationClip('cut',1,[new VectorKeyframeTrack('pelvis.position',[0,1],[0,0,0,1,0,0]),new QuaternionKeyframeTrack('arm.quaternion',[0,1],[0,0,0,1,...rotation])]);
 const second=new AnimationClip('recover',.5,[new VectorKeyframeTrack('pelvis.position',[0,.5],[1,0,0,0,0,0]),new QuaternionKeyframeTrack('arm.quaternion',[0,.5],[...rotation.map(v=>-v),0,0,0,-1])]);
 const joined=joinSourceMotions(first,second,{bridge:.1});assert.equal(joined.duration,1.6);
 for(let i=0;i<2;i++){
  assert.deepEqual([...first.tracks[i].times],[0,1]);assert.deepEqual([...second.tracks[i].times],[0,.5]);
  const sample=joined.tracks[i].createInterpolant();
  for(const time of[0,.25,.5,1])assert.deepEqual([...sample.evaluate(time)],[...first.tracks[i].createInterpolant().evaluate(time)]);
  for(const time of[0,.2,.5]){
   const a=Array.from(sample.evaluate(1.1+time)),b=Array.from(second.tracks[i].createInterpolant().evaluate(time));
   if(i===0)assert.ok(Math.hypot(...a.map((v,k)=>v-b[k]))<1e-6);else assert.ok(new Quaternion().fromArray(a).angleTo(new Quaternion().fromArray(b))<1e-3);
  }
 }
});

test('unrelated motion endpoints fail before retargeting',()=>{
 const first=new AnimationClip('a',1,[new VectorKeyframeTrack('hip.position',[0,1],[0,0,0,1,0,0])]);
 const mismatch=new AnimationClip('b',1,[new VectorKeyframeTrack('hip.position',[0,1],[2,0,0,0,0,0])]);
 assert.throws(()=>joinSourceMotions(first,mismatch),/does not match/);
 assert.throws(()=>joinSourceMotions(first,mismatch,{bridge:0}),/positive bridge/);
});
