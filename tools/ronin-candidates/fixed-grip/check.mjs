import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../../../tests/native-skin-helper.mjs';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations} from '../../../tools/native-arm-anatomy.mjs';
import {installLimbSkinning} from '../../../src/forearm-twist.js';
import {createWeapon,BLADE_PROFILES} from '../../../src/weapons.js';
import {handSurface,measureGripSurface} from '../../../tools/grip-contact.mjs';
import {measureBladeHeadClearance} from '../../../tools/blade-head-surface.mjs';
import {verifyAnimationReplacement} from '../../../tools/verify-animation-replacement.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/check.mjs --candidate DIRECTORY\nChecks the rebuilt Ready/Cleave GLB, hand surfaces, native joints, body intersections, and preservation. Writes check.json and exits nonzero on a failed bound.');process.exit(0);}
if(!values.candidate)throw Error('Supply --candidate DIRECTORY. See --help.');
const file=name=>path.join(values.candidate,name);
const model=file('ronin.glb'),g=await loadNativeSkin(model),bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o});
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
const deformation=installLimbSkinning(g.scene,{upperArms:['r'],overflow:'nearest'}),surfaces=skinGroups(g),hands=Object.fromEntries(['r','l'].map(s=>[s,handSurface(g.scene,s)]));
const grips=JSON.parse(fs.readFileSync(file('grips.json'))).ronin.sword,neutral=JSON.parse(fs.readFileSync('tools/ronin-candidates/heavy-cleave-frames.json'));
const allSurfaces=[];g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const index=mesh.geometry.index,triangles=[];for(let i=0;i<(index?index.count:mesh.geometry.attributes.position.count);i+=3)triangles.push([0,1,2].map(k=>index?index.getX(i+k):i+k));allSurfaces.push({mesh,triangles});});
BLADE_PROFILES.odachi.grip=.27;const weapon=createWeapon('odachi'),up=new T.Vector3(0,1,0);
const report={model,preserved:verifyAnimationReplacement('public/models/ronin.glb',model,[['Ronin_Ready','Ronin_Ready'],['Ronin_Heavy_Cleave','Ronin_Heavy_Cleave']]),samples:0,violations:[],skinCrossings:[],minBladeClearance:.03,maxGripDepth:0,maxFittingDepth:0,maxWrist:0,maxHandFrameError:0,maxPalmGap:0,maxJointSpeed:0};
report.clips={};
for(const clipName of ['Ronin_Ready','Ronin_Heavy_Cleave']){
 g.mixer.stopAllAction();const action=g.mixer.clipAction(g.animations.find(a=>a.name===clipName)).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 let previous=null;report.clips[clipName]=0;
 const times=clipName==='Ronin_Ready'?[0,1,2]:Array.from({length:Math.ceil(.76*960)+1},(_,i)=>Math.min(.76,i/960));
 for(const t of times){action.time=t;g.mixer.update(0);g.scene.updateMatrixWorld(true);deformation.update({upperArmWeight:clipName==='Ronin_Ready'?0:T.MathUtils.smoothstep(t,.40,.46)*(1-T.MathUtils.smoothstep(t,.58,.66))});
 const palms=Object.fromEntries(['r','l'].map(s=>[s,bones['hand_'+s].localToWorld(new T.Vector3().fromArray(grips[s].center))]));
 const frame=bones.hand_r.getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(grips.r.frame)).normalize(),shaft=up.clone().applyQuaternion(frame);
 weapon.quaternion.copy(frame);weapon.position.copy(palms.r).addScaledVector(shaft,-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
 const gap=palms.l.distanceTo(palms.r.clone().addScaledVector(shaft,-.12));report.maxPalmGap=Math.max(report.maxPalmGap,gap);
 let hits=0;
 for(const s of ['r','l']){
  const measurement=measureArmAnatomy(cal[s],captureArmPose(bones,s)),bad=armAuthoringViolations(measurement,{maxHingeDeviationDegrees:.1});if(bad.length)report.violations.push({clip:clipName,t,side:s,bad});
  const skin=measureArmSkin(g,surfaces,s);hits+=Object.values(skin).reduce((n,r)=>n+r.pairs,0);
  const grip=measureGripSurface(hands[s],weapon,.014);report.maxGripDepth=Math.max(report.maxGripDepth,grip.maxPenetration);report.maxFittingDepth=Math.max(report.maxFittingDepth,grip.fittingPenetration);
  report.maxWrist=Math.max(report.maxWrist,bones['hand_'+s].quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(neutral[s].neutralHandRotation).normalize())*180/Math.PI);
  report.maxHandFrameError=Math.max(report.maxHandFrameError,bones['hand_'+s].getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(grips[s].frame)).normalize().angleTo(frame)*180/Math.PI);
 }
 if(hits)report.skinCrossings.push({clip:clipName,t,pairs:hits});
 const clearance=measureBladeHeadClearance(allSurfaces,{r:weapon},{distanceCap:.03});report.minBladeClearance=Math.min(report.minBladeClearance,clearance.minimumClearance);
 const rotations=Object.fromEntries(['clavicle_r','clavicle_l','upperarm_r','upperarm_l','lowerarm_r','lowerarm_l'].map(n=>[n,bones[n].quaternion.clone().normalize()]));
 if(previous)for(const[n,q]of Object.entries(rotations)){const speed=q.angleTo(previous.rotations[n])*180/Math.PI/(t-previous.t);if(speed>report.maxJointSpeed){report.maxJointSpeed=speed;report.fastestJoint={clip:clipName,t,bone:n};}}
 previous={t,rotations};report.samples++;report.clips[clipName]++;
}
}
fs.writeFileSync(file('check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,violations:report.violations.slice(0,3),violationCount:report.violations.length,skinCrossings:report.skinCrossings.slice(0,5),crossingSampleCount:report.skinCrossings.length}));
assert.equal(report.violations.length,0,'Native arm bounds failed. Inspect check.json.');
assert.equal(report.skinCrossings.length,0,'Arm or elbow skin intersections found. Inspect check.json.');
assert.ok(report.minBladeClearance>=.0299,'The blade approaches the body. Inspect check.json.');
assert.ok(report.maxGripDepth<.0015&&report.maxFittingDepth===0,'The hand intersects the handle fittings. Inspect check.json.');
assert.ok(report.maxWrist<13.81&&report.maxHandFrameError<.03&&report.maxPalmGap<.0002,'The complete hand grip is unstable. Inspect check.json.');
