import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {createGolfClub} from '../src/golf-club.js';
import {captureGolfRestPose,calibrateGolfClub,sampleGolfGripPose} from '../src/golf-club-fit.js';

test('kaede: the club continues through contact without the previous stop and second surge',async()=>{
 const file=process.env.NINJA_GOLF_MODEL_DIR?path.join(process.env.NINJA_GOLF_MODEL_DIR,'kaede.glb'):new URL('../public/models/kaede.glb',import.meta.url);
 const g=await loadNativeSkin(file),clip=g.animations.find(c=>c.name==='Golf_Swing'),hand=g.scene.getObjectByName('hand_r');
 const profile=JSON.parse(fs.readFileSync(new URL('../src/grip-data.json',import.meta.url))).kaede.golf.r;
 const grip={center:new T.Vector3().fromArray(profile.center),frame:new T.Quaternion().fromArray(profile.frame)},restPose=captureGolfRestPose(g.scene);
 const fit=calibrateGolfClub({root:g.scene,hand,clip,restPose,grip,club:createGolfClub(),contactTime:1.4});
 const impact=sampleGolfGripPose({root:g.scene,hand,clip,restPose,grip,time:1.4});
 const localContact=fit.contactPointNative.clone().sub(impact.palm).applyQuaternion(impact.rotation.clone().invert());
 const point=time=>{const p=sampleGolfGripPose({root:g.scene,hand,clip,restPose,grip,time});return localContact.clone().applyQuaternion(p.rotation).add(p.palm);};
 const speed=time=>point(time+.005).distanceTo(point(time-.005))/.01;
 const delivery=[1.2,1.25,1.3,1.35,1.4].map(speed),release=[1.43,1.45,1.5,1.55,1.6,1.65,1.7].map(speed);
 for(let i=1;i<delivery.length;i++)assert.ok(delivery[i]>delivery[i-1],'The delivery slows before contact');
 assert.ok(release[0]>20,'The club stalls directly after contact');
 for(let i=1;i<release.length;i++)assert.ok(release[i]<release[i-1],'The release stops and accelerates a second time');
 assert.ok(Math.abs(clip.duration-2.4)<1e-6,'The gameplay contact and completion clock must stay unchanged');
});
