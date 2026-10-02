import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Object3D,Quaternion,Vector3} from 'three';
import {GuardContactTransfer} from '../src/guard-contact-transfer.js';

function fixture(options={}){
 const root=new Group(),bones={},feet={},contacts={};
 for(const s of ['r','l']){
  const x=s==='r'?-.2:.2;
  for(const [name,y,z]of [['thigh',.8,0],['calf',.42,.18],['foot',.1,0]]){
   const bone=new Object3D();bone.position.set(x,y,z);root.add(bone);bones[name+'_'+s]=bone;
  }
  feet[s]={p:new Vector3(x,.1,0),q:new Quaternion()};
  contacts[s]={contacts:[new Vector3(0,-.1,.14),new Vector3(0,-.1,-.065)],soleUp:new Vector3(0,1,0)};
 }
 root.updateMatrixWorld(true);
 const transfer=new GuardContactTransfer({feet,support:'r',contacts,bones,root,...options});
 return{root,bones,feet,contacts,transfer};
}

for(const side of ['r','l'])test(`${side}: attack recovery retains the current walking phase and support`,()=>{
 const walkPhase=side==='r'?.17:.67;
 const {transfer,feet,contacts}=fixture({support:side,walkPhase});
 assert.equal(transfer.phase,walkPhase);
 assert.ok(Math.abs(transfer.feet[side].phase-.42)<1e-12);
 const anchor=feet[side].p.clone().add(contacts[side].contacts[0]);
 for(let frame=1;frame<=4;frame++){
  transfer.begin(1/144);
  const target=new Vector3(side==='r'?-.2:.2,.4,.6),q=new Quaternion();
  assert.equal(transfer.place(side,target,q,.42+frame*.01,1/144,()=>0),true);
  const sole=contacts[side].contacts[0].clone().applyQuaternion(q).add(target);
  assert.ok(sole.distanceTo(anchor)<1e-9,'The outgoing shoe moved before its walking support ended.');
  assert.equal(transfer.handoff(),null,'Only a new landing can transfer to the running clock.');
 }
});

test('an airborne attack exit does not create a supporting footprint',()=>{
 const {transfer}=fixture({support:'r',walkPhase:.17,grounded:false});
 assert.equal(transfer.feet.r.anchor,undefined);
 assert.equal(transfer.feet.l.anchor,undefined);
 assert.equal(transfer.handoff(),null);
});

test('walking recovery bounds a root turn around its actual supporting shoe',()=>{
 const {root,bones,transfer,contacts}=fixture();
 const rest=Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,bone.position.clone()]));
 const target=new Vector3(-.2,.1,0),q=new Quaternion();
 transfer.begin(1/120,()=>0);transfer.place('r',target,q,.01,1/120,()=>0);
 const anchor=contacts.r.contacts[transfer.feet.r.contact].clone().applyQuaternion(q).add(target);
 root.rotation.y=Math.PI/2;root.updateMatrixWorld(true);
 for(let frame=1;frame<=24;frame++){
  transfer.begin(1/120,()=>0);
  // Apply the same body correction as AttackLocomotion before asking the
  // support solver to evaluate the hip's reach.
  for(const [name,bone]of Object.entries(bones))bone.position.copy(rest[name]).applyQuaternion(transfer.bodyCorrection);
  root.updateMatrixWorld(true);
  const planned=new Vector3(-.2,.1,.5),rotation=new Quaternion();
  transfer.place('r',planned,rotation,.01+frame*.009,1/120,()=>0);
  const actual=contacts.r.contacts[transfer.feet.r.contact].clone().applyQuaternion(rotation).add(planned);
  assert.ok(actual.distanceTo(anchor)<1e-9,JSON.stringify({frame,distance:actual.distanceTo(anchor),phase:transfer.feet.r.phase,support:transfer.feet.r.support,anchored:!!transfer.feet.r.anchor,heading:transfer.heading}));
  assert.ok(transfer.heading<=25*Math.PI/180+1e-9,'The walking support exceeded the shared pivot budget.');
  const body=new Vector3(0,0,1).applyQuaternion(root.quaternion).applyQuaternion(transfer.bodyCorrection);
  assert.ok(Math.abs(Math.atan2(body.x,body.z)-transfer.heading)<1e-9);
 }
 assert.ok(transfer.heading>.3,'The test must exercise a real supporting pivot.');
 transfer.landing='l';
 assert.equal(transfer.handoff().bodyHeading,transfer.heading,'The next gait lost the constrained body heading.');
});

test('a first-frame landing retains the outgoing horizontal footprint',()=>{
 const {transfer,feet}=fixture({walkPhase:.24});
 transfer.begin(1/40,()=>0);
 const target=new Vector3(.8,.1,.8),q=new Quaternion();
 transfer.place('l',target,q,.01,1/40,()=>0);
 assert.ok(Math.hypot(target.x-feet.l.p.x,target.z-feet.l.p.z)<1e-10);
 assert.equal(transfer.handoff().support,'l');
});

