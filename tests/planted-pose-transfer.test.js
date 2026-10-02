import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {PlantedPoseTransfer} from '../src/planted-pose-transfer.js';

function fixture(){
 const feet=Object.fromEntries(['r','l'].map(side=>[side,{p:new Vector3(side==='r'?-.3:.3,.1,0),q:new Quaternion(),ballQ:new Quaternion()}]));
 const contacts=Object.fromEntries(['r','l'].map(side=>[side,{contacts:[new Vector3(0,-.1,.15),new Vector3(0,-.1,-.1)],surface:{points:()=>[new Vector3(0,-.1,-.1),new Vector3(0,-.1,.15)]}}]));
 return{feet,transfer:new PlantedPoseTransfer(feet,contacts)};
}
const pose=(x,z=0,y=.1)=>({p:new Vector3(x,y,z),q:new Quaternion(),ballQ:new Quaternion()});
const recorded={duration:1,footPlants:{r:[[0,.2],[.5,1]],l:[[0,1]]}};

test('an authored attack keeps its existing support while the body moves',()=>{
 const {feet,transfer}=fixture(),original=feet.l.p.clone();
 for(let i=0;i<20;i++){
  transfer.begin(.01,'attack',i*.01);
  const frame=transfer.place('l',pose(.4,i*.008),recorded,()=>0);
  assert.ok(frame.supported);assert.ok(frame.p.distanceTo(original)<1e-10);
  transfer.record('l',frame.p,frame.q,frame.ballQ);
 }
});

test('a free authored step removes the entry correction before its next landing',()=>{
 const {transfer}=fixture();
 transfer.begin(.01,'attack',.2);
 const planted=transfer.place('r',pose(-.2,.04),recorded,()=>0);
 transfer.record('r',planted.p,planted.q,planted.ballQ);
 transfer.begin(.01,'attack',.21);
 const released=transfer.place('r',pose(-.2,.05,.12),recorded,()=>0);
 assert.equal(released.supported,false);assert.ok(released.p.distanceTo(planted.p)<1e-10,'Release must retain the actual foot.');
 transfer.record('r',released.p,released.q,released.ballQ);
 for(let i=22;i<50;i++){
  transfer.begin(.01,'attack',i/100);
  const native=pose(-.2,i/100-.16,.15),frame=transfer.place('r',native,recorded,()=>0);
  transfer.record('r',frame.p,frame.q,frame.ballQ);
  if(i===49)assert.ok(frame.p.distanceTo(native.p)<.0001,'The foot retained an obsolete entry offset.');
 }
 transfer.begin(.01,'attack',.5);assert.ok(transfer.place('r',pose(-.2,.34),recorded,()=>0).supported);
});

test('guard motion without intervals uses its evaluated support and keeps its footprint',()=>{
 const {feet,transfer}=fixture();
 for(let i=0;i<40;i++){
  transfer.begin(.01,'guard',i*.01);
  const frame=transfer.place('r',pose(-.2,.05),{duration:1},()=>0,1);
  assert.ok(frame.supported);assert.ok(frame.p.distanceTo(feet.r.p)<1e-10);
  transfer.record('r',frame.p,frame.q,frame.ballQ);
 }
 assert.throws(()=>transfer.place('r',pose(-.2),{},()=>0),/evaluated support/);
});

test('changing the authored clip retains the actual outgoing support',()=>{
 const {transfer}=fixture();transfer.begin(.01,'guard',.4);
 const guard=transfer.place('l',pose(.35,.1),{duration:1},()=>0,1);
 transfer.record('l',guard.p,guard.q,guard.ballQ);
 transfer.begin(.01,'attack',0);
 const attack=transfer.place('l',pose(.36,.12),recorded,()=>0);
 assert.ok(attack.p.distanceTo(guard.p)<1e-10);assert.ok(attack.supported);
 assert.throws(()=>transfer.begin(0,'attack',.01),/positive frame time/);
});

test('flat support retains its entire rotation and toe pose through a clip blend',()=>{
 const {feet,transfer}=fixture();feet.r.q.setFromAxisAngle(new Vector3(0,1,0),.25);transfer.feet.r.last.q.copy(feet.r.q);
 for(let i=0;i<20;i++){
  transfer.begin(.01,'attack',i*.01);const native=pose(-.2,.04);native.ballQ.setFromAxisAngle(new Vector3(1,0,0),i*.01);
  const frame=transfer.place('r',native,recorded,()=>0);
  assert.ok(frame.q.angleTo(feet.r.q)<1e-7);assert.ok(frame.ballQ.angleTo(feet.r.ballQ)<1e-7);
  transfer.record('r',frame.p,frame.q,frame.ballQ);
 }
});

test('canceling an airborne pose lands continuously instead of snapping to the next support',()=>{
 const {transfer}=fixture(),air=pose(-.3,0,.22);transfer.feet.r.last=air;
 transfer.begin(1/120,'guard',0);
 const first=transfer.place('r',pose(-.2,.1),{duration:1},()=>0,1);
 assert.equal(first.supported,false);assert.ok(first.p.distanceTo(air.p)<1e-10);
 transfer.record('r',first.p,first.q,first.ballQ);
 let last=first,maxSpeed=0;
 for(let i=1;i<=30;i++){
  transfer.begin(1/120,'guard',i/120);const frame=transfer.place('r',pose(-.2,.1),{duration:1},()=>0,1);
  maxSpeed=Math.max(maxSpeed,frame.p.distanceTo(last.p)*120);transfer.record('r',frame.p,frame.q,frame.ballQ);last=frame;
 }
 assert.ok(last.supported);assert.ok(last.p.distanceTo(pose(-.2,.1).p)<1e-10);assert.ok(maxSpeed<2.5);
});

test('toe support has the same final transform at different frame rates',()=>{
 const result=[];
 for(const hz of [30,60,120,144]){
  const {transfer}=fixture();let final;
  for(let i=0;i<=hz/2;i++){
   const time=i/hz,native=pose(-.3);native.q.setFromAxisAngle(new Vector3(1,0,0),-.2*time);
   native.ballQ.setFromAxisAngle(new Vector3(0,0,1),time*.15);
   transfer.begin(1/hz,'toe-pivot',time);final=transfer.place('r',native,{duration:1,footPlants:{r:[]},toePlants:{r:[[0,1]]}},()=>0);
   transfer.record('r',final.p,final.q,final.ballQ);
  }
  result.push(final);
 }
 for(const frame of result.slice(1)){assert.ok(frame.p.distanceTo(result[0].p)<1e-9);assert.ok(frame.q.angleTo(result[0].q)<1e-7);assert.ok(frame.ballQ.angleTo(result[0].ballQ)<1e-7);}
});

test('small evaluated support noise and repeated guard loops cannot move a planted foot',()=>{
 const {feet,transfer}=fixture();
 for(let i=0;i<300;i++){
  transfer.begin(.01,'guard',(i%75)/100);const frame=transfer.place('l',pose(.4,.08),{duration:.75},()=>0,i%2?.49:.51);
  assert.ok(frame.supported);assert.ok(frame.p.distanceTo(feet.l.p)<1e-10);transfer.record('l',frame.p,frame.q,frame.ballQ);
 }
});
