import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeRunSpec,nativeWalkSpec} from '../src/native-stride.js';

test('shortened native strides keep the loaded foot stationary at different world speeds',()=>{
 for(const name of ['Run_Forward','Run_Backward','Run_Left','Run_Right','Sprint_Forward']){
  const old=nativeRunSpec({name});
  for(const ratio of [.52,.7,1])for(const actorScale of [.95,1.2])for(const speed of [2.5,5.3,7]){
   const spec=nativeRunSpec({name,userData:{nativeStrideScale:ratio}}),dt=.001;
   const phaseRate=speed/(actorScale*2*spec.amplitude/spec.support);
   const oldPhase=.1*spec.support,newPhase=oldPhase+dt*phaseRate;
   const footAt=p=>old.amplitude*(1-2*p/old.support)*ratio*actorScale;
   assert.ok(Math.abs(footAt(newPhase)-footAt(oldPhase)+speed*dt)<1e-12,
    `${name}: shortened stride slides under world movement`);
  }
 }
});

test('guard walking and attack steps use the same fitted distance clock',()=>{
 const original={duration:.9,walkSpeed:1.2};
 for(const ratio of [.6,.8,1]){
  const clip={name:'Twin_Guard_Walk_Forward',userData:{nativeStrideScale:ratio}};
  const spec=nativeWalkSpec(clip,original),actorScale=1.12,speed=2.5;
  const phaseRate=speed/(actorScale*spec.walkSpeed*spec.duration);
  const nativeDisplacement=original.walkSpeed*original.duration*ratio;
  assert.ok(Math.abs(nativeDisplacement*actorScale*phaseRate-speed)<1e-12);
  assert.equal(original.walkSpeed,1.2,'The shared source record must remain unchanged.');
 }
});

test('unmodified and explicitly aliased clips retain the previous stride',()=>{
 const old=nativeRunSpec({name:'Run_Forward'});
 assert.equal(nativeRunSpec({name:'Run_Forward'}),old);
 assert.equal(nativeRunSpec({name:'Run_Forward_Legacy',userData:{legacyLocomotion:'Run_Forward'}}),old);
 assert.equal(nativeRunSpec({name:'Ronin_Ready'}),undefined);
 const walk={walkSpeed:1.2};assert.equal(nativeWalkSpec({name:'Walk'},walk),walk);
});

test('malformed fitted distances fail before animation starts',()=>{
 for(const scale of [0,-1,NaN,Infinity,'0.7']){
  const clip={name:'Run_Forward',userData:{nativeStrideScale:scale}};
  assert.throws(()=>nativeRunSpec(clip),/nativeStrideScale/);
  assert.throws(()=>nativeWalkSpec(clip,{walkSpeed:1}),/nativeStrideScale/);
 }
 assert.throws(()=>nativeWalkSpec({name:'Walk'},undefined),/Missing walking speed/);
});
