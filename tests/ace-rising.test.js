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

const file=new URL('../public/models/kaede.glb',import.meta.url);
const spec=JSON.parse(fs.readFileSync(new URL('../src/motion-data.json',import.meta.url))).Fan_Heavy_Rising;
test('Ace rising cut tracks native knees, drives upward, and holds world-space contacts',async()=>{
 const g=await loadNativeSkin(file),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o});
 const p=n=>b[n].getWorldPosition(new T.Vector3()),q=n=>b[n].getWorldQuaternion(new T.Quaternion()).normalize();
 const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegHinge(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
 const forward=Object.fromEntries(['pelvis','spine_03'].map(n=>[n,new T.Vector3(0,0,1).applyQuaternion(q(n).invert())]));
 const clip=g.animations.find(c=>c.name==='Fan_Heavy_Rising'),a=g.mixer.clipAction(clip).setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
 const rows=[],anchors={};
 for(let i=0;i<=Math.ceil(spec.duration*120);i++){
  const time=Math.min(i/120,spec.duration);a.time=time;g.mixer.update(0);const root=samplePlanarRoot(spec.planarRoot,time);g.scene.position.set(root.x,0,root.z);g.scene.updateMatrixWorld(true);
  const row={time,y:p('pelvis').y,legs:{}};
  const hip=forward.pelvis.clone().applyQuaternion(q('pelvis')),chest=forward.spine_03.clone().applyQuaternion(q('spine_03'));
  const turn=Math.atan2(chest.x,chest.z)-Math.atan2(hip.x,hip.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<.9,`${time}: chest separates too far from hips`);
  for(const s of ['r','l']){
   const upper=p('calf_'+s).sub(p('thigh_'+s)).normalize(),lower=p('foot_'+s).sub(p('calf_'+s)).normalize(),hinge=cal[s].hingeInThigh.clone().applyQuaternion(q('thigh_'+s));
   const deviation=Math.asin(Math.min(1,Math.abs(hinge.dot(lower)))),flex=Math.atan2(hinge.dot(upper.clone().cross(lower)),upper.dot(lower));row.legs[s]={flex};
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
 for(let i=2;i<rows.length-2;i++){
  const before=rows[i-2],at=rows[i],after=rows[i+2],dt=(after.time-before.time)/2;
  if(Math.abs(at.time-before.time-dt)>1e-7)continue;
  assert.ok((after.y-2*at.y+before.y)/dt**2>-10,`Crouch falls faster than gravity at ${at.time}`);
 }
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
