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
const {values}=parseArgs({options:{candidate:{type:'string'},model:{type:'string'},'with-diagonal':{type:'boolean'},'return-only':{type:'boolean'},before:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/check.mjs --candidate DIRECTORY [--model FAMILY.glb --with-diagonal] [--return-only --before FAMILY.glb] [--output REPORT.json]\nChecks the candidate clips, complete hand frames, native joints, body intersections, and preservation. Also checks source foot paths. --return-only checks the second light cut, whole-body endpoints, speed, and cutting edge. Exits nonzero on a failed bound.');process.exit(0);}
if(!values.candidate)throw Error('Supply --candidate DIRECTORY. See --help.');
if(values['return-only']&&(!values.before||values['with-diagonal']))throw Error('--return-only requires --before FAMILY.glb and cannot use --with-diagonal.');
const file=name=>path.join(values.candidate,name);
const model=values.model??file('ronin.glb'),g=await loadNativeSkin(model),bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o});
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
const deformation=installLimbSkinning(g.scene,{upperArms:['r'],overflow:'nearest'}),surfaces=skinGroups(g),hands=Object.fromEntries(['r','l'].map(s=>[s,handSurface(g.scene,s)]));
const grips=JSON.parse(fs.readFileSync(file('grips.json'))).ronin.sword,neutral=JSON.parse(fs.readFileSync('tools/ronin-candidates/heavy-cleave-frames.json'));
const allSurfaces=[];g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const index=mesh.geometry.index,triangles=[];for(let i=0;i<(index?index.count:mesh.geometry.attributes.position.count);i+=3)triangles.push([0,1,2].map(k=>index?index.getX(i+k):i+k));allSurfaces.push({mesh,triangles});});
BLADE_PROFILES.odachi.grip=.27;const weapon=createWeapon('odachi'),up=new T.Vector3(0,1,0);
const replacements=values['return-only']?[['Cut_Return','Ronin_Cut_Return']]:[['Ronin_Ready','Ronin_Ready'],['Ronin_Heavy_Cleave','Ronin_Heavy_Cleave']];
if(values['with-diagonal'])replacements.push(['Cut_Diagonal','Ronin_Cut_Diagonal']);
const report={model,preserved:verifyAnimationReplacement(values.before??'public/models/ronin.glb',model,replacements),samples:0,violations:[],skinCrossings:[],minBladeClearance:.03,maxGripDepth:0,maxFittingDepth:0,maxWrist:0,maxHandFrameError:0,maxPalmGap:0,maxJointSpeed:0};
const returnProfile=values['return-only']?JSON.parse(fs.readFileSync(new URL('./return-profile.json',import.meta.url))):null;
const returnSourceTime=t=>{let i=0;const keys=returnProfile.bodyTimeKeys;while(i<keys.length-2&&t>keys[i+1][0])i++;const a=keys[i],b=keys[i+1];return T.MathUtils.lerp(a[1],b[1],(t-a[0])/(b[0]-a[0]));};
const support=values['with-diagonal']||returnProfile?await loadNativeSkin(returnProfile?'public/models/ronin.glb':model):null;
const supportAction=support?.mixer.clipAction(support.animations.find(a=>a.name==='Ronin_Heavy_Cleave')).setLoop(T.LoopOnce,1).play();
if(supportAction){supportAction.clampWhenFinished=true;report.sourceFootPath={maxPositionError:0,maxFootRotationDegrees:0};}
report.clips={};
for(const [,clipName]of replacements){
 g.mixer.stopAllAction();const action=g.mixer.clipAction(g.animations.find(a=>a.name===clipName)).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 let previous=null;report.clips[clipName]=0;
 const duration=action.getClip().duration,diagonal=clipName==='Ronin_Cut_Diagonal';
 const times=clipName==='Ronin_Ready'?[0,1,2]:Array.from({length:Math.ceil(duration*960)+1},(_,i)=>Math.min(duration,i/960));
 const cutFrames=[];
 for(const t of times){const sourceTime=returnProfile?returnSourceTime(t):diagonal?t/duration*.76:t;action.time=t;g.mixer.update(0);g.scene.updateMatrixWorld(true);deformation.update({upperArmWeight:clipName==='Ronin_Ready'||returnProfile?0:T.MathUtils.smoothstep(sourceTime,.40,.46)*(1-T.MathUtils.smoothstep(sourceTime,.58,.66))});
 if(diagonal||returnProfile){
  supportAction.time=sourceTime;support.mixer.update(0);support.scene.updateMatrixWorld(true);
  for(const side of ['r','l'])for(const part of returnProfile?['thigh_','calf_','foot_','ball_']:['foot_','ball_']){
   const name=part+side,actual=bones[name],reference=support.scene.getObjectByName(name);
   report.sourceFootPath.maxPositionError=Math.max(report.sourceFootPath.maxPositionError,actual.getWorldPosition(new T.Vector3()).distanceTo(reference.getWorldPosition(new T.Vector3())));
   if(part==='foot_')report.sourceFootPath.maxFootRotationDegrees=Math.max(report.sourceFootPath.maxFootRotationDegrees,actual.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(reference.getWorldQuaternion(new T.Quaternion()).normalize())*180/Math.PI);
  }
 }
 const palms=Object.fromEntries(['r','l'].map(s=>[s,bones['hand_'+s].localToWorld(new T.Vector3().fromArray(grips[s].center))]));
 const frame=bones.hand_r.getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(grips.r.frame)).normalize(),shaft=up.clone().applyQuaternion(frame);
 weapon.quaternion.copy(frame);weapon.position.copy(palms.r).addScaledVector(shaft,-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
 if(returnProfile)cutFrames.push({t,palm:palms.r.clone(),center:palms.r.clone().add(new T.Vector3(.08,.8,0).applyQuaternion(frame)),edge:new T.Vector3(1,0,0).applyQuaternion(frame)});
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
 if(returnProfile){report.maxHandSpeed=0;report.minContactEdgeAlignment=1;for(let i=1;i<cutFrames.length;i++){const a=cutFrames[i-1],b=cutFrames[i];report.maxHandSpeed=Math.max(report.maxHandSpeed,b.palm.distanceTo(a.palm)/(b.t-a.t));if(i<cutFrames.length-1&&Math.abs(b.t-returnProfile.impact)<.025)report.minContactEdgeAlignment=Math.min(report.minContactEdgeAlignment,cutFrames[i+1].center.clone().sub(a.center).normalize().dot(b.edge));}}
}
if(returnProfile){
 const endpoint=(name,end)=>{g.mixer.stopAllAction();const clip=g.animations.find(c=>c.name===name),action=g.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;action.time=end?clip.duration:0;g.mixer.update(0);g.scene.updateMatrixWorld(true);return Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.getWorldPosition(new T.Vector3()),q:b.getWorldQuaternion(new T.Quaternion()).normalize(),s:b.scale.clone()}]));};
 const ready=endpoint('Ronin_Ready',false),entry=endpoint('Ronin_Cut_Return',false),exit=endpoint('Ronin_Cut_Return',true),first=endpoint('Ronin_Cut_Diagonal',true);report.boundaries={};
 for(const[label,a,b]of [['readyToReturn',ready,entry],['firstCutToReturn',first,entry],['returnToReady',exit,ready]])report.boundaries[label]={position:Math.max(...Object.keys(a).map(n=>a[n].p.distanceTo(b[n].p))),degrees:Math.max(...Object.keys(a).map(n=>a[n].q.angleTo(b[n].q)*180/Math.PI)),scale:Math.max(...Object.keys(a).map(n=>a[n].s.distanceTo(b[n].s)))};
}
fs.writeFileSync(values.output??file('check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,violations:report.violations.slice(0,3),violationCount:report.violations.length,skinCrossings:report.skinCrossings.slice(0,5),crossingSampleCount:report.skinCrossings.length}));
assert.equal(report.violations.length,0,'Native arm bounds failed. Inspect check.json.');
assert.equal(report.skinCrossings.length,0,'Arm or elbow skin intersections found. Inspect check.json.');
assert.ok(report.minBladeClearance>=.0299,'The blade approaches the body. Inspect check.json.');
assert.ok(report.maxGripDepth<.0015&&report.maxFittingDepth===0,'The hand intersects the handle fittings. Inspect check.json.');
assert.ok(report.maxWrist<13.81&&report.maxHandFrameError<.03&&report.maxPalmGap<.0002,'The complete hand grip is unstable. Inspect check.json.');
if(report.sourceFootPath)assert.ok(report.sourceFootPath.maxPositionError<.003&&report.sourceFootPath.maxFootRotationDegrees<1,'The cut changes its source foot or toe support.');
if(returnProfile){
 for(const [label,value]of Object.entries(report.boundaries))assert.ok(value.position<.0001&&value.degrees<.01&&value.scale<1e-7,'The whole-body endpoint does not match: '+label);
 assert.ok(report.maxHandSpeed<12.5&&report.maxJointSpeed<3000,'The return has a sudden hand or joint movement.');
 assert.ok(report.minContactEdgeAlignment>.8,'The return does not lead with its cutting edge around contact.');
}
