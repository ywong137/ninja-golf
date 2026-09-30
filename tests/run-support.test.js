import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {rollRunSupport} from '../src/run-support.js';

const geometry={points:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],up:new Vector3(0,1,0)};
const state=()=>({anchor:new Vector3(-.16,.1,0),supportQ:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.15),support:.28});
for(const direction of [1,-1])test(`support rolls onto the ${direction>0?'toe':'heel'} without moving its contact`,()=>{
 const foot=state(),hip=new Vector3(-.1,.85,direction*.35),anchors={};let last;
 for(let i=0;i<=240;i++){
  const pose=rollRunSupport(foot,geometry,hip,i/240*.28),contact=geometry.points[pose.index].clone().applyQuaternion(pose.q).add(pose.position);
  assert.ok(contact.distanceTo(pose.anchor)<1e-10);
  anchors[pose.index]??=contact.clone();assert.ok(contact.distanceTo(anchors[pose.index])<1e-10);
  last=pose;
 }
 assert.equal(last.index,direction>0?0:1);
 const other=geometry.points[1-last.index].clone().applyQuaternion(last.q).add(last.position);
 assert.ok(other.y-last.anchor.y>.04,'The free end of the shoe did not rise');
 assert.ok(last.position.y>foot.roll.flatPosition.y+.015,'The ankle did not gain reach above the flat sole');
});

test('the heel-to-toe transition converges under finer sampling',()=>{
 const peaks=[];
 for(const samples of [240,960]){
  const foot=state(),hip=new Vector3(-.1,.85,.35);let previous,position=0,rotation=0;
  for(let i=0;i<=samples;i++){
   const pose=rollRunSupport(foot,geometry,hip,i/samples*.28);
   if(previous){position=Math.max(position,pose.position.distanceTo(previous.position)*samples);rotation=Math.max(rotation,pose.q.angleTo(previous.q)*samples);}
   previous=pose;
  }
  peaks.push({position,rotation});
 }
 for(const key of ['position','rotation'])assert.ok(peaks[1][key]<peaks[0][key]*1.03,JSON.stringify(peaks));
});

test('joining at late support does not compress a whole foot roll into toe-off',()=>{
 const foot=state();foot.rollStart=.265;const hip=new Vector3(-.1,.85,.35);
 const start=rollRunSupport(foot,geometry,hip,.265),end=rollRunSupport(foot,geometry,hip,.279);
 assert.ok(start.q.angleTo(end.q)<.02,'The shoe rotated too far during late controller entry');
 assert.ok(start.position.distanceTo(end.position)<.003);
});
