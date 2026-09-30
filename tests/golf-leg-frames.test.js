import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {resolveFootSupport} from '../src/foot-placement.js';
const motions=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url)));
const heroes=['ronin','shinobi','monk','kaede','ayame','sora'];
for(const hero of heroes)test(`${hero}: golf knees hinge forward and both forefeet remain planted`,async t=>{
 const g=await loadNativeSkin(process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url)),b={};g.scene.traverse(n=>{if(n.isBone)b[n.name]=n});g.scene.updateMatrixWorld(true);
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const shoeSurfaces={r:[],l:[]};
 g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const{skinIndex:ids,skinWeight:w,position}=mesh.geometry.attributes;for(const side of ['r','l']){const vertices=[];for(let i=0;i<position.count;i++){let amount=0;for(let k=0;k<4;k++)if(['foot_'+side,'ball_'+side].includes(mesh.skeleton.bones[ids.getComponent(i,k)].name))amount+=w.getComponent(i,k);if(amount>.9)vertices.push(i);}if(vertices.length)shoeSurfaces[side].push({mesh,vertices});}});
 const sole=side=>Math.min(...shoeSurfaces[side].flatMap(({mesh,vertices})=>{mesh.skeleton.update();return vertices.map(v=>mesh.getVertexPosition(v,new T.Vector3()).applyMatrix4(mesh.matrixWorld).y);}));
 const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
 const peak={hip:0,ankle:0,knee:0,toeDrift:0,soleDrift:0,pelvisSpeed:0,kneeSpeed:0,shoeSpeed:0,ankleOffPitch:0,samples:0};
 for(const name of ['Golf_Address','Golf_Swing','Golf_Putt']){
  g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();a.time=0;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const support=resolveFootSupport(clip,motions[name]),leadPlantEnd=support.footPlants.r[0][1];
  const floors={r:sole('r'),l:sole('l')},toes={r:p('ball_r').setY(0),l:p('ball_l').setY(0)},lead=p('foot_r'),leadQ=q('foot_r'),keys=[...new Set(clip.tracks.flatMap(t=>Array.from(t.times)))].sort((a,b)=>a-b);
  const times=[...new Set([...keys,...keys.slice(1).map((t,i)=>(t+keys[i])/2),...Array.from({length:Math.ceil(clip.duration*480)+1},(_,i)=>Math.min(i/480,clip.duration))])].sort((a,b)=>a-b);let last=null;
  for(const time of times){a.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);const sample={time,pelvis:p('pelvis'),knees:{r:p('calf_r'),l:p('calf_l')},shoes:{r:q('foot_r'),l:q('foot_l')}};
   for(const s of ['r','l']){
    const m=measureLegAnatomy(cal[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);peak.samples++;peak.hip=Math.max(peak.hip,Math.abs(m.hipTwist));peak.ankle=Math.max(peak.ankle,Math.abs(m.ankleTwist));peak.knee=Math.max(peak.knee,m.kneeDeviation);peak.ankleOffPitch=Math.max(peak.ankleOffPitch,m.ankleOffPitch);peak.toeDrift=Math.max(peak.toeDrift,p('ball_'+s).setY(0).distanceTo(toes[s]));
    assert.ok(Math.abs(m.hipTwist)<45&&Math.abs(m.ankleTwist)<17&&m.kneeDeviation<.1&&m.ankleOffPitch<24,`${name}/${time}/${s}: ${JSON.stringify(m)}`);
    if(Math.abs(time*120-Math.round(time*120))<1e-5)peak.soleDrift=Math.max(peak.soleDrift,Math.abs(sole(s)-floors[s]));
    assert.ok(m.kneeFlexion>0&&m.kneeFlexion<95,`${name}/${time}/${s}: reversed knee`);
    if(last&&time-last.time>1e-5){const dt=time-last.time;peak.kneeSpeed=Math.max(peak.kneeSpeed,sample.knees[s].distanceTo(last.knees[s])/dt);peak.shoeSpeed=Math.max(peak.shoeSpeed,sample.shoes[s].angleTo(last.shoes[s])/dt);}
   }
   if(last&&time-last.time>1e-5)peak.pelvisSpeed=Math.max(peak.pelvisSpeed,sample.pelvis.distanceTo(last.pelvis)/(time-last.time));
   if(time<=leadPlantEnd)assert.ok(p('foot_r').distanceTo(lead)<.0005,`${name}/${time}: lead ankle drift ${p('foot_r').distanceTo(lead)}`);
   if(name==='Golf_Swing'&&time>=1.91)assert.ok(Math.abs(q('foot_r').angleTo(leadQ)-35*Math.PI/180)<.001,'Lead foot loses its 35-degree finish pivot');
   last=sample;
  }
 }
 assert.ok(peak.toeDrift<.0005,`Forefoot slides horizontally during the swing: ${peak.toeDrift} m`);
 assert.ok(peak.soleDrift<.001,'Actual shoe surface leaves or penetrates its support plane');
 assert.ok(peak.kneeSpeed<4&&peak.shoeSpeed<6,`Leg frame changes abruptly: ${JSON.stringify(peak)}`);
 t.diagnostic(JSON.stringify(peak));
});
