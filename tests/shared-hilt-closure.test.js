import assert from 'node:assert/strict';
import test from 'node:test';
import {Quaternion,Vector3} from 'three';
import {closeSharedHilt,measureBladeFrameError} from '../tools/shared-hilt-closure.mjs';
const v=(x=0,y=0,z=0)=>new Vector3(x,y,z);
const fixture=()=>({shoulders:{r:v(-.2,1.4,0),l:v(.2,1.4,0)},upperArmLengths:{r:.3,l:.31},elbowOffsets:{r:v(-.04,-.08,-.24),l:v(.03,.03,-.23)},target:v(0,1.25,.5)});
function checkLengths(input,result){
 assert.equal(result.feasible,true);
 for(const side of ['r','l']){
  const elbow=result.position.clone().add(input.elbowOffsets[side]);
  assert.ok(Math.abs(elbow.distanceTo(input.shoulders[side])-input.upperArmLengths[side])<1e-10);
 }
}
test('common hilt retains both unequal upper-arm lengths throughout its orbit',()=>{
 for(let step=0;step<360;step++){
  const input={...fixture(),orbitRadians:step*Math.PI/180};
  checkLengths(input,closeSharedHilt(input));
 }
});
test('zero orbit chooses the closest feasible hilt to the requested point',()=>{
 const input=fixture(),best=closeSharedHilt(input),distance=best.position.distanceTo(input.target);
 for(let step=1;step<360;step++){
  const candidate=closeSharedHilt({...input,orbitRadians:step*Math.PI/180});
  assert.ok(candidate.position.distanceTo(input.target)>=distance-1e-12);
 }
});
test('closure is invariant under a rigid scene transform',()=>{
 const input=fixture(),q=new Quaternion().setFromAxisAngle(v(.2,.4,.7).normalize(),1.2),shift=v(3,-2,5);
 const moved={...input,shoulders:{},elbowOffsets:{},target:input.target.clone().applyQuaternion(q).add(shift)};
 for(const side of ['r','l']){
  moved.shoulders[side]=input.shoulders[side].clone().applyQuaternion(q).add(shift);
  moved.elbowOffsets[side]=input.elbowOffsets[side].clone().applyQuaternion(q);
 }
 const original=closeSharedHilt(input),result=closeSharedHilt(moved);
 checkLengths(moved,result);
 assert.ok(result.position.distanceTo(original.position.clone().applyQuaternion(q).add(shift))<1e-10);
});
test('unreachable hands fail without clamping or stretching a limb',()=>{
 const input=fixture();input.elbowOffsets={r:v(),l:v()};input.shoulders.l=v(2,1.4,0);
 const result=closeSharedHilt(input);
 assert.equal(result.feasible,false);assert.equal(result.reason,'separated');
 assert.ok(Math.abs(result.gap-1.59)<1e-12);assert.equal(result.position,undefined);
 input.shoulders.l=v(-.195,1.4,0);
 assert.equal(closeSharedHilt(input).reason,'contained');
});
test('tangency and axial targets stay finite; coincident spheres require another constraint',()=>{
 const input={shoulders:{r:v(),l:v(.6,0,0)},upperArmLengths:{r:.3,l:.3},elbowOffsets:{r:v(),l:v()},target:v(.2,0,0)};
 const tangent=closeSharedHilt(input);checkLengths(input,tangent);assert.ok(tangent.radius<1e-8);
 input.shoulders.l.x=.4;const axial=closeSharedHilt(input);checkLengths(input,axial);assert.ok(axial.position.toArray().every(Number.isFinite));
 input.shoulders.l.x=0;assert.throws(()=>closeSharedHilt(input),/reach spheres coincide/);
});
test('blade check detects a quarter-turn flat slap despite an exact shaft fit',()=>{
 const error=measureBladeFrameError(new Quaternion().setFromAxisAngle(v(0,1,0),Math.PI/2),new Quaternion());
 assert.ok(error.shaftDegrees<1e-10);assert.ok(Math.abs(error.edgeDegrees-90)<1e-10);
 assert.ok(Math.abs(error.rotationDegrees-90)<1e-10);
});
test('invalid inputs fail with field names',()=>{
 assert.throws(()=>closeSharedHilt({...fixture(),upperArmLengths:{r:0,l:.3}}),/upperArmLengths.r/);
 assert.throws(()=>closeSharedHilt({...fixture(),target:v(NaN,0,0)}),/target/);
 assert.throws(()=>closeSharedHilt({...fixture(),orbitRadians:Infinity}),/orbitRadians/);
 assert.throws(()=>measureBladeFrameError(new Quaternion(0,0,0,0),new Quaternion()),/actual/);
});
