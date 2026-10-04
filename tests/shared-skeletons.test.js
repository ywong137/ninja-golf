import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {shareClonedSkeletons} from '../src/shared-skeletons.js';
import {loadNativeSkin} from './native-skin-helper.mjs';

test('shares exact bone palettes within one actor without changing mesh binding',()=>{
 const root=new T.Group(),a=new T.Bone(),b=new T.Bone();a.add(b);root.add(a);root.updateMatrixWorld(true);
 const source=new T.Skeleton([a,b]),first=new T.SkinnedMesh(),second=new T.SkinnedMesh();
 first.skeleton=source;second.skeleton=source.clone();second.bindMatrix.makeTranslation(1,2,3);root.add(first,second);
 let disposed=0;second.skeleton.dispose=()=>disposed++;
 assert.deepEqual(shareClonedSkeletons(root),{palettes:1,removed:1});assert.equal(first.skeleton,second.skeleton);
 assert.deepEqual(second.bindMatrix.elements.slice(12,15),[1,2,3]);assert.equal(disposed,1);
 assert.deepEqual(shareClonedSkeletons(root),{palettes:1,removed:0});
});
test('different bones, order, or inverse bind transforms cannot share a palette',()=>{
 const root=new T.Group(),a=new T.Bone(),b=new T.Bone(),c=new T.Bone();
 const original=new T.Skeleton([a,b]);
 const differentInverse=new T.Skeleton([a,b],original.boneInverses.map(m=>m.clone()));differentInverse.boneInverses[1].elements[12]=.25;
 const palettes=[original,new T.Skeleton([a,c]),new T.Skeleton([b,a]),differentInverse];
 for(const skeleton of palettes){const mesh=new T.SkinnedMesh();mesh.skeleton=skeleton;root.add(mesh);}
 assert.deepEqual(shareClonedSkeletons(root),{palettes:4,removed:0});
});
for(const name of ['enemy-hoodie','enemy-tshirt','enemy-cloth-ninja'])test(`${name}: one palette preserves all animated skin positions`,async()=>{
 const rig=await loadNativeSkin(new URL(`../public/models/${name}.glb`,import.meta.url));
 const meshes=[];rig.scene.traverse(m=>{if(m.isSkinnedMesh)meshes.push(m);});
 const originals=meshes.map(m=>m.skeleton);shareClonedSkeletons(rig.scene);
 assert.equal(new Set(meshes.map(m=>m.skeleton)).size,1);
 const point=new T.Vector3(),expected=new T.Vector3();
 for(const clip of rig.animations){
  rig.mixer.stopAllAction();const action=rig.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
  for(const fraction of [0,.3,.7,1]){
   action.time=clip.duration*fraction;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
   for(const [j,mesh]of meshes.entries()){
    const shared=mesh.skeleton;shared.update();originals[j].update();
    for(let i=0;i<mesh.geometry.attributes.position.count;i+=31){
     mesh.skeleton=originals[j];mesh.getVertexPosition(i,expected);mesh.skeleton=shared;mesh.getVertexPosition(i,point);
     assert.deepEqual(point.toArray(),expected.toArray());
    }
   }
  }
 }
});
