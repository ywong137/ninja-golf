import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {headSurfaceMetadata,measureBladeHeadClearance,measureTriangleHeadClearance,measureTriangleHeadClearances} from '../tools/blade-head-surface.mjs';

const HEAD=[[-1,-1,0],[1,-1,0],[0,1,0]];
function fixture(bladePoints,{indexed=false}={}){
 const scene=new T.Group(),head=new T.Bone(),eye=new T.Bone();head.name='Head';eye.name='eye_r';head.add(eye);scene.add(head);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(HEAD.flat(),3));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,0,0,0,0,0,0,0,1,0,0,0],4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
 if(indexed)geometry.setIndex([0,1,2]);
 const mesh=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial());mesh.name='head surface';scene.add(mesh);scene.updateMatrixWorld(true);mesh.bind(new T.Skeleton([head,eye]));
 const weapon=new T.Group(),bladeGeometry=new T.BufferGeometry();bladeGeometry.setAttribute('position',new T.Float32BufferAttribute(bladePoints.flat(),3));
 if(indexed)bladeGeometry.setIndex([0,1,2]);
 const blade=new T.Mesh(bladeGeometry,new T.MeshBasicMaterial());blade.name='Flat steel blade';weapon.add(blade);scene.add(weapon);scene.updateMatrixWorld(true);
 const surfaces=headSurfaceMetadata({scene});
 return{scene,head,eye,weapon,mesh,surfaces,measure:()=>{scene.updateMatrixWorld(true);return measureBladeHeadClearance(surfaces,{r:weapon});}};
}

test('actual blade edges cross the interior of a skinned head triangle',()=>{
 const f=fixture([[0,0,-.2],[0,0,.2],[.2,.1,.2]],{indexed:true}),r=f.measure();
 assert.equal(r.minimumClearance,0);assert.ok(r.crossings>0);assert.deepEqual(r.closest,{side:'r',headMesh:'head surface'});
});

test('parallel blade triangles report their exact near clearance',()=>{
 const r=fixture(HEAD.map(([x,y])=>[x,y,.007])).measure();
 assert.ok(Math.abs(r.minimumClearance-.007)<1e-8);assert.equal(r.crossings,0);
});

test('clearance beyond the cap does not claim an exact distance',()=>{
 const r=fixture(HEAD.map(([x,y])=>[x,y,.1])).measure();
 assert.equal(r.minimumClearance,.03);assert.equal(r.clearanceCappedAt,.03);assert.equal(r.closest,null);assert.equal(r.crossings,0);
});

test('head bone motion changes measured clearance after metadata capture',()=>{
 const f=fixture(HEAD.map(([x,y])=>[x,y,.02]));
 assert.ok(Math.abs(f.measure().minimumClearance-.02)<1e-8);
 f.head.position.z=.012;
 assert.ok(Math.abs(f.measure().minimumClearance-.008)<1e-8,'must deform skin rather than reuse bind positions');
 f.eye.position.z=.008;
 const r=f.measure();assert.ok(r.minimumClearance<1e-7,'Head descendants must deform the tested triangle');assert.ok(r.crossings>0);
});

test('rigid head attachments remain outside the documented skinned-surface scope',()=>{
 const f=fixture(HEAD.map(([x,y])=>[x,y,.02])),glasses=new T.Mesh(new T.BoxGeometry(.2,.2,.2),new T.MeshBasicMaterial());
 glasses.name='rigid glasses';f.head.add(glasses);f.scene.updateMatrixWorld(true);
 const surfaces=headSurfaceMetadata({scene:f.scene});assert.equal(surfaces.length,1);assert.equal(surfaces[0].mesh,f.mesh);
 assert.ok(Math.abs(measureBladeHeadClearance(surfaces,{r:f.weapon}).minimumClearance-.02)<1e-8);
});

