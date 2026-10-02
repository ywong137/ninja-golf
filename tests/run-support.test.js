import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {rollRunSupport,pivotRunSupport} from '../src/run-support.js';

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

for(const slope of [-.12,.12])test(`rolling support keeps its contact on a ${slope} slope`,()=>{
 const normal=new Vector3(0,1,-slope).normalize(),q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.atan(slope)*.5);
 const foot={anchor:new Vector3(-.16,0,0),supportQ:q,support:.28};
 const gap=p=>p.y-slope*p.z;
 foot.anchor.y-=Math.min(...geometry.points.map(p=>gap(p.clone().applyQuaternion(q).add(foot.anchor))));
 const anchors={};
 for(let i=0;i<=120;i++){
  const hip=new Vector3(-.1,.85,-.25+i/120*.7);
  const pose=rollRunSupport(foot,{...geometry,normal},hip,i/120*.28);
  const points=geometry.points.map(p=>p.clone().applyQuaternion(pose.q).add(pose.position));
  assert.ok(Math.abs(gap(points[pose.index]))<1e-10,'The supporting contact left the slope.');
  assert.ok(Math.min(...points.map(gap))>=-1e-10,'The other end of the sole cut into the slope.');
  anchors[pose.index]??=points[pose.index].clone();
  assert.ok(points[pose.index].distanceTo(anchors[pose.index])<1e-10,'A supporting contact slid.');
 }
});

for(const slope of [0,-.12,.12])for(const firstPhase of [.03,.2])test(`loaded turn keeps one sole point fixed on slope ${slope}, phase ${firstPhase}`,()=>{
 const normal=new Vector3(0,1,-slope).normalize(),g={...geometry,normal},foot=state();foot.heading=0;
 const gap=p=>p.y-slope*p.z;
 foot.anchor.y-=Math.min(...geometry.points.map(p=>gap(p.clone().applyQuaternion(foot.supportQ).add(foot.anchor))));
 const hip=new Vector3(-.1,.85,.3),first=rollRunSupport(foot,g,hip,firstPhase);
 foot.contact=first.index;foot.contactAnchor=first.anchor.clone();foot.lastQ=first.q.clone();
 const fixed=first.anchor.clone();let previous=first.q.clone();
 for(let i=1;i<=40;i++){
  pivotRunSupport(foot,g,25*Math.PI/180/40);
  const pose=rollRunSupport(foot,g,hip,firstPhase+i/40*(.279-firstPhase),0,1/144);
  const contacts=g.points.map(p=>p.clone().applyQuaternion(pose.q).add(pose.position));
  assert.equal(pose.index,first.index,'The turning shoe changed its pivot mid-step.');
  assert.ok(contacts[pose.index].distanceTo(fixed)<1e-10,'The planted pivot slid.');
  assert.ok(Math.min(...contacts.map(gap))>-1e-10,'The turning sole penetrated the slope.');
  assert.ok(gap(contacts[1-pose.index])>0,'The other sole point must lift during the pivot.');
  assert.ok(previous.angleTo(pose.q)<=8/144+1e-7,'The planted shoe rotated faster than its bound.');
  previous.copy(pose.q);
 }
});

for(const offset of [-.12,.12])test(`ordinary pivot applies the moving floor offset only once (${offset})`,()=>{
 const foot=state(),hip=new Vector3(-.1,.85,.3);foot.heading=0;
 const first=rollRunSupport(foot,geometry,hip,.08,offset);
 foot.contact=first.index;foot.contactAnchor=first.anchor.clone();foot.lastQ=first.q.clone();
 const base=first.anchor.clone().addScaledVector(new Vector3(0,1,0),-offset);
 for(let i=1;i<=20;i++){
  const floor=offset+i*.002;
  pivotRunSupport(foot,geometry,15*Math.PI/180/20);
  const pose=rollRunSupport(foot,geometry,hip,.08+i*.008,floor,1/120);
  const actual=geometry.points[pose.index].clone().applyQuaternion(pose.q).add(pose.position);
  assert.ok(actual.distanceTo(base.clone().add(new Vector3(0,floor,0)))<1e-10,'The pivot added the floor offset twice.');
  foot.contact=pose.index;foot.contactAnchor=pose.anchor.clone();foot.lastQ=pose.q.clone();
 }
});
