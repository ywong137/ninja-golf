import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {calibrateLegHinge} from '../src/leg-hinge.js';
import {samplePlanarRoot} from '../src/attack-root-motion.js';
import {bakeAttackCurves} from '../tools/bake-attack-curves.mjs';
import {parseGlb} from '../tools/bake-native-golf.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../tools/native-leg-anatomy.mjs';

const file=new URL(process.env.NINJA_KNEE_MODEL_DIR?process.env.NINJA_KNEE_MODEL_DIR+'/kaede.glb':'../public/models/kaede.glb',import.meta.url);
const spec=JSON.parse(fs.readFileSync(new URL(process.env.NINJA_MOTION_RECORD||'../src/motion-data.json',import.meta.url))).Fan_Heavy_Rising;
test('Ace rising cut tracks native knees, drives upward, and holds world-space contacts',async t=>{
 const g=await loadNativeSkin(file),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o});
 const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const anatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const worst={hipTwist:0,ankleTwist:0};
 const soleVertices={r:[],l:[]};
 g.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex,skinWeight,position}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++)for(const side of ['r','l']){
   let weight=0;
   for(let k=0;k<4;k++)if(['foot_'+side,'ball_'+side].includes(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))weight+=skinWeight.getComponent(i,k);
   if(weight>.8)soleVertices[side].push([mesh,i]);
  }
 });
 for(const side of ['r','l'])assert.ok(soleVertices[side].length>20,'Missing weighted shoe surface');
 const soleMeshes=new Set([...soleVertices.r,...soleVertices.l].map(([mesh])=>mesh));
 const forward=Object.fromEntries(['pelvis','spine_03'].map(n=>[n,new T.Vector3(0,0,1).applyQuaternion(q(n).invert())]));
 const clip=g.animations.find(c=>c.name==='Fan_Heavy_Rising'),a=g.mixer.clipAction(clip).setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
 const rows=[],anchors={};
 for(let i=0;i<=Math.ceil(spec.duration*120);i++){
  const time=Math.min(i/120,spec.duration);a.time=time;g.mixer.update(0);const root=samplePlanarRoot(spec.planarRoot,time);g.scene.position.set(root.x,0,root.z);g.scene.updateMatrixWorld(true);
  const row={time,y:p('pelvis').y,pelvis:p('pelvis'),rearFoot:p('foot_l'),legs:{}};
  for(const mesh of soleMeshes)mesh.skeleton.update();
  const hip=forward.pelvis.clone().applyQuaternion(q('pelvis')),chest=forward.spine_03.clone().applyQuaternion(q('spine_03'));
  row.hipYaw=Math.atan2(hip.x,hip.z);row.chestYaw=Math.atan2(chest.x,chest.z);
  const turn=Math.atan2(chest.x,chest.z)-Math.atan2(hip.x,hip.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<.9,`${time}: chest separates too far from hips`);
  if(time>=1.05&&time<=1.2){
   const upper=p('lowerarm_l').sub(p('upperarm_l')),lower=p('hand_l').sub(p('lowerarm_l'));
   assert.ok(upper.angleTo(lower)<70*Math.PI/180,`${time}: free arm stays folded during recovery`);
  }
  for(const s of ['r','l']){
   // Check the actual shoe during recovery support, not only its joint proxy.
   const rearSupported=[...spec.footPlants.l,...spec.toePlants.l].some(([from,to])=>time>=from&&time<=to);
   if((s==='r'&&time>=.82&&time<=1.02)||(s==='l'&&rearSupported)){
    const bottom=Math.min(...soleVertices[s].map(([mesh,i])=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).y));
    assert.ok(Math.abs(bottom)<.003,`${s}/${time}: supported shoe floats or sinks`);
   }
   const upper=p('calf_'+s).sub(p('thigh_'+s)).normalize(),lower=p('foot_'+s).sub(p('calf_'+s)).normalize(),hinge=cal[s].hingeInThigh.clone().applyQuaternion(q('thigh_'+s));
   const deviation=Math.asin(Math.min(1,Math.abs(hinge.dot(lower)))),flex=Math.atan2(hinge.dot(upper.clone().cross(lower)),upper.dot(lower));row.legs[s]={flex};
   const measured=measureLegAnatomy(anatomy[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);
   worst.hipTwist=Math.max(worst.hipTwist,Math.abs(measured.hipTwist));
   worst.ankleTwist=Math.max(worst.ankleTwist,Math.abs(measured.ankleTwist));
   assert.ok(Math.abs(measured.hipTwist)<45,`${s}/${time}: knee correction twists the hip`);
   assert.ok(Math.abs(measured.ankleTwist)<15,`${s}/${time}: knee correction twists the ankle`);
   assert.ok(deviation<.1*Math.PI/180,`${s}/${time}: sideways knee`);assert.ok(flex>=0&&flex<135*Math.PI/180,`${s}/${time}: invalid flexion`);
   for(const[bone,intervals]of [['foot_',spec.footPlants[s]],['ball_',spec.toePlants[s]]])for(const[j,[start,end]]of intervals.entries()){
    if(time<=start+.02||time>=end-.02)continue;
    const point=p(bone+s),key=bone+s+j;anchors[key]??=point;
    assert.ok(point.distanceTo(anchors[key])<.003,`${key}: support slides or lifts at ${time}`);
   }
  }
  rows.push(row);
 }
 const impact=rows.reduce((a,b)=>Math.abs(a.time-spec.impacts[0])<Math.abs(b.time-spec.impacts[0])?a:b);
 assert.ok(impact.legs.l.flex>15*Math.PI/180&&impact.legs.l.flex<40*Math.PI/180,'The rear leg must extend into the lunge');
 assert.ok(impact.legs.r.flex>65*Math.PI/180,'The front leg must accept the weight');
 const y=t=>rows.reduce((a,b)=>Math.abs(a.time-t)<Math.abs(b.time-t)?a:b).y;
 assert.ok(y(.8)-y(.5)>.08,'Legs must extend during the rising stroke');
 const recovery=rows.filter(row=>row.time>=.7&&row.time<=1.2);
 for(let i=1;i<recovery.length;i++)assert.ok(recovery[i].pelvis.z>=recovery[i-1].pelvis.z-.001,'Recovery must carry the body forward without falling back');
 // Recovery has no hit. Reject the old abrupt turn back to the ready stance.
 for(let i=1;i<rows.length;i++)if(rows[i-1].time>=.78&&rows[i].time<=1.4){
  for(const key of ['hipYaw','chestYaw']){
   const delta=rows[i][key]-rows[i-1][key],rate=Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))/(rows[i].time-rows[i-1].time);
   assert.ok(rate<600*Math.PI/180,`${key}: recovery turns too abruptly at ${rows[i].time}`);
  }
 }
 const rearToeOff=spec.toePlants.l.find(([start])=>start<spec.impacts[0])?.[1];
 const rearLanding=Math.min(...[...spec.footPlants.l,...spec.toePlants.l].filter(([start])=>start>rearToeOff).map(([start])=>start));
 const rearFlatLanding=spec.footPlants.l.find(([start])=>start>spec.impacts[0])?.[0];
 // The rear thigh must pass outside its partner as the pelvis unwinds.
 // The earlier 0.24s straight step landed too soon and crossed thigh surfaces.
 assert.ok(rearLanding-rearToeOff>0&&rearLanding-rearToeOff<=.33,'The rear foot must catch the body during recovery');
 const finalRearFoot=rows.at(-1).rearFoot;
 for(const row of rows.filter(row=>row.time>=rearFlatLanding))assert.ok(row.rearFoot.distanceTo(finalRearFoot)<.003,'The rear foot must land in its final stance without sliding back');
 for(let i=2;i<rows.length-2;i++){
  const before=rows[i-2],at=rows[i],after=rows[i+2],dt=(after.time-before.time)/2;
  if(Math.abs(at.time-before.time-dt)>1e-7)continue;
  assert.ok((after.y-2*at.y+before.y)/dt**2>-10,`Crouch falls faster than gravity at ${at.time}`);
 }
 t.diagnostic(JSON.stringify(worst));
});

test('Reviewed attack curves reject a different rig and preserve unrelated payloads',()=>{
 const raw=fs.readFileSync(file),source=parseGlb(raw),curves=JSON.parse(gunzipSync(fs.readFileSync(new URL('../tools/motion-sources/ace-rising-curves.json.gz',import.meta.url))));
 assert.throws(()=>bakeAttackCurves(raw,{...curves,rigSha256:'different'}),/skeleton changed/);
 const after=parseGlb(bakeAttackCurves(raw,curves));
 assert.ok(after.bin.subarray(0,source.bin.length).equals(source.bin));
 for(const key of ['nodes','skins','meshes','materials','images'])assert.deepEqual(after.doc[key],source.doc[key]);
 for(const clip of source.doc.animations.filter(c=>c.name!==curves.clip))assert.deepEqual(after.doc.animations.find(c=>c.name===clip.name),clip);
 const bad=structuredClone(curves);bad.channels[0].times[1]=0;assert.throws(()=>bakeAttackCurves(raw,bad),/times/);
});
