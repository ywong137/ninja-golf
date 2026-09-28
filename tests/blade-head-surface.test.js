import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {headSurfaceMetadata,measureBladeHeadClearance} from '../tools/blade-head-surface.mjs';

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
