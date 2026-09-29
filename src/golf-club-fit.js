import * as THREE from 'three';
import {BALL_RADIUS} from './golf-equipment.js';
import {clubBodyOrientation} from './golf-club.js';

const UP=new THREE.Vector3(0,1,0);

// Capture before the first animation. Sampling never changes live bones or actions.
export function captureGolfRestPose(model){
  const rest=new Map();
  model.traverse(object=>rest.set(object,{
    position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone(),
  }));
  return rest;
}

function finite(value,label){if(!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);}
function positive(value,label){finite(value,label);if(value<=0)throw new RangeError(`${label} must be positive.`);}
function vector(value,label){
  if(!value?.isVector3||!value.toArray().every(Number.isFinite))throw new TypeError(`${label} must be a finite Vector3.`);
}
function quaternion(value,label){
  if(!value?.isQuaternion||!value.toArray().every(Number.isFinite)||Math.abs(value.lengthSq()-1)>1e-5)
    throw new TypeError(`${label} must be a unit Quaternion.`);
}

export function sampleGolfGripPose({root,hand,clip,restPose,grip,time}){
  if(!(restPose instanceof Map))throw new TypeError('Capture the complete golf rest pose before animation.');
  if(!clip?.tracks)throw new TypeError('A native golf AnimationClip is required.');
  finite(time,'Contact time');
  if(time<0||time>clip.duration)throw new RangeError(`Contact time must be within ${clip.name} (0..${clip.duration}).`);
  vector(grip?.center,'Grip center');quaternion(grip?.frame,'Grip frame');
  const chain=[];
  for(let object=hand;object!==root;object=object?.parent){
    if(!object)throw new Error('The golf hand must descend from the actor root.');
    chain.push(object);
  }
  const tracks=new Map(clip.tracks.map(track=>[track.name,track])),matrix=new THREE.Matrix4();
  for(const object of chain.reverse()){
    const rest=restPose.get(object);
    if(!rest)throw new Error(`Missing golf rest pose for ${object.name||object.type}. Capture the whole model.`);
    const parts={};
    for(const key of ['position','quaternion','scale']){
      const track=tracks.get(`${object.name}.${key}`);
      parts[key]=rest[key].clone();
      if(track)parts[key].fromArray(track.createInterpolant().evaluate(time));
      if(!parts[key].toArray().every(Number.isFinite))throw new Error(`Nonfinite ${object.name}.${key} at ${time}.`);
    }
    parts.quaternion.normalize();
    matrix.multiply(new THREE.Matrix4().compose(parts.position,parts.quaternion,parts.scale));
  }
  const rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  matrix.decompose(new THREE.Vector3(),rotation,scale);
  if(scale.distanceTo(new THREE.Vector3(1,1,1))>1e-5)
    throw new Error('Golf calibration requires an unscaled native bone chain. Pass actorScale separately.');
  rotation.multiply(grip.frame).normalize();
  return {palm:grip.center.clone().applyMatrix4(matrix),rotation,axis:UP.clone().applyQuaternion(rotation)};
}

function headGeometry(club,bodyQuaternion){
  const body=club?.head?.getObjectByName('Golf club body');
  if(!body)throw new Error('Golf calibration requires separate Golf club body and neck groups.');
  const short=club.root.userData.clubShort;
  const faceName=short==='PT'?'Face insert':(short==='DR'||short==='3W')?'Titanium face':'Forged blade';
  const vertices=[],triangles=[],face=[];
  function visit(object,parentMatrix){
    const matrix=parentMatrix.clone().multiply(new THREE.Matrix4().compose(
      object.position,object===body?bodyQuaternion:object.quaternion,object.scale,
    ));
    if(object.isMesh){
      const {position,normal}=object.geometry.attributes,index=object.geometry.index;
      const points=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix));
      vertices.push(...points);
      for(let i=0;i<(index?.count??position.count);i+=3){
        const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),triangle=ids.map(j=>points[j]);
        triangles.push(triangle);
        if(object.name===faceName&&ids.every(j=>normal.getZ(j)<-.999999))face.push(triangle);
      }
    }
    for(const child of object.children)visit(child,matrix);
  }
  for(const child of club.head.children)visit(child,new THREE.Matrix4());
  if(!face.length)throw new Error(`Club ${short} has no finite front cap on ${faceName}.`);
  return {vertices,triangles,face};
}

