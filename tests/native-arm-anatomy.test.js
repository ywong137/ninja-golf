import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Quaternion,Vector3} from 'three';
import {
 ARM_AUTHORING_BOUNDS,captureArmPose,calibrateArmAnatomy,
 measureArmAnatomy,armAuthoringViolations,
} from '../tools/native-arm-anatomy.mjs';

const radians=Math.PI/180,X=new Vector3(1,0,0),Y=new Vector3(0,1,0),Z=new Vector3(0,0,1);
const turn=(axis,degrees)=>new Quaternion().setFromAxisAngle(axis,degrees*radians);
const close=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);

function fixture(side='r',{bindFlexion=23,upperBind=turn(Z,side==='r'?130:-130)}={}){
 const root=new Group(),chest=new Bone(),upper=new Bone(),lower=new Bone(),hand=new Bone();
 root.add(chest);chest.add(upper);upper.add(lower);lower.add(hand);
 upper.position.set(side==='r'?-.2:.2,1.4,0);
 lower.position.set(0,.3,0);hand.position.set(0,.27,0);
 upper.quaternion.copy(upperBind);lower.quaternion.copy(turn(Z,-bindFlexion));
 const bones={spine_03:chest,['upperarm_'+side]:upper,['lowerarm_'+side]:lower,['hand_'+side]:hand};
 root.updateMatrixWorld(true);
 return{root,chest,upper,lower,hand,bones,side,upperBind,calibration:calibrateArmAnatomy(captureArmPose(bones,side))};
}

function setFixture(rig,{flexion=50,humeralRoll=0,forearmTwist=0}={}){
 rig.upper.quaternion.copy(rig.upperBind).multiply(turn(Y,humeralRoll));
 rig.lower.quaternion.copy(turn(Z,-flexion)).multiply(turn(Y,forearmTwist));
 rig.root.updateMatrixWorld(true);
 return measureArmAnatomy(rig.calibration,captureArmPose(rig.bones,rig.side));
}

test('Both native sides retain bind flexion and zero relative axial rotation',()=>{
 for(const side of ['r','l']){
  const rig=fixture(side),m=measureArmAnatomy(rig.calibration,captureArmPose(rig.bones,side));
  close(m.signedFlexionDegrees,23);close(m.humeralRollDegrees,0);close(m.forearmTwistDegrees,0);close(m.hingeDeviationDegrees,0);
  assert.ok(rig.calibration.hingeAxisLocal.distanceTo(Z.clone().negate())<1e-8);
 }
});

test('Signed flexion distinguishes a backward bend from an equal unsigned angle',()=>{
 const rig=fixture(),positive=setFixture(rig,{flexion:45}),negative=setFixture(rig,{flexion:-45});
 close(positive.signedFlexionDegrees,45);close(negative.signedFlexionDegrees,-45);
 assert.deepEqual(armAuthoringViolations(positive),[]);
 assert.deepEqual(armAuthoringViolations(negative).map(v=>v.metric),['signedFlexionDegrees']);
});

test('Forearm twist changes the surface frame without changing endpoints or the local wrist',()=>{
 const rig=fixture();setFixture(rig,{flexion:65});
 const before=captureArmPose(rig.bones,'r'),wrist=rig.hand.quaternion.clone();
 const m=setFixture(rig,{flexion:65,forearmTwist:100}),after=captureArmPose(rig.bones,'r');
 assert.ok(before.wrist.distanceTo(after.wrist)<1e-8);
 assert.ok(rig.hand.quaternion.angleTo(wrist)<1e-8);
 close(m.signedFlexionDegrees,65);close(m.humeralRollDegrees,0);close(m.forearmTwistDegrees,100);
 assert.deepEqual(armAuthoringViolations(m).map(v=>v.metric),['forearmTwistDegrees']);
});

test('Humeral roll and forearm twist remain independent on both mirrored sides',()=>{
 for(const side of ['r','l']){
  const rig=fixture(side),m=setFixture(rig,{flexion:80,humeralRoll:-95,forearmTwist:35});
  close(m.signedFlexionDegrees,80);close(m.humeralRollDegrees,-95);close(m.forearmTwistDegrees,35);
  assert.deepEqual(armAuthoringViolations(m).map(v=>v.metric),['humeralRollDegrees']);
 }
});

test('Chest transport removes global body rotation from the upper-arm roll measurement',()=>{
 const rig=fixture();setFixture(rig,{flexion:60,humeralRoll:25,forearmTwist:-40});
 rig.chest.quaternion.copy(turn(X,35)).multiply(turn(Y,-70)).multiply(turn(Z,20));
 rig.root.position.set(8,3,-5);rig.root.updateMatrixWorld(true);
 const m=measureArmAnatomy(rig.calibration,captureArmPose(rig.bones,'r'));
 close(m.signedFlexionDegrees,60);close(m.humeralRollDegrees,25);close(m.forearmTwistDegrees,-40);
});

test('Minimal upper-arm aiming produces no humeral roll',()=>{
 const rig=fixture('r',{upperBind:new Quaternion()});
 const target=new Vector3(.6,.3,.7).normalize();
 rig.upper.quaternion.setFromUnitVectors(Y,target);rig.lower.quaternion.copy(turn(Z,-55));
 rig.root.updateMatrixWorld(true);
 const m=measureArmAnatomy(rig.calibration,captureArmPose(rig.bones,'r'));
 close(m.humeralRollDegrees,0);close(m.forearmTwistDegrees,0);close(m.signedFlexionDegrees,55);
});

