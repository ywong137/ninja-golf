import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FootPlacement} from '../src/foot-placement.js';
import {COURSE_SETS,heightAt,ellipse} from '../src/course.js';
import {courseSurfaceHeight} from '../src/terrain.js';
const spots=[[29.3656,176.9803],[2.3435,208.6719],[13.6653,219.8109],[-47.1833,207.1993]];
async function nativeRig(hero){
 const raw=readFileSync(new URL(`../public/models/${hero}.glb`,import.meta.url)),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
 // The CPU test needs native joint transforms, not texture decoding or a browser.
 delete doc.images;delete doc.textures;delete doc.samplers;delete doc.materials;
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 const binary=raw.subarray(28+size);doc.buffers=[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}];
 globalThis.ProgressEvent??=class{};const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');gltf.scene.scale.setScalar(1.1);const bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 return {root:gltf.scene,bones,clips:gltf.animations,mixer:new THREE.AnimationMixer(gltf.scene),placement:new FootPlacement(gltf.scene,bones)};
}
const position=bone=>bone.getWorldPosition(new THREE.Vector3());
function soleGaps(rig,ground){return ['r','l'].map(side=>{const foot=rig.bones['foot_'+side],q=foot.getWorldQuaternion(new THREE.Quaternion()),ankle=position(foot);return Math.min(...rig.placement.feet[side].contacts.map(local=>{const p=local.clone().applyQuaternion(q).add(ankle);return p.y-ground(p.x,p.z)}));});}
test('Native slope support preserves all six bodies and the exact golf hand path',async()=>{
 for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){
  const rig=await nativeRig(hero),{root,bones,mixer,placement,clips}=rig;
  for(const [theme,[x,z]]of spots.entries())for(const name of ['Idle_Loop','Golf_Address']){
   const c=COURSE_SETS[theme].holes[0],ground=(x,z)=>courseSurfaceHeight(c,x,z,heightAt,ellipse);placement.restore();placement.reset();root.position.set(x,heightAt(c,x,z),z);mixer.stopAllAction();mixer.clipAction(clips.find(c=>c.name===name)).play();mixer.setTime(0);root.updateMatrixWorld(true);
   const golf=name.startsWith('Golf'),hand=position(bones.hand_r),handSpan=position(bones.hand_l).sub(hand),pelvis=position(bones.pelvis),lengths=['r','l'].map(s=>[position(bones['thigh_'+s]).distanceTo(position(bones['calf_'+s])),position(bones['calf_'+s]).distanceTo(position(bones['foot_'+s]))]);
   for(let frame=0;frame<60;frame++){placement.restore();mixer.setTime(0);placement.apply(1/60,ground,{golf});}
   for(const gap of soleGaps(rig,ground))assert.ok(Math.abs(gap)<.025,`${hero}/${theme}/${name}: support gap ${gap}`);
   // Imported native scales produce micrometre differences when rotations change.
   for(const [i,side]of ['r','l'].entries()){assert.ok(Math.abs(position(bones['thigh_'+side]).distanceTo(position(bones['calf_'+side]))-lengths[i][0])<1e-5);assert.ok(Math.abs(position(bones['calf_'+side]).distanceTo(position(bones['foot_'+side]))-lengths[i][1])<1e-5,`${hero}/${theme}/${name}: calf length change ${position(bones['calf_'+side]).distanceTo(position(bones['foot_'+side]))-lengths[i][1]}`);}
   assert.ok(position(bones.hand_l).sub(position(bones.hand_r)).distanceTo(handSpan)<1e-8,'Leg correction must preserve shared weapon grips');
   if(golf){assert.ok(position(bones.hand_r).distanceTo(hand)<1e-8);assert.ok(position(bones.pelvis).distanceTo(pelvis)<1e-8);}
   placement.restore();mixer.setTime(0);const before=position(bones.foot_r);placement.apply(1/60,ground,{enabled:false});assert.equal(placement.report,null);assert.ok(position(bones.foot_r).distanceTo(before)<1e-8);
  }
 }
});

test('Golf terrain support retains the native heel pivot on flat ground',async()=>{
 for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora']){
  const rig=await nativeRig(hero),{root,bones,mixer,placement,clips}=rig;
  const action=mixer.clipAction(clips.find(c=>c.name==='Golf_Swing')).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
  for(let frame=0;frame<=72;frame++){
   placement.restore();action.time=frame/30;mixer.update(0);root.updateMatrixWorld(true);
   const hands=['r','l'].map(s=>position(bones['hand_'+s]));
   const rotations=['r','l'].map(s=>bones['foot_'+s].getWorldQuaternion(new THREE.Quaternion()).normalize());
   placement.apply(1/60,()=>0,{golf:true});
   for(const [i,side]of ['r','l'].entries()){
    const now=bones['foot_'+side].getWorldQuaternion(new THREE.Quaternion()).normalize();
    // Native nonuniform bind scales produce about 0.001 degrees of roundoff.
    assert.ok(now.angleTo(rotations[i])<1e-4,`${hero}/${frame}: terrain support flattened the authored heel pivot`);
    assert.ok(position(bones['hand_'+side]).distanceTo(hands[i])<1e-8,`${hero}/${frame}: golf hand path changed`);
   }
   for(const gap of soleGaps(rig,()=>0))assert.ok(Math.abs(gap)<.002,`${hero}/${frame}: golf support gap ${gap}`);
   assert.ok(placement.report.feet.every(f=>f.reachError<.001),`${hero}/${frame}: native backswing leg was shortened`);
  }
 }
});