test('late walking recovery does not restart a full clearance arc',()=>{
 const {transfer}=fixture({walkPhase:.20});
 for(const phase of [.955,.975,.99]){
  transfer.begin(1/120,()=>0);
  const target=new Vector3(.2,.1,0),q=new Quaternion();
  transfer.place('l',target,q,phase,1/120,()=>0);
  assert.ok(target.y<.115,'The nearly landed foot received a new full-height hop.');
 }
});

test('guard entry preserves the actual support footprint instead of the native target',()=>{
 const {root,contacts,transfer}=fixture(),anchor=new Vector3(-.2,0,.14);
 for(let frame=1;frame<=10;frame++){
  root.position.z=frame*.006;root.updateMatrixWorld(true);transfer.begin(1/144);
  const target=new Vector3(-.2,.1,.6+frame*.01),q=new Quaternion();
  assert.equal(transfer.place('r',target,q,frame*.008,1/144),true);
  const contact=contacts.r.contacts[0].clone().applyQuaternion(q).add(target);
  assert.ok(contact.distanceTo(anchor)<1e-9,'The support point moved toward the next clip');
  assert.equal(transfer.handoff(),null,'Existing support was mistaken for a fresh landing');
 }
});

test('guard swing starts from the outgoing foot pose',()=>{
 const {transfer,feet}=fixture();transfer.begin(1/144);
 const target=new Vector3(.25,.3,-.3),q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.4);
 assert.equal(transfer.place('l',target,q,.51,1/144),false);
 assert.ok(target.distanceTo(feet.l.p)<1e-10);
 assert.ok(q.angleTo(feet.l.q)<1e-7);
});

test('an unreachable touchdown cannot authorize the run handover',()=>{
 const {transfer}=fixture();transfer.feet.l.phase=.99;transfer.begin(1/144);
 transfer.place('l',new Vector3(.2,.1,.15),new Quaternion(),.01,1/144);
 transfer.record('l',.03);
 assert.equal(transfer.handoff(),null);
});

test('the run handover carries measured final foot velocity instead of a provisional target',()=>{
 const {transfer,bones}=fixture(),dt=1/144,velocity=new Vector3(.2,.1,1.8),start=bones.foot_l.position.clone();
 for(let i=1;i<=3;i++){
  transfer.begin(dt);
  // The terrain and joint layers can change the provisional target. Only the
  // final skeleton positions belong in the velocity passed to the next gait.
  transfer.place('l',new Vector3(.2,.4,-.7+i*.15),new Quaternion(),.5+i*.01,dt);
  bones.foot_l.position.copy(start).addScaledVector(velocity,i*dt);
  bones.foot_l.updateWorldMatrix(true,true);transfer.record('l',0);
 }
 transfer.landing='r';const handoff=transfer.handoff();
 assert.ok(handoff.feet.l.velocity.distanceTo(velocity)<1e-10);
 assert.ok(handoff.feet.l.p.distanceTo(bones.foot_l.position)<1e-10);
 transfer.feet.l.velocity.set(99,99,99);
 assert.ok(handoff.feet.l.velocity.distanceTo(velocity)<1e-10,'The handover must own a stable copy.');
});

test('the handover retains time elapsed after a landing between updates',()=>{
 for(const dt of [1/40,1/144]){
  const {transfer}=fixture(),cadence=2.1,untilLanding=.002;
  transfer.feet.l.phase=1-untilLanding*cadence;
  transfer.begin(dt);
  const phase=(dt-untilLanding)*cadence;
  transfer.place('l',new Vector3(.2,.1,.15),new Quaternion(),phase,dt);
  assert.ok(Math.abs(transfer.handoff().elapsed-(dt-untilLanding))<1e-12);
 }
});

test('a late swing collects a reachable footprint instead of snapping to a distant proxy',()=>{
 for(const dt of [1/40,1/120]){
  const {transfer}=fixture({walkPhase:.2,grounded:false});
  transfer.begin(dt,()=>0);
  transfer.place('l',new Vector3(.2,.1,0),new Quaternion(),.96,dt,()=>0);
  const first=transfer.feet.l.last.clone();
  transfer.begin(dt,()=>0);
  const target=new Vector3(.2,.1,-1.2),q=new Quaternion();
  transfer.place('l',target,q,.99,dt,()=>0);
  assert.ok(target.distanceTo(first)/dt<9,'A late clip correction moved the shoe faster than the native leg envelope.');
  const beforeLanding=target.clone();
  transfer.begin(dt,()=>0);
  target.set(.2,.1,-1.2);
  transfer.place('l',target,q,.015,dt,()=>0);
  assert.ok(target.distanceTo(beforeLanding)/dt<9,'Touchdown snapped to an unreachable native endpoint.');
  assert.ok(target.z>-.7,'The collecting step must keep the reachable footprint.');
  assert.equal(transfer.handoff().support,'l');
 }
});
