import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {installForearmTwistHelpers} from '../src/forearm-twist.js';
import {loadNativeSkin,skinGroups} from './native-skin-helper.mjs';

function rig({overflow=false}={}) {
 const scene=new T.Group(),clavicle=new T.Bone(),upper=new T.Bone(),lower=new T.Bone(),hand=new T.Bone();
 clavicle.name='clavicle_r';
 upper.name='upperarm_r';lower.name='lowerarm_r';hand.name='hand_r';
 lower.position.y=1;hand.position.y=1;
 upper.add(lower);lower.add(hand);clavicle.add(upper);scene.add(clavicle);
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([.03,1.01,0,0,1.01,.03,-.03,1.01,0],3));
 const extras=overflow?[new T.Bone(),new T.Bone()]:[];
 extras.forEach((bone,i)=>{bone.name='extra_'+i;upper.add(bone);});
 const indices=overflow?[0,1,3,4]:[0,1,0,0],weights=overflow?[.2,.4,.2,.2]:[.5,.5,0,0];
 if(overflow)for(let i=0;i<3;i++)geometry.attributes.position.setY(i,1.3);
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute([...indices,...indices,...indices],4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute([...weights,...weights,...weights],4));
 scene.updateMatrixWorld(true);
 const mesh=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial());scene.add(mesh);
 mesh.bind(new T.Skeleton([upper,lower,hand,...extras,clavicle]));scene.updateMatrixWorld(true);
 return {scene,upper,lower,hand,mesh};
}

function vertices(mesh) {
 mesh.skeleton.update();
 return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()));
}

test('forearm helpers prevent twist collapse without moving joints or changing the bind surface',()=>{
 const g=rig(),bind=vertices(g.mesh),bones=[g.upper,g.lower,g.hand];
 const helpers=installForearmTwistHelpers(g.scene,{sides:['r']});
 vertices(g.mesh).forEach((point,i)=>assert.ok(point.distanceTo(bind[i])<1e-7));
 g.lower.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);g.scene.updateMatrixWorld(true);
 const original=bones.map(b=>b.matrixWorld.clone());helpers.update();
 bones.forEach((bone,i)=>assert.deepEqual(bone.matrixWorld.elements,original[i].elements));
 const repaired=vertices(g.mesh);
 assert.ok(Math.abs(Math.hypot(repaired[0].x,repaired[0].z)-.03)<1e-7);
 helpers.dispose();g.scene.updateMatrixWorld(true);
 const collapsed=vertices(g.mesh);
 assert.ok(Math.abs(Math.hypot(collapsed[0].x,collapsed[0].z)-.03/Math.sqrt(2))<1e-7);
});

test('continuous twist crosses the quaternion sign boundary without a half-twist flip',()=>{
 const g=rig(),helpers=installForearmTwistHelpers(g.scene,{sides:['r']});
 let previous;
 for(let degree=170;degree<=190;degree++){
  g.lower.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),degree*Math.PI/180);
  if(degree%2)g.lower.quaternion.set(...g.lower.quaternion.toArray().map(x=>-x));
  helpers.update({continuousTwist:true,resetContinuity:degree===170});
  const current=helpers.helpers.r.mid.quaternion;
  if(previous)assert.ok(Math.abs(previous.angleTo(current)*180/Math.PI-.5)<1e-5);
  previous=current.clone();
 }
 assert.ok(Math.abs(helpers.report.angles.r.unwrappedDegrees-190)<1e-8);
 // A deliberate seek starts a separate pose, independent of playback history.
 helpers.update({resetContinuity:true});
 assert.ok(Math.abs(helpers.report.angles.r.unwrappedDegrees+170)<1e-8);
 helpers.dispose();
});

test('the default helper pose is independent of animation seeks and earlier rotations',()=>{
 const g=rig(),helper=installForearmTwistHelpers(g.scene,{sides:['r']});
 const pose=degree=>{g.lower.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),degree*Math.PI/180);helper.update();return helper.helpers.r.mid.quaternion.clone();};
 const expected=pose(-65);pose(160);const afterSeek=pose(-65);
 assert.ok(afterSeek.angleTo(expected)<1e-7);
 assert.ok(Math.abs(helper.report.angles.r.unwrappedDegrees+65)<1e-7);
 helper.dispose();
});

