import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationClip,AnimationMixer,NumberKeyframeTrack,Object3D} from 'three';
import {capturePoseWeights,applyPoseWeights} from '../src/pose-crossfade.js';

function fixture(){
 const body=new Object3D();body.position.x=50;
 const mixer=new AnimationMixer(body);
 const actions=[4,10,16].map((value,i)=>mixer.clipAction(new AnimationClip('pose'+i,1,[new NumberKeyframeTrack('.position[x]',[0,1],[value,value])])).setEffectiveWeight(i===0?1:0).play());
 mixer.update(0);return{body,mixer,actions};
}

test('returning to a still-fading pose retains the displayed body instead of exposing the bind pose',()=>{
 const {body,mixer,actions:[a,b,c]}=fixture();
 const first=capturePoseWeights([a,b,c]);applyPoseWeights(first,new Map([[b,1]]),.4);mixer.update(0);
 assert.ok(Math.abs(body.position.x-6.4)<1e-12);
 const interrupted=capturePoseWeights([a,b,c,a]);
 applyPoseWeights(interrupted,new Map([[a,1]]),0);mixer.update(0);
 assert.ok(Math.abs(body.position.x-6.4)<1e-12,'The command changed the outgoing pose');
 applyPoseWeights(interrupted,new Map([[a,1]]),.5);mixer.update(0);
 assert.ok(Math.abs(body.position.x-5.2)<1e-12,'Missing mixture weight exposed the distant bind pose');
 applyPoseWeights(interrupted,new Map([[a,1]]),1);mixer.update(0);
 assert.equal(body.position.x,4);assert.equal(b.isScheduled(),false);
});

test('a running blend and a single-pose blend share the same normalized interruption path',()=>{
 const {body,mixer,actions:[a,b,c]}=fixture();
 const first=capturePoseWeights([a,b,c]);applyPoseWeights(first,new Map([[b,.25],[c,.75]]),.4);mixer.update(0);
 const outgoing=body.position.x,second=capturePoseWeights([a,b,c]);
 applyPoseWeights(second,new Map([[a,1]]),.25);mixer.update(0);
 assert.ok(Math.abs(body.position.x-(outgoing*.75+4*.25))<1e-12);
 assert.ok(Math.abs([a,b,c].reduce((sum,action)=>sum+action.getEffectiveWeight(),0)-1)<1e-12);
 assert.throws(()=>applyPoseWeights(second,new Map([[a,.5]]),.25),/normalized target/);
});
