import * as THREE from 'three';
import {solveLeg} from './foot-placement.js';
import {GuardContactTransfer} from './guard-contact-transfer.js';
import {captureLegPole,blendLegPole,solveLegWithPole} from './leg-pole.js';
import {PlantedPoseTransfer} from './planted-pose-transfer.js';
import {nativeWalkSpec} from './native-stride.js';
import {blendAttackPelvis} from './attack-pelvis.js';

const DIRECTIONS=['Forward','Right','Backward','Left'];
const point=bone=>bone.getWorldPosition(new THREE.Vector3());
const rotation=bone=>bone.getWorldQuaternion(new THREE.Quaternion());
const SPINE=['spine_01','spine_02','spine_03'];
function setWorldRotation(bone,q){bone.quaternion.copy(rotation(bone.parent).invert().multiply(q)).normalize();bone.updateWorldMatrix(false,true);}

// Evaluate native combat steps separately from the weapon choreography. World-space
// targets keep the imported joint axes and each character's actual limb lengths.
export class AttackLocomotion {
 constructor(root,model,bones,clips,prefix,motionData){
  this.root=root;this.bones=bones;this.saved=[];this.weight=0;this.phase=0;this.travelHeading=null;this.pelvisGaitWeight=0;
  this.proxyRoot=new THREE.Group();this.proxy=model.clone(true);this.proxyRoot.add(this.proxy);
  const meshes=[];this.proxy.traverse(o=>{if(o.isMesh)meshes.push(o);});for(const mesh of meshes)mesh.removeFromParent();
  this.proxyBones={};this.proxy.traverse(o=>{if(o.isBone)this.proxyBones[o.name]=o;});
  this.mixer=new THREE.AnimationMixer(this.proxy);
  this.names=DIRECTIONS.map(direction=>`${prefix}_Guard_Walk_${direction}`);
  this.actions=this.names.map(name=>{
   const clip=clips.find(c=>c.name===name);if(!clip)throw Error(`Missing attack footwork source: ${name}`);
   return this.mixer.clipAction(clip).setEffectiveTimeScale(0).play();
  });
  this.specs=this.actions.map(action=>nativeWalkSpec(action.getClip(),motionData[action.getClip().name]));
 }
 restore(){for(const [bone,position,q]of this.saved){bone.position.copy(position);bone.quaternion.copy(q);}this.saved=[];}
 seedContactEntry({feet,support,contacts,anatomy,elapsed=0,walkPhase,grounded=true,rootRotation,rootPosition,rootVelocity}){
  this.contactTransfer=new GuardContactTransfer({feet,support,contacts,bones:this.bones,root:this.root,elapsed,walkPhase,grounded,rootRotation,rootPosition,rootVelocity});
  this.phase=this.contactTransfer.phase;this.weight=1;this.transferAnatomy=anatomy;
  this.settling=null;
  this.transferPelvis=this.bones.pelvis.position.clone();
  this.transferPoles=Object.fromEntries(['r','l'].map(s=>[s,{pole:feet[s].pole??captureLegPole(this.bones['thigh_'+s],this.bones['calf_'+s],this.bones['foot_'+s],anatomy[s].hinge),continuity:{}}]));
 }
 reset(){this.weight=0;this.pelvisGaitWeight=0;this.report=null;this.contactTransfer=null;this.transferPelvis=null;this.transferPoles=null;this.settling=null;this.travelHeading=null;}