function faceContactAtHeight(face,height){
  let area=0;const center=new THREE.Vector3(),tri=new THREE.Triangle();
  for(const points of face){tri.set(...points);const a=tri.getArea();center.addScaledVector(tri.getMidpoint(new THREE.Vector3()),a);area+=a;}
  if(area<1e-12)throw new Error('The club face has no usable surface area.');
  center.multiplyScalar(1/area);
  let best=null,bestDistance=Infinity;
  for(const points of face){
    const crossings=[];
    for(let i=0;i<3;i++){
      const a=points[i],b=points[(i+1)%3],da=a.y-height,db=b.y-height;
      if(Math.abs(da)<1e-10)crossings.push(a.clone());
      if(da*db<0)crossings.push(a.clone().lerp(b,da/(da-db)));
    }
    for(let i=0;i<crossings.length;i++)for(let j=i+1;j<crossings.length;j++){
      const point=new THREE.Line3(crossings[i],crossings[j]).closestPointToPoint(center,true,new THREE.Vector3());
      const distance=point.distanceToSquared(center);
      if(distance<bestDistance){best=point;bestDistance=distance;}
    }
  }
  return best;
}

function addressCorrection({pose,geometry,shaftLengthNative,actorScale,ball,ballRadius,soleHeight}){
  const origin=pose.palm.clone().addScaledVector(pose.axis,shaftLengthNative).multiplyScalar(actorScale);
  const transform=point=>point.clone().applyQuaternion(pose.rotation).multiplyScalar(actorScale).add(origin);
  const vertices=geometry.vertices.map(transform),face=geometry.face.map(points=>points.map(transform));
  const normal=new THREE.Triangle(...face[0]).getNormal(new THREE.Vector3());
  if(normal.x>=-.1)return {addressOffsetNative:null,addressFit:{accepted:false,reason:'The address face does not point toward the -X shot.'}};
  const offsetWorld=new THREE.Vector3(0,soleHeight-Math.min(...vertices.map(point=>point.y)),0);
  const initialPlaneDistance=normal.dot(ball.clone().sub(face[0][0]));
  const requestedGap=.005;
  offsetWorld.x=(initialPlaneDistance-normal.y*offsetWorld.y-ballRadius-requestedGap)/normal.x;
  const closest=new THREE.Vector3(),shiftedFace=face.map(points=>points.map(point=>point.clone().add(offsetWorld)));
  const distance=triangles=>Math.min(...triangles.map(points=>new THREE.Triangle(...points).closestPointToPoint(ball,closest).distanceTo(ball)));
  const faceGapWorld=distance(shiftedFace)-ballRadius;
  const headGapWorld=distance(geometry.triangles.map(points=>points.map(point=>transform(point).add(offsetWorld))))-ballRadius;
  const soleHeightWorld=Math.min(...vertices.map(point=>point.y+offsetWorld.y));
  const facePlaneGapWorld=normal.dot(ball.clone().sub(shiftedFace[0][0]))-ballRadius;
  let reason=null;
  if(offsetWorld.length()>.03)reason=`The address correction is ${(offsetWorld.length()*1000).toFixed(3)} mm; the limit is 30 mm.`;
  else if(Math.abs(soleHeightWorld-soleHeight)>1e-7||Math.abs(facePlaneGapWorld-requestedGap)>1e-7)
    reason='The rigid address correction failed its sole or signed-plane check.';
  else if(!Number.isFinite(faceGapWorld)||!Number.isFinite(headGapWorld)||faceGapWorld<requestedGap-1e-7||headGapWorld<requestedGap-1e-7)
    reason='An actual head surface enters the required 5 mm address clearance.';
  return {
    addressOffsetNative:reason?null:offsetWorld.clone().multiplyScalar(1/actorScale),
    addressFit:{accepted:!reason,reason,offsetWorld,soleHeightWorld,facePlaneGapWorld,faceGapWorld,headGapWorld},
  };
}

