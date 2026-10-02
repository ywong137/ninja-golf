#!/usr/bin/env node
// Retarget captured torso motion while preserving the complete native carry.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {spawnSync} from 'node:child_process';
import {Quaternion,Vector3,LoopOnce,MathUtils} from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {parseAcclaimSkeleton,parseAcclaimMotion} from './acclaim-motion.mjs';
import {createAcclaimGaitCycle} from './acclaim-gait-cycle.mjs';
import {createAcclaimGaitRig} from './acclaim-gait-rig.mjs';
import {createSourceGaitRetarget} from './source-gait-retarget.mjs';
import {sampleRowCurve} from './row-hermite-curve.mjs';
import {FootPlacement,solveLeg,AUTHORED_LEG_REACH} from '../src/foot-placement.js';
import {headingKnee} from '../src/knee-alignment.js';
import {alignLegHinge} from '../src/leg-hinge.js';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';
import {captureFootSoles,sampleFootSole} from '../src/foot-sole.js';
import {moveSourceGaitFoot} from './source-gait-contacts.mjs';
import {nativeRunSpec} from '../src/native-stride.js';
import {RUN_CONTACT_SCHEDULE,createRunningStance} from './run-contact-trajectory.mjs';
import {calibrateLegAnatomy} from '../src/leg-anatomy.js';
import {recoveryWeight,recoveryShoeRotation} from '../src/leg-recovery.js';

