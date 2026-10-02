import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Quaternion,Vector3} from 'three';
import {SourceTerrainFrame} from '../src/source-terrain-frame.js';
import {WARRIORS} from '../src/warriors.js';
import {ENEMY_APPEARANCES} from '../src/enemy-appearances.js';
import {loadNativeSkin} from './native-skin-helper.mjs';

const q=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();
const p=bone=>bone.getWorldPosition(new Vector3());

for(const character of [...WARRIORS,...ENEMY_APPEARANCES])test(`${character.model}: terrain plane preserves leg shape, chest attitude, and paired-hand relationship`,async()=>{
 const g=await loadNativeSkin(new URL('../public/models/'+character.model+'.glb',import.meta.url)),root=new Group(),bones={};root.add(g.scene);root.scale.setScalar(1.1);
 g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});root.updateMatrixWorld(true);
 const terrain=new SourceTerrainFrame(root,g.scene,bones),clip=g.animations.find(c=>c.name==='Run_Forward')??g.animations.find(c=>c.name==='Jog_Fwd_Loop');
 assert.ok(clip);const action=g.mixer.clipAction(clip).setEffectiveTimeScale(0).play();
 for(const yaw of [0,1.1])for(const [sx,sz]of [[0,0],[.08,0],[0,.08],[0,-.08],[.07,-.06]])for(const phase of [.02,.2,.55,.8]){
  terrain.reset();root.rotation.y=yaw;action.time=clip.duration*phase;g.mixer.update(0);root.updateMatrixWorld(true);
  const local=new Map(Object.values(bones).map(b=>[b,b.quaternion.clone()]));
  const segments=Object.fromEntries(['r','l'].map(s=>[s,['thigh','calf','foot','ball'].map(n=>p(bones[n+'_'+s]))]));
  const chest=q(bones.spine_03),right=q(bones.hand_r),left=q(bones.hand_l),palms=p(bones.hand_l).sub(p(bones.hand_r));
  let plane;for(let i=0;i<150;i++)plane=terrain.apply(1/60,(x,z)=>sx*x+sz*z,{active:true});
  for(const side of ['r','l']){
   const before=segments[side],after=['thigh','calf','foot','ball'].map(n=>p(bones[n+'_'+side]));
   for(let i=1;i<4;i++)assert.ok(Math.abs(before[i].distanceTo(before[i-1])-after[i].distanceTo(after[i-1]))<1e-5);
   const angle=a=>a[1].clone().sub(a[0]).angleTo(a[2].clone().sub(a[1]));
   assert.ok(Math.abs(angle(before)-angle(after))<1e-5,'Slope changed the source knee flexion');
  }
  assert.ok(q(bones.spine_03).angleTo(chest)<1e-5,'Slope changed the recorded chest attitude');
  assert.ok(q(bones.hand_r).angleTo(right)<1e-5&&q(bones.hand_l).angleTo(left)<1e-5,'Slope twisted a wrist');
  assert.ok(p(bones.hand_l).sub(p(bones.hand_r)).distanceTo(palms)<1e-5,'Torso compensation opened the paired grip');
  for(const [x,z]of [[.2,.3],[-.4,.1],[.1,-.7]])assert.ok(Math.abs(plane.height(x,z)-(sx*x+sz*z))<1e-6,'Reference plane disagrees with terrain');
  terrain.restore();root.updateMatrixWorld(true);
  for(const [b,rotation]of local)assert.deepEqual(b.quaternion.toArray(),rotation.toArray(),'Restoring terrain changed '+b.name);
 }
});

test('terrain adaptation limits tilt and turn speed, returns smoothly to upright, and clears invalid terrain',()=>{
 const root=new Group(),model=new Group();root.add(model);const terrain=new SourceTerrainFrame(root,model);
 let previous=terrain.normal.clone();
 for(let i=0;i<120;i++){
  terrain.apply(1/60,(x,z)=>.8*z,{active:true});
  assert.ok(terrain.normal.angleTo(previous)<=1.2/60+1e-7);previous.copy(terrain.normal);
  assert.ok(terrain.normal.angleTo(new Vector3(0,1,0))<=12*Math.PI/180+1e-7);
 }
 for(let i=0;i<120;i++){
  terrain.apply(1/60,(x,z)=>.8*z,{active:false});
  assert.ok(terrain.normal.angleTo(previous)<=1.2/60+1e-7);previous.copy(terrain.normal);
 }
 assert.equal(terrain.plane,null);assert.ok(model.quaternion.angleTo(new Quaternion())<1e-7);
 terrain.apply(1/60,()=>NaN,{active:true});assert.equal(terrain.plane,null);
});
