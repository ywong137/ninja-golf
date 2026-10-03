import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,VectorKeyframeTrack,QuaternionKeyframeTrack,Quaternion,Vector3,InterpolateDiscrete} from 'three';
import {sliceSourceMotion} from '../tools/slice-source-motion.mjs';

const source=()=>new AnimationClip('source',2,[
 new VectorKeyframeTrack('pelvis.position',[0,.4,1.3,2],[0,0,0, 1,2,3, 4,2,-1, 6,1,-2]),
 new QuaternionKeyframeTrack('pelvis.quaternion',[0,1,2],[...[0,.8,1.6].flatMap(t=>new Quaternion().setFromAxisAngle(new Vector3(0,1,0),t).toArray())]),
]);
test('Splitting between source keys preserves interpolation and shared endpoints',()=>{
 const clip=source(),a=sliceSourceMotion(clip,0,.73,'a'),b=sliceSourceMotion(clip,.73,2,'b');
 for(let k=0;k<clip.tracks.length;k++){
  const original=clip.tracks[k].createInterpolant();
  for(const [part,offset]of [[a,0],[b,.73]])for(let i=0;i<=20;i++){
   const t=part.duration*i/20,got=part.tracks[k].createInterpolant().evaluate(t),want=original.evaluate(t+offset);
   assert.ok(got.every((v,j)=>Math.abs(v-want[j])<1e-6));
  }
  assert.deepEqual(Array.from(a.tracks[k].createInterpolant().evaluate(a.duration)),Array.from(b.tracks[k].createInterpolant().evaluate(0)));
 }
 assert.equal(clip.name,'source');assert.equal(b.name,'b');assert.equal(b.tracks[0].times[0],0);
});
test('Invalid ranges and unsupported interpolation fail before authoring',()=>{
 for(const range of [[-1,1],[1,1],[2,1],[0,3],[NaN,1]])assert.throws(()=>sliceSourceMotion(source(),...range));
 const clip=source();clip.tracks[0].setInterpolation(InterpolateDiscrete);assert.throws(()=>sliceSourceMotion(clip,0,1),/linear/);
});
