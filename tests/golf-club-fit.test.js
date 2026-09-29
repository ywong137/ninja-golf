import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {BALL_RADIUS} from '../src/golf-equipment.js';
import {CLUB_HEAD_SPECS,createGolfClub} from '../src/golf-club.js';
import {gripFrame} from '../src/hand-grip.js';
import {captureGolfRestPose,sampleGolfGripPose,calibrateGolfClub} from '../src/golf-club-fit.js';
import {loadNativeSkin} from './native-skin-helper.mjs';

function fixture(){
  const root=new T.Group(),base=new T.Bone(),hand=new T.Bone();
  base.name='base';hand.name='hand';root.add(base);base.add(hand);
  base.position.set(.1,.2,.1);hand.position.set(0,.8,.3);hand.rotation.x=Math.PI;
  const restPose=captureGolfRestPose(root),grip={center:new T.Vector3(.01,0,.02),frame:new T.Quaternion()};
  const clip=new T.AnimationClip('Golf_Swing',2,[
    new T.VectorKeyframeTrack('hand.position',[0,2],[0,.8,.3,0,.8,.3]),
    new T.QuaternionKeyframeTrack('hand.quaternion',[0,2],[...hand.quaternion.toArray(),...hand.quaternion.toArray()]),
  ]);
  const club={root:new T.Group(),head:new T.Group()};club.root.userData.clubShort='DR';club.root.add(club.head);
  const body=new T.Group();body.name='Golf club body';club.head.add(body);
  const face=new T.Mesh(new T.BoxGeometry(.10,.04,.004));face.name='Titanium face';face.position.z=.002;body.add(face);
  return {root,hand,clip,restPose,grip,club,contactTime:1.4,actorScale:1.1};
}
function close(actual,expected,tolerance=1e-8){assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);}
function mountedSurface(club,ball){
  let minimumY=Infinity,distance=Infinity;
  club.head.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
    const points=Array.from({length:position.count},(_,i)=>new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
    for(const point of points)minimumY=Math.min(minimumY,point.y);
    for(let i=0;i<(index?.count??position.count);i+=3){
      const triangle=new T.Triangle(...[0,1,2].map(k=>points[index?index.getX(i+k):i+k]));
      distance=Math.min(distance,triangle.closestPointToPoint(ball,new T.Vector3()).distanceTo(ball));
    }
  });
  return {minimumY,distance};
}

test('calibration contacts the actual finite face and sole after one actor scale',()=>{
  const input=fixture(),fit=calibrateGolfClub(input);
  const pose=sampleGolfGripPose({...input,time:input.contactTime});
  input.root.scale.setScalar(input.actorScale);
  input.root.add(input.club.root);input.club.root.position.copy(pose.palm);input.club.root.quaternion.copy(pose.rotation);
  input.club.head.position.y=fit.shaftLengthNative;
  input.club.head.getObjectByName('Golf club body').quaternion.copy(fit.bodyQuaternion);
  input.root.updateMatrixWorld(true);
  const ball=fit.ballOffsetNative.clone().multiplyScalar(input.actorScale),point=new T.Vector3();
  let minimumY=Infinity,faceDistance=Infinity,fullDistance=Infinity;
  input.club.head.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const {position,normal}=mesh.geometry.attributes,index=mesh.geometry.index;
    for(let i=0;i<position.count;i++)minimumY=Math.min(minimumY,new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).y);
    for(let i=0;i<(index?.count??position.count);i+=3){
      const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
      const triangle=new T.Triangle(...ids.map(j=>new T.Vector3().fromBufferAttribute(position,j).applyMatrix4(mesh.matrixWorld)));
      const distance=triangle.closestPointToPoint(ball,point).distanceTo(ball);
      fullDistance=Math.min(fullDistance,distance);
      if(ids.every(j=>normal.getZ(j)<-.999))faceDistance=Math.min(faceDistance,distance);
    }
  });
  close(minimumY,.002);close(ball.y,BALL_RADIUS);close(faceDistance,BALL_RADIUS);close(fullDistance,BALL_RADIUS);
  close(fit.faceNormal.distanceTo(new T.Vector3(-1,0,0)),0);
  close(fit.soleHeightWorld,.002);close(fit.faceGapWorld,0);
});

