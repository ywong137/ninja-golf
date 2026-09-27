/** CPU-only comparison of baked native locomotion and protected animation bytes. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
if(args.includes('--help')){console.log('node tools/check-native-locomotion.mjs --before DIRECTORY [--heroes ronin,kaede]');process.exit(0);}
const before=option('--before',null);if(!before)throw new Error('Pass --before DIRECTORY containing the previous hero GLBs');
const heroes=option('--heroes','ronin,shinobi,monk,kaede,ayame,sora').split(','),specs=JSON.parse(fs.readFileSync(new URL('../src/locomotion-data.json',import.meta.url)));
globalThis.ProgressEvent??=class{};
function read(file){const raw=fs.readFileSync(file),length=raw.readUInt32LE(12);return{doc:JSON.parse(raw.subarray(20,20+length)),bin:raw.subarray(28+length)};}
function accessorBytes(asset,index){const a=asset.doc.accessors[index],v=asset.doc.bufferViews[a.bufferView],start=v.byteOffset||0;return asset.bin.subarray(start,start+v.byteLength);}
async function rig(asset){const j=structuredClone(asset.doc);j.buffers[0].uri='data:application/octet-stream;base64,'+asset.bin.toString('base64');delete j.images;delete j.textures;delete j.materials;delete j.meshes;delete j.skins;for(const n of j.nodes){delete n.mesh;delete n.skin;}const gltf=await new GLTFLoader().parseAsync(JSON.stringify(j),''),mixer=new T.AnimationMixer(gltf.scene);return{gltf,mixer};}
function point(r,name){return r.gltf.scene.getObjectByName(name).getWorldPosition(new T.Vector3());}
function rotation(r,name){return r.gltf.scene.getObjectByName(name).getWorldQuaternion(new T.Quaternion()).normalize();}
function sample(r,name,t){r.mixer.stopAllAction();const a=r.mixer.clipAction(r.gltf.animations.find(c=>c.name===name)).play();a.time=t;r.mixer.update(0);r.gltf.scene.updateMatrixWorld(true);}
const reports=[];
for(const hero of heroes){
 const old=read(path.join(before,hero+'.glb')),current=read(new URL('../public/models/'+hero+'.glb',import.meta.url));
 let protectedClips=0;for(const a of old.doc.animations){if(specs[a.name])continue;const b=current.doc.animations.find(c=>c.name===a.name);assert.deepEqual(b,a,`${hero}: protected clip descriptor ${a.name}`);for(const sampler of a.samplers)for(const key of ['input','output'])assert.ok(accessorBytes(old,sampler[key]).equals(accessorBytes(current,sampler[key])),`${hero}: protected ${a.name} bytes`);protectedClips++;}
 const a=await rig(old),b=await rig(current);
 for(const [name,spec]of Object.entries(specs)){
  let maxFootDelta=0,maxKeyFootDelta=0,maxStanceDelta=0,maxKeyStanceDelta=0,maxFootRotation=0,maxKeyFootRotation=0,maxCoreRotation=0,minimumKnee=1,worstKnee=null,maxReach=0,maxLengthError=0;const rises=[],hipYaws=[];
  const count=Math.round(spec.duration*60),phases=[...new Set([...Array.from({length:121},(_,i)=>i/120),...Array.from({length:count+1},(_,i)=>i/count)])].sort((a,b)=>a-b);
  for(const phase of phases){
   const isKey=Math.abs(phase*count-Math.round(phase*count))<1e-7;sample(a,name,phase*spec.duration);sample(b,name,phase*spec.duration);rises.push(point(b,'pelvis').y-point(a,'pelvis').y);
   const hipLine=point(b,'thigh_l').sub(point(b,'thigh_r'));hipYaws.push(Math.atan2(-hipLine.z,hipLine.x));
   maxCoreRotation=Math.max(maxCoreRotation,rotation(a,'spine_03').angleTo(rotation(b,'spine_03')));
   for(const side of ['r','l']){
    const delta=point(a,'foot_'+side).distanceTo(point(b,'foot_'+side));maxFootDelta=Math.max(maxFootDelta,delta);if(isKey)maxKeyFootDelta=Math.max(maxKeyFootDelta,delta);const footPhase=(phase+(side==='r'?0:.5))%1;if(footPhase<spec.support-.00001){maxStanceDelta=Math.max(maxStanceDelta,delta);if(isKey)maxKeyStanceDelta=Math.max(maxKeyStanceDelta,delta);}const footAngle=rotation(a,'foot_'+side).angleTo(rotation(b,'foot_'+side));maxFootRotation=Math.max(maxFootRotation,footAngle);if(isKey)maxKeyFootRotation=Math.max(maxKeyFootRotation,footAngle);
    const hip=point(b,'thigh_'+side),knee=point(b,'calf_'+side),ankle=point(b,'foot_'+side),axis=ankle.clone().sub(hip),bend=knee.clone().sub(hip).addScaledVector(axis,-knee.clone().sub(hip).dot(axis)/axis.lengthSq());if(bend.z<minimumKnee){minimumKnee=bend.z;worstKnee={phase,side,bend: bend.toArray(),reach:hip.distanceTo(ankle)/(hip.distanceTo(knee)+knee.distanceTo(ankle))};}maxReach=Math.max(maxReach,hip.distanceTo(ankle)/(hip.distanceTo(knee)+knee.distanceTo(ankle)));
    maxLengthError=Math.max(maxLengthError,Math.abs(hip.distanceTo(knee)-point(a,'thigh_'+side).distanceTo(point(a,'calf_'+side))),Math.abs(knee.distanceTo(ankle)-point(a,'calf_'+side).distanceTo(point(a,'foot_'+side))));
   }
  }
  const report={hero,name,protectedClips,maxFootDelta,maxKeyFootDelta,maxStanceDelta,maxKeyStanceDelta,maxFootRotation,maxKeyFootRotation,maxCoreRotation,minimumKnee,worstKnee,maxReach,maxLengthError,minLift:Math.min(...rises),maxLift:Math.max(...rises),meanLift:rises.reduce((s,v)=>s+v,0)/rises.length,hipYawRange:Math.max(...hipYaws)-Math.min(...hipYaws)};reports.push(report);
 }
}
console.log(JSON.stringify(reports,null,2));
// Imported female rigs retain tiny nonuniform scales; allow at most 0.05 mm world-length residual.
for(const r of reports){assert.ok(r.maxKeyStanceDelta<.0001&&r.maxStanceDelta<.002,`Foot target changed: ${JSON.stringify(r)}`);assert.ok(r.maxKeyFootRotation<.0002&&r.maxFootRotation<.002,`Foot orientation changed: ${JSON.stringify(r)}`);assert.ok(r.maxCoreRotation<.001,`Source upper-body rotation changed: ${JSON.stringify(r)}`);assert.ok(r.maxLengthError<.00005,`Native limb stretched: ${JSON.stringify(r)}`);assert.ok(r.minimumKnee>.02,`Knee bend lost: ${JSON.stringify(r)}`);assert.ok(r.minLift>-.001&&r.maxLift>.015,`Posture refinement absent: ${JSON.stringify(r)}`);}

// Measure the actual hip joints, since compensating spine_01 cancels pelvis rotation.
for(const r of reports.filter(r=>r.name==='Run_Forward'))assert.ok(r.hipYawRange>5*Math.PI/180,`Hip coupling lost: ${JSON.stringify(r)}`);
