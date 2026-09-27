/** Audit selected native arm repairs, preserving bodies and every unrelated clip byte. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const usage='node tools/check-native-reach.mjs --before BASELINE_DIRECTORY';
if(process.argv.includes('--help')){console.log(usage);process.exit(0);}
const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--before'||!args[1])throw new Error(`Usage: ${usage}`);const before=args[1];
const selected={shinobi:['Twin_Cut_Diagonal','Twin_Heavy_Cleave','Twin_Heavy_Slam','Twin_Musou_Flow'],ayame:['Ring_Musou_Flow']};globalThis.ProgressEvent??=class{};
function read(file){const raw=fs.readFileSync(file),size=raw.readUInt32LE(12);return{doc:JSON.parse(raw.subarray(20,20+size)),bin:raw.subarray(28+size)};}
function bytes(asset,index){const a=asset.doc.accessors[index],v=asset.doc.bufferViews[a.bufferView];return asset.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}
async function rig(asset){const j=structuredClone(asset.doc);j.buffers[0].uri='data:application/octet-stream;base64,'+asset.bin.toString('base64');for(const k of ['images','textures','materials','meshes','skins'])delete j[k];for(const n of j.nodes){delete n.mesh;delete n.skin;}const gltf=await new GLTFLoader().parseAsync(JSON.stringify(j),'');return{gltf,mixer:new T.AnimationMixer(gltf.scene)};}
const reports=[];
for(const [hero,names]of Object.entries(selected)){
 const old=read(path.join(before,hero+'.glb')),current=read(new URL('../public/models/'+hero+'.glb',import.meta.url));let protectedClips=0;
 for(const key of ['meshes','nodes','skins','materials','textures','images'])assert.deepEqual(current.doc[key],old.doc[key],`${hero}: changed ${key}`);
 for(const mesh of old.doc.meshes)for(const primitive of mesh.primitives)for(const i of [...Object.values(primitive.attributes),primitive.indices].filter(v=>v!==undefined))assert.ok(bytes(old,i).equals(bytes(current,i)),`${hero}: body bytes changed`);
 for(const image of old.doc.images){const v=old.doc.bufferViews[image.bufferView];assert.ok(old.bin.subarray(v.byteOffset,v.byteOffset+v.byteLength).equals(current.bin.subarray(v.byteOffset,v.byteOffset+v.byteLength)),`${hero}: texture bytes changed`);}
 for(const a of old.doc.animations){if(names.includes(a.name))continue;const b=current.doc.animations.find(c=>c.name===a.name);assert.deepEqual(a,b,`${hero}: protected ${a.name} descriptor`);for(const sampler of a.samplers)for(const key of ['input','output'])assert.ok(bytes(old,sampler[key]).equals(bytes(current,sampler[key])),`${hero}: protected ${a.name} bytes`);protectedClips++;}
 const rigs=await Promise.all([old,current].map(rig));
 for(const name of names){
  const clips=rigs.map(r=>r.gltf.animations.find(c=>c.name===name));assert.equal(clips[0].duration,clips[1].duration,`${name}: duration changed`);const actions=rigs.map((r,i)=>{r.mixer.stopAllAction();const a=r.mixer.clipAction(clips[i]);a.play();return a;});let maximumReach=0,maximumKeyAxisChange=0,maximumAxisChange=0,maximumSupportChange=0;
  for(let i=0;i<=Math.ceil(clips[0].duration*240);i++){
   const time=Math.min(clips[0].duration,i/240);const samples=rigs.map((r,index)=>{actions[index].time=time;r.mixer.update(0);r.gltf.scene.updateMatrixWorld(true);const point=n=>r.gltf.scene.getObjectByName(n).getWorldPosition(new T.Vector3());return {point,axes:['r','l'].map(side=>point('PalmShaft_'+side).sub(point('PalmGrip_'+side)).normalize())};});
   for(const [index,side]of ['r','l'].entries()){
    const p=samples[1].point,shoulder=p('upperarm_'+side),elbow=p('lowerarm_'+side),wrist=p('hand_'+side);maximumReach=Math.max(maximumReach,shoulder.distanceTo(wrist)/(shoulder.distanceTo(elbow)+elbow.distanceTo(wrist)));
    const angle=samples[0].axes[index].angleTo(samples[1].axes[index])*180/Math.PI;maximumAxisChange=Math.max(maximumAxisChange,angle);if((side==='r'||hero==='shinobi')&&Math.abs(time*30-Math.round(time*30))<1e-5)maximumKeyAxisChange=Math.max(maximumKeyAxisChange,angle);
    for(const bone of ['pelvis','thigh_'+side,'calf_'+side,'foot_'+side])maximumSupportChange=Math.max(maximumSupportChange,p(bone).distanceTo(samples[0].point(bone)));
   }
  }
  reports.push({hero,name,protectedClips,maximumReach,maximumKeyAxisChange,maximumAxisChange,maximumSupportChange});
 }
}
console.log(JSON.stringify(reports,null,2));
for(const r of reports){assert.ok(r.maximumReach<.97,`Arm still locks: ${JSON.stringify(r)}`);assert.ok(r.maximumKeyAxisChange<.01,`Authored wrist axis changed: ${JSON.stringify(r)}`);assert.ok(r.maximumAxisChange<4,`Wrist interpolation changed excessively: ${JSON.stringify(r)}`);assert.ok(r.maximumSupportChange<.00001,`Lower-body motion changed: ${JSON.stringify(r)}`);}