const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'},clip:{type:'string',default:'all'},'whole-body':{type:'boolean'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/author-run-body.mjs --input CANDIDATE.glb --output NEW.glb [--clip all|Run_Forward|Sprint_Forward] [--whole-body]\nTransfer CMU 09_01 torso motion onto forward running and sprinting. Preserve complete native arm and finger tracks. Default: retain native foot targets. --whole-body: transfer captured pelvis and legs from the same cycle, with sole clearance and reach fitting. Output must be new and outside public/. Require visual and integration review before publication.');process.exit(0);}
if(!values.input||!values.output)throw Error('Supply --input and --output. See --help.');
if(!['all','Run_Forward','Sprint_Forward'].includes(values.clip))throw Error('Choose --clip all, Run_Forward, or Sprint_Forward.');
const input=path.resolve(values.input),output=path.resolve(values.output),publicRoot=path.resolve('public');
if(input===output||output===publicRoot||output.startsWith(publicRoot+path.sep)||fs.existsSync(output))throw Error('Choose a new candidate path outside public/.');
const g=await loadNativeSkin(input),target=await loadNativeSkin(input),bones={};g.scene.traverse(b=>{if(b.isBone)bones[b.name]=b;});
const skeleton=parseAcclaimSkeleton(fs.readFileSync('tests/fixtures/cmu-running/09.asf','utf8'));
const motion=parseAcclaimMotion(fs.readFileSync('tests/fixtures/cmu-running/09_01.amc','utf8'),skeleton);
const cycle=createAcclaimGaitCycle(skeleton,motion,{startFrame:2,endFrame:90,rate:120,smooth:true}),source=createAcclaimGaitRig(skeleton);
const transfer=createSourceGaitRetarget(source.root,target.scene,{footRotation:'bind-delta'});
const point=b=>b.getWorldPosition(new Vector3()),rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const placement=new FootPlacement(g.scene,bones),bodyNames=['pelvis','spine_01','spine_02','spine_03','Head'];
const wholeBody=!!values['whole-body'],soles=wholeBody?captureFootSoles(g.scene):null;
const bindToes=Object.fromEntries(['r','l'].map(side=>[side,bones['ball_'+side].quaternion.clone()]));
const legNames=['r','l'].flatMap(side=>(wholeBody?['thigh','calf','foot','ball']:['thigh','calf','foot']).map(n=>n+'_'+side)),names=[...bodyNames,...legNames];
const legs=Object.fromEntries(['r','l'].map(s=>[s,{upper:point(bones['thigh_'+s]).distanceTo(point(bones['calf_'+s])),lower:point(bones['calf_'+s]).distanceTo(point(bones['foot_'+s]))}]));
const anatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const periodic=(values,u)=>{
 const n=values.length,at=((u%1)+1)%1*n,i=Math.floor(at),x=at-i,h=j=>values[(j+n)%n];
 const a=h(i),b=h(i+1),m0=(b-h(i-1))/2,m1=(h(i+2)-a)/2;
 return (2*x**3-3*x*x+1)*a+(x**3-2*x*x+x)*m0+(-2*x**3+3*x*x)*b+(x**3-x*x)*m1;
};
const fitCurve=input=>{
 const fit=spawnSync('python3',[new URL('./fit-locomotion-posture.py',import.meta.url).pathname],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'}});
 if(fit.status!==0)throw Error('Captured motion fit failed: '+fit.stderr);
 return JSON.parse(fit.stdout);
};
const entries=[],reports=[];
for(const name of ['Run_Forward','Sprint_Forward']){
if(values.clip!=='all'&&values.clip!==name)continue;
const clip=g.animations.find(c=>c.name===name);
if(clip?.userData?.sharedPostureVersion!==3||clip.userData.capturedTorsoVersion)throw Error('Use a reviewed native posture candidate without a torso bake: '+name);
const release=clip.userData.nativeContactSchedule?.release??.28,sourceLanding=42/88,sourceRelease=60/88;
const supportRate=(sourceRelease-sourceLanding)/release,flightRate=(.5-sourceRelease+sourceLanding)/(.5-release),tangent=2*supportRate*flightRate/(supportRate+flightRate);
const phaseRows=[{t:0,p:sourceLanding},{t:release,p:sourceRelease},{t:.5,p:sourceLanding+.5}].map(row=>({...row,derivatives:{p:tangent}}));
const referencePhase=u=>sampleRowCurve(phaseRows,u%.5).value.p+Math.floor(u/.5)*.5;
const count=Math.round(clip.duration*480),times=[...new Set([...Array.from({length:count+1},(_,i)=>Math.fround(i/count*clip.duration)),...clip.tracks.flatMap(t=>Array.from(t.times))])].sort((a,b)=>a-b);
g.mixer.stopAllAction();const action=g.mixer.clipAction(clip).reset().setLoop(LoopOnce).play();action.clampWhenFinished=true;
const rotations=Object.fromEntries(names.map(n=>[n,[]])),translations={pelvis:[]},rows=[];let maxError=0,maxCarryError=0,maxOrientationError=0;
const lean=()=>{const v=point(bones.neck_01).sub(point(bones.pelvis));return Math.atan2(v.z,v.y)*180/Math.PI;};
let floorOffset=0,contactPaths=null,strideScale,footHeights=null;
const prepare=u=>{
 action.time=u*clip.duration;g.mixer.update(0);g.scene.updateMatrixWorld(true);
 const original=names.map(n=>[bones[n],bones[n].quaternion.clone(),bones[n].position.clone()]),originalLean=lean(),pelvis=point(bones.pelvis);
 const chest=bones.spine_03,carry=Object.fromEntries(['r','l'].map(side=>[side,{p:chest.worldToLocal(point(bones['hand_'+side])),q:rotation(chest).invert().multiply(rotation(bones['hand_'+side]))}]));
 let feet=Object.fromEntries(['r','l'].map(s=>[s,{p:point(bones['foot_'+s]),q:rotation(bones['foot_'+s])}]));
 source.apply(cycle.sample(referencePhase(u)),{yaw:cycle.yaw});transfer.apply();
 for(const name of bodyNames)if(name!=='Head')bones[name].quaternion.copy(transfer.bones[name].quaternion);
 // Rocketbox clavicles are children of neck_01. That joint owns the native
 // shoulder frame, so retain it and place captured head motion on Head only.
 // Otherwise retargeting the neck rotates both hands away from the chest.
 g.scene.updateMatrixWorld(true);
 bones.Head.quaternion.copy(rotation(bones.Head.parent).invert().multiply(rotation(transfer.bones.Head)));
 if(wholeBody){
  bones.pelvis.position.copy(transfer.bones.pelvis.position);
  for(const name of legNames)bones[name].quaternion.copy(transfer.bones[name].quaternion);
 }
 g.scene.updateMatrixWorld(true);
 if(wholeBody){
  pelvis.copy(point(bones.pelvis));pelvis.y+=floorOffset;
  feet=Object.fromEntries(['r','l'].map(s=>{
   const p=point(bones['foot_'+s]),q=rotation(bones['foot_'+s]);
   const phase=((u+(s==='l'?.5:0))%1+1)%1;
   const minimum=Math.min(...sampleFootSole(soles[s]).map(v=>v.y));
   // Loaded soles follow the ground. In flight, retain captured heel recovery
   // and carry the foot with the source body's common floor offset.
   const flight=phase<=release?0:Math.min(1,(phase-release)/.1,(1-phase)/.1);
   const blend=flight*flight*(3-2*flight);
   p.y+=floorOffset*blend-minimum*(1-blend);
   if(contactPaths){
    const stance=contactPaths[s],loaded=phase<=release;
    const leave=1-MathUtils.smootherstep(phase,release,release+.10);
    const arrive=MathUtils.smootherstep(phase,.90,1),weight=loaded?1:Math.max(leave,arrive);
    const endpoint=loaded?phase:leave>0?release:0;
    const contact=stance.sample(endpoint);
    if(!loaded)contact.p.z-=stance.travelPerPhase*(leave>0?phase-release:phase-1);
    p.lerp(contact.p,weight);q.slerp(contact.q,weight);
    bones['ball_'+s].quaternion.slerp(bindToes[s],weight);
    q.copy(recoveryShoeRotation(bones['thigh_'+s],bones['calf_'+s],q,anatomy[s],recoveryWeight(phase)));
   }
   const minimumHeight=-Math.min(...[...placement.feet[s].surface.points(),...placement.feet[s].contacts].map(v=>v.clone().applyQuaternion(q).y));
   if(footHeights)p.y=periodic(footHeights[s],u);
   return [s,{p,q,minimum,minimumHeight,phase}];
  }));
 }
 return {original,originalLean,pelvis,chest,carry,feet};
};
const restore=original=>{for(const [bone,q,p]of original){bone.quaternion.copy(q);bone.position.copy(p);}g.scene.updateMatrixWorld(true);};
if(wholeBody){
 const levels=[];
 for(let i=0;i<100;i++){
  const {original,feet}=prepare(i/100);
  for(const s of ['r','l'])if(feet[s].phase<=release)levels.push(feet[s].minimum);
  restore(original);
 }
 levels.sort((a,b)=>a-b);floorOffset=-levels[Math.floor(levels.length/2)];
 const strides=[];
 for(const s of ['r','l']){
  const samples=[];
  for(let i=0;i<=40;i++){
   const phase=.025+i/40*(release-.05),u=(phase+(s==='l'?.5:0))%1,{original,feet}=prepare(u);
   samples.push({phase,z:feet[s].p.z});restore(original);
  }
  const mean=samples.reduce((n,r)=>n+r.phase,0)/samples.length,z=samples.reduce((n,r)=>n+r.z,0)/samples.length;
  strides.push(-samples.reduce((n,r)=>n+(r.phase-mean)*(r.z-z),0)/samples.reduce((n,r)=>n+(r.phase-mean)**2,0));
 }
 const oldSpec=nativeRunSpec(clip),stride=(strides[0]+strides[1])/2;
 if(!Number.isFinite(stride)||stride<=0)throw Error('Captured stance must travel backward in model space.');
 strideScale=(clip.userData.nativeStrideScale??1)*stride/(2*oldSpec.amplitude/oldSpec.support);
 const paths={};
 for(const s of ['r','l']){
  const samples=[0,RUN_CONTACT_SCHEDULE.flat,release].map(phase=>{
   const {original,feet}=prepare((phase+(s==='l'?.5:0))%1),f=feet[s];restore(original);return f;
  });
  const [landing,flat,last]=samples,up=placement.feet[s].soleUp.clone().applyQuaternion(flat.q);
  flat.q.premultiply(new Quaternion().setFromUnitVectors(up,new Vector3(0,1,0)));
  // A supporting sole owns its contact point. The captured ankle remains free
  // to roll around that point; pinning the ankle alone would slide the toes.
  paths[s]=createRunningStance({landingPosition:landing.p,landingRotation:landing.q,flatRotation:flat.q,
   contacts:placement.feet[s].contacts,releaseToeZ:last.p.z,travelPerPhase:stride,landingContact:0});
 }
 contactPaths=paths;
}
const fitRows=[],fitCount=200;
for(let i=0;i<fitCount;i++){
 const {original,pelvis,feet}=prepare(i/fitCount);let ceiling=pelvis.y+.02;
 for(const side of ['r','l']){
  const hip=point(bones['thigh_'+side]),f=feet[side],reach=(legs[side].upper+legs[side].lower)*AUTHORED_LEG_REACH;
  const horizontal=hip.clone().sub(f.p).setY(0).lengthSq();
  if(horizontal>=reach**2)throw Error('Captured torso makes the foot unreachable horizontally.');
  const y=wholeBody?Math.max(f.minimumHeight,f.p.y):f.p.y;
  ceiling=Math.min(ceiling,point(bones.pelvis).y+y+Math.sqrt(reach**2-horizontal)-hip.y);
 }
 fitRows.push({source:pelvis.y,target:pelvis.y,ceiling});restore(original);
}
const fitted=fitCurve({duration:clip.duration,target:fitRows[0].source,rows:fitRows}),height=u=>periodic(fitted.heights,u),footFits={};
if(wholeBody){
 const curves={};
 for(const side of ['r','l']){
  const fitRows=[],contactDiagnostics=[];
  for(let i=0;i<fitCount;i++){
   const u=i/fitCount,{original,feet}=prepare(u),f=feet[side],hip=point(bones['thigh_'+side]);
   hip.y+=height(u)-point(bones.pelvis).y;
   const reach=(legs[side].upper+legs[side].lower)*AUTHORED_LEG_REACH,horizontal=hip.clone().sub(f.p).setY(0).lengthSq();
   if(horizontal>=reach**2)throw Error('Captured free foot exceeds horizontal leg reach.');
   const floor=Math.max(f.minimumHeight,hip.y-Math.sqrt(reach**2-horizontal)),loaded=f.phase<=release;
   // Solve the complete periodic height curve before baking joint angles.
   // A runtime floor clamp would add a corner each time the sole touched it.
   const desired=-f.p.y;
   fitRows.push({source:desired,target:desired,ceiling:loaded?desired+.001:-(floor+.0005)+.001,...(loaded?{floor:desired}:{})});
   if(f.phase<.011||f.phase>.979||Math.abs(f.phase-release)<.011)contactDiagnostics.push({phase:f.phase,rawHeight:f.p.y,minimumHeight:f.minimumHeight,reachFloor:floor,loaded});
   restore(original);
  }
  const fit=fitCurve({duration:clip.duration,target:0,speedLimit:10,rows:fitRows}),{heights,...diagnostics}=fit;
  curves[side]=heights.map(v=>-v);footFits[side]={...diagnostics,contactDiagnostics};
 }
 footHeights=curves;
}
for(const t of times){
 const u=Math.min(t/clip.duration,1),{original,originalLean,pelvis,chest,carry,feet}=prepare(u);
 pelvis.y=height(u);bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));g.scene.updateMatrixWorld(true);
 let reachExcess=0;
 for(const side of ['r','l']){
  const f=feet[side],leg=legs[side];reachExcess=Math.max(reachExcess,point(bones['thigh_'+side]).distanceTo(f.p)-leg.upper-leg.lower);
  if(wholeBody){
   maxError=Math.max(maxError,moveSourceGaitFoot(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],f.p,{hinge:placement.hinges[side]}));
   const foot=bones['foot_'+side];foot.quaternion.copy(rotation(foot.parent).invert().multiply(f.q));foot.updateWorldMatrix(false,true);
  }
  else{
   maxError=Math.max(maxError,solveLeg(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],f.p,f.q,{maxReach:.999,kneeSolver:headingKnee}));
   alignLegHinge(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side],placement.hinges[side]);
  }
 }
 for(const side of ['r','l']){
  maxCarryError=Math.max(maxCarryError,chest.worldToLocal(point(bones['hand_'+side])).distanceTo(carry[side].p));
  maxOrientationError=Math.max(maxOrientationError,rotation(chest).invert().multiply(rotation(bones['hand_'+side])).angleTo(carry[side].q));
 }
 rows.push({phase:u,originalLean,lean:lean(),reachExcess});
 for(const name of names){const q=bones[name].quaternion.clone().normalize(),track=rotations[name];if(track.length&&q.dot(new Quaternion().fromArray(track,track.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);track.push(...q.toArray());}
 translations.pelvis.push(...bones.pelvis.position.toArray());restore(original);
}
const range=key=>[Math.min(...rows.map(r=>r[key])),Math.max(...rows.map(r=>r[key]))];
const {heights,...fitDiagnostics}=fitted;
const report={clip:name,wholeBody,floorOffset,strideScale,source:'CMU 09_01 frames 2–90 at 120 Hz',sourcePhase:{landing:sourceLanding,release:sourceRelease},contactPhase:{landing:0,release},maxError,maxCarryError,maxOrientationError,originalLean:range('originalLean'),lean:range('lean'),reachExcess:range('reachExcess'),fit:fitDiagnostics,footFits,rows};
fs.mkdirSync(path.dirname(output),{recursive:true});
reports.push(report);fs.writeFileSync(output+'.body.json',JSON.stringify(reports,null,2)+'\n');
if(maxError>1e-5||maxCarryError>1e-5||maxOrientationError>1e-4)throw Error('Body transfer violates foot reach or the preserved carry: '+JSON.stringify({maxError,maxCarryError,maxOrientationError}));
entries.push({clip:clip.name,times,rotations,translations,extras:{capturedTorsoVersion:1,capturedTorsoReference:report.source,...(wholeBody?{capturedBodyVersion:5,capturedShoeRecoveryVersion:1,capturedSourceFilter:'periodic five-frame binomial at 120 Hz',nativeStrideScale:strideScale,nativeContactSchedule:{...RUN_CONTACT_SCHEDULE,landingContact:0}}:{}),reviewCandidate:true}});
}
fs.writeFileSync(output,patchAnimationTransforms(fs.readFileSync(input),entries));
const preservation=verifyAnimationReplacement(input,output,entries.map(e=>[e.clip,e.clip]));
console.log(JSON.stringify({output,reports:reports.map(({rows,...r})=>r),preservation},null,2));
