import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {FacialPose,FACIAL_LIMITS} from '../src/facial-pose.js';
import {measureFace} from '../tools/audit-facial-pose.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/vice-president-fit.json',import.meta.url)));
const file=process.env.NINJA_ETHAN_CANDIDATE||new URL('../public/models/monk.glb',import.meta.url);
const raw=fs.readFileSync(file),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),bin=raw.subarray(28+size);
function stream(i){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type]*{5121:1,5123:2,5125:4,5126:4}[a.componentType],stride=v.byteStride??n,start=(a.byteOffset??0)+(v.byteOffset??0);return Buffer.concat(Array.from({length:a.count},(_,j)=>bin.subarray(start+j*stride,start+j*stride+n)));}
function meshesOf(g){const meshes=[];g.scene.traverse(m=>{if(m.isSkinnedMesh)meshes.push(m);});return meshes;}
function update(g){g.scene.updateMatrixWorld(true);for(const m of meshesOf(g))m.skeleton.update();}

test('Ethan refinement preserves the body, topology, UVs, and skin streams',()=>{
 for(const [key,hash]of Object.entries(fixture.preservedStreamHashes)){
  const [index,attr]=key.split(':'),p=doc.meshes[0].primitives[Number(index)];
  assert.equal(crypto.createHash('sha256').update(stream(attr==='indices'?p.indices:p.attributes[attr])).digest('hex'),hash,key);
 }
});

test('Ethan likeness improves both photographs through unchanged reference cameras',async()=>{
 const g=await loadNativeSkin(file),clip=g.animations.find(c=>c.name===fixture.clip);assert.ok(clip);
 g.mixer.clipAction(clip).play();g.mixer.update(fixture.time);update(g);
 const meshes=meshesOf(g),anchors=new Map(fixture.anchors.map(a=>{
  const mesh=meshes.find(m=>m.name===a.mesh);assert.ok(mesh,a.mesh);const point=new T.Vector3();
  a.vertices.forEach((i,k)=>point.addScaledVector(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld),a.barycentric[k]));return[a.id,point];
 }));
 for(const photo of fixture.photos){
  const {rotationVector,translation,matrix}=photo.camera,r=new T.Vector3().fromArray(rotationVector),angle=r.length(),q=new T.Quaternion().setFromAxisAngle(r.normalize(),angle),origin=new T.Vector3().fromArray(fixture.modelOrigin);let error=0,weight=0;
  for(const a of photo.landmarks){const p=anchors.get(a.id).clone().sub(origin).applyQuaternion(q).add(new T.Vector3().fromArray(translation));assert.ok(p.z>0);const x=matrix[0][0]*p.x/p.z+matrix[0][2],y=matrix[1][1]*p.y/p.z+matrix[1][2];error+=a.weight*((x-a.observed[0])**2+(y-a.observed[1])**2);weight+=a.weight;}
  const rms=Math.sqrt(error/weight);assert.ok(rms<photo.baselineRms*.9,`${photo.id}: fixed-camera RMS ${rms.toFixed(3)} px must improve baseline ${photo.baselineRms.toFixed(3)} px by at least 10%`);
 }
});

test('Ethan eyeballs remain rigid and their pivots follow the same displacement',async()=>{
 const g=await loadNativeSkin(file);update(g);const mesh=meshesOf(g).find(m=>m.name==='Mesh_1'),p=mesh.geometry.attributes.position;
 for(const side of ['R','L']){
  const baseline=fixture.eyes[side],delta=new T.Vector3();let maximumDistanceError=0;
  const points=baseline.vertices.map(v=>new T.Vector3(p.getX(v.id),p.getY(v.id),p.getZ(v.id)));
  baseline.vertices.forEach((v,i)=>delta.add(points[i].clone().sub(new T.Vector3().fromArray(v.position))));delta.divideScalar(points.length);
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)maximumDistanceError=Math.max(maximumDistanceError,Math.abs(points[i].distanceTo(points[j])-new T.Vector3().fromArray(baseline.vertices[i].position).distanceTo(new T.Vector3().fromArray(baseline.vertices[j].position))));
  assert.ok(maximumDistanceError<.000001,`${side}: non-rigid eye deformation ${maximumDistanceError}`);
  const pivot=g.scene.getObjectByName('Bip01_'+side+'Eye').getWorldPosition(new T.Vector3()).sub(new T.Vector3().fromArray(baseline.pivot));
  assert.ok(pivot.distanceTo(delta)<.000002,`${side}: the eye pivot and surface moved differently`);
  assert.ok(delta.y<0&&Math.abs(delta.x)>.0005&&Math.abs(delta.z)<.000001,`${side}: missing reviewed orbital refinement`);
 }
});

test('The measured Ethan face retains eye clearance at every angry gaze limit',async()=>{
 const g=await loadNativeSkin(file),bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});const rig={scene:g.scene,bones,meshes:meshesOf(g),update:()=>update(g)};rig.update();
 const pose=new FacialPose(bones,{identity:'monk'}),meter=measureFace(rig),rest=meter.measure();
 for(const side of ['R','L'])assert.ok(rest.eyes[side].restSamples>200,`${side}: inadequate aperture samples`);
 for(const [ys,ps]of [[-1,-1],[-1,1],[1,-1],[1,1]]){
  for(let frame=0;frame<90;frame++){pose.restore();pose.apply(1/60,{gazeYaw:ys*FACIAL_LIMITS.gazeYaw,gazePitch:ps*FACIAL_LIMITS.gazePitch,exertion:1,musou:1});}
  const result=meter.measure();assert.equal(result.flippedTriangles,0);assert.ok(result.penetrationIncrease<.0005);assert.ok(result.maxLidDisplacement<.0015);assert.ok(result.maxLongEdgeStretch<1.5);assert.ok(result.minEdgeRatio>.5);
  for(const side of ['R','L'])assert.ok(result.eyes[side].openFraction>.92,`${side}: aperture ${result.eyes[side].openFraction}`);
 }
 pose.restore();rig.update();assert.deepEqual(meter.measure(),rest);
});
