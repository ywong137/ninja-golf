import {withoutMusouTarget} from './without-musou-target.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {FacialPose,FACIAL_LIMITS} from '../src/facial-pose.js';
import {measureFace} from '../tools/audit-facial-pose.mjs';
import {readModel,packedStream} from '../tools/preserve-vice-president-head.mjs';
import {restoreVicePresidentLegacyBrowWeights} from '../tools/author-vice-president-brow-weights.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/vice-president-fit.json',import.meta.url)));
const anatomy=JSON.parse(fs.readFileSync(new URL('./fixtures/vice-president-anatomical-fit.json',import.meta.url)));
const file=process.env.NINJA_ETHAN_CANDIDATE||new URL('../public/models/monk.glb',import.meta.url);
const raw=fs.readFileSync(file);
function meshesOf(g){const meshes=[];g.scene.traverse(m=>{if(m.isSkinnedMesh)meshes.push(m);});return meshes;}
function update(g){g.scene.updateMatrixWorld(true);for(const m of meshesOf(g))m.skeleton.update();}

test('Ethan refinement preserves the body, topology, UVs, and skin streams',()=>{
 const model=withoutMusouTarget(readModel(raw));
 // The geometric fit predates the separately tested eight-row skin repair.
 // Reverse only that exact approved patch; retain the original fingerprints.
 if(model.doc.extras?.vicePresidentBrowWeights)restoreVicePresidentLegacyBrowWeights(model);
 for(const [key,hash]of Object.entries(fixture.preservedStreamHashes)){
  const [index,attr]=key.split(':'),current=model.doc.meshes[0].primitives[Number(index)];
  // The coat separates the original hand triangles into their own material.
  // The wardrobe test verifies that both partitions retain every original face.
  const p=model.doc.extras?.wardrobeDefault&&index==='0'&&attr==='indices'?JSON.parse(fs.readFileSync(new URL('./fixtures/ethan-before-wardrobe.json',import.meta.url))).meshes[0].primitives[0]:current;
  assert.equal(crypto.createHash('sha256').update(packedStream(model,attr==='indices'?p.indices:p.attributes[attr])).digest('hex'),hash,key);
 }
});

test('Ethan nasal geometry follows the checked photographic wing span',async()=>{
 const g=await loadNativeSkin(file),clip=g.animations.find(c=>c.name===fixture.clip);assert.ok(clip);
 g.mixer.clipAction(clip).play();g.mixer.update(fixture.time);update(g);
 const mesh=meshesOf(g).find(m=>m.name==='Mesh_1');assert.ok(mesh);
 const {rotationVector,translation,cameraMatrix:matrix}=anatomy.frontCamera;
 const r=new T.Vector3().fromArray(rotationVector),angle=r.length(),q=new T.Quaternion().setFromAxisAngle(r.normalize(),angle);
 const origin=new T.Vector3().fromArray(anatomy.modelOrigin),t=new T.Vector3().fromArray(translation);
 const xs=anatomy.alarWidth.candidateVertices.map(id=>{
  const p=mesh.getVertexPosition(id,new T.Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin).applyQuaternion(q).add(t);
  assert.ok(p.z>0);return matrix[0][0]*p.x/p.z+matrix[0][2];
 });
 const width=Math.max(...xs)-Math.min(...xs),{observedPixels,uncertaintyPixels}=anatomy.alarWidth;
 assert.ok(Math.abs(width-observedPixels)<=uncertaintyPixels,`Nasal span ${width.toFixed(2)} px; checked photograph ${observedPixels} ± ${uncertaintyPixels} px`);
});

test('The measured oral seam uses opposing lip surfaces, with no eyeball correspondences',async()=>{
 const g=await loadNativeSkin(file),mesh=meshesOf(g).find(m=>m.name==='Mesh_1');assert.ok(mesh);
 const weights=mesh.geometry.attributes.skinWeight,joints=mesh.geometry.attributes.skinIndex;
 for(const id of Object.values(anatomy.semanticVertices).flat())assert.ok(!anatomy.excludedEyeVertices.includes(id));
 for(const [id,bone]of [[1103,'Bip01_MUpperLip'],[947,'Bip01_MBottomLip']]){
  let total=0;for(let i=0;i<4;i++)if(mesh.skeleton.bones[joints.getComponent(id,i)].name===bone)total+=weights.getComponent(id,i);
  assert.ok(total>.5,`Vertex ${id} must follow ${bone}`);
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
