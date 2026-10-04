import fs from 'node:fs';
import * as T from 'three';
import {createHash} from 'node:crypto';
const release=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const {loadNativeSkin}=await import(release+'/tests/native-skin-helper.mjs');
const {createSourceGaitRetarget}=await import(release+'/tools/source-gait-retarget.mjs');
const {createSourceHandRetarget}=await import(release+'/tools/source-hand-retarget.mjs');
const {patchAnimationTransforms}=await import(release+'/tools/patch-animation-rotations.mjs');
const {alignLegHinge}=await import(release+'/src/leg-hinge.js');
const {calibrateLegAnatomy,measureLegAnatomy}=await import(release+'/src/leg-anatomy.js');
const {captureArmPose,calibrateArmAnatomy,measureArmAnatomy}=await import(release+'/src/arm-anatomy.js');
const {captureWristPose,calibrateWristAnatomy,measureWristAnatomy}=await import(release+'/src/wrist-anatomy.js');
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Usage: node tools/transfer-enemy-emergence.mjs SOURCE.glb INPUT.glb OUTPUT.glb REPORT.json\nTransfers the complete CC0 Quaternius UAL2 NinjaJump sequence. Existing meshes and clips remain intact.');process.exit(0);}
if(args.length!==4)throw Error('Supply source, input, output and report paths. See --help.');
const [sourceFile,input,output,reportFile]=args;
const source=await loadNativeSkin(sourceFile),target=await loadNativeSkin(input),retarget=createSourceGaitRetarget(source.scene,target.scene,{footRotation:'bind-delta'}),hands=createSourceHandRetarget(source.scene,target.scene),bones=retarget.bones;
const legs=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
const wrists=Object.fromEntries(['r','l'].map(s=>[s,calibrateWristAnatomy(captureWristPose(bones,s))]));
const point=b=>b.getWorldPosition(new T.Vector3()),rotation=b=>b.getWorldQuaternion(new T.Quaternion());
function armHinge(side){
 const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
 const u=point(lower).sub(point(upper)).normalize(),v=point(hand).sub(point(lower)).normalize(),normal=u.clone().cross(v);
 if(normal.lengthSq()<1e-10)return;normal.normalize();
 const q=rotation(upper),lowerQ=rotation(lower),hinge=arms[side].hingeAxisLocal.clone().applyQuaternion(q);
 const turn=Math.atan2(u.dot(hinge.clone().cross(normal)),hinge.dot(normal));
 const aligned=q.premultiply(new T.Quaternion().setFromAxisAngle(u,turn));
 upper.quaternion.copy(rotation(upper.parent).invert().multiply(aligned));upper.updateWorldMatrix(false,true);
 lower.quaternion.copy(rotation(lower.parent).invert().multiply(lowerQ));lower.updateWorldMatrix(false,true);
}
const clips=[['NinjaJump_Start','Ninja_Emerge_Start','Jump_Start'],['NinjaJump_Idle_Loop','Ninja_Emerge_Flight','Jump_Loop'],['NinjaJump_Land','Ninja_Emerge_Land','Jump_Land']],entries=[],report=[];
for(const [sourceName,name,templateName]of clips){
 const clip=source.animations.find(c=>c.name===sourceName),template=target.animations.find(c=>c.name===templateName);
 source.mixer.stopAllAction();const action=source.mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1).play();action.clampWhenFinished=true;
 const channels=Object.fromEntries(['quaternion','position','scale'].map(prop=>[prop,template.tracks.filter(t=>t.name.endsWith('.'+prop)).map(t=>t.name.slice(0,-prop.length-1))]));
 const rotations=Object.fromEntries(channels.quaternion.map(n=>[n,[]])),translations=Object.fromEntries(channels.position.map(n=>[n,[]])),scales=Object.fromEntries(channels.scale.map(n=>[n,[]]));
 const count=Math.ceil(clip.duration*120),times=Array.from({length:count+1},(_,i)=>i/count*clip.duration),r={name,sourceName,duration:clip.duration,maxKneeDeviation:0,minKneeFlex:180,maxKneeFlex:0,minElbowFlex:180,maxElbowDeviation:0,maxWrist:0,maxHipTwist:0,maxAnkleTwist:0,maxHumeralRoll:0,maxForearmTwist:0,points:[]};
 for(const [i,time]of times.entries()){
  action.time=time;source.mixer.update(0);retarget.apply();hands.apply();
  for(const s of ['r','l']){alignLegHinge(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],legs[s].hinge);armHinge(s);}
  for(const s of ['r','l']){
   const foot=bones['foot_'+s],calf=bones['calf_'+s],m=measureLegAnatomy(legs[s],bones['thigh_'+s],calf,foot);
   const turn=m.ankleTwist-T.MathUtils.clamp(m.ankleTwist,-12,12),axis=point(foot).sub(point(calf)).normalize();
   const q=rotation(foot).premultiply(new T.Quaternion().setFromAxisAngle(axis,-turn*Math.PI/180));
   foot.quaternion.copy(rotation(foot.parent).invert().multiply(q));foot.updateWorldMatrix(false,true);
  }
  target.scene.updateMatrixWorld(true);
  for(const s of ['r','l']){
   const l=measureLegAnatomy(legs[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]),a=measureArmAnatomy(arms[s],captureArmPose(bones,s));
   r.maxHipTwist=Math.max(r.maxHipTwist,Math.abs(l.hipTwist));r.maxAnkleTwist=Math.max(r.maxAnkleTwist,Math.abs(l.ankleTwist));r.maxHumeralRoll=Math.max(r.maxHumeralRoll,Math.abs(a.humeralRollDegrees));r.maxForearmTwist=Math.max(r.maxForearmTwist,Math.abs(a.forearmTwistDegrees));
   r.maxKneeDeviation=Math.max(r.maxKneeDeviation,l.kneeDeviation);r.minKneeFlex=Math.min(r.minKneeFlex,l.kneeFlexion);r.maxKneeFlex=Math.max(r.maxKneeFlex,l.kneeFlexion);r.minElbowFlex=Math.min(r.minElbowFlex,a.signedFlexionDegrees);r.maxElbowDeviation=Math.max(r.maxElbowDeviation,a.hingeDeviationDegrees);r.maxWrist=Math.max(r.maxWrist,measureWristAnatomy(wrists[s],captureWristPose(bones,s)).totalDegrees);
  }
  for(const [property,tracks]of [['quaternion',rotations],['position',translations],['scale',scales]])for(const [n,values]of Object.entries(tracks)){
   const v=bones[n][property].clone();if(property==='quaternion'){v.normalize();if(i&&v.dot(new T.Quaternion().fromArray(values,values.length-4))<0)v.set(-v.x,-v.y,-v.z,-v.w);}values.push(...v.toArray());
  }
  if(i%12===0||i===count)r.points.push({time,joints:Object.fromEntries(['pelvis','spine_03','hand_r','hand_l','calf_r','calf_l','foot_r','foot_l'].map(n=>[n,point(bones[n]).toArray()]))});
 }
 entries.push({clip:name,template:templateName,times,rotations,translations,scales,extras:{nativeLegFrames:1,sourceClip:sourceName,sourceLicense:'CC0-1.0',sourceMotion:'Quaternius Universal Animation Library 2',enemyEmergenceVersion:1}});report.push(r);
}
const original=fs.readFileSync(input),doc=JSON.parse(original.subarray(20,20+original.readUInt32LE(12))),rawNames=new Map(doc.nodes.filter(n=>n.name).map(n=>[T.PropertyBinding.sanitizeNodeName(n.name),n.name]));
for(const entry of entries)for(const field of ['rotations','translations','scales'])entry[field]=Object.fromEntries(Object.entries(entry[field]).map(([name,values])=>[rawNames.get(name)??name,values]));
fs.writeFileSync(output,patchAnimationTransforms(fs.readFileSync(input),entries));
fs.writeFileSync(reportFile,JSON.stringify({input,sourceFile,sourceHash:createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'),clips:report},null,2));
console.log(JSON.stringify(report.map(({points,...r})=>r)));
