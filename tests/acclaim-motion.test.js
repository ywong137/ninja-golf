import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {acclaimRotation,parseAcclaimSkeleton,parseAcclaimMotion,decodeAcclaimReference} from '../tools/acclaim-motion.mjs';

// Synthetic geometry has known endpoints. It does not reuse the FK algorithm
// to calculate expected values, or depend on an optional downloaded asset.
const asf=`:version 1.10
:units
mass 1
length 1
angle deg
:root
order TX TY TZ RX RY RZ
axis XYZ
position 0 0 0
orientation 0 0 0
:bonedata
begin
id 1
name upper
direction 0 0 1
length 2
axis 0 0 90 XYZ
dof rx
limits (-180 180)
end
begin
id 2
name radius
direction 0 0 1
length 1
axis 0 0 0 XYZ
dof rx
end
begin
id 3
name wrist
direction 0 0 1
length 0.5
axis 0 0 0 XYZ
end
:hierarchy
begin
root upper
upper radius
radius wrist
end`;
const amc=`:FULLY-SPECIFIED
:DEGREES
1
root 1 2 3 0 90 0
upper 90
radius 90
2
root 1 2 3 0 0 0
upper 0
radius 0`;
const close=(actual,expected,epsilon=1e-12)=>actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<epsilon,`${actual} != ${expected}`));

test('fixed-axis rotations apply X before Y rather than intrinsic Euler XYZ',()=>{
 close(new Vector3(0,1,0).applyQuaternion(acclaimRotation('XY',[90,90])).toArray(),[1,0,0]);
});

test('joint-axis conjugation, parent rotation, endpoints and inch conversion agree with known geometry',()=>{
 const result=decodeAcclaimReference(asf,amc,{rate:120}),p=result.frames[0].points;
 // Local X bend, expressed in a Z90 joint frame, becomes a Y90 bend.
 // Root Y90 adds to Y180: the upper segment points along world -Z.
 close(p.root,[.0254,.0508,.0762]);
 close(p.upper,[.0254,.0508,.0254]);
 close(p.radius,[.0254,.0254,.0254]);
 close(p.wrist,[.0254,.0127,.0254]);
 assert.equal(result.frames[1].t,1/120);
 assert.equal(result.rotationFormat,'quaternion-xyzw');
});

test('the wrist endpoint includes the radius AND the remaining wrist segment',()=>{
 const {frames}=decodeAcclaimReference(asf,amc,{rate:120}),p=frames[1].points;
 close(p.wrist,[.0254,.0508,.1651]);
 assert.ok(Math.abs(new Vector3(...p.wrist).distanceTo(new Vector3(...p.upper))-.0381)<1e-12);
});

test('a non-XYZ ASF axis order keeps angles associated with their named axes',()=>{
 // ZYX makes C = Rx90 Ry90, so C*X = +Y. XYZ instead gives C*X = -Z.
 const reordered=asf.replace('axis 0 0 90 XYZ','axis 90 90 0 ZYX');
 close(decodeAcclaimReference(reordered,amc,{rate:120}).frames[0].points.upper,[.0254,.0508,.0254]);
 const xyz=reordered.replace('axis 90 90 0 ZYX','axis 90 90 0 XYZ');
 close(decodeAcclaimReference(xyz,amc,{rate:120}).frames[0].points.upper,[.0762,.0508,.0762]);
});

test('a forearm axial rotation changes its frame without moving the wrist endpoint',()=>{
 const skeleton=asf.replace('length 0.5\naxis 0 0 0 XYZ','length 0.5\naxis 0 0 0 XYZ\ndof rz');
 const motion=amc.replace('radius 90\n','radius 90\nwrist 60\n').replace('radius 0','radius 0\nwrist 60');
 const result=decodeAcclaimReference(skeleton,motion,{rate:120});
 close(result.frames[1].points.wrist,[.0254,.0508,.1651]);
 close(result.frames[1].rotations.wrist,[0,0,.5,Math.sqrt(3)/2]);
});

test('invalid source skeletons fail before authoring',()=>{
 for(const text of [asf.replace('radius wrist','radius upper'),asf.replace('radius wrist',''),asf.replace('length 1\nangle','length 0\nangle'),asf.replace('direction 0 0 1','direction 0 0 4')])
  assert.throws(()=>parseAcclaimSkeleton(text),/Acclaim reference:/);
 assert.throws(()=>parseAcclaimSkeleton(asf.replace('position 0 0 0','position 0 1 0')),/root offsets/);
});

test('missing, duplicate, nonfinite and mismatched motion channels fail explicitly',()=>{
 const skeleton=parseAcclaimSkeleton(asf);
 for(const text of [amc.replace('radius 90\n',''),amc.replace('upper 90','upper 90\nupper 0'),amc.replace('upper 90','upper NaN'),amc.replace('upper 90','upper 90 0'),amc.replace('\n2\n','\n3\n'),amc.replace(':DEGREES',':RADIANS')])
  assert.throws(()=>parseAcclaimMotion(text,skeleton),/Acclaim reference:/);
 assert.throws(()=>decodeAcclaimReference(asf,amc),/documented capture rate/);
});