test('sampling uses captured unkeyed transforms without disturbing live bones or actions',()=>{
  const input=fixture(),first=calibrateGolfClub(input),base=input.root.getObjectByName('base');
  const mixer=new T.AnimationMixer(input.root),action=mixer.clipAction(input.clip);action.play();mixer.update(.32);
  base.position.set(-4,6,3);base.rotation.set(.2,.4,.6);input.hand.scale.setScalar(1.5);
  input.root.position.set(10,20,30);input.root.rotation.y=.8;input.root.scale.setScalar(2);
  const snapshot=()=>({nodes:[input.root,base,input.hand].map(o=>[o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]),time:mixer.time,action:action.time});
  const before=snapshot(),second=calibrateGolfClub(input);
  assert.deepEqual(snapshot(),before);close(second.shaftLengthNative,first.shaftLengthNative);
  close(second.ballOffsetNative.distanceTo(first.ballOffsetNative),0);close(second.bodyQuaternion.angleTo(first.bodyQuaternion),0);
  const larger=calibrateGolfClub({...input,actorScale:1.4});
  close(larger.ballOffsetNative.y*1.4,BALL_RADIUS);close(larger.soleHeightWorld,.002);
  assert.notEqual(larger.shaftLengthNative,first.shaftLengthNative,'world sole height must not receive the actor scale twice');
});

test('calibration rejects inaccessible finite faces and incomplete pose inputs',()=>{
  const input=fixture();
  assert.throws(()=>calibrateGolfClub({...input,actorScale:NaN}),/finite/);
  assert.throws(()=>calibrateGolfClub({...input,restPose:new Map()}),/Missing golf rest pose/);
  assert.throws(()=>calibrateGolfClub({...input,contactTime:3}),/within Golf_Swing/);
  assert.throws(()=>calibrateGolfClub({...input,hand:new T.Bone()}),/descend/);
  const geometry=input.club.head.getObjectByName('Titanium face').geometry;
  const normal=geometry.attributes.normal,position=geometry.attributes.position;
  // Raise the front cap while retaining a lower rear sole. The sphere must not
  // silently move onto a corner or pass through the lower body.
  for(let i=0;i<position.count;i++)if(normal.getZ(i)<-.999)position.setY(i,position.getY(i)-.1);
  assert.throws(()=>calibrateGolfClub(input),/cannot contact a ground ball on its finite face/);
});

test('optional address correction translates the whole actor and rejects excessive motion',()=>{
  const input=fixture(),contact=calibrateGolfClub(input);
  const addressClip=input.clip.clone();addressClip.name='Golf_Address';
  const positionTrack=addressClip.tracks.find(track=>track.name==='hand.position');
  for(let i=0;i<positionTrack.values.length;i+=3){positionTrack.values[i]-=.01;positionTrack.values[i+1]-=.008;}
  const fit=calibrateGolfClub({...input,addressClip}),offset=fit.addressOffsetNative;
  assert.equal(fit.addressFit.accepted,true);close(offset.z,0);
  assert.ok(offset.length()*1.1<=.03);close(fit.shaftLengthNative,contact.shaftLengthNative);
  assert.deepEqual(fit.bodyQuaternion.toArray(),contact.bodyQuaternion.toArray());
  assert.deepEqual(fit.ballOffsetNative.toArray(),contact.ballOffsetNative.toArray());
  const pose=sampleGolfGripPose({...input,clip:addressClip,time:0});
  input.hand.position.fromArray(positionTrack.values);input.root.scale.setScalar(1.1);
  input.root.add(input.club.root);input.club.root.position.copy(pose.palm);input.club.root.quaternion.copy(pose.rotation);
  input.club.head.position.y=fit.shaftLengthNative;input.club.head.getObjectByName('Golf club body').quaternion.copy(fit.bodyQuaternion);
  input.root.updateMatrixWorld(true);
  const relativeBefore=input.hand.matrixWorld.clone().invert().multiply(input.club.root.matrixWorld);
  const handBefore=input.hand.getWorldPosition(new T.Vector3());
  input.root.position.copy(offset).multiplyScalar(1.1);input.root.updateMatrixWorld(true);
  const relativeAfter=input.hand.matrixWorld.clone().invert().multiply(input.club.root.matrixWorld);
  relativeBefore.elements.forEach((value,i)=>close(relativeAfter.elements[i],value));
  close(input.hand.getWorldPosition(new T.Vector3()).sub(handBefore).distanceTo(offset.clone().multiplyScalar(1.1)),0);
  const surface=mountedSurface(input.club,fit.ballOffsetNative.clone().multiplyScalar(1.1));
  close(surface.minimumY,.002);close(surface.distance-BALL_RADIUS,.005);
  for(let i=0;i<positionTrack.values.length;i+=3)positionTrack.values[i]+=.10;
  const rejected=calibrateGolfClub({...input,addressClip});
  assert.equal(rejected.addressOffsetNative,null);assert.equal(rejected.addressFit.accepted,false);
  assert.match(rejected.addressFit.reason,/limit is 30 mm/);
  close(rejected.shaftLengthNative,contact.shaftLengthNative);
  assert.equal('addressOffsetNative' in contact,false,'omitting addressClip must retain the contact-only contract');
});

