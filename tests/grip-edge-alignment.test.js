import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {measureGripEdgeAlignment,compareGripClock} from '../tools/grip-edge-alignment.mjs';

const V=(x,y,z)=>new Vector3(x,y,z);
const example=()=>({shaftOrigin:V(0,0,0),shaftAxis:V(0,1,0),edgeDirection:V(1,0,0),knuckles:{middle:V(.025,.06,0),ring:V(.023,.03,0),pinky:V(.021,0,0)}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);

test('A hand can match the shaft exactly while facing the side of the blade',()=>{
 const pose=example();
 const aligned=measureGripEdgeAlignment(pose);
 near(aligned.meanClockDegrees,0);near(aligned.concentration,1);
 pose.edgeDirection.set(0,0,1);
 const sideways=measureGripEdgeAlignment(pose);
 near(sideways.meanClockDegrees,90);
 near(sideways.maxAbsoluteClockDegrees,90);
 for(const name of Object.keys(pose.knuckles))near(sideways.knuckles[name].radius,aligned.knuckles[name].radius);
});

test('A world rotation and translation preserve measured grip alignment',()=>{
 const pose=example();pose.knuckles.middle.z=.008;
 const before=measureGripEdgeAlignment(pose),rotation=new Quaternion().setFromAxisAngle(V(.3,.7,.2).normalize(),2.3),shift=V(20,-4,11);
 const after=measureGripEdgeAlignment({
  shaftOrigin:pose.shaftOrigin.clone().applyQuaternion(rotation).add(shift),
  shaftAxis:pose.shaftAxis.clone().applyQuaternion(rotation),
  edgeDirection:pose.edgeDirection.clone().applyQuaternion(rotation),
  knuckles:Object.fromEntries(Object.entries(pose.knuckles).map(([name,p])=>[name,p.clone().applyQuaternion(rotation).add(shift)])),
 });
 near(before.meanClockDegrees,after.meanClockDegrees);
 for(const name of Object.keys(pose.knuckles))for(const metric of ['clockDegrees','radius','along'])near(before.knuckles[name][metric],after.knuckles[name][metric]);
});

test('The circular mean distinguishes the back of the handle from the cutting edge',()=>{
 const pose=example();pose.knuckles={middle:V(-1,0,.01),ring:V(-1,0,-.01)};
 const measured=measureGripEdgeAlignment(pose);
 near(Math.abs(measured.meanClockDegrees),180);
 assert.ok(measured.maxAbsoluteClockDegrees>179);
});

test('Shaft origin can move along the handle without changing angular alignment',()=>{
 const pose=example(),before=measureGripEdgeAlignment(pose);pose.shaftOrigin.y=5;
 const after=measureGripEdgeAlignment(pose);
 near(before.meanClockDegrees,after.meanClockDegrees);
 near(before.knuckles.middle.radius,after.knuckles.middle.radius);
 near(before.knuckles.middle.along-5,after.knuckles.middle.along);
 assert.deepEqual(pose.shaftAxis,V(0,1,0));assert.deepEqual(pose.edgeDirection,V(1,0,0));
});

test('Invalid or ambiguous landmarks fail with actionable errors',()=>{
 assert.throws(()=>measureGripEdgeAlignment({...example(),shaftAxis:V(0,0,0)}),/shaftAxis/);
 assert.throws(()=>measureGripEdgeAlignment({...example(),edgeDirection:V(0,2,0)}),/cutting edge/);
 assert.throws(()=>measureGripEdgeAlignment({...example(),knuckles:{}}),/PIP/);
 assert.throws(()=>measureGripEdgeAlignment({...example(),knuckles:{middle:V(0,1,0)}}),/middle/);
 assert.throws(()=>measureGripEdgeAlignment({...example(),knuckles:{middle:V(NaN,0,0)}}),/finite/);
 assert.throws(()=>measureGripEdgeAlignment({...example(),knuckles:{middle:V(1,0,0),ring:V(-1,0,0)}}),/common radial direction/);
});

test('Mirrored finger fans distinguish hand rotation from different anatomy',()=>{
 const report=angles=>({knuckles:Object.fromEntries(angles.map((clockDegrees,i)=>['finger'+i,{clockDegrees}]))});
 const right=report([-40,-7,-3,4]),left=report([40,7,3,-4].map(a=>a-53));
 const matched=compareGripClock(right,left,{mirrorReference:true});
 near(matched.rotationDegrees,-53);near(matched.maxShapeResidualDegrees,0);
 assert.ok(compareGripClock(right,left).maxShapeResidualDegrees>40);
 left.knuckles.finger3.clockDegrees+=20;
 assert.ok(compareGripClock(right,left,{mirrorReference:true}).maxShapeResidualDegrees>10);
});

test('Clock comparison remains local across the angle boundary and checks landmarks',()=>{
 const a={knuckles:{middle:{clockDegrees:179},ring:{clockDegrees:-179}}};
 const b={knuckles:{middle:{clockDegrees:-178},ring:{clockDegrees:-176}}};
 near(compareGripClock(a,b).rotationDegrees,3);
 assert.throws(()=>compareGripClock(a,{knuckles:{middle:{clockDegrees:0}}}),/same named PIP/);
 assert.throws(()=>compareGripClock(a,{knuckles:{middle:{clockDegrees:0},ring:{clockDegrees:NaN}}}),/finite/);
});
