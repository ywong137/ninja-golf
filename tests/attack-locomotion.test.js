import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AttackLocomotion} from '../src/attack-locomotion.js';
const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
globalThis.ProgressEvent??=class{};
async function rig(hero,prefix){
 const raw=fs.readFileSync(new URL(`../public/models/${hero}.glb`,import.meta.url)),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),bin=raw.subarray(28+size);
 for(const key of ['meshes','materials','textures','images'])delete doc[key];for(const node of doc.nodes){delete node.mesh;delete node.skin;}
 doc.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),''),root=new T.Group();root.scale.setScalar(1.1);root.add(gltf.scene);const bones={};gltf.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 return{root,bones,mixer:new T.AnimationMixer(gltf.scene),clips:gltf.animations,steps:new AttackLocomotion(root,gltf.scene,bones,gltf.animations,prefix,motions)};
}
const heroes=[['ronin','Odachi',''],['shinobi','Twin','Twin_'],['monk','Naginata',''],['kaede','Fan','Fan_'],['ayame','Ring','Ring_'],['sora','Sickle','Sickle_']];
test('Moving attacks step in eight directions with native legs across all six heroes',async()=>{
 for(const [hero,prefix,attackPrefix]of heroes){
  const {root,bones,mixer,clips,steps}=await rig(hero,prefix),clip=clips.find(c=>c.name===attackPrefix+'Cut_Diagonal'),action=mixer.clipAction(clip).play();
  for(let direction=0;direction<8;direction++){
   const angle=direction*Math.PI/4,speed=2.5;steps.restore();steps.reset();root.position.set(0,0,0);let maxError=0,maxLift=0,footMin=Infinity,footMax=-Infinity;
   for(let frame=0;frame<120;frame++){
    steps.restore();action.time=clip.duration*.4;mixer.update(0);root.position.x+=Math.sin(angle)*speed/60;root.position.z+=Math.cos(angle)*speed/60;
    const report=steps.apply(1/60,{active:true,speed,angle});root.updateMatrixWorld(true);
    assert.ok(report);for(const foot of steps.report.feet)maxError=Math.max(maxError,foot.error);
    if(frame>20){const y=bones.foot_r.getWorldPosition(new T.Vector3()).y;footMin=Math.min(footMin,y);footMax=Math.max(footMax,y);}
   }
   maxLift=footMax-footMin;
   assert.ok(maxError<.06,`${hero}/${direction}: unreachable leg ${maxError}`);
   assert.ok(maxLift>.07,`${hero}/${direction}: no visible foot recovery ${maxLift}`);
  }
  steps.restore();steps.reset();action.time=clip.duration*.4;mixer.update(0);root.updateMatrixWorld(true);const before=bones.foot_r.getWorldPosition(new T.Vector3());
  assert.equal(steps.apply(1/60,{active:false,speed:0}),null);assert.ok(before.distanceTo(bones.foot_r.getWorldPosition(new T.Vector3()))<1e-8,'Stationary attacks keep their authored steps');steps.dispose();
 }
});

test('Releasing backward or sideways attack movement keeps the last heading and limits foot displacement',async()=>{
 const {root,bones,mixer,clips,steps}=await rig('kaede','Fan'),clip=clips.find(c=>c.name==='Fan_Cut_Diagonal'),action=mixer.clipAction(clip).play();
 const pose=()=>{steps.restore();action.time=clip.duration*.4;mixer.update(0);root.updateMatrixWorld(true);};
 const feet=()=>['r','l'].map(s=>bones['foot_'+s].getWorldPosition(new T.Vector3()));
 for(let d=1;d<8;d++)for(let p=0;p<40;p++){
  const angle=d*Math.PI/4,phase=p/40;pose();steps.phase=phase;steps.weight=1;steps.angle=angle;steps.apply(0,{active:true,speed:2.5,angle});const before=feet();
  pose();steps.phase=phase;steps.weight=1;steps.angle=angle;steps.apply(1/60,{active:false,speed:0,angle:0});const released=feet();
  pose();steps.phase=phase;steps.weight=1;steps.angle=angle;steps.apply(1/60,{active:false,speed:0,angle});const held=feet();
  for(let side=0;side<2;side++){assert.ok(released[side].distanceTo(held[side])<1e-8,'Discarded input direction changes the foot pose');assert.ok(released[side].distanceTo(before[side])<.05,'Foot jumps when movement stops');}
 }
 steps.dispose();
});
