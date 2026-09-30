import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {SkinnedBounds} from '../src/skinned-bounds.js';
import {loadNativeSkin} from './native-skin-helper.mjs';

function checkVertices(mesh,bounds){
 mesh.skeleton.update();const p=new T.Vector3();let count=0;
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){
  mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);
  assert.ok(bounds.box.containsPoint(p),`${mesh.name}: vertex ${i} leaves its culling box`);
  assert.ok(bounds.world.containsPoint(p),`${mesh.name}: vertex ${i} leaves its animated bound by ${bounds.world.distanceToPoint(p)}`);count++;
 }
 return count;
}
function fixture(){
 const root=new T.Group(),geometry=new T.BufferGeometry(),mesh=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial());
 geometry.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,1,0,0,0,2,0,0,.8,.5],3));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0],4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,.4,.6,0,0,0,1,0,0,.5,.5,0,0],4));
 const a=new T.Bone(),b=new T.Bone();a.add(b);b.position.y=1;mesh.add(a);root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton([a,b]));return{root,mesh,a,b};
}
test('animated bounds contain blended skinning through shear, translation, rotation, and detached binding',()=>{
 for(const detached of [false,true]){
  const {root,mesh,a,b}=fixture();if(detached)mesh.bindMode=T.DetachedBindMode;
  const previous=mesh.intersectsFrustum,bounds=new SkinnedBounds(mesh);
  for(let i=0;i<24;i++){
   root.position.set(460+i*3,-20+i,600-i);root.rotation.set(.1*i,.31*i,-.07*i);root.scale.set(1.2,.8,1.6);
   a.scale.set(2,.5,1);a.rotation.set(.23*i,.07*i,.17*i);b.rotation.set(.37*i,.14*i,-.16*i);b.position.y=1+i*.1;
   if(detached)mesh.position.x=i*.2;
   root.updateMatrixWorld(true);bounds.update();checkVertices(mesh,bounds);
  }
  // Disabling a renderer optimization restores its original mesh contract.
  bounds.dispose();assert.equal(mesh.intersectsFrustum,previous);assert.equal(mesh.boundingSphere,null);
 }
});
test('bounds use matching bind transforms when sharing geometry and reject unsupported or corrupt skinning',()=>{
 const {root,mesh}=fixture();root.updateMatrixWorld(true);
 const first=new SkinnedBounds(mesh),second=new SkinnedBounds(mesh);assert.equal(first.bindBounds,second.bindBounds);second.dispose();first.dispose();
 mesh.bindMatrix.elements[12]=.25;const rebound=new SkinnedBounds(mesh);assert.notEqual(rebound.bindBounds,first.bindBounds);rebound.update();checkVertices(mesh,rebound);rebound.dispose();
 mesh.geometry.attributes.skinWeight.setX(0,-.1);mesh.geometry.attributes.skinWeight.needsUpdate=true;
 assert.throws(()=>new SkinnedBounds(mesh),/negative or nonfinite/);
 mesh.geometry.attributes.skinWeight.setX(0,2);mesh.geometry.attributes.skinWeight.needsUpdate=true;
 assert.throws(()=>new SkinnedBounds(mesh),/normalize/);
 mesh.geometry.attributes.skinWeight.setX(0,1);mesh.geometry.attributes.skinWeight.needsUpdate=true;
 mesh.geometry.morphAttributes.position=[mesh.geometry.attributes.position.clone()];assert.throws(()=>new SkinnedBounds(mesh),/position morphs/);
});
for(const name of ['enemy-hoodie','enemy-tshirt','enemy-cloth-ninja'])test(`${name}: bounds contain every vertex across every native animation`,async t=>{
 const rig=await loadNativeSkin(new URL(`../public/models/${name}.glb`,import.meta.url)),bounds=[];
 rig.scene.traverse(mesh=>{if(mesh.isSkinnedMesh)bounds.push(new SkinnedBounds(mesh));});assert.ok(bounds.length);
 let vertices=0,poses=0;
 for(const clip of rig.animations){
  rig.mixer.stopAllAction();const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  for(const fraction of [0,.13,.29,.53,.79,1]){
   action.time=clip.duration*fraction;rig.mixer.update(0);rig.scene.position.set(350,23,-800);rig.scene.rotation.set(.13,-.7,.08);rig.scene.scale.setScalar(1.1);rig.scene.updateMatrixWorld(true);
   for(const bound of bounds){bound.update();vertices+=checkVertices(bound.mesh,bound);}poses++;
  }
 }
 t.diagnostic(JSON.stringify({meshes:bounds.length,clips:rig.animations.length,poses,vertices}));
 for(const bound of bounds)bound.dispose();
});
