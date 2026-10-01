import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../../../tests/native-skin-helper.mjs';
import {patchAnimationTransforms} from '../../../tools/patch-animation-rotations.mjs';
import {solveLeg} from '../../../src/foot-placement.js';
import {headingKnee,footForward} from '../../../src/knee-alignment.js';
import {alignLegHinge} from '../../../src/leg-hinge.js';
import {calibrateLegAnatomy,measureLegAnatomy} from '../../../src/leg-anatomy.js';
const {values}=parseArgs({options:{candidate:{type:'string'},output:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/ronin-candidates/fixed-grip/author-footwork.mjs --candidate DIRECTORY --output DIRECTORY\nAdds the candidate first-cut step, hip turn, and toe pivot to the eleven-clip candidate. Input remains unchanged. Output must stay outside public/. Run check-footwork.mjs and the runtime checks before using the result.');process.exit(0);}
if(!values.candidate||!values.output)throw Error('Supply --candidate and --output directories. See --help.');
const source=path.resolve(values.candidate),output=path.resolve(values.output),publicRoot=path.resolve('public');
if(output===source||output===publicRoot||output.startsWith(publicRoot+path.sep))throw Error('Use a separate output directory outside public/.');
const params=JSON.parse(fs.readFileSync(new URL('./footwork-profile.json',import.meta.url)));
const hash=crypto.createHash('sha256').update(fs.readFileSync(source+'/ronin.glb')).digest('hex');
if(hash!==params.sourceSha256)throw Error('The input model changed. Review and refit the footwork before rebuilding.');
fs.mkdirSync(output,{recursive:true});
const name='Ronin_Cut_Diagonal',file=source+'/ronin.glb',g=await loadNativeSkin(file),bones={};
g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});g.scene.updateMatrixWorld(true);
const cal=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const clip=g.animations.find(c=>c.name===name),action=g.mixer.clipAction(clip).setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const record=JSON.parse(fs.readFileSync(source+'/diagonal.json'))[name],profiles=JSON.parse(fs.readFileSync(source+'/grips.json')).ronin.sword;
const p=n=>bones[n].getWorldPosition(new T.Vector3()),q=n=>bones[n].getWorldQuaternion(new T.Quaternion()).normalize(),UP=new T.Vector3(0,1,0),D=Math.PI/180;
const setQ=(n,v)=>{bones[n].quaternion.copy(bones[n].parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(v)).normalize();bones[n].updateWorldMatrix(false,true);};
const setP=(n,v)=>{bones[n].position.copy(bones[n].parent.worldToLocal(v));bones[n].updateWorldMatrix(false,true);};
const curve=(keys,t)=>{let i=0;while(i<keys.length-2&&keys[i+1][0]<t)i++;const a=keys[i],b=keys[i+1];return T.MathUtils.lerp(a[1],b[1],T.MathUtils.smoothstep(t,a[0],b[0]));};
const rotations=Object.fromEntries(['pelvis','spine_02','Head','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l','ball_l'].map(n=>[n,[]])),translations={pelvis:[]},times=[],poses=[],report={parameters:params,frames:[],violations:[],maxReachError:0,maxPalmGap:0};
const count=params.samples,locals=Array.from({length:count},(_,i)=>{action.time=clip.duration*i/(count-1);g.mixer.update(0);return Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}]));});
const src=v=>[v.x,-v.z,v.y];
let baseFeet;
for(let i=0;i<count;i++){
 const t=i/(count-1),time=t*record.duration;
 for(const[n,b]of Object.entries(bones)){b.position.copy(locals[i][n].p);b.quaternion.copy(locals[i][n].q);b.scale.copy(locals[i][n].s);}g.scene.updateMatrixWorld(true);
 const feet=Object.fromEntries(['r','l'].map(s=>[s,{p:p('foot_'+s),q:q('foot_'+s),toe:p('ball_'+s)}]));
 baseFeet??={r:feet.r.p.y,l:feet.l.p.y};
 const head=q('Head'),chest=q('spine_02'),hip=q('pelvis'),oldPelvis=p('pelvis'),leftToeRotation=q('ball_l');
 const step=T.MathUtils.clamp(feet.r.p.z/.29,0,1),load=T.MathUtils.smoothstep(t,0,.2)*(1-T.MathUtils.smoothstep(t,.2,.4));
 setP('pelvis',oldPelvis.clone().add(new T.Vector3(-params.pelvisSide*step+params.loadSide*load,-params.pelvisDrop*step,params.pelvisAdvance*step-params.loadBack*load)));
 setQ('pelvis',hip.premultiply(new T.Quaternion().setFromAxisAngle(UP,curve(params.hipYaw,t)*D)));
 setQ('spine_02',chest.premultiply(new T.Quaternion().setFromAxisAngle(UP,curve(params.chestYaw,t)*D)));
 setQ('Head',head);
 feet.r.p.add(new T.Vector3(-params.stepSide*step,0,params.stepExtension*step));
 feet.r.q.premultiply(new T.Quaternion().setFromAxisAngle(UP,params.frontFootTurn*D*step));
 const pivot=curve(params.pivot,t),axis=UP.clone().cross(footForward(bones.foot_l,feet.l.q)).normalize();
 const delta=new T.Quaternion().setFromAxisAngle(UP,params.rearFootTurn*D*pivot).multiply(new T.Quaternion().setFromAxisAngle(axis,params.heelLift*D*pivot));
 const relative=feet.l.toe.clone().sub(feet.l.p).applyQuaternion(delta);
 feet.l.p.copy(feet.l.toe).sub(relative);feet.l.q.premultiply(delta);
 const legs={};
 for(const s of ['r','l']){
  const error=solveLeg(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],feet[s].p,feet[s].q,{kneeSolver:headingKnee});report.maxReachError=Math.max(report.maxReachError,error);
  alignLegHinge(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],cal[s].hinge);
  legs[s]=measureLegAnatomy(cal[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);
  const m=legs[s];if(error>.0001||m.kneeDeviation>.1||m.kneeFlexion<0||Math.abs(m.hipTwist)>36||Math.abs(m.ankleTwist)>10)report.violations.push({t,side:s,error,...m});
 }
 // Flex the toe joint as the heel rises. A rigid shoe rotation drives its
 // forefoot below the ground even when the toe bone stays in one place.
 const toeTurn=new T.Quaternion().setFromAxisAngle(UP,params.rearFootTurn*D*pivot).multiply(new T.Quaternion().setFromAxisAngle(axis,-params.toeExtension*D*pivot));
 setQ('ball_l',leftToeRotation.premultiply(toeTurn));
 g.scene.updateMatrixWorld(true);
 const palm=s=>p('hand_'+s).add(new T.Vector3().fromArray(profiles[s].center).applyQuaternion(q('hand_'+s)));
 const primary=palm('r'),secondary=palm('l'),weapon=q('hand_r').multiply(new T.Quaternion().fromArray(profiles.r.frame)),shaft=UP.clone().applyQuaternion(weapon),roll=new T.Quaternion().setFromUnitVectors(UP,shaft).invert().multiply(weapon);
 report.maxPalmGap=Math.max(report.maxPalmGap,primary.clone().addScaledVector(shaft,-record.gripSpacing).distanceTo(secondary));
 const footR=p('foot_r'),footL=p('foot_l');
 poses.push({...record.poses[Math.min(record.poses.length-1,Math.round(t*(record.poses.length-1)))],t,grip:src(primary),secondaryGrip:src(secondary),tip:src(primary.clone().addScaledVector(shaft,1.15)),roll:2*Math.atan2(roll.y,roll.w),footR:src(footR.clone().add(new T.Vector3(0,-baseFeet.r,0))),footL:src(footL.clone().add(new T.Vector3(0,-baseFeet.l,0))),elbowR:src(p('lowerarm_r')),elbowL:src(p('lowerarm_l'))});
 report.frames.push({t,pelvis:p('pelvis').toArray(),rightFoot:footR.toArray(),leftFoot:footL.toArray(),leftToe:p('ball_l').toArray(),legs});
 times.push(time);
 for(const n of Object.keys(rotations)){const rot=bones[n].quaternion.clone();if(i&&rot.dot(new T.Quaternion().fromArray(rotations[n],rotations[n].length-4))<0)rot.set(-rot.x,-rot.y,-rot.z,-rot.w);rotations[n].push(...rot.toArray());}
 translations.pelvis.push(...bones.pelvis.position.toArray());
}
if(report.violations.length)throw Error('Footwork violates native leg limits: '+JSON.stringify(report.violations[0]));
const raw=fs.readFileSync(file),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12))),animation=doc.animations.find(a=>a.name===name),newRotations={};
for(const n of Object.keys(rotations))if(!animation.channels.some(c=>doc.nodes[c.target.node].name===n&&c.target.path==='rotation')){newRotations[n]=rotations[n];delete rotations[n];}
fs.writeFileSync(output+'/ronin.glb',patchAnimationTransforms(raw,[{clip:name,times,rotations,newRotations,translations,extras:{nativeLightFootworkVersion:1}}]));
fs.writeFileSync(output+'/diagonal.json',JSON.stringify({[name]:{...record,nativeLightFootworkVersion:1,nativeSampleRate:(count-1)/record.duration,footPlants:{...record.footPlants,l:[[0,.28*record.duration],[.90*record.duration,record.duration]]},toePlants:{...record.toePlants,l:[[.28*record.duration,.90*record.duration]]},poses}}));
for(const n of ['motion.json','ready.json','return.json','guards.json','grips.json'])fs.copyFileSync(source+'/'+n,output+'/'+n);
fs.writeFileSync(output+'/footwork-author-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,frames:undefined,violations:report.violations.slice(0,3),violationCount:report.violations.length}));
