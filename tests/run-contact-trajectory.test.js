import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {RUN_CONTACT_SCHEDULE,createRunningStance,quinticVector} from '../tools/run-contact-trajectory.mjs';

function fixture(){
 const contacts=[new Vector3(0,-.08,.2),new Vector3(0,-.08,-.1)];
 return {contacts,stance:createRunningStance({
  landingPosition:new Vector3(-.1,.1,.3),
  landingRotation:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.1),
  flatRotation:new Quaternion(),contacts,releaseToeZ:-.3,
 })};
}

test('one contact path preserves forward landing and backward release',()=>{
 const {contacts,stance}=fixture(),landing=stance.sample(0),release=stance.sample(RUN_CONTACT_SCHEDULE.release);
 assert.ok(Math.abs(landing.p.z-.3)<1e-12);
 assert.ok(Math.abs(release.p.clone().add(contacts[0].clone().applyQuaternion(release.q)).z+.3)<1e-12);
 assert.ok(stance.travelPerPhase>2.5);
});

test('the actual heel and toe remain fixed throughout their complete support intervals',()=>{
 const {contacts,stance}=fixture(),anchors=new Map();
 for(let i=0;i<=280;i++){
  const phase=i/1000,{p,q,contact}=stance.sample(phase);
  // Add the character's travel to recover the point in world coordinates.
  const world=contacts[contact].clone().applyQuaternion(q).add(p);
  world.z+=stance.travelPerPhase*phase;
  if(!anchors.has(contact))anchors.set(contact,world);
  assert.ok(world.distanceTo(anchors.get(contact))<1e-10);
  assert.ok(Math.abs(world.y)<1e-10);
 }
 assert.equal(anchors.size,2);
});

test('the contact switch does not move the shoe',()=>{
 const {stance}=fixture(),u=RUN_CONTACT_SCHEDULE.flat;
 assert.ok(stance.sample(u-1e-7).p.distanceTo(stance.sample(u+1e-7).p)<1e-6);
 assert.ok(stance.sample(u-1e-7).q.angleTo(stance.sample(u+1e-7).q)<1e-6);
 assert.throws(()=>stance.sample(.29),/through release/);
});

test('a captured forefoot landing grounds the toe without forcing the heel down',()=>{
 const contacts=[new Vector3(0,-.08,.2),new Vector3(0,-.08,-.1)];
 const stance=createRunningStance({landingPosition:new Vector3(-.1,.1,.3),
  landingRotation:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.2),
  flatRotation:new Quaternion(),contacts,releaseToeZ:-.3,landingContact:0});
 let anchor;
 for(let i=0;i<=280;i++){
  const phase=i/1000,{p,q,contact}=stance.sample(phase);
  assert.equal(contact,0);
  const toe=contacts[0].clone().applyQuaternion(q).add(p);toe.z+=stance.travelPerPhase*phase;
  anchor??=toe.clone();assert.ok(toe.distanceTo(anchor)<1e-10);
  assert.ok(contacts[1].clone().applyQuaternion(q).add(p).y>=-1e-10,'The heel must not cross the floor');
 }
});

test('the flight interpolator preserves endpoint velocity and acceleration',()=>{
 const duration=.7;
 const value=t=>new Vector3(1+2*t+3*t*t+t**3,-t+2*t*t,4+t**3);
 const velocity=t=>new Vector3(2+6*t+3*t*t,-1+4*t,3*t*t);
 const acceleration=t=>new Vector3(6+6*t,4,6*t);
 const start={p:value(0),v:velocity(0),a:acceleration(0)};
 const end={p:value(duration),v:velocity(duration),a:acceleration(duration)};
 for(let i=0;i<=20;i++){
  const t=duration*i/20;
  assert.ok(quinticVector(start,end,t,duration).distanceTo(value(t))<1e-12);
 }
});