/** Calibrate once per hero and club, in actor-local metres before actorScale.
 * The body orientation and shaft length stay fixed for the entire animation.
 * ballOffsetNative is the ball center relative to the actor root on level ground.
 * An optional addressOffsetNative translates the WHOLE actor, never the club
 * relative to the hands. A rejected address correction returns null.
 */
export function calibrateGolfClub({root,hand,clip,restPose,grip,club,contactTime,actorScale=1.1,ballRadius=BALL_RADIUS,soleHeight=.002,addressClip,addressTime=0}){
  positive(actorScale,'Actor scale');positive(ballRadius,'Ball radius');finite(soleHeight,'Sole height');
  if(soleHeight<0)throw new RangeError('Sole height cannot be negative.');
  const pose=sampleGolfGripPose({root,hand,clip,restPose,grip,time:contactTime});
  if(pose.axis.y>=-.1)throw new Error('The contact shaft must point down toward the ground.');
  const bodyQuaternion=clubBodyOrientation(pose.rotation);
  const geometry=headGeometry(club,bodyQuaternion);
  const rotate=point=>point.clone().applyQuaternion(pose.rotation);
  const minimum=Math.min(...geometry.vertices.map(point=>rotate(point).y));
  const shaftLengthNative=(soleHeight/actorScale-pose.palm.y-minimum)/pose.axis.y;
  if(shaftLengthNative<=.15||shaftLengthNative>2)throw new RangeError(`Invalid calibrated shaft length ${shaftLengthNative} m.`);
  const origin=pose.palm.clone().addScaledVector(pose.axis,shaftLengthNative).multiplyScalar(actorScale);
  const transform=point=>rotate(point).multiplyScalar(actorScale).add(origin);
  const face=geometry.face.map(points=>points.map(transform));
  const normal=new THREE.Triangle(...face[0]).getNormal(new THREE.Vector3());
  if(normal.x>=0||Math.abs(normal.z)>1e-5)throw new Error('The finite club face must point toward the actor-local -X shot.');
  const requiredHeight=ballRadius*(1-normal.y),contact=faceContactAtHeight(face,requiredHeight);
  if(!contact){
    const ys=face.flat().map(point=>point.y),minimumFace=Math.min(...ys),maximumFace=Math.max(...ys);
    throw new RangeError(`Club ${club.root.userData.clubShort} cannot contact a ground ball on its finite face: required height ${(requiredHeight*1000).toFixed(3)} mm, face ${(minimumFace*1000).toFixed(3)}..${(maximumFace*1000).toFixed(3)} mm. Correct the sole/face geometry.`);
  }
  const ball=contact.clone().addScaledVector(normal,ballRadius);
  const point=new THREE.Vector3();
  const distance=Math.min(...face.map(points=>new THREE.Triangle(...points).closestPointToPoint(ball,point).distanceTo(ball)));
  if(Math.abs(distance-ballRadius)>1e-7)throw new Error('The finite face tangency check failed.');
  const headDistance=Math.min(...geometry.triangles.map(points=>new THREE.Triangle(...points.map(transform)).closestPointToPoint(ball,point).distanceTo(ball)));
  const result={
    clubShort:club.root.userData.clubShort,clip:clip.name,contactTime,actorScale,
    shaftLengthNative,bodyQuaternion,ballOffsetNative:ball.clone().multiplyScalar(1/actorScale),
    contactPointNative:contact.clone().multiplyScalar(1/actorScale),faceNormal:normal,
    soleHeightWorld:Math.min(...geometry.vertices.map(point=>transform(point).y)),
    faceGapWorld:distance-ballRadius,headGapWorld:headDistance-ballRadius,
  };
  if(addressClip){
    const addressPose=sampleGolfGripPose({root,hand,clip:addressClip,restPose,grip,time:addressTime});
    Object.assign(result,addressCorrection({pose:addressPose,geometry,shaftLengthNative,actorScale,ball,ballRadius,soleHeight}));
    Object.assign(result.addressFit,{clip:addressClip.name,time:addressTime});
  }
  return result;
}
