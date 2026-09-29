import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegHinge,alignLegHinge} from '../src/leg-hinge.js';
import {FootPlacement} from '../src/foot-placement.js';

// Imported nonuniform bind scales add up to 20 micrometres and 0.002 degrees
// when world rotations are decomposed. Keep tolerances below visible movement.
const p=bone=>bone.getWorldPosition(new T.Vector3());
const q=bone=>bone.getWorldQuaternion(new T.Quaternion()).normalize();
function offHinge(bones,side,cal){
 const upper=p(bones['calf_'+side]).sub(p(bones['thigh_'+side])).normalize();
 const lower=p(bones['foot_'+side]).sub(p(bones['calf_'+side])).normalize();
 const hinge=cal.hingeInThigh.clone().applyQuaternion(q(bones['thigh_'+side]));
 return{deviation:Math.asin(Math.min(1,Math.abs(hinge.dot(lower)))),flex:Math.atan2(hinge.dot(upper.clone().cross(lower)),upper.dot(lower))};
}

test('Native knee frames preserve solved joints and shoe orientation under an outer transform',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/kaede.glb',import.meta.url)),bones={};
 g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b});
 g.scene.position.set(2,4,-3);g.scene.rotation.set(.12,.73,-.08);g.scene.scale.setScalar(1.1);g.scene.updateMatrixWorld(true);
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegHinge(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
 const clip=g.animations.find(c=>c.name==='Fan_Cut_Rising'),a=g.mixer.clipAction(clip).setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
 let maximumOriginalDeviation=0;
 for(const time of [0,.15,.30,.45,.60]){
  a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  for(const s of ['r','l']){
   const names=['thigh_','calf_','foot_','ball_'].map(n=>n+s),before=names.map(n=>p(bones[n])),shoe=q(bones['foot_'+s]);
   maximumOriginalDeviation=Math.max(maximumOriginalDeviation,offHinge(bones,s,cal[s]).deviation);
   alignLegHinge(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],cal[s]);
   names.forEach((n,i)=>assert.ok(p(bones[n]).distanceTo(before[i])<5e-5,`${n}: joint moved ${p(bones[n]).distanceTo(before[i])}`));
   assert.ok(q(bones['foot_'+s]).angleTo(shoe)<1e-4,'Shoe rotation changed');
   const m=offHinge(bones,s,cal[s]);assert.ok(m.deviation<1e-4,'Knee bends across its hinge');assert.ok(m.flex>=-1e-5,'Knee bends backward');
  }
 }
 assert.ok(maximumOriginalDeviation>.05,'Fixture must expose the old direction-only solve');
});

test('Authored slope correction preserves native knee hinges and restores source poses',async()=>{
 const g=await loadNativeSkin(new URL('../public/models/kaede.glb',import.meta.url)),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b});
 const placement=new FootPlacement(g.scene,bones),clip=g.animations.find(c=>c.name==='Fan_Cut_Rising'),a=g.mixer.clipAction(clip).setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
 for(const slope of [0,.14,-.2])for(const time of [.15,.3,.45]){
  placement.restore();a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const source=Object.fromEntries(['pelvis','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l'].map(n=>[n,{p:bones[n].position.clone(),q:bones[n].quaternion.clone()}]));
  const hand=p(bones.hand_r);
  placement.apply(1/60,(x,z)=>slope*z,{preserveAuthored:true,preserveHinge:true,contactWeights:{r:1,l:1},stance:{r:true,l:true}});
  for(const s of ['r','l'])assert.ok(offHinge(bones,s,placement.hinges[s]).deviation<1e-4,JSON.stringify({s,time,slope,...offHinge(bones,s,placement.hinges[s])}));
  if(slope===0)assert.ok(p(bones.hand_r).distanceTo(hand)<1e-8);
  placement.restore();for(const[n,v]of Object.entries(source)){assert.ok(bones[n].position.distanceTo(v.p)<1e-9);assert.ok(bones[n].quaternion.clone().normalize().angleTo(v.q.clone().normalize())<1e-7);}
 }
});