test('Hinge deviation detects forearm aiming outside the calibrated hinge plane',()=>{
 const rig=fixture();rig.lower.quaternion.copy(turn(X,20)).multiply(turn(Z,-50));rig.root.updateMatrixWorld(true);
 const m=measureArmAnatomy(rig.calibration,captureArmPose(rig.bones,'r'));
 assert.ok(m.hingeDeviationDegrees>12&&m.hingeDeviationDegrees<13);
 assert.ok(armAuthoringViolations(m,{maxHingeDeviationDegrees:2}).some(v=>v.metric==='hingeDeviationDegrees'));
});

test('Task limits admit their boundaries and reject excessive folding or either twist sign',()=>{
 assert.equal(ARM_AUTHORING_BOUNDS.maxFlexionDegrees,130);
 assert.deepEqual(armAuthoringViolations({signedFlexionDegrees:130,humeralRollDegrees:-70,forearmTwistDegrees:70,hingeDeviationDegrees:0}),[]);
 const failures=armAuthoringViolations({signedFlexionDegrees:131,humeralRollDegrees:71,forearmTwistDegrees:-71,hingeDeviationDegrees:0});
 assert.deepEqual(failures.map(v=>v.metric),['signedFlexionDegrees','humeralRollDegrees','forearmTwistDegrees']);
});

test('Quaternion signs do not change the measured rotations',()=>{
 const rig=fixture();setFixture(rig,{flexion:90,humeralRoll:45,forearmTwist:-65});
 const pose=captureArmPose(rig.bones,'r'),before=measureArmAnatomy(rig.calibration,pose);
 for(const key of ['upperArmQuaternion','forearmQuaternion','chestQuaternion']){
  const q=pose[key];q.set(-q.x,-q.y,-q.z,-q.w);
 }
 const after=measureArmAnatomy(rig.calibration,pose);
 for(const key of Object.keys(before))close(before[key],after[key]);
});

test('Calibration fails clearly for an unknown hinge in a straight bind arm',()=>{
 const straight={shoulder:new Vector3(),elbow:Y.clone(),wrist:Y.clone().multiplyScalar(2),
  upperArmQuaternion:new Quaternion(),forearmQuaternion:new Quaternion(),chestQuaternion:new Quaternion()};
 assert.throws(()=>calibrateArmAnatomy(straight),/Supply its signed hingeAxisLocal/);
 const calibrated=calibrateArmAnatomy(straight,{hingeAxisLocal:Z.clone().negate()});
 close(calibrated.bindFlexionDegrees,0);
 assert.throws(()=>calibrateArmAnatomy(straight,{hingeAxisLocal:Y}),/perpendicular/);
 assert.throws(()=>captureArmPose({},'r'),/Missing native bone upperarm_r/);
 assert.throws(()=>armAuthoringViolations({signedFlexionDegrees:NaN}),/must be finite/);
});

// Recorded from the actual rejected ninja-ace-heavy-v8.glb at .434 seconds.
// Keep this snapshot permanent; the test never loads its former /tmp source.
const rejectedHeavyFrame={
 bind:{
  shoulder:[-.1721256333257109,1.380047927155409,-.06052005361486506],
  elbow:[-.3588688290573211,1.209849589600466,-.06278730161851774],
  wrist:[-.5244043072965193,1.0630498726765496,.03061275996426656],
  upperArmQuaternion:[.6455062518122635,-.2885327895511138,.648160653467694,.28276890145140393],
  forearmQuaternion:[.6915942835493067,-.15776057470160107,.572127031616668,.4116789653043511],
  chestQuaternion:[-.11153298057181635,.6982493491711805,-.11153118825724645,.6982614324977408],
 },
 pose:{
  shoulder:[-.03670287069561915,1.1364084937193504,.5118297629877778],
  elbow:[.015958509592323512,1.001017234115544,.7185701002212652],
  wrist:[.05806862236793824,.7946911428928198,.6031058541394522],
  upperArmQuaternion:[.6238370198211177,-.24320477232871793,-.6154195847783122,.41585765612838743],
  forearmQuaternion:[.7233157944262253,-.09663717730770127,.6374778801569257,-.24717905678749566],
  chestQuaternion:[-.022873727033381953,.8809970038059176,.1900172124038955,.4326829480364969],
 },
};
const fromSnapshot=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[
 key,key.endsWith('Quaternion')?new Quaternion().fromArray(value):new Vector3().fromArray(value),
]));

test('The old rejected heavy frame fails axial limits despite positive elbow flexion',()=>{
 const calibration=calibrateArmAnatomy(fromSnapshot(rejectedHeavyFrame.bind));
 const m=measureArmAnatomy(calibration,fromSnapshot(rejectedHeavyFrame.pose));
 close(calibration.bindFlexionDegrees,23.4131750846,1e-6);
 assert.ok(m.signedFlexionDegrees>83&&m.signedFlexionDegrees<85);
 assert.ok(m.humeralRollDegrees<-108&&m.humeralRollDegrees>-109);
 assert.ok(Math.abs(m.forearmTwistDegrees)>175);
 assert.deepEqual(armAuthoringViolations(m).map(v=>v.metric),['humeralRollDegrees','forearmTwistDegrees']);
});
