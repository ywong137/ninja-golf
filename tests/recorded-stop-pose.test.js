import test from 'node:test';
import assert from 'node:assert/strict';
import {RecordedStopPose} from '../src/recorded-stop-pose.js';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {captureGolfRestPose} from '../src/golf-club-fit.js';
import {WARRIORS} from '../src/warriors.js';

const profile={duration:1.725,exitTime:1.05,contacts:{r:[[.2,.275],[.5666667,.625],[.75,1.725]],l:[[.025,.1083333],[.3666667,.4583333],[.7083333,1.725]]}};
for(const warrior of WARRIORS)test(`${warrior.model}: recorded landing recovers the native ready body without replacing leg motion`,async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+warrior.model+'.glb',import.meta.url)),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
 const recovery=new RecordedStopPose(bones,g.animations.find(c=>c.name===warrior.readyClip),captureGolfRestPose(g.scene));
 const action=g.mixer.clipAction(g.animations.find(c=>c.name==='Run_Forward'));action.play();action.time=.1;g.mixer.update(0);
 const original=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{p:b.position.clone(),q:b.quaternion.clone()}]));
 recovery.apply(profile,.6);
 for(const [name,bone]of Object.entries(bones))assert.ok(bone.quaternion.equals(original[name].q),'Recovery started before the final takeoff: '+name);
 recovery.restore();recovery.apply(profile,1.05,{count:1,rows:[{pelvis:original.pelvis.p},{pelvis:original.pelvis.p}]});
 assert.ok(Math.abs(bones.pelvis.position.y-recovery.readyHeight)<1e-12);
 for(const [name,q]of Object.entries(recovery.ready))assert.ok(bones[name].quaternion.angleTo(q)<1e-7);
 for(const name of ['thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'])assert.ok(bones[name].quaternion.equals(original[name].q),'The contact solver must retain leg ownership');
 recovery.restore();
 for(const [name,bone]of Object.entries(bones)){assert.ok(bone.quaternion.equals(original[name].q));assert.ok(bone.position.distanceTo(original[name].p)<1e-12);}
 recovery.applyExit(.09);assert.ok(recovery.last,'Interrupted recovery must retain its displayed pose');recovery.restore();
 recovery.applyExit(.1);assert.equal(recovery.last,null);recovery.restore();
 for(const [name,bone]of Object.entries(bones))assert.ok(bone.quaternion.equals(original[name].q),'The outgoing layer leaked into the next animation');
});
