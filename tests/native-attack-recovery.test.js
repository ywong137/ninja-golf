import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WARRIORS} from '../src/warriors.js';

// The same checks can run against independent pre-fix GLBs. No baseline asset
// or authoring formula participates in the normal shipping-asset assertions.
const directory=process.env.NINJA_NATIVE_RECOVERY_DIR;
const motionPath=directory?path.join(directory,'motion-data.json'):new URL('../src/motion-data.json',import.meta.url);
const motions=JSON.parse(readFileSync(motionPath));
globalThis.ProgressEvent??=class{};
async function loadRig(hero){
 const file=directory?path.join(directory,`${hero}.glb`):new URL(`../public/models/${hero}.glb`,import.meta.url);
 const raw=readFileSync(file),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
 doc.buffers[0].uri='data:application/octet-stream;base64,'+raw.subarray(28+size).toString('base64');
 for(const key of ['meshes','skins','materials','textures','images'])delete doc[key];
 for(const node of doc.nodes){delete node.mesh;delete node.skin;}
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
 return{...gltf,mixer:new THREE.AnimationMixer(gltf.scene)};
}
const RATE=240,DEGREES=180/Math.PI;
for(const hero of WARRIORS)test(`${hero.name}: native recovery has no elbow teleport or terminal wrist snap`,async t=>{
 const rig=await loadRig(hero.model),point=name=>rig.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 const activeNames=new Set(['Cut_Diagonal','Cut_Return','Cut_Rising','Cut_Sweep','Heavy_Cleave','Heavy_Rising','Heavy_Sweep','Heavy_Slam','Musou_Flow'].map(s=>{const key=(hero.motionPrefix||'')+s;return hero.motionOverrides?.[key]??key;}));
 const clips=rig.animations.filter(c=>activeNames.has(c.name));
 assert.equal(clips.length,9,`${hero.model}: incomplete attack family`);
 const failures=[],reports=[];
 for(const clip of clips){
  const spec=motions[clip.name],start=spec.impacts.at(-1)+.09;
  rig.mixer.stopAllAction();const action=rig.mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;
  const rows={r:[],l:[]},count=Math.ceil(clip.duration*RATE);
  for(let frame=0;frame<=count;frame++){
   // Include the actual final GLB sample, even when duration is not a multiple
   // of 1/240. Otherwise the old forced final wrist rotation escapes the test.
   const seconds=Math.min(clip.duration,frame/RATE);action.time=seconds;rig.mixer.update(0);rig.scene.updateMatrixWorld(true);
   for(const side of ['r','l']){
    const elbow=point('lowerarm_'+side).sub(point('upperarm_'+side));
    const wrist=rig.scene.getObjectByName('hand_'+side).getWorldQuaternion(new THREE.Quaternion()).normalize();
    const list=rows[side],previous=list.at(-1),dt=previous?seconds-previous.seconds:0;
    list.push({seconds,elbow,wrist,elbowSpeed:dt>1e-8?elbow.distanceTo(previous.elbow)/dt:0,wristSpeed:dt>1e-8?wrist.angleTo(previous.wrist)*DEGREES/dt:0});
   }
  }
  for(const side of ['r','l']){
   const recovery=rows[side].filter(r=>r.seconds>start),terminal=rows[side].filter(r=>r.seconds>clip.duration-.0125),preceding=rows[side].filter(r=>r.seconds>=clip.duration-.075&&r.seconds<=clip.duration-.0125);
   const elbow=recovery.reduce((a,b)=>b.elbowSpeed>a.elbowSpeed?b:a),wrist=terminal.reduce((a,b)=>b.wristSpeed>a.wristSpeed?b:a);
   const precedingSpeed=Math.max(...preceding.map(r=>r.wristSpeed));
   const report={clip:clip.name,side,elbowSpeed:elbow.elbowSpeed,elbowTime:elbow.seconds,terminalWristSpeed:wrist.wristSpeed,wristTime:wrist.seconds,precedingWristSpeed:precedingSpeed};reports.push(report);
   // 8 m/s equals 3.33 cm of elbow motion in one 240 Hz sample. This is already
   // a fast recovery, but rejects the measured 9.48–26.7 m/s elbow excursions.
   if(elbow.elbowSpeed>8)failures.push({...report,reason:'elbow recovery exceeds 8 m/s'});
   // A settled endpoint must not introduce a fresh angular acceleration spike.
   // Permit interpolation noise (20 deg/s), not a forced final-key rotation.
   if(wrist.wristSpeed>precedingSpeed*1.25+20)failures.push({...report,reason:'terminal wrist accelerates beyond its preceding recovery'});
  }
 }
 const worstElbow=reports.reduce((a,b)=>b.elbowSpeed>a.elbowSpeed?b:a);
 const worstTerminal=reports.reduce((a,b)=>b.terminalWristSpeed/(b.precedingWristSpeed*1.25+20)>a.terminalWristSpeed/(a.precedingWristSpeed*1.25+20)?b:a);
 t.diagnostic(JSON.stringify({hero:hero.model,clips:clips.length,worstElbow,worstTerminal}));
 assert.deepEqual(failures,[],`${hero.model}: native recovery defects\n${JSON.stringify(failures,null,2)}`);
});
