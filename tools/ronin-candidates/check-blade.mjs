#!/usr/bin/env node
// Check the candidate's actual blade against every skinned body triangle.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../tests/native-skin-helper.mjs';
import {createWeapon} from '../../src/weapons.js';
import {alignWeaponShaft} from '../../src/weapon-frame.js';
import {measureBladeHeadClearance} from '../blade-head-surface.mjs';

const {values}=parseArgs({options:{model:{type:'string'},record:{type:'string',multiple:true},clip:{type:'string',multiple:true},output:{type:'string'},rate:{type:'string',default:'480'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/check-blade.mjs --model CANDIDATE.glb --record MOTIONS.json --clip CLIP --output REPORT.json [--record MORE.json] [--clip MORE] [--rate 480]\nChecks the actual odachi blade against all skinned body, head, eye, and hair triangles. Uses the candidate grip centers, fixed frames, and runtime paired attachment. Excludes rigid attachments. Requires 5 mm clearance; reports distances capped at 30 mm.');process.exit(0);}
if(!values.model||!values.record?.length||!values.clip?.length||!values.output)throw Error('Supply --model, --record, --clip, and --output. See --help.');
const rate=Number(values.rate);
if(!Number.isInteger(rate)||rate<120||rate>960)throw Error('--rate must be an integer from 120 through 960.');
const records=Object.assign({},...values.record.map(file=>JSON.parse(fs.readFileSync(file))));
const profiles=JSON.parse(fs.readFileSync(new URL('./ronin-grip-patch.json',import.meta.url))).sword;
const g=await loadNativeSkin(values.model),surfaces=[],bones={};
g.scene.traverse(object=>{
 if(object.isBone)bones[object.name]=object;
 if(!object.isSkinnedMesh)return;
 const {index,attributes:{position}}=object.geometry,triangles=[];
 for(let i=0;i<(index?index.count:position.count);i+=3)triangles.push([0,1,2].map(k=>index?index.getX(i+k):i+k));
 surfaces.push({mesh:object,triangles});
});
if(!surfaces.length)throw Error('The model contains no skinned surfaces.');
const weapon=createWeapon('odachi'),up=new T.Vector3(0,1,0),distanceCap=.03;
const report={model:values.model,rate,distanceCap,surfaceScope:'all skinned body surfaces',triangles:surfaces.reduce((n,s)=>n+s.triangles.length,0),passed:true,clips:{}};
for(const name of values.clip){
 const clip=g.animations.find(c=>c.name===name),spec=records[name];
 if(!clip||!spec?.nativeAttachment||!spec.pairedGrip||!spec.twoHanded||!(spec.gripSpacing>0))throw Error(name+': supply its native paired model clip and motion record.');
 g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 const times=[...new Set([...Array.from({length:Math.ceil(clip.duration*rate)+1},(_,i)=>Math.min(i/rate,clip.duration)),...(spec.impacts??[])])].sort((a,b)=>a-b);
 const row={samples:times.length,minimumClearance:distanceCap,crossings:0,crossingSamples:0,closest:null};
 for(const time of times){
  action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);
  const palms=['r','l'].map(side=>bones['hand_'+side].localToWorld(new T.Vector3().fromArray(profiles[side].center)));
  const axis=palms[0].clone().sub(palms[1]).normalize();
  const rotation=bones.hand_r.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().fromArray(profiles.r.frame));
  alignWeaponShaft(rotation,axis);
  weapon.quaternion.copy(rotation);
  weapon.position.copy(palms[0]).add(palms[1]).multiplyScalar(.5).addScaledVector(up.clone().applyQuaternion(rotation),-((spec.primaryGrip??weapon.userData.primaryGrip)-spec.gripSpacing*.5));
  weapon.updateMatrixWorld(true);
  const hit=measureBladeHeadClearance(surfaces,{r:weapon},{distanceCap});
  if(hit.minimumClearance<row.minimumClearance){row.minimumClearance=hit.minimumClearance;row.closest={time,...hit.closest};}
  row.crossings+=hit.crossings;if(hit.crossings)row.crossingSamples++;
 }
 if(row.minimumClearance<.005)report.passed=false;
 report.clips[name]=row;console.log(name,JSON.stringify(row));
}
fs.writeFileSync(values.output,JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