test('refitted search bounds match brute-force results through animated head poses',()=>{
 const f=fixture([[0,-.12,-.05],[0,.12,.05],[.20,0,.03]]),geometry=new T.SphereGeometry(.15,16,12);
 const positions=geometry.attributes.position,indices=new Uint16Array(positions.count*4),weights=new Float32Array(positions.count*4);
 for(let i=0;i<positions.count;i++){indices[i*4]=positions.getY(i)>0?1:0;weights[i*4]=1;}
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));f.mesh.geometry=geometry;
 const surfaces=headSurfaceMetadata({scene:f.scene});let crossingPoses=0,nearPoses=0,farPoses=0;
 for(let i=0;i<90;i++){
  f.head.rotation.set(.3*Math.sin(i),.4*Math.cos(i*.71),i*.02);f.head.position.set(.08*Math.sin(i*.33),.07*Math.cos(i*.53),.02);
  f.eye.position.set(.01*Math.sin(i*.6),.015*Math.cos(i*.4),.025*Math.sin(i*.8));
  f.weapon.position.set(.24*Math.sin(i*.2),.04*Math.cos(i*.43),.19*Math.sin(i*.5));f.weapon.rotation.set(i*.31,i*.17,i*.13);f.scene.updateMatrixWorld(true);
  const actual=measureBladeHeadClearance(surfaces,{r:f.weapon}),reference=measureBladeHeadClearance(surfaces,{r:f.weapon},{bruteForce:true});
  assert.ok(Math.abs(actual.minimumClearance-reference.minimumClearance)<1e-10,`pose ${i}: the search tree pruned the nearest triangles`);
  assert.equal(actual.crossings,reference.crossings,`pose ${i}: the search tree missed intersecting triangles`);
  if(actual.crossings)crossingPoses++;else if(actual.minimumClearance<.03)nearPoses++;else farPoses++;
 }
 assert.ok(crossingPoses>0&&nearPoses>0&&farPoses>0,'Exercise contact, near misses, and broad-phase rejection.');
});


test('arbitrary posed triangles match blade queries and brute force',()=>{
 const f=fixture([[0,0,-.2],[0,0,.2],[.2,.1,.2]],{indexed:true});
 for(const dz of [0,.01,.30]){
  f.head.position.z=.012;f.eye.rotation.y=.1;f.weapon.position.z=dz;f.scene.updateMatrixWorld(true);
  const blade=f.weapon.getObjectByName('Flat steel blade'),a=blade.geometry.attributes.position,indices=blade.geometry.index;
  const triangle=[0,1,2].map(i=>new T.Vector3().fromBufferAttribute(a,indices.getX(i)).applyMatrix4(blade.matrixWorld));
  const query=measureTriangleHeadClearance(f.surfaces,{forearm:[triangle]}),reference=measureTriangleHeadClearance(f.surfaces,{forearm:[triangle]},{bruteForce:true}),wrapped=f.measure();
  assert.deepEqual(query,reference);
  assert.equal(query.minimumClearance,wrapped.minimumClearance);assert.equal(query.crossings,wrapped.crossings);
  if(query.closest)assert.deepEqual(query.closest,{source:'forearm',headMesh:wrapped.closest.headMesh});
 }
 assert.throws(()=>measureTriangleHeadClearance(f.surfaces,{forearm:[[new T.Vector3()]]}),/three finite/);
});


test('batched parts retain independent collision counts and nearest distances across poses',()=>{
 const f=fixture(HEAD.map(([x,y])=>[x,y,.02]),{indexed:true});
 const sets={
  crossing:[[new T.Vector3(0,0,-.2),new T.Vector3(0,0,.2),new T.Vector3(.2,.1,.2)]],
  near:[HEAD.map(([x,y])=>new T.Vector3(x,y,.007))],
  far:[HEAD.map(([x,y])=>new T.Vector3(x,y,1))],
 };
 let changed=false,previous;
 for(let i=0;i<20;i++){
  f.head.position.z=.015*Math.sin(i*.3);f.eye.position.z=.008*Math.cos(i*.4);f.scene.updateMatrixWorld(true);
  const actual=measureTriangleHeadClearances(f.surfaces,sets);
  for(const [name,triangles]of Object.entries(sets)){
   const single=measureTriangleHeadClearance(f.surfaces,{[name]:triangles});
   const reference=measureTriangleHeadClearance(f.surfaces,{[name]:triangles},{bruteForce:true});
   assert.deepEqual(actual[name],single);assert.deepEqual(actual[name],reference);
  }
  assert.ok(actual.crossing.crossings>0);assert.equal(actual.far.crossings,0);
  assert.equal(actual.far.minimumClearance,.03);
  if(previous&&actual.near.minimumClearance!==previous.near.minimumClearance)changed=true;
  previous=actual;
 }
 assert.ok(changed,'Each batch must refresh the animated head and eye surface.');
 assert.throws(()=>measureTriangleHeadClearances(f.surfaces,sets,{distanceCap:0}),/positive finite/);
 assert.throws(()=>measureTriangleHeadClearances(f.surfaces,{bad:[[new T.Vector3()]]}),/three finite/);
});

