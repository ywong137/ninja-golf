import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {enemyStrideRate} from '../src/enemy-locomotion.js';
import {ENEMY_TYPES} from '../src/combat.js';
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];

test('enemy stride pacing reduces ground-contact sliding at each combat role speed',async t=>{
 const g=await loadNativeSkin(new URL('../public/models/enemy-hoodie.glb',import.meta.url)),scale=1.1,rows=[];
 for(const name of ['Jog_Fwd_Loop','Sprint_Loop']){
  g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),a=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);a.clampWhenFinished=true;a.play();
  const velocities=[],previous={};
  for(let i=0;i<=Math.floor(clip.duration*960);i++){
   a.time=i/960;g.mixer.update(0);g.scene.updateMatrixWorld(true);
   for(const side of ['r','l']){
    const toe=g.scene.getObjectByName('ball_'+side).getWorldPosition(new T.Vector3());
    if(previous[side]&&toe.y<.03&&previous[side].y<.03){const v=-(toe.z-previous[side].z)*960;if(v>.05)velocities.push(v);}
    previous[side]=toe;
   }
  }
  assert.ok(velocities.length>100,'The check must measure real ground contacts.');
  const sprint=name==='Sprint_Loop';
  for(const role of ENEMY_TYPES){
   const speed=role.speed*(sprint?1.4:1),pace=enemyStrideRate(name,speed,scale),oldPace=sprint?1.15:1;
   const slip=median(velocities.map(v=>Math.abs(speed-v*scale*pace))),oldSlip=median(velocities.map(v=>Math.abs(speed-v*scale*oldPace)));
   rows.push({clip:name,role:role.name,speed,slip,oldSlip});assert.ok(slip<.65,JSON.stringify(rows.at(-1)));
  }
 }
 assert.ok(rows.reduce((n,r)=>n+r.slip,0)<rows.reduce((n,r)=>n+r.oldSlip,0)*.3,'Pacing must remove at least 70% of aggregate median sliding.');
 t.diagnostic(JSON.stringify(rows));
});
