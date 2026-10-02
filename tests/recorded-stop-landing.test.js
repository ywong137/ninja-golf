import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Quaternion,Vector3} from 'three';
import {RecordedStopLanding} from '../src/recorded-stop-landing.js';

const profile={duration:1.725,exitTime:1.05,contacts:{r:[[.2,.275],[.5666667,.625],[.75,1.725]],l:[[.025,.1083333],[.3666667,.4583333],[.7083333,1.725]]}};
function fixture(){
 const root=new Group(),model=new Group(),bones={},contacts={},row={},ready={};root.add(model);
 for(const side of ['r','l']){
  const sign=side==='r'?-1:1,bone=new Bone();model.add(bone);bones['ball_'+side]=bone;
  contacts[side]={surface:{points:()=>[new Vector3(0,-.1,0),new Vector3(0,-.1,.15).applyQuaternion(bone.quaternion)]}};
  row[side]={p:new Vector3(sign*.1,.1,0),q:new Quaternion(),ballQ:new Quaternion()};
  ready[side]={p:new Vector3(sign*.3,.1,0),q:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.4),ballQ:new Quaternion()};
 }
 const landing=new RecordedStopLanding(root,model,bones,contacts,{count:1,rows:[ready,ready]});
 landing.begin(profile,{count:1,rows:[row,row]},.4);
 const base=(supported=false,z=0)=>({contactWeights:{r:supported?1:0,l:supported?1:0},stance:{r:supported,l:supported},targets:Object.fromEntries(['r','l'].map(side=>[side,{p:row[side].p.clone().add(new Vector3(0,0,z)),q:row[side].q.clone()}]))});
 return{root,model,bones,contacts,landing,base};
}

test('recorded landing changes feet during flight and retains the landing through root movement',()=>{
 const {root,landing,base}=fixture(),ground=()=>0;
 const early=landing.apply(.42,base(),ground);
 assert.equal(early.targets.l.p.x,.1,'The supporting left foot moved before takeoff.');
 assert.ok(early.targets.r.p.x<-.1,'The right flight did not widen.');
 landing.restore();
 const placed=landing.apply(.9,base(true),ground);
 assert.ok(Math.abs(placed.targets.r.p.x+.3)<1e-10);
 assert.ok(Math.abs(placed.targets.l.p.x-.3)<1e-10);
 landing.restore();root.position.z+=.2;
 const held=landing.apply(1,base(true,.2),ground);
 for(const side of ['r','l']){
  assert.ok(held.targets[side].p.distanceTo(placed.targets[side].p)<1e-10,'The supported foot slid with the root.');
  assert.ok(held.targets[side].q.angleTo(placed.targets[side].q)<1e-7);
 }
});

test('recorded landing clears the full airborne sole before support begins',()=>{
 const {landing,contacts,base,bones}=fixture(),ground=(x,z)=>.04*x+.02*z;
 const original=bones.ball_r.quaternion.clone(),input=base(),inputPosition=input.targets.r.p.clone();
 const placed=landing.apply(.74,input,ground);
 for(const side of ['r','l'])for(const point of contacts[side].surface.points()){
  const p=point.applyQuaternion(placed.targets[side].q).add(placed.targets[side].p);
  assert.ok(p.y-ground(p.x,p.z)>-1e-10,'An airborne toe crossed the terrain.');
 }
 assert.ok(input.targets.r.p.equals(inputPosition),'The planner mutated the source target.');
 landing.restore();assert.ok(bones.ball_r.quaternion.equals(original));
});
