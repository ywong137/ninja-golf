import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Quaternion,Vector3} from 'three';
import {HandGrip,compatibleNativePair} from '../src/hand-grip.js';

const pair={nativeAttachment:true,pairedGrip:true,twoHanded:true,primaryGrip:-.36,gripSpacing:.4};

test('Native pairs share the same two palm stations',()=>{
 assert.equal(compatibleNativePair(pair,{...pair},0),true);
 assert.equal(compatibleNativePair({...pair,primaryGrip:undefined},{...pair,primaryGrip:undefined},-.36),true);
 assert.equal(compatibleNativePair({...pair,primaryGrip:undefined},pair,-.36),true);
 for(const change of [{primaryGrip:-.3},{gripSpacing:.3},{nativeAttachment:false},{pairedGrip:false},{twoHanded:false},{gripSpacing:0},{gripSpacing:NaN},{primaryGrip:Infinity}]){
  assert.equal(compatibleNativePair(pair,{...pair,...change},0),false,JSON.stringify(change));
  assert.equal(compatibleNativePair({...pair,...change},pair,0),false,JSON.stringify(change));
 }
 assert.equal(compatibleNativePair(undefined,pair,0),false);
 assert.equal(compatibleNativePair(pair,undefined,0),false);
 assert.equal(compatibleNativePair({...pair,primaryGrip:undefined},pair,undefined),false);
});

test('Golf pairs preserve the second hand toward the club head',()=>{
 const golf={...pair,primaryGrip:0,gripSpacing:-.108};
 assert.equal(compatibleNativePair(golf,{...golf},0),true);
 assert.equal(compatibleNativePair(golf,{...golf,gripSpacing:.108},0),false);
 for(const spacing of [-.108,.4]){
  const root=new Group(),held=new Group(),right=new Group(),left=new Group();
  root.position.set(3,.5,-2);root.rotation.set(.2,.7,-.1);root.scale.setScalar(1.1);
  root.add(right,left,held);
  const origin=new Vector3(.15,.9,.4),frame=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.6),station=.03;
  right.position.copy(new Vector3(0,station,0).applyQuaternion(frame).add(origin));
  left.position.copy(new Vector3(0,station-spacing,0).applyQuaternion(frame).add(origin));
  right.quaternion.copy(frame);left.quaternion.copy(frame);root.updateMatrixWorld(true);
  const grip={actor:{root,bones:{hand_r:right,hand_l:left}},active:{r:{center:new Vector3(),frame:new Quaternion()},l:{center:new Vector3(),frame:new Quaternion()}},secondaryWeight:1};
  HandGrip.prototype.attachPair.call(grip,held,station,spacing);
  assert.ok(held.localToWorld(new Vector3(0,station,0)).distanceTo(right.getWorldPosition(new Vector3()))<1e-9);
  assert.ok(held.localToWorld(new Vector3(0,station-spacing,0)).distanceTo(left.getWorldPosition(new Vector3()))<1e-9);
  assert.ok(held.quaternion.angleTo(frame)<1e-7,'The head direction must stay unchanged for either spacing sign.');
  assert.ok(grip.report.palmGap<1e-9);
  assert.throws(()=>HandGrip.prototype.attachPair.call(grip,held,0,0),/nonzero signed spacing/);
 }
});

test('A golf support-hand interpolation error cannot steer the calibrated club face',()=>{
 const root=new Group(),held=new Group(),right=new Group(),left=new Group();
 root.position.set(-2,.4,3);root.rotation.set(.2,-.7,.1);root.scale.setScalar(1.1);root.add(held,right,left);
 const frame=new Quaternion().setFromAxisAngle(new Vector3(1,.2,.4).normalize(),.7);
 right.position.set(.1,.8,.3);right.quaternion.copy(frame);
 left.position.copy(right.position).add(new Vector3(.0001,.108,0).applyQuaternion(frame));left.quaternion.copy(frame);
 root.updateMatrixWorld(true);
 const grip=Object.assign(Object.create(HandGrip.prototype),{
  actor:{root,bones:{hand_r:right,hand_l:left}},
  active:{r:{center:new Vector3(),frame:new Quaternion()},l:{center:new Vector3(),frame:new Quaternion()}},secondaryWeight:1,
 });
 const originalLeft=left.quaternion.clone();
 grip.attachPair(held,0,-.108,{preservePrimaryFrame:true});
 assert.ok(held.getWorldPosition(new Vector3()).distanceTo(right.getWorldPosition(new Vector3()))<1e-9);
 assert.ok(held.quaternion.angleTo(frame)<1e-7,'Keep the face orientation calibrated against the lead hand.');
 assert.ok(left.quaternion.angleTo(originalLeft)<1e-7,'Do not correct the native support wrist at runtime.');
 assert.ok(Math.abs(grip.report.palmGap-.00011)<1e-9);
});