test('all native heroes and clubs retain a finite face contact with a clear physical sole',async()=>{
  const profiles=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
  for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){
    const gltf=await loadNativeSkin(new URL(`../public/models/${hero}.glb`,import.meta.url));
    const root=gltf.scene,bones={};root.traverse(object=>{if(object.isBone)bones[object.name]=object;});
    const restPose=captureGolfRestPose(root),grip=gripFrame(bones,profiles[hero].golf.r,'r');
    for(const short of Object.keys(CLUB_HEAD_SPECS)){
      const putting=short==='PT',clip=gltf.animations.find(c=>c.name===(putting?'Golf_Putt':'Golf_Swing'));
      const addressClip=gltf.animations.find(c=>c.name===(putting?'Golf_Putt':'Golf_Address'));
      const club=createGolfClub(short),input={root,hand:bones.hand_r,clip,restPose,grip,club,contactTime:putting?22/30:1.4,addressClip};
      const fit=calibrateGolfClub(input),pose=sampleGolfGripPose({...input,time:input.contactTime});
      club.setBodyOrientation(fit.bodyQuaternion);club.head.position.y=fit.shaftLengthNative;
      club.root.position.copy(pose.palm).multiplyScalar(1.1);club.root.quaternion.copy(pose.rotation);club.root.scale.setScalar(1.1);
      club.root.updateMatrixWorld(true);
      const ball=fit.ballOffsetNative.clone().multiplyScalar(1.1),{minimumY,distance}=mountedSurface(club,ball);
      close(minimumY,.002);close(ball.y,BALL_RADIUS);close(fit.faceGapWorld,0);
      assert.ok(distance>=BALL_RADIUS-1e-8,`${hero}/${short}: actual head penetrates ball by ${(BALL_RADIUS-distance)*1000} mm`);
      const loft=Math.atan2(fit.faceNormal.y,Math.hypot(fit.faceNormal.x,fit.faceNormal.z))*180/Math.PI;
      close(loft,CLUB_HEAD_SPECS[short].loft,1e-4);
      assert.equal(fit.addressFit.accepted,true,`${hero}/${short}: ${fit.addressFit.reason}`);
      close(fit.addressOffsetNative.z,0);assert.ok(fit.addressOffsetNative.length()*1.1<=.03);
      const addressPose=sampleGolfGripPose({...input,clip:addressClip,time:0});
      club.root.position.copy(addressPose.palm).add(fit.addressOffsetNative).multiplyScalar(1.1);
      club.root.quaternion.copy(addressPose.rotation);club.root.updateMatrixWorld(true);
      const addressSurface=mountedSurface(club,ball);
      close(addressSurface.minimumY,.002);close(fit.addressFit.facePlaneGapWorld,.005);
      assert.ok(addressSurface.distance>=BALL_RADIUS+.005-1e-8,`${hero}/${short}: corrected address lacks 5 mm surface clearance`);
      close(addressSurface.distance-BALL_RADIUS,fit.addressFit.headGapWorld);
    }
  }
});