 apply(dt,{active=false,speed=0,angle=0,runPhase=null,kneeSolver,pelvisGaitWeight=0,groundHeight=null,authoredPose=null}={}){
  const wanted=(active||this.contactTransfer)&&speed>.10?1:0;
  const contactGround=groundHeight??(()=>this.root.position.y);
  if(wanted&&this.settling){
   const feet=Object.fromEntries(['r','l'].map(s=>[s,{...this.settling.feet[s].last,velocity:this.settling.feet[s].velocity}]));
   const support=['r','l'].sort((a,b)=>this.settling.gap(a,feet[a],contactGround)-this.settling.gap(b,feet[b],contactGround))[0];
   this.seedContactEntry({feet,support,contacts:this.contactTransfer.contacts,anatomy:this.transferAnatomy,rootRotation:this.contactTransfer.lastRootRotation});
  }
  if(!wanted&&this.contactTransfer&&!this.settling){
   const feet=Object.fromEntries(['r','l'].map(s=>[s,{p:this.contactTransfer.feet[s].last,q:this.contactTransfer.feet[s].lastQ,
    velocity:this.contactTransfer.feet[s].velocity,ballQ:this.bones['ball_'+s].quaternion}]));
   this.settling=new PlantedPoseTransfer(feet,this.contactTransfer.contacts);
  }
  this.contactTransfer?.begin(dt,groundHeight);
  if(this.settling)this.settling.begin(dt,authoredPose?.key??'ready',authoredPose?.time??this.contactTransfer.age);
  if(wanted)this.pelvisGaitWeight=THREE.MathUtils.clamp(pelvisGaitWeight,0,1);
  const previousWeight=this.weight;
  const rootForward=new THREE.Vector3(0,0,1).applyQuaternion(rotation(this.root)),rootHeading=Math.atan2(rootForward.x,rootForward.z);
  const wantedHeading=angle+rootHeading;
  if(wanted&&!this.weight){this.phase=runPhase===null?0:(runPhase+.75)%1;this.travelHeading=wantedHeading;}
  this.travelHeading??=wantedHeading;
  if(speed>.10)this.travelHeading+=Math.atan2(Math.sin(wantedHeading-this.travelHeading),Math.cos(wantedHeading-this.travelHeading))*(1-Math.exp(-16*dt));
  // Steering can turn the input root ahead of a loaded body. Keep travel in
  // world space, then choose the gait relative to the body's actual heading.
  angle=this.travelHeading-rootHeading-(this.contactTransfer?.yawCorrection??0);
  this.weight=wanted?THREE.MathUtils.damp(this.weight,1,24,dt):Math.max(0,this.weight-dt/.22);
  if(this.weight<.001){if(!this.contactTransfer){this.reset();return null;}this.weight=0;}
  const weights=[Math.max(0,Math.cos(angle)),Math.max(0,Math.sin(angle)),Math.max(0,-Math.cos(angle)),Math.max(0,-Math.sin(angle))].map((v,i)=>v/this.specs[i].walkSpeed);
  const sum=weights.reduce((a,b)=>a+b,0),duration=this.specs[0].duration;
  // A landing can occur between updates. Retain its elapsed time instead of
  // restarting support at the frame which consumes the handoff.
  const phaseTime=dt+(this.contactTransfer?.entryElapsed??0);
  if(this.contactTransfer)this.contactTransfer.entryElapsed=0;
  const phaseRate=speed*sum/(this.root.scale.x*duration);
  if(this.contactTransfer)this.contactTransfer.phaseRate=phaseRate;
  this.phase=(this.phase+phaseTime*phaseRate)%1;
  this.actions.forEach((action,i)=>{action.time=this.phase*duration;action.setEffectiveWeight(weights[i]/sum);});
  this.proxyRoot.position.copy(this.root.position);this.proxyRoot.quaternion.copy(this.root.quaternion);this.proxyRoot.scale.copy(this.root.scale);
  if(this.contactTransfer)this.proxyRoot.quaternion.premultiply(this.contactTransfer.bodyCorrection);
  this.mixer.update(0);this.proxyRoot.updateMatrixWorld(true);this.root.updateMatrixWorld(true);
  const targets=['r','l'].map(side=>({side,ankle:point(this.bones['foot_'+side]),q:rotation(this.bones['foot_'+side])}));
  if(!wanted){
   // A wide attack stance can be far from the last walking pose. Limit the
   // release displacement instead of moving that distance in a fixed fade.
   const span=Math.max(...targets.map(({side,ankle})=>ankle.distanceTo(point(this.proxyBones['foot_'+side]))));
   if(span>1e-6)this.weight=Math.max(this.weight,previousWeight-2.4*dt/span);
  }
  for(const name of ['pelvis','thigh_r','calf_r','foot_r','ball_r','thigh_l','calf_l','foot_l','ball_l']){
   const bone=this.bones[name];this.saved.push([bone,bone.position.clone(),bone.quaternion.clone()]);
  }
  if(this.contactTransfer){
   const pelvis=this.bones.pelvis,correction=this.contactTransfer.bodyCorrection;
   const p=point(pelvis).sub(this.root.position).applyQuaternion(correction).add(this.root.position);
   pelvis.position.copy(pelvis.parent.worldToLocal(p));
   setWorldRotation(pelvis,correction.clone().multiply(rotation(pelvis)));
  }
  const turnWeight=this.weight*(this.contactTransfer?THREE.MathUtils.lerp(this.pelvisGaitWeight,.85,THREE.MathUtils.smootherstep(this.contactTransfer.age,0,.18)):this.pelvisGaitWeight);
  const spineFrames=this.weight?SPINE.map(name=>[this.bones[name],rotation(this.bones[name])]):[];
  for(const [bone]of spineFrames)this.saved.push([bone,bone.position.clone(),bone.quaternion.clone()]);
  const pelvis=this.bones.pelvis,p=point(pelvis),gait=point(this.proxyBones.pelvis);
  // Retain some attack compression and lean while moving the body over its steps.
  p.x=THREE.MathUtils.lerp(p.x,gait.x,this.weight*.85);p.z=THREE.MathUtils.lerp(p.z,gait.z,this.weight*.85);p.y=THREE.MathUtils.lerp(p.y,gait.y,this.weight*.6);
  pelvis.position.copy(pelvis.parent.worldToLocal(p));
  if(this.contactTransfer&&this.transferPelvis)pelvis.position.copy(this.transferPelvis.clone().lerp(pelvis.position,THREE.MathUtils.smootherstep(this.contactTransfer.age,0,.18)));
  this.root.updateMatrixWorld(true);
  let pelvisBlend=null;
  if(this.weight){
   // Walking supplies some pelvic turn so a wide cut cannot wrench the hips
   // against forward-facing steps. Keep the chest and weapon orientation,
   // distributing the difference through all three abdominal/spinal joints.
   const original=rotation(pelvis);
   pelvisBlend=blendAttackPelvis(original,rotation(this.proxyBones.pelvis),{
    turnWeight,walkWeight:this.weight,up:new THREE.Vector3(0,1,0).applyQuaternion(rotation(this.root)).normalize(),
   });
   const turned=pelvisBlend.rotation;
   const correction=turned.clone().multiply(original.clone().invert());
   setWorldRotation(pelvis,turned);
   for(const [i,[bone,q]]of spineFrames.entries())setWorldRotation(bone,new THREE.Quaternion().slerp(correction,(2-i)/3).multiply(q));
  }
  const contactWeights={},stance={},feet=[],worldFootTargets=this.contactTransfer?{}:null;
  for(const target of targets){
   const {side}=target,foot=this.bones['foot_'+side],proxyFoot=this.proxyBones['foot_'+side];
   target.ankle.lerp(point(proxyFoot),this.weight);target.q.slerp(rotation(proxyFoot),this.weight);
   this.bones['ball_'+side].quaternion.slerp(this.proxyBones['ball_'+side].quaternion,this.weight);
   const phase=(this.phase+(side==='r'?.25:.75))%1;
   let supported;
   if(this.settling){
    const frame=this.settling.place(side,{p:target.ankle,q:target.q,ballQ:this.bones['ball_'+side].quaternion},authoredPose?.motion,contactGround,authoredPose?.contactWeights?.[side]??1);
    target.ankle.copy(frame.p);target.q.copy(frame.q);this.bones['ball_'+side].quaternion.copy(frame.ballQ);supported=frame.supported;
    this.contactTransfer.feet[side].target=target.ankle.clone();this.contactTransfer.feet[side].targetQ=target.q.clone();
   }else supported=this.contactTransfer?.place(side,target.ankle,target.q,phase,dt,groundHeight);
   let error;
   if(this.contactTransfer){
    const thigh=this.bones['thigh_'+side],calf=this.bones['calf_'+side],hinge=this.transferAnatomy[side].hinge;
    solveLeg(thigh,calf,foot,target.ankle,target.q,{kneeSolver});
    const native=captureLegPole(thigh,calf,foot,hinge),axis=target.ankle.clone().sub(point(thigh)).normalize(),source=this.transferPoles[side];
    const bend=blendLegPole(source.pole,native,axis,THREE.MathUtils.smootherstep(this.contactTransfer.age,0,.24),source.continuity);
    error=solveLegWithPole(thigh,calf,foot,target.ankle,target.q,hinge,{axis,bend});
    worldFootTargets[side]={p:target.ankle.clone(),q:target.q.clone()};
   }else error=solveLeg(this.bones['thigh_'+side],this.bones['calf_'+side],foot,target.ankle,target.q,{kneeSolver});
   stance[side]=this.contactTransfer?supported:phase<.5;contactWeights[side]=this.contactTransfer?Number(supported):phase<.5?1:phase<.6?1-THREE.MathUtils.smoothstep(phase,.5,.6):THREE.MathUtils.smoothstep(phase,.9,1);
   feet.push({side,error});
  }
  this.report={weight:this.weight,phase:this.phase,feet,pelvisYaw:pelvisBlend?.afterYaw??0,
   pelvisYawBefore:pelvisBlend?.beforeYaw??0,pelvisExtraYaw:pelvisBlend?.extraYaw??0};
  return{weight:this.settling?1:this.weight,contactWeights,stance,worldFootTargets};
 }
 finalizeContacts(groundHeight){
  if(!this.contactTransfer||!groundHeight)return;
  this.contactTransfer.lastRootRotation=rotation(this.root).normalize();
  const rootPosition=point(this.root),transfer=this.contactTransfer;
  if(transfer.frameDt>0)transfer.lastRootVelocity.copy(rootPosition).sub(transfer.lastRootPosition).divideScalar(transfer.frameDt);
  transfer.lastRootPosition.copy(rootPosition);
  for(const side of ['r','l']){
   const f=this.contactTransfer.feet[side],foot=this.bones['foot_'+side],error=point(foot).distanceTo(f.target);
   this.contactTransfer.record(side,error);
   if(this.settling)this.settling.record(side,point(foot),rotation(foot),this.bones['ball_'+side].quaternion);
   f.lastPole=captureLegPole(this.bones['thigh_'+side],this.bones['calf_'+side],foot,this.transferAnatomy[side].hinge);
   const report=this.report.feet.find(f=>f.side===side);report.preTerrainError=report.error;report.error=error;
   report.actualGap=this.contactTransfer.gap(side,point(foot),rotation(foot),groundHeight);
   if(this.contactTransfer.landing===side&&Math.abs(report.actualGap)>.012)this.contactTransfer.landing=null;
  }
 }
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.proxy);}
}
