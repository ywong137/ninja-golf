import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';

const profiles=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url)));
for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])test(`${hero}: folds the trail arm and sets the club across the top of the backswing`,async t=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,hero+'.glb'):new URL('../public/models/'+hero+'.glb',import.meta.url);
 const g=await loadNativeSkin(file),p=n=>g.scene.getObjectByName(n).getWorldPosition(new T.Vector3());
 const clip=g.animations.find(c=>c.name==='Golf_Swing'),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce).play();action.clampWhenFinished=true;
 const frame=new T.Quaternion().fromArray(profiles[hero].golf.r.frame),rows=[];
 for(const time of [.99,1.05,1.1]){
  action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const hand=g.scene.getObjectByName('hand_r'),shaft=new T.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()).multiply(frame));
  const flex=s=>180-p('upperarm_'+s).sub(p('lowerarm_'+s)).angleTo(p('hand_'+s).sub(p('lowerarm_'+s)))*180/Math.PI;
  const trail=flex('l'),lead=flex('r'),elevation=Math.asin(shaft.y)*180/Math.PI;
  // These are bounds for this reviewed short backswing, not all golf styles.
  // The previous animation extended both arms and left the shaft near vertical.
  assert.ok(trail>70&&trail<110,'Trail elbow extends instead of folding at the top.');
  assert.ok(lead<trail-20,'The lead arm lost its longer reach.');
  assert.ok(elevation>5&&elevation<35,'The club has not set across the shoulders.');
  assert.ok(shaft.x<-.7,'The shaft points away from the target at the top.');
  rows.push({time,trailFlexion:trail,leadFlexion:lead,shaftElevation:elevation});
 }
 t.diagnostic(JSON.stringify(rows));
});