test('one batch deforms each head vertex once, and the next batch refreshes it',()=>{
 const f=fixture(HEAD.map(([x,y])=>[x,y,.02])),original=f.mesh.getVertexPosition.bind(f.mesh);let reads=0;
 f.mesh.getVertexPosition=(...args)=>{reads++;return original(...args);};
 const triangles=[HEAD.map(([x,y])=>new T.Vector3(x,y,.007))],sets=Object.fromEntries(Array.from({length:8},(_,i)=>['part'+i,triangles]));
 const first=measureTriangleHeadClearances(f.surfaces,sets);assert.equal(reads,3,'Eight parts share one head deformation.');
 f.head.position.z=.004;f.scene.updateMatrixWorld(true);
 const next=measureTriangleHeadClearances(f.surfaces,sets);assert.equal(reads,6,'Do not reuse head geometry between poses.');
 assert.ok(next.part0.minimumClearance<first.part0.minimumClearance);
});


test('plane rejection preserves exact results for thin, degenerate, and reversed triangles',()=>{
 const f=fixture(HEAD.map(([x,y])=>[x,y,.02]),{indexed:true});
 const shapes=[
  HEAD.map(([x,y])=>new T.Vector3(x,y,.029999999)),
  HEAD.map(([x,y])=>new T.Vector3(x,y,.030000001)),
  [new T.Vector3(-.3,0,0),new T.Vector3(.3,0,0),new T.Vector3(.300000000001,0,0)],
  [new T.Vector3(0,0,-.3),new T.Vector3(0,0,.3),new T.Vector3(.1,.1,.3)],
  [new T.Vector3(-.2,-.2,.08),new T.Vector3(.2,-.2,.09),new T.Vector3(0,.2,.10)],
 ];
 for(const reversed of [false,true])for(const triangle of shapes)for(const dz of [0,.011,-.011]){
  f.head.position.z=dz;f.eye.position.z=.002;f.scene.updateMatrixWorld(true);
  const query={part:[reversed?[...triangle].reverse():triangle]};
  assert.deepEqual(measureTriangleHeadClearance(f.surfaces,query),measureTriangleHeadClearance(f.surfaces,query,{bruteForce:true}));
 }
});


test('plane rejection retains near-contact counts after an exact crossing sets the minimum to zero',()=>{
 const f=fixture(HEAD.map(([x,y])=>[x,y,.02]),{indexed:true});
 f.head.rotation.set(.5,.37,.2);f.scene.updateMatrixWorld(true);f.mesh.skeleton.update();
 const points=[0,1,2].map(i=>f.mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(f.mesh.matrixWorld));
 const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
 const center=points.reduce((p,v)=>p.add(v),new T.Vector3()).multiplyScalar(1/3),edge=points[1].clone().sub(points[0]).normalize();
 const crossing=[center.clone().addScaledVector(normal,-.2),center.clone().addScaledVector(normal,.2),center.clone().addScaledVector(edge,.1).addScaledVector(normal,.2)];
 const near=points.map(p=>p.clone().addScaledVector(normal,5e-8)),sets={first:[crossing],then:[near]};
 const expected=measureTriangleHeadClearance(f.surfaces,sets,{bruteForce:true});assert.equal(expected.minimumClearance,0);assert.equal(expected.crossings,2);
 assert.deepEqual(measureTriangleHeadClearance(f.surfaces,sets),expected);
});
