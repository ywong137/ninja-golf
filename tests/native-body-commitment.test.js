import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WARRIORS} from '../src/warriors.js';

globalThis.ProgressEvent??=class{};
const asset=process.env.NINJA_NATIVE_BODY_DIR
 ?path.join(process.env.NINJA_NATIVE_BODY_DIR,'kaede.glb')
 :new URL('../public/models/kaede.glb',import.meta.url);

// This test reads the exported skeleton and animation. It does not import the
// authoring curves or derive its expected motion from their formulas.
test('Kaede cleave loads the rear support and commits her torso through the planted strike',async t=>{
 const raw=readFileSync(asset),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
 doc.buffers[0].uri='data:application/octet-stream;base64,'+raw.subarray(28+size).toString('base64');
 for(const key of ['meshes','skins','materials','textures','images'])delete doc[key];
 for(const node of doc.nodes){delete node.mesh;delete node.skin;}
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
 const name=WARRIORS.find(w=>w.model==='kaede').motionOverrides?.Fan_Heavy_Cleave??'Fan_Heavy_Cleave';
 const clip=gltf.animations.find(c=>c.name===name);assert.ok(clip,`Missing native ${name}`);
 const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play();
 const point=name=>gltf.scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());
 const orientation=name=>gltf.scene.getObjectByName(name).getWorldQuaternion(new THREE.Quaternion()).normalize();
 const timeScale=clip.duration/.76; // Preserve the reviewed phase windows when the heavy stroke slows.
 const samples=[],contacts={};let minKnee=180,maxKnee=0,maxSupportDrift=0,maxSupportTurn=0;
 for(let frame=22;frame<=112;frame++){
  const seconds=frame/240*timeScale;action.time=seconds;mixer.update(0);gltf.scene.updateMatrixWorld(true);
  const leftHip=point('thigh_l'),rightHip=point('thigh_r'),pelvis=leftHip.clone().add(rightHip).multiplyScalar(.5);
  const shoulders=point('upperarm_l').add(point('upperarm_r')).multiplyScalar(.5);
  const lateral=leftHip.clone().sub(rightHip);lateral.y=0;lateral.normalize();
  const forward=lateral.clone().cross(new THREE.Vector3(0,1,0)).normalize(),torso=shoulders.sub(pelvis);
  const leftFoot=point('foot_l'),rightFoot=point('foot_r'),supportLine=leftFoot.clone().sub(rightFoot);supportLine.y=0;
  // Horizontal hip projection: 0 is rear/right ankle, 1 is lead/left ankle.
  // This checks visible transfer across the support base, not physical COM.
  // Discard vertical ankle lift so the entering foot cannot fake a weight shift.
  const leadFraction=pelvis.clone().sub(rightFoot).dot(supportLine)/supportLine.lengthSq();
  samples.push({seconds,lean:Math.atan2(torso.dot(forward),torso.y)*180/Math.PI,leadFraction});
  for(const side of ['r','l']){
   const foot=side==='r'?rightFoot:leftFoot;
   // The rear toe stays fixed during its heel pivot. The lead foot plants
   // before contact and stays fixed through the low finish.
   if(side==='r'||seconds>=.3375*timeScale){
    const support=side==='r'?point('ball_r'):foot;
    const q=orientation('foot_'+side);contacts[side]??={position:support.clone(),rotation:q.clone()};
    maxSupportDrift=Math.max(maxSupportDrift,support.distanceTo(contacts[side].position));
    if(side==='l')maxSupportTurn=Math.max(maxSupportTurn,q.angleTo(contacts[side].rotation));
   }
   if(seconds>=.3375*timeScale){
    const knee=point('calf_'+side),upper=point('thigh_'+side).sub(knee),lower=foot.clone().sub(knee);
    const flexion=180-upper.angleTo(lower)*180/Math.PI;minKnee=Math.min(minKnee,flexion);maxKnee=Math.max(maxKnee,flexion);
   }
  }
 }
 const mean=(a,b,key)=>{const rows=samples.filter(s=>s.seconds>=a*timeScale&&s.seconds<=b*timeScale);assert.ok(rows.length>=9);return rows.reduce((sum,s)=>sum+s[key],0)/rows.length;};
 const rearLoad=mean(.10,.14,'leadFraction'),leadBrace=mean(.40,.45,'leadFraction'),strikeLean=mean(.36,.45,'lean');
 const report={rearLoad,leadBrace,transfer:leadBrace-rearLoad,strikeLean,minKnee,maxKnee,maxSupportDrift,maxSupportTurnDegrees:maxSupportTurn*180/Math.PI};
 t.diagnostic(JSON.stringify(report));
 const failures=[];
 // These phase-window averages require a sustained pose, not one exaggerated
 // sample. The old upright clip averaged about 10 degrees through this strike;
 // the reviewed pilot averages about 18 degrees with a distinct rear/front load.
 if(strikeLean<16)failures.push('Torso does not commit at least 16 degrees through impact/follow-through');
 if(rearLoad>.40)failures.push('Entry does not visibly load the rear support');
 if(leadBrace<.64)failures.push('Follow-through does not brace over the lead support');
 if(leadBrace-rearLoad<.25)failures.push('Hip projection does not transfer a quarter of the support span');
 if(minKnee<25||maxKnee>110)failures.push('Braced knees become straight or excessively folded');
 if(maxSupportDrift>.003||maxSupportTurn>THREE.MathUtils.degToRad(.25))failures.push('Planted ankles drift or turn through the strike');
 assert.deepEqual(failures,[],JSON.stringify(report));
});
