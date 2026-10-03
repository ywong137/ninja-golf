import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {createSourceGaitRetarget} from './source-gait-retarget.mjs';
import {createSourceHandRetarget} from './source-hand-retarget.mjs';
import {patchAnimationTransforms} from './patch-animation-rotations.mjs';
import {verifyAnimationReplacement} from './verify-animation-replacement.mjs';
import {calibrateLegAnatomy,measureLegAnatomy} from '../src/leg-anatomy.js';
import {balanceLegJoints} from '../src/leg-joint-balance.js';
import {captureLegPole,solveLegWithPole} from '../src/leg-pole.js';
import {alignLegHinge} from '../src/leg-hinge.js';
import {captureArmPose,calibrateArmAnatomy,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,calibrateWristAnatomy,measureWristAnatomy,wristRotationFromAngles} from '../src/wrist-anatomy.js';
import {loadMixamoMotion} from './load-mixamo-motion.mjs';
import {joinSourceMotions} from './join-source-motions.mjs';
import {fitSourceSwordWrist,fitSourceSwordPalm} from './fit-source-sword-wrist.mjs';
import {gripFrame,solveGripArm} from '../src/hand-grip.js';
import {captureFootSoles,sampleFootSole} from '../src/foot-sole.js';

const {values}=parseArgs({options:{input:{type:'string'},source:{type:'string'},'source-clip':{type:'string'},recovery:{type:'string'},output:{type:'string'},grips:{type:'string'},hero:{type:'string',default:'kaede'},clip:{type:'string',default:'Ace_Reference_Cut'},template:{type:'string',default:'Ace_Cut_Diagonal'},'paired-spacing':{type:'string'},'fit-pair-reach':{type:'boolean'},grounded:{type:'boolean'},'wrist-fit':{type:'boolean'},'palm-pronation-fit':{type:'boolean'},'palm-frame':{type:'boolean'},'look-ahead':{type:'boolean'},'edge-turn':{type:'string'},'edge-window':{type:'string'},'neutral-source':{type:'boolean'},'overhead-lift':{type:'string'},'step-clearance':{type:'string'},'stance-width':{type:'string'},'knee-clearance':{type:'string'},'joint-fit':{type:'boolean'},'shaft-reference':{type:'string',default:'fists'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/transfer-sword-study.mjs --input RELEASE/kaede.glb --source UAL1_Standard.glb --grips RELEASE/src/grip-data.json --output REVIEW/kaede.glb [--wrist-fit]\nAppend one full-body motion study. Preserve existing animations and geometry. Output must remain outside public/. For Mixamo FBX, select --hero, --clip and --template; optional --paired-spacing sets a signed grip distance. For a named library clip, use --source-clip; --recovery joins its matching authored recovery. The paired fit rejects invalid arm frames. --wrist-fit is for single-hand studies only. --palm-pronation-fit bounds the forearm and removes residual wrist roll; it changes the sword path and requires review. --edge-window start,full,release,end sets the four native seconds for --edge-turn. --palm-frame transfers both palm axes. --look-ahead shares a bounded upward gaze correction between neck and head.');process.exit(0);}
for(const key of ['input','source','output','grips'])if(!values[key])throw Error(`Supply --${key}. See --help.`);
if(!values.output.endsWith('.glb')||path.resolve(values.output)===path.resolve(values.input)||path.resolve(values.output).split(path.sep).includes('public'))throw Error('Choose a separate review GLB outside public/.');
const edgeWindow=(values['edge-window']??'.20,.38,.62,.90').split(',').map(Number);
if(edgeWindow.length!==4||edgeWindow.some((v,i)=>!Number.isFinite(v)||v<0||(i&&v<edgeWindow[i-1]))||edgeWindow[0]===edgeWindow[1]||edgeWindow[2]===edgeWindow[3])throw Error('--edge-window needs four ordered seconds: start,full,release,end.');
if(values['edge-window']&&values['edge-turn']===undefined)throw Error('--edge-window requires --edge-turn.');
const isMixamo=values.source.endsWith('.fbx');
const source=isMixamo?loadMixamoMotion(values.source):await loadNativeSkin(values.source),target=await loadNativeSkin(values.input);
const retarget=createSourceGaitRetarget(source.scene,target.scene,{footRotation:isMixamo?'segment-frame':'bind-delta'}),bones=retarget.bones;
const handRetarget=isMixamo||values['palm-frame']?createSourceHandRetarget(source.scene,target.scene):null;
let clip=values['source-clip']?source.animations.find(a=>a.name===values['source-clip']):isMixamo?source.animations[0]:source.animations.find(a=>a.name==='Sword_Attack');
if(values.recovery){const recovery=source.animations.find(a=>a.name===values.recovery);if(!recovery)throw Error('Missing recovery '+values.recovery);clip=joinSourceMotions(clip,recovery);}
const name=values.clip,template=values.template;
if(!clip||!target.animations.some(a=>a.name===template))throw Error('Missing the source animation or target template '+template+'.');
const gripData=JSON.parse(fs.readFileSync(values.grips))[values.hero].sword,grip=gripData.r;
const pairedSpacing=values['paired-spacing']===undefined?null:Number(values['paired-spacing']);
if(values['wrist-fit']&&values['palm-pronation-fit'])throw Error('Choose one wrist fitting method.');
if(pairedSpacing!==null&&(values['wrist-fit']||values['palm-pronation-fit']))throw Error('--wrist-fit cannot be combined with --paired-spacing.');
if(pairedSpacing!==null&&(!Number.isFinite(pairedSpacing)||pairedSpacing===0))throw Error('--paired-spacing must be a nonzero signed distance in native model metres.');
const profiles=Object.fromEntries(['r','l'].map(s=>[s,gripFrame(bones,gripData[s],s)]));
const neutralWrists=Object.fromEntries(['r','l'].map(s=>[s,bones['hand_'+s].quaternion.clone()]));
const names=retarget.names;
const bindHead=bones.Head.getWorldQuaternion(new T.Quaternion());
const original=fs.readFileSync(values.input),baseline=patchAnimationTransforms(original,[{clip:name,template,times:[0,clip.duration],extras:{reviewCandidate:true}}]);
const existing=new Set(target.animations.find(a=>a.name===template).tracks.filter(t=>t.name.endsWith('.quaternion')).map(t=>t.name.slice(0,-11)));
const rotations={},newRotations={},translations={pelvis:[]};
for(const n of names)(existing.has(n)?rotations:newRotations)[n]=[];
const anatomy=Object.fromEntries(['r','l'].map(s=>[s,calibrateLegAnatomy(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s])]));
const arms=Object.fromEntries(['r','l'].map(s=>[s,calibrateArmAnatomy(captureArmPose(bones,s))]));
const wrists=Object.fromEntries(['r','l'].map(s=>[s,calibrateWristAnatomy(captureWristPose(bones,s))])),wrist=wrists.r;
const soles=values.grounded?captureFootSoles(target.scene):null;
const legStates={r:{},l:{}};
const previousGripRoll={r:0,l:0},previousElbowPole={r:0,l:0},previousForearmTwist={r:null,l:null};
const swordWristState={};
let pairSample=0,previousAxis=null;
function fitPair(time){
 const palms=['r','l'].map(s=>bones['hand_'+s].localToWorld(profiles[s].center.clone()));
 // Native limb lengths move the palms. Preserve the source fist directions
 // instead of deriving the blade direction from that altered palm spacing.
 const directions=['r','l'].map(s=>new T.Vector3(0,1,0).applyQuaternion(bones['hand_'+s].getWorldQuaternion(new T.Quaternion()).multiply(profiles[s].frame)));
 const axis=values['shaft-reference']==='palm-line'?palms[0].clone().sub(palms[1]).multiplyScalar(Math.sign(pairedSpacing)):directions[0].add(directions[1]);
 if(axis.lengthSq()<1e-6)throw Error('Opposed grip directions: check the source hand roles.');
 axis.normalize();
 if(previousAxis?axis.dot(previousAxis)<0:axis.dot(palms[0].clone().sub(palms[1]))*pairedSpacing<0)axis.negate();
 previousAxis=axis.clone();
 const center=palms[0].clone().add(palms[1]).multiplyScalar(.5);
 if(values['overhead-lift'])center.y+=Number(values['overhead-lift'])*T.MathUtils.smoothstep(time,.80,1.00)*(1-T.MathUtils.smoothstep(time,1.20,1.38));
 if(values['fit-pair-reach']){
  const initial=center.clone(),limits=['r','l'].map(s=>{
   const shoulder=bones['upperarm_'+s].getWorldPosition(new T.Vector3()),elbow=bones['lowerarm_'+s].getWorldPosition(new T.Vector3()),wrist=bones['hand_'+s].getWorldPosition(new T.Vector3());
   const frame=bones['hand_'+s].getWorldQuaternion(new T.Quaternion()).multiply(profiles[s].frame);
   frame.premultiply(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0).applyQuaternion(frame),axis));
   const handQ=frame.multiply(profiles[s].frame.clone().invert());
   return {shoulder,offset:axis.clone().multiplyScalar((s==='r'?1:-1)*pairedSpacing*.5).sub(profiles[s].center.clone().applyQuaternion(handQ)),radius:(shoulder.distanceTo(elbow)+elbow.distanceTo(wrist))*.96};
  });
  // Project the common grip centre, preserving the rigid shaft and hand spacing.
  // Moving a target by a few centimetres is preferable to lengthening either arm.
  for(let pass=0;pass<12;pass++)for(const {shoulder,offset,radius}of limits){const reach=center.clone().add(offset).sub(shoulder),distance=reach.length();if(distance>radius)center.addScaledVector(reach,(radius-distance)/distance);}
  const correction=center.distanceTo(initial);report.maxPairCenterCorrection=Math.max(report.maxPairCenterCorrection??0,correction);
  if(correction>.15)throw Error('The requested grip needs more than 15 cm of source hand-path correction at '+time+'.');
 }
 for(const s of ['r','l']){
  const upper=bones['upperarm_'+s],lower=bones['lowerarm_'+s],hand=bones['hand_'+s];
  const start=[upper.quaternion.clone(),lower.quaternion.clone(),hand.quaternion.clone()];
  const referenceElbow=lower.getWorldPosition(new T.Vector3());
  const palm=center.clone().addScaledVector(axis,(s==='r'?1:-1)*pairedSpacing*.5);
  const base=hand.getWorldQuaternion(new T.Quaternion()).multiply(profiles[s].frame);
  base.premultiply(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0).applyQuaternion(base),axis));
  const baseHand=base.multiply(profiles[s].frame.clone().invert());
  const evaluate=(roll,pole)=>{
   for(const [i,b]of [upper,lower,hand].entries())b.quaternion.copy(start[i]);upper.updateWorldMatrix(false,true);
   const q=new T.Quaternion().setFromAxisAngle(axis,roll*Math.PI/180).multiply(baseHand);
   const wanted=palm.clone().sub(profiles[s].center.clone().applyQuaternion(q));
   const shoulder=upper.getWorldPosition(new T.Vector3()),reachAxis=wanted.clone().sub(shoulder).normalize();
   const upperWorld=upper.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(reachAxis,pole*Math.PI/180));
   upper.quaternion.copy(upper.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(upperWorld));upper.updateWorldMatrix(false,true);
   const gap=solveGripArm(upper,lower,hand,wanted,q);alignArmHinge(s);
   const forearm=lower.getWorldQuaternion(new T.Quaternion());
   const forward=hand.getWorldPosition(new T.Vector3()).sub(lower.getWorldPosition(new T.Vector3())).normalize();
   const delta=q.clone().multiply(neutralWrists[s].clone().invert()).multiply(forearm.clone().invert());
   const angle=2*Math.atan2(new T.Vector3(delta.x,delta.y,delta.z).dot(forward),delta.w);
   forearm.premultiply(new T.Quaternion().setFromAxisAngle(forward,angle));
   lower.quaternion.copy(lower.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(forearm));lower.updateWorldMatrix(false,true);
   hand.quaternion.copy(forearm.clone().invert().multiply(q));hand.updateWorldMatrix(false,true);
   const arm=measureArmAnatomy(arms[s],captureArmPose(bones,s));
   const minTwist=previousForearmTwist[s]===null?-70:Math.max(-70,previousForearmTwist[s]-5),maxTwist=previousForearmTwist[s]===null?70:Math.min(70,previousForearmTwist[s]+5);
   const limited=T.MathUtils.clamp(arm.forearmTwistDegrees,minTwist,maxTwist);
   forearm.premultiply(new T.Quaternion().setFromAxisAngle(forward,(limited-arm.forearmTwistDegrees)*Math.PI/180));
   lower.quaternion.copy(lower.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(forearm));lower.updateWorldMatrix(false,true);
   hand.quaternion.copy(forearm.clone().invert().multiply(q));hand.updateWorldMatrix(false,true);
   const wristAngle=neutralWrists[s].angleTo(hand.quaternion)*180/Math.PI;
   const elbowError=lower.getWorldPosition(new T.Vector3()).distanceToSquared(referenceElbow);
   const movement=T.MathUtils.euclideanModulo(roll-previousGripRoll[s]+180,360)-180;
   const wristExcess=Math.max(0,wristAngle-25),upperExcess=Math.max(0,Math.abs(arm.humeralRollDegrees)-70),elbowExcess=Math.max(0,arm.signedFlexionDegrees-130);
   const cost=wristExcess*wristExcess*.04+wristAngle*wristAngle*.0001+elbowError*25+gap*gap*1e5+movement*movement*.00002+(pole-previousElbowPole[s])**2*.00002+(upperExcess**2+elbowExcess**2)*.04;
   return {roll,pole,cost,gap,wristAngle,forearmTwist:limited};
  };
  let best=evaluate(previousGripRoll[s],previousElbowPole[s]);
  if(pairSample===0)for(const roll of [-120,-60,0,60,120])for(const pole of [-70,-35,0,35,70]){
   const candidate=evaluate(roll,pole);if(candidate.cost<best.cost)best=candidate;
  }
  for(const step of (pairSample===0?[20,8,3,1]:[4,2,1]))for(let pass=0;pass<2;pass++){
   const {roll,pole}=best;
   for(const [r,p]of [[roll-step,pole],[roll+step,pole],[roll,pole-step],[roll,pole+step]]){
    if(Math.abs(p)>85||pairSample>0&&(Math.abs(p-previousElbowPole[s])>5||Math.abs(r-previousGripRoll[s])>6))continue;const candidate=evaluate(r,p);if(candidate.cost<best.cost)best=candidate;
   }
  }
  best=evaluate(best.roll,best.pole);previousGripRoll[s]=best.roll;previousElbowPole[s]=best.pole;previousForearmTwist[s]=best.forearmTwist;
  if(best.gap>.001)throw Error('The '+s+' grip misses the source handle by '+best.gap+' m.');
 }
 pairSample++;
}
// Fit the mesh's elbow hinge to the source's joint positions. Preserve the
// forearm's world rotation, including its pronation and complete hand frame.
function alignArmHinge(side){
 const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
 const point=b=>b.getWorldPosition(new T.Vector3()),rotation=b=>b.getWorldQuaternion(new T.Quaternion());
 const u=point(lower).sub(point(upper)).normalize(),v=point(hand).sub(point(lower)).normalize(),normal=u.clone().cross(v);
 if(normal.lengthSq()<1e-10)return;
 normal.normalize();const q=rotation(upper),lowerQ=rotation(lower),hinge=arms[side].hingeAxisLocal.clone().applyQuaternion(q);
 const angle=Math.atan2(u.dot(hinge.clone().cross(normal)),hinge.dot(normal));
 q.premultiply(new T.Quaternion().setFromAxisAngle(u,angle));
 upper.quaternion.copy(rotation(upper.parent).invert().multiply(q));upper.updateWorldMatrix(false,true);
 lower.quaternion.copy(rotation(lower.parent).invert().multiply(lowerQ));lower.updateWorldMatrix(false,true);
}
const report={source:isMixamo?'Adobe Mixamo; local motion study':'Quaternius Universal Animation Library, CC0',sourceClip:clip.name,sourceFile:values.source,hero:values.hero,clip:name,pairedSpacing,handFrame:handRetarget?'complete palm frame':'segment direction',weaponAxis:pairedSpacing!==null?values['shaft-reference']:null,neutralSource:!!values['neutral-source'],overheadLift:Number(values['overhead-lift']??0),duration:clip.duration,lookAhead:!!values['look-ahead'],wristFit:!!values['wrist-fit'],palmPronationFit:!!values['palm-pronation-fit'],edgeTurn:Number(values['edge-turn']??0),edgeWindow,grounded:!!values.grounded,maxFloorCorrection:0,maxPalmGap:0,maxWristDegrees:0,wristDegrees:{r:0,l:0},maxKneeDeviation:0,minKneeFlex:180,maxKneeFlex:0,arms:{r:{minFlex:180,maxDeviation:0,maxTwist:0},l:{minFlex:180,maxDeviation:0,maxTwist:0}},points:[]};
const action=source.mixer.clipAction(clip).reset().setLoop(T.LoopOnce);action.clampWhenFinished=true;action.play();
const count=Math.ceil(clip.duration*120),times=Array.from({length:count+1},(_,i)=>i/count*clip.duration);
for(let i=0;i<times.length;i++){
 action.time=times[i];source.mixer.update(0);retarget.apply();handRetarget?.apply();
 // Fit each native knee frame to the transferred joint positions. Keep the
 // complete source path and shoe rotation; do not author a replacement step.
 for(const s of ['r','l'])alignLegHinge(bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s],anatomy[s].hinge);
 if(values['stance-width']){
 const targets=Object.fromEntries(['r','l'].map(s=>[s,bones['foot_'+s].getWorldPosition(new T.Vector3())]));
 const pelvis=bones.pelvis.getWorldPosition(new T.Vector3());pelvis.y-=.05;bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));bones.pelvis.updateWorldMatrix(false,true);
 for(const s of ['r','l']){
  const thigh=bones['thigh_'+s],calf=bones['calf_'+s],foot=bones['foot_'+s];
  const outward=bones.thigh_l.getWorldPosition(new T.Vector3()).sub(bones.thigh_r.getWorldPosition(new T.Vector3())).setY(0).normalize().multiplyScalar(s==='l'?1:-1);
  const pole=captureLegPole(thigh,calf,foot,anatomy[s].hinge),target=targets[s].addScaledVector(outward,Number(values['stance-width'])),q=foot.getWorldQuaternion(new T.Quaternion());
  solveLegWithPole(thigh,calf,foot,target,q,anatomy[s].hinge,pole);
  if(foot.getWorldPosition(new T.Vector3()).distanceTo(target)>.001)throw Error('Wider stance exceeds native leg reach at '+times[i]+' '+s+'.');
 }
 }
 if(values['step-clearance']){
  const side='l',thigh=bones.thigh_l,calf=bones.calf_l,foot=bones.foot_l;
  const weight=T.MathUtils.smoothstep(times[i],.10,.27)*(1-T.MathUtils.smoothstep(times[i],.40,.58));
  const outward=bones.thigh_l.getWorldPosition(new T.Vector3()).sub(bones.thigh_r.getWorldPosition(new T.Vector3())).setY(0).normalize();
  const pole=captureLegPole(thigh,calf,foot,anatomy.l.hinge),target=foot.getWorldPosition(new T.Vector3()).addScaledVector(outward,Number(values['step-clearance'])*weight),q=foot.getWorldQuaternion(new T.Quaternion());
  solveLegWithPole(thigh,calf,foot,target,q,anatomy.l.hinge,pole);
  if(foot.getWorldPosition(new T.Vector3()).distanceTo(target)>.001)throw Error('Step clearance exceeds native leg reach.');
 }
 if(values['joint-fit'])for(let jointPass=0;jointPass<2;jointPass++)for(const s of ['r','l']){
  const thigh=bones['thigh_'+s],calf=bones['calf_'+s],foot=bones['foot_'+s];
  balanceLegJoints({thigh,calf,foot,calibration:anatomy[s],contacts:[new T.Vector3(0,-.05,0)],groundHeight:()=>0,supported:true,supportWeight:1,state:legStates[s]});
  if(values['knee-clearance']&&jointPass===1){
   const angle=Number(values['knee-clearance'])*Math.PI/180*T.MathUtils.smoothstep(times[i],.20,.30)*(1-T.MathUtils.smoothstep(times[i],.39,.50));
   const pole=captureLegPole(thigh,calf,foot,anatomy[s].hinge),target=foot.getWorldPosition(new T.Vector3()),shoe=foot.getWorldQuaternion(new T.Quaternion()),knee=calf.getWorldPosition(new T.Vector3()),hip=thigh.getWorldPosition(new T.Vector3());
   const outward=bones.thigh_l.getWorldPosition(new T.Vector3()).sub(bones.thigh_r.getWorldPosition(new T.Vector3())).normalize().multiplyScalar(s==='l'?1:-1);
   const derivative=pole.axis.clone().cross(knee.clone().sub(hip)).dot(outward);
   solveLegWithPole(thigh,calf,foot,target,shoe,anatomy[s].hinge,{axis:pole.axis,bend:pole.bend.clone().applyAxisAngle(pole.axis,Math.sign(derivative)*angle)});
  }
  const measured=measureLegAnatomy(anatomy[s],thigh,calf,foot),desired=20*Math.tanh(measured.ankleTwist/20),axis=foot.getWorldPosition(new T.Vector3()).sub(calf.getWorldPosition(new T.Vector3())).normalize();
  const q=foot.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(axis,(desired-measured.ankleTwist)*Math.PI/180));
  foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));foot.updateWorldMatrix(false,true);
 }
 if(soles){
  const minimum=Math.min(...['r','l'].flatMap(s=>sampleFootSole(soles[s]).map(p=>p.y)));
  const pelvis=bones.pelvis.getWorldPosition(new T.Vector3());pelvis.y-=minimum;
  bones.pelvis.position.copy(bones.pelvis.parent.worldToLocal(pelvis));bones.pelvis.updateWorldMatrix(false,true);
  report.maxFloorCorrection=Math.max(report.maxFloorCorrection,Math.abs(minimum));
 }
 if(pairedSpacing!==null&&values['neutral-source']){
  for(const s of ['r','l']){
   const lower=bones['lowerarm_'+s],hand=bones['hand_'+s],q=hand.getWorldQuaternion(new T.Quaternion()),forearm=lower.getWorldQuaternion(new T.Quaternion());
   const axis=hand.getWorldPosition(new T.Vector3()).sub(lower.getWorldPosition(new T.Vector3())).normalize();
   const delta=q.clone().multiply(neutralWrists[s].clone().invert()).multiply(forearm.clone().invert());
   const angle=2*Math.atan2(new T.Vector3(delta.x,delta.y,delta.z).dot(axis),delta.w);
   forearm.premultiply(new T.Quaternion().setFromAxisAngle(axis,angle));lower.quaternion.copy(lower.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(forearm));lower.updateWorldMatrix(false,true);
   hand.quaternion.copy(forearm.clone().invert().multiply(q));hand.updateWorldMatrix(false,true);
   const m=measureWristAnatomy(wrists[s],captureWristPose(bones,s));
   hand.quaternion.copy(wristRotationFromAngles(wrists[s],{flexionDegrees:15*Math.tanh(m.flexionDegrees/15),ulnarDeviationDegrees:20*Math.tanh(m.ulnarDeviationDegrees/20),axialTwistDegrees:0}));hand.updateWorldMatrix(false,true);
  }
 }
 if(values['look-ahead']){
  const head=bones.Head,neck=bones.neck_01,q=head.getWorldQuaternion(new T.Quaternion());
  const forward=new T.Vector3(0,0,1).applyQuaternion(q.clone().multiply(bindHead.clone().invert())).normalize();
  const pitch=Math.asin(T.MathUtils.clamp(forward.y,-1,1)),axis=forward.clone().cross(new T.Vector3(0,1,0)).normalize();
  const excess=Math.max(0,-pitch-T.MathUtils.degToRad(10));
  const lift=Math.min(T.MathUtils.degToRad(35),excess)*T.MathUtils.smoothstep(excess,0,T.MathUtils.degToRad(5));
  const target=q.clone().premultiply(new T.Quaternion().setFromAxisAngle(axis,lift));
  const neckWorld=neck.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(axis,lift*.45));
  neck.quaternion.copy(neck.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(neckWorld));neck.updateWorldMatrix(false,true);
  head.quaternion.copy(head.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(target));head.updateWorldMatrix(false,true);
 }
 if(pairedSpacing!==null)fitPair(times[i]);
 for(const s of ['r','l'])alignArmHinge(s);
 if(values['wrist-fit'])fitSourceSwordWrist({bones,arm:arms.r,wrist,state:swordWristState});
 if(values['palm-pronation-fit']){const fit=fitSourceSwordPalm({bones,arm:arms.r,wrist,state:swordWristState});report.maxDiscardedPalmDegrees=Math.max(report.maxDiscardedPalmDegrees??0,Math.abs(fit.discardedDegrees));}
 if(values['edge-turn']!==undefined){
  const degrees=Number(values['edge-turn']);if(!Number.isFinite(degrees)||pairedSpacing!==null)throw Error('--edge-turn needs a finite single-hand forearm correction.');
  // Pronation turns the whole fist and sword together. Do not spin a blade
  // inside its fingers or change the wrist to disguise the source frame.
  const time=times[i],weight=T.MathUtils.smoothstep(time,edgeWindow[0],edgeWindow[1])*(1-T.MathUtils.smoothstep(time,edgeWindow[2],edgeWindow[3]));
  const anatomy=measureArmAnatomy(arms.r,captureArmPose(bones,'r'));
  const desired=T.MathUtils.clamp(anatomy.forearmTwistDegrees+degrees*weight,-70,70);
  const lower=bones.lowerarm_r,axis=bones.hand_r.getWorldPosition(new T.Vector3()).sub(lower.getWorldPosition(new T.Vector3())).normalize();
  const world=lower.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(axis,(desired-anatomy.forearmTwistDegrees)*Math.PI/180));
  lower.quaternion.copy(lower.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));lower.updateWorldMatrix(false,true);
 }
 for(const [n,q]of Object.entries(grip.rotations))bones[n].quaternion.fromArray(q);
 if(pairedSpacing!==null)for(const [n,q]of Object.entries(gripData.l.rotations))bones[n].quaternion.fromArray(q);
 target.scene.updateMatrixWorld(true);
 if(pairedSpacing!==null){const palms=['r','l'].map(s=>bones['hand_'+s].localToWorld(profiles[s].center.clone()));report.maxPalmGap=Math.max(report.maxPalmGap,Math.abs(palms[0].distanceTo(palms[1])-Math.abs(pairedSpacing)));}
 for(const s of pairedSpacing===null?['r']:['r','l']){
  const degrees=measureWristAnatomy(wrists[s],captureWristPose(bones,s)).totalDegrees;
  report.wristDegrees[s]=Math.max(report.wristDegrees[s],degrees);report.maxWristDegrees=Math.max(report.maxWristDegrees,degrees);
 }
 for(const n of names){const values=rotations[n]??newRotations[n],q=bones[n].quaternion.clone().normalize();if(i&&q.dot(new T.Quaternion().fromArray(values,values.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);values.push(...q.toArray());}
 translations.pelvis.push(...bones.pelvis.position.toArray());
 for(const s of ['r','l']){const m=measureLegAnatomy(anatomy[s],bones['thigh_'+s],bones['calf_'+s],bones['foot_'+s]);report.maxKneeDeviation=Math.max(report.maxKneeDeviation,m.kneeDeviation);report.minKneeFlex=Math.min(report.minKneeFlex,m.kneeFlexion);report.maxKneeFlex=Math.max(report.maxKneeFlex,m.kneeFlexion);}
 for(const s of ['r','l']){const m=measureArmAnatomy(arms[s],captureArmPose(bones,s)),r=report.arms[s];r.minFlex=Math.min(r.minFlex,m.signedFlexionDegrees);r.maxDeviation=Math.max(r.maxDeviation,m.hingeDeviationDegrees);r.maxTwist=Math.max(r.maxTwist,Math.abs(m.forearmTwistDegrees));}
 if(i%12===0||i===count)report.points.push({time:times[i],joints:Object.fromEntries(['pelvis','spine_03','hand_r','hand_l','foot_r','foot_l'].map(n=>[n,bones[n].getWorldPosition(new T.Vector3()).toArray()]))});
}
if(report.maxKneeDeviation>.1||report.minKneeFlex<-.1||report.maxKneeFlex>150)throw Error('The source transfer reversed or overfolded a knee: '+JSON.stringify({...report,points:undefined}));
if(Object.values(report.arms).some(r=>r.minFlex<0||r.maxDeviation>.1))throw Error('The source transfer reversed or bent an elbow sideways.');
const result=patchAnimationTransforms(baseline,[{clip:name,times,rotations,newRotations,translations,extras:{reviewCandidate:true,nativeLegFrames:1,sourceClip:clip.name}}]);
fs.mkdirSync(path.dirname(values.output),{recursive:true});fs.writeFileSync(values.output,result);
const before=values.output+'.baseline.glb';fs.writeFileSync(before,baseline);
try{report.preservation=verifyAnimationReplacement(before,values.output,[[name,name]]);}finally{fs.unlinkSync(before);}
fs.writeFileSync(values.output+'.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,points:undefined,output:values.output}));
