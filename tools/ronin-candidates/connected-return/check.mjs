import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadNativeSkin,skinGroups,measureArmSkin} from '../../../tests/native-skin-helper.mjs';
import {calibrateArmAnatomy,captureArmPose,measureArmAnatomy,armAuthoringViolations} from '../../../tools/native-arm-anatomy.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../../../src/leg-anatomy.js';
import {installLimbSkinning} from '../../../src/forearm-twist.js';
import {createWeapon,BLADE_PROFILES} from '../../../src/weapons.js';
import {handSurface,measureGripSurface} from '../../../tools/grip-contact.mjs';
import {measureBladeHeadClearance} from '../../../tools/blade-head-surface.mjs';
import {parseGlb} from '../../../tools/bake-native-golf.mjs';
const {values}=parseArgs({options:{candidate:{type:'string'},before:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/connected-return/check.mjs --candidate DIRECTORY --before SOURCE.glb\nChecks the new clip at 960 Hz: arm and leg limits, skin surfaces, complete hand frames, blade clearance, contact edge, foot support, and unchanged source bytes.');process.exit(0);}
if(!values.candidate||!values.before)throw Error('Supply --candidate and --before. See --help.');
const dir=path.resolve(values.candidate)+path.sep,g=await loadNativeSkin(dir+'ronin.glb'),b={};g.scene.traverse(o=>{if(o.isBone)b[o.name]=o;});g.scene.updateMatrixWorld(true);
const arm=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(b,s))])),legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(b['thigh_'+s],b['calf_'+s],b['foot_'+s])]));
const deform=installLimbSkinning(g.scene,{upperArms:['r'],overflow:'nearest'}),surfaces=skinGroups(g),hands=Object.fromEntries(['r','l'].map(s=>[s,handSurface(g.scene,s)]));
const grips=JSON.parse(fs.readFileSync(dir+'grips.json')).ronin.sword,neutral=JSON.parse(fs.readFileSync('tools/ronin-candidates/heavy-cleave-frames.json')),all=[],shoes=[];
g.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const index=mesh.geometry.index,{position,skinIndex:ids,skinWeight:weights}=mesh.geometry.attributes,triangles=[];for(let i=0;i<(index?index.count:position.count);i+=3)triangles.push([0,1,2].map(k=>index?index.getX(i+k):i+k));all.push({mesh,triangles});const vertices=[];for(let i=0;i<position.count;i++){let w=0;for(let k=0;k<4;k++)if(/^(ball|foot)_[rl]$/.test(mesh.skeleton.bones[ids.getComponent(i,k)].name))w+=weights.getComponent(i,k);if(w>.8)vertices.push(i);}shoes.push({mesh,vertices});});
BLADE_PROFILES.odachi.grip=.27;const weapon=createWeapon('odachi'),clip=g.animations.find(c=>c.name==='Ronin_Cut_Return_Connected'),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const report={samples:0,violations:[],skinCrossings:[],maxGap:0,maxFrame:0,maxWrist:0,maxGripDepth:0,maxFittingDepth:0,minBladeClearance:.03,minShoeHeight:Infinity,maxJointSpeed:0,maxHandSpeed:0,maxFrontDrift:0,maxToeDrift:0,minEdgeAlignment:1},point=n=>b[n].getWorldPosition(new T.Vector3());
let prior,baseFoot,baseToe;
for(let i=0;i<=Math.ceil(clip.duration*960);i++){
 const time=Math.min(clip.duration,i/960);action.time=time;g.mixer.update(0);g.scene.updateMatrixWorld(true);deform.update({upperArmWeight:1-T.MathUtils.smoothstep(time,0,.08)});
 const palm=s=>b['hand_'+s].localToWorld(new T.Vector3().fromArray(grips[s].center)),r=palm('r'),frame=b.hand_r.getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(grips.r.frame)).normalize(),shaft=new T.Vector3(0,1,0).applyQuaternion(frame);
 weapon.quaternion.copy(frame);weapon.position.copy(r).addScaledVector(shaft,-weapon.userData.primaryGrip);weapon.updateMatrixWorld(true);
 report.maxGap=Math.max(report.maxGap,palm('l').distanceTo(r.clone().addScaledVector(shaft,-.12)));
 let crossings=0;
 for(const s of ['r','l']){
  const m=measureArmAnatomy(arm[s],captureArmPose(b,s)),bad=armAuthoringViolations(m,{maxHingeDeviationDegrees:.1});if(bad.length)report.violations.push({time,s,arm:bad});
  const leg=measureLegAnatomy(legs[s],b['thigh_'+s],b['calf_'+s],b['foot_'+s]);if(leg.kneeFlexion<0||leg.kneeDeviation>.1||Math.abs(leg.hipTwist)>36||Math.abs(leg.ankleTwist)>10)report.violations.push({time,s,leg});
  const skin=measureArmSkin(g,surfaces,s);crossings+=Object.values(skin).reduce((sum,v)=>sum+v.pairs,0);
  report.maxFrame=Math.max(report.maxFrame,b['hand_'+s].getWorldQuaternion(new T.Quaternion()).normalize().multiply(new T.Quaternion().fromArray(grips[s].frame)).normalize().angleTo(frame)*180/Math.PI);
  report.maxWrist=Math.max(report.maxWrist,b['hand_'+s].quaternion.clone().normalize().angleTo(new T.Quaternion().fromArray(neutral[s].neutralHandRotation).normalize())*180/Math.PI);
  const contact=measureGripSurface(hands[s],weapon,.014);report.maxGripDepth=Math.max(report.maxGripDepth,contact.maxPenetration);report.maxFittingDepth=Math.max(report.maxFittingDepth,contact.fittingPenetration);
 }
 if(crossings)report.skinCrossings.push({time,crossings});
 report.minBladeClearance=Math.min(report.minBladeClearance,measureBladeHeadClearance(all,{r:weapon},{distanceCap:.03}).minimumClearance);
 for(const{mesh,vertices}of shoes){mesh.skeleton.update();for(const i of vertices){const y=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).y;if(y<report.minShoeHeight){report.minShoeHeight=y;report.lowestShoe={time,mesh:mesh.name,vertex:i};}}}
 baseFoot??=point('foot_r');baseToe??=point('ball_l');if(time<=.4){report.maxFrontDrift=Math.max(report.maxFrontDrift,point('foot_r').distanceTo(baseFoot));report.maxToeDrift=Math.max(report.maxToeDrift,point('ball_l').distanceTo(baseToe));}
 const joints=Object.fromEntries(['clavicle_r','clavicle_l','upperarm_r','upperarm_l','lowerarm_r','lowerarm_l'].map(n=>[n,b[n].quaternion.clone().normalize()])),center=r.clone().add(new T.Vector3(.08,.8,0).applyQuaternion(frame)),edge=new T.Vector3(1,0,0).applyQuaternion(frame);
 if(prior){for(const[n,q]of Object.entries(joints)){const speed=q.angleTo(prior.joints[n])*180/Math.PI/(time-prior.time);if(speed>report.maxJointSpeed){report.maxJointSpeed=speed;report.fastestJoint={time,n};}}report.maxHandSpeed=Math.max(report.maxHandSpeed,r.distanceTo(prior.r)/(time-prior.time));if(Math.abs(time-.295)<.024)report.minEdgeAlignment=Math.min(report.minEdgeAlignment,center.clone().sub(prior.center).normalize().dot(edge));}
 prior={time,joints,r,center};report.samples++;
}
const before=parseGlb(fs.readFileSync(values.before)),after=parseGlb(fs.readFileSync(dir+'ronin.glb'));
report.preservation={animations:before.doc.animations.every(a=>JSON.stringify(a)===JSON.stringify(after.doc.animations.find(b=>b.name===a.name))),sourceBytes:before.bin.equals(after.bin.subarray(0,before.bin.length))};
fs.writeFileSync(dir+'connected-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,violations:report.violations.slice(0,3),violationCount:report.violations.length,skinCrossings:report.skinCrossings.slice(0,3),crossingCount:report.skinCrossings.length}));
assert.deepEqual(report.preservation,{animations:true,sourceBytes:true});assert.equal(report.violations.length,0);assert.equal(report.skinCrossings.length,0);assert.ok(report.minBladeClearance>.0299);assert.ok(report.maxGap<.00025&&report.maxFrame<.04&&report.maxWrist<13.81);assert.ok(report.maxGripDepth<.0015&&report.maxFittingDepth===0);assert.ok(report.maxFrontDrift<.001&&report.maxToeDrift<.001);assert.ok(report.minShoeHeight>-.003);assert.ok(report.minEdgeAlignment>.8);