test('install rejects an animated arm before changing any mesh or hierarchy',()=>{
 const g=rig(),geometry=g.mesh.geometry,skeleton=g.mesh.skeleton,children=g.upper.children.slice();
 g.lower.rotation.x=.3;
 assert.throws(()=>installForearmTwistHelpers(g.scene,{sides:['r']}),/before animation/);
 assert.equal(g.mesh.geometry,geometry);assert.equal(g.mesh.skeleton,skeleton);assert.deepEqual(g.upper.children,children);
});

test('helper rotations do not depend on scene transforms and fast updates match CPU updates',()=>{
 const g=rig(),helpers=installForearmTwistHelpers(g.scene,{sides:['r']});
 g.lower.quaternion.setFromEuler(new T.Euler(.8,.7,.2));helpers.update();
 const expected=Object.values(helpers.helpers.r).map(b=>b.quaternion.clone());
 g.scene.position.set(7,-3,2);g.scene.rotation.set(.4,-1.1,.2);g.scene.scale.set(.8,1.4,1.1);
 helpers.update({refreshMatrices:false});
 Object.values(helpers.helpers.r).forEach((bone,i)=>assert.ok(bone.quaternion.angleTo(expected[i])<1e-7));
 helpers.update();
 Object.values(helpers.helpers.r).forEach((bone,i)=>assert.ok(bone.quaternion.angleTo(expected[i])<1e-7));
 helpers.dispose();
});

test('overflow fails before altering the scene or source skin weights',()=>{
 const g=rig({overflow:true}),geometry=g.mesh.geometry,skeleton=g.mesh.skeleton,children=g.upper.children.slice();
 assert.throws(()=>installForearmTwistHelpers(g.scene,{sides:['r']}),/needs 5 influences/);
 assert.equal(g.mesh.geometry,geometry);assert.equal(g.mesh.skeleton,skeleton);assert.deepEqual(g.upper.children,children);
});

test('cloned actors keep private weights and release their helper resources',()=>{
 const g=rig(),clone=cloneSkeleton(g.scene),mesh=clone.getObjectByProperty('isSkinnedMesh',true);
 const shared=mesh.geometry,sourceIndices=Array.from(shared.attributes.skinIndex.array),sourceWeights=Array.from(shared.attributes.skinWeight.array);
 const helper=installForearmTwistHelpers(clone,{sides:['r']});
 assert.notEqual(mesh.geometry,shared);
 assert.deepEqual(Array.from(shared.attributes.skinIndex.array),sourceIndices);
 assert.deepEqual(Array.from(shared.attributes.skinWeight.array),sourceWeights);
 let geometryDisposed=0;mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);
 helper.dispose();helper.dispose();assert.equal(geometryDisposed,1);assert.equal(mesh.geometry,shared);
 assert.equal(clone.getObjectByName('lowerarm_skin_base_r'),undefined);
 assert.throws(()=>helper.update(),/disposed/);
});

for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){
 test(`${hero}: native skin retains its bind surface and four-influence budget`,async()=>{
  const g=await loadNativeSkin(new URL(`../public/models/${hero}.glb`,import.meta.url)),meshes=[];
  g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  const before=meshes.map(vertices),originalGroups=skinGroups(g).triangles,helper=installForearmTwistHelpers(g.scene);
  assert.deepEqual(skinGroups(g).triangles,originalGroups,`${hero}: helper skin disappeared from collision classification`);
  assert.ok(helper.report.maximumInfluences<=4);assert.equal(helper.report.quantizedOverflowVertices,0);
  for(const [i,mesh]of meshes.entries())vertices(mesh).forEach((p,v)=>assert.ok(p.distanceTo(before[i][v])<1e-6,`${hero}: bind vertex ${v}`));
  for(const mesh of meshes){
   const {skinIndex,skinWeight}=mesh.geometry.attributes;
   for(let v=0;v<skinIndex.count;v++){
    let fingers=false,auxiliary=false;
    for(let k=0;k<4;k++)if(skinWeight.getComponent(v,k)>0){
     const name=mesh.skeleton.bones[skinIndex.getComponent(v,k)].name;
     fingers ||= /^(thumb|index|middle|ring|pinky)_/.test(name);
     auxiliary ||= /^lowerarm_skin_/.test(name);
    }
    assert.ok(!(fingers&&auxiliary),`${hero}: finger vertex ${v} acquired helper weights`);
   }
  }
  helper.dispose();
 });
}
