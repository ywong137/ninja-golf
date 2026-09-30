import * as THREE from 'three';
import {calibrateLegAnatomy} from './leg-anatomy.js';
import locomotion from './locomotion-data.json';
import {RunTurnPlanner} from './run-turn-planner.js';
import {recoveryWeight,solveRecoveryLeg} from './leg-recovery.js';

const caches=new WeakMap();
const point=bone=>bone.getWorldPosition(new THREE.Vector3());
const rotation=bone=>bone.getWorldQuaternion(new THREE.Quaternion()).normalize();
const BODY=['pelvis','spine_01','spine_02','spine_03','ball_r','ball_l'];
const TURN_BODY=['pelvis','spine_01','spine_02','spine_03','Head'];
// Rocketbox attaches both thighs to spine_01. It must share the complete hip
// turn; distributing counter-rotation there moves and twists the hip joints.
const TURN_WEIGHTS=[1,1,.82,.65,.24];

// Quaternion blending alone shortens a planted leg when the hips turn between
// forward and lateral runs. Blend the authored ankle paths, then solve the legs.
// Cache native paths once per model; no extra skeleton runs during gameplay.
function sampleClips(template,clips){
 if(caches.has(template))return caches.get(template);
 const proxy=template.clone(true),meshes=[];proxy.traverse(o=>{if(o.isMesh)meshes.push(o);});for(const mesh of meshes)mesh.removeFromParent();
 const mixer=new THREE.AnimationMixer(proxy),data={};
 for(const clip of clips.filter(c=>/^Run_|^Sprint_Forward$/.test(c.name))){
  const count=Math.ceil(clip.duration*240),rows=[];mixer.stopAllAction();
  const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce);action.clampWhenFinished=true;action.play();
  for(let i=0;i<=count;i++){
   action.time=i/count*clip.duration;mixer.update(0);proxy.updateMatrixWorld(true);
   rows.push({...Object.fromEntries(['r','l'].map(side=>{const foot=proxy.getObjectByName('foot_'+side);return[side,{p:point(foot),q:rotation(foot)}];})),body:BODY.map(name=>proxy.getObjectByName(name).quaternion.clone().normalize()),pelvis:proxy.getObjectByName('pelvis').position.clone()});
  }
  data[clip.name]={rows,count};
 }
 mixer.stopAllAction();mixer.uncacheRoot(proxy);caches.set(template,data);return data;
}
export class RunFootwork{
 constructor(root,model,bones,template,clips,contactGeometry){
  this.root=root;this.model=model;this.bones=bones;this.saved=[];this.data=sampleClips(template,clips);
  this.contactGeometry=contactGeometry?Object.fromEntries(['r','l'].map(side=>[side,{points:contactGeometry[side].contacts,up:contactGeometry[side].soleUp}])):null;
  this.legLengths=Object.fromEntries(['r','l'].map(side=>[side,point(bones['thigh_'+side]).distanceTo(point(bones['calf_'+side]))+point(bones['calf_'+side]).distanceTo(point(bones['foot_'+side]))]));
  this.bodyFrames=Object.fromEntries(TURN_BODY.map(name=>[name,rotation(model).invert().multiply(rotation(bones[name]))]));
  this.anatomy=Object.fromEntries(['r','l'].map(side=>[side,calibrateLegAnatomy(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side])]));
 }
 restore(){for(const [bone,q,p]of this.saved){bone.quaternion.copy(q);if(p)bone.position.copy(p);}this.saved=[];}
 captureEntry({includeBody=false}={}){
  this.root.updateMatrixWorld(true);
  this.entry=Object.fromEntries(['r','l'].map(side=>[side,{p:point(this.bones['foot_'+side]),q:rotation(this.bones['foot_'+side])}]));
  this.entryBody=includeBody?BODY.map(name=>this.bones[name].quaternion.clone().normalize()):null;
  const pelvis=this.bones.pelvis;
  this.entryPelvis=includeBody?pelvis.position.clone():null;
  this.entryPelvisRotation=includeBody?rotation(pelvis):null;
 }
 resetEntry(){this.entry=null;this.entryBody=null;this.entryPelvis=null;this.entryPelvisRotation=null;}
 applyExit(dt){
  if(!this.exitPose)return;
  if(dt===0){this.exitPose=null;this.exitAge=undefined;return;}
  this.exitAge=(this.exitAge??0)+dt;
  const blend=THREE.MathUtils.smootherstep(this.exitAge,0,.18);
  for(const [bone,pose]of this.exitPose){
   this.saved.push([bone,bone.quaternion.clone(),pose.p?bone.position.clone():null]);
   bone.quaternion.copy(pose.q.clone().slerp(bone.quaternion,blend));
   if(pose.p)bone.position.copy(pose.p.clone().lerp(bone.position,blend));
  }
  this.root.updateMatrixWorld(true);
  if(blend===1){this.exitPose=null;this.exitAge=undefined;}
 }
 resetDirection(){this.turnPlanner=null;this.previousHeading=null;this.previousActualHeading=null;this.previousFeet=null;this.previousAngle=null;this.previousRootYaw=null;this.previousPelvis=null;this.previousBody=null;this.gaitContacts=null;}
 apply(actions,phase,blend,{dt=0}={}){
  this.report=null;if(!actions?.length||blend<=0)return;
  const active=actions.map(action=>({name:action.getClip().name,weight:action.getEffectiveWeight()})).filter(a=>a.weight>1e-6);
  if(!active.length)return;
  const total=active.reduce((sum,a)=>sum+a.weight,0);
  // Blend to the native run, not the mixer's already fading body pose. Blending
  // twice accelerates a large sideways turn sharply at the end of the fade.
  if(this.entryBody)for(const [j,name]of BODY.entries()){
   const bone=this.bones[name],target=new THREE.Quaternion(),pelvis=new THREE.Vector3();let accumulated=0;
   for(const a of active){
    const {rows,count}=this.data[a.name],at=((phase%1)+1)%1*count,i=Math.min(count-1,Math.floor(at)),t=at-i;
    const q=rows[i].body[j].clone().slerp(rows[i+1].body[j],t);
    if(j===0)pelvis.addScaledVector(rows[i].pelvis.clone().lerp(rows[i+1].pelvis,t),a.weight/total);
    if(!accumulated)target.copy(q);else target.slerp(q,a.weight/(accumulated+a.weight));accumulated+=a.weight;
   }
   // The entry feet stay in world space during a turn. Keep the entry pelvis
   // orientation in that same frame so root yaw cannot wind up the hips.
   const entry=j===0?rotation(bone.parent).invert().multiply(this.entryPelvisRotation):this.entryBody[j];
   this.saved.push([bone,bone.quaternion.clone(),j===0?bone.position.clone():null]);bone.quaternion.copy(entry).slerp(target,blend);
   if(j===0)bone.position.copy(this.entryPelvis).lerp(pelvis,blend);
  }
  this.root.updateMatrixWorld(true);
  const modelQ=rotation(this.model),reports=[],planned=[];
  const velocity=new THREE.Vector3();let sourceHeading=0;
  for(const a of active){
   const spec=locomotion[a.name];
   velocity.addScaledVector(new THREE.Vector3(Math.sin(spec.angle),0,Math.cos(spec.angle)),a.weight/total*spec.amplitude);
   sourceHeading+=(a.name==='Run_Right'?1:a.name==='Run_Left'?-1:0)*a.weight/total*85*Math.PI/180;
  }
  const angle=Math.atan2(velocity.x,velocity.z),amplitude=velocity.length();
  const forward=new THREE.Vector3(0,0,1).applyQuaternion(modelQ),rootYaw=Math.atan2(forward.x,forward.z);
  if(dt===0)this.resetDirection();
  const headingChange=!Number.isFinite(this.previousHeading)?0:Math.atan2(Math.sin(sourceHeading+rootYaw-this.previousHeading),Math.cos(sourceHeading+rootYaw-this.previousHeading));
  const angleChange=!Number.isFinite(this.previousAngle)?0:Math.atan2(Math.sin(angle-this.previousAngle),Math.cos(angle-this.previousAngle));
  if((Math.abs(angle)>Math.PI/2+1e-6||Math.abs(headingChange)>1e-4||Math.abs(angleChange)>1e-4)&&!this.turnPlanner)this.turnPlanner=new RunTurnPlanner({heading:dt>0?this.previousActualHeading:undefined,feet:dt>0?this.previousFeet:null,center:point(this.model),toeAxes:{r:this.bones.ball_r.position,l:this.bones.ball_l.position},contactGeometry:this.contactGeometry});
  const planner=this.turnPlanner;
  let heading=sourceHeading;
  if(planner){
   if(!planner.yawOffsets){
    const previousRoot=this.previousRootYaw??rootYaw,initial=planner.heading??rootYaw+sourceHeading;
    const local=Math.atan2(Math.sin(initial-previousRoot),Math.cos(initial-previousRoot));
    planner.yawOffsets=TURN_BODY.map((name,i)=>{
     const previous=this.previousBody?.[name];if(!previous)return 0;
     const forward=new THREE.Vector3(0,0,1).applyQuaternion(previous.clone().multiply(this.bodyFrames[name].clone().invert()));
     const offset=Math.atan2(forward.x,forward.z)-previousRoot-local*TURN_WEIGHTS[i];return Math.atan2(Math.sin(offset),Math.cos(offset));
    });
   }
   heading=planner.begin({angle,phase,dt,sourceHeading,center:point(this.model),rootYaw,scale:this.root.scale.x,amplitude});
   const pelvis=this.bones.pelvis,saved=this.saved.find(([b])=>b===pelvis);
   if(saved)saved[2]??=pelvis.position.clone();else this.saved.push([pelvis,pelvis.quaternion.clone(),pelvis.position.clone()]);
   planner.pelvisPosition??=(this.previousPelvis??pelvis.position).clone();
   planner.pelvisPosition.lerp(pelvis.position,1-Math.exp(-32*Math.min(dt,.05)));
   if(dt>0)pelvis.position.copy(planner.pelvisPosition);
   this.root.updateMatrixWorld(true);
   const frames=TURN_BODY.map(name=>[name,rotation(this.bones[name])]);planner.lean??={};
   for(const [i,[name,q]]of frames.entries()){
    const bone=this.bones[name];if(!this.saved.some(([b])=>b===bone))this.saved.push([bone,bone.quaternion.clone()]);
    const direction=new THREE.Vector3(0,0,1).applyQuaternion(q.clone().multiply(this.bodyFrames[name].clone().invert()));
    const actual=Math.atan2(direction.x,direction.z),wanted=planner.heading+planner.counterYaw*(1-TURN_WEIGHTS[i])+planner.yawOffsets[i]*Math.exp(-24*planner.age);
    const Y=new THREE.Vector3(0,1,0),amount=Math.atan2(Math.sin(wanted-actual),Math.cos(wanted-actual))*blend;
    const lean=new THREE.Quaternion().setFromAxisAngle(Y,-actual).multiply(q);
    if(!planner.lean[name]){
     const previous=this.previousBody?.[name]??q,axis=new THREE.Vector3(0,0,1).applyQuaternion(previous.clone().multiply(this.bodyFrames[name].clone().invert()));
     planner.lean[name]=new THREE.Quaternion().setFromAxisAngle(Y,-Math.atan2(axis.x,axis.z)).multiply(previous);
    }
    if(dt>0)lean.copy(planner.lean[name].slerp(lean,1-Math.exp(-32*Math.min(dt,.05))));
    bone.quaternion.copy(rotation(bone.parent).invert().multiply(new THREE.Quaternion().setFromAxisAngle(Y,actual+amount)).multiply(lean)).normalize();bone.updateWorldMatrix(false,true);
   }
  }
  this.previousHeading=heading+rootYaw;this.previousAngle=angle;this.previousRootYaw=rootYaw;

  for(const side of ['r','l']){
   const target=new THREE.Vector3(),q=new THREE.Quaternion();let accumulated=0;
   for(const a of active){
    const {rows,count}=this.data[a.name],at=(planner?((planner.animationPhase(side)+(side==='r'?0:.5))%1):((phase%1)+1)%1)*count,i=Math.min(count-1,Math.floor(at)),t=at-i;
    target.addScaledVector(rows[i][side].p.clone().lerp(rows[i+1][side].p,t),a.weight/total);
    const orientation=rows[i][side].q.clone().slerp(rows[i+1][side].q,t);
    if(!accumulated)q.copy(orientation);else q.slerp(orientation,a.weight/(accumulated+a.weight));accumulated+=a.weight;
   }
   if(planner){
    const {rows,count}=this.data.Run_Backward,at=((planner.animationPhase(side)+(side==='r'?0:.5))%1)*count,i=Math.min(count-1,Math.floor(at)),t=at-i;
    const source=rows[i][side].p.clone().lerp(rows[i+1][side].p,t);source.y=THREE.MathUtils.lerp(target.y,source.y,planner.backWeight);const travel=planner.travel(side),sign=side==='r'?-1:1,width=planner.width(side);
    target.set(Math.sin(angle)*travel+sign*width*Math.cos(heading),source.y,Math.cos(angle)*travel-sign*width*Math.sin(heading));
    const Y=new THREE.Vector3(0,1,0),backQ=rows[i][side].q.clone().slerp(rows[i+1][side].q,t).premultiply(new THREE.Quaternion().setFromAxisAngle(Y,heading));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(Y,heading-sourceHeading)).slerp(backQ,planner.backWeight);
    const toe=this.bones['ball_'+side].position.clone().applyQuaternion(q);
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(Y,heading+sign*8*Math.PI/180-Math.atan2(toe.x,toe.z)));
   }
   target.applyMatrix4(this.model.matrixWorld);q.premultiply(modelQ);
   if(planner)planner.place(side,target,q,{hip:point(this.bones['thigh_'+side]),reach:this.legLengths[side]});
   const thigh=this.bones['thigh_'+side],calf=this.bones['calf_'+side],foot=this.bones['foot_'+side];
   target.lerp(this.entry?.[side].p??point(foot),1-blend);q.slerp(this.entry?.[side].q??rotation(foot),1-blend);
   planned.push({side,thigh,calf,foot,target,q});
  }
  // Keep support targets reachable before solving either leg. A free target
  // must not pull the whole pelvis into a squat during a quick turn.
  let lower=0;
  if(planner)for(const {side,thigh,calf,foot,target}of planned){
   const contact=planner.feet[side].anchor?1:THREE.MathUtils.smootherstep(planner.animationPhase(side),.84,1);
   if(!contact)continue;
   const hip=point(thigh),knee=point(calf),ankle=point(foot),reach=(hip.distanceTo(knee)+knee.distanceTo(ankle))*.98;
   const horizontal=Math.hypot(target.x-hip.x,target.z-hip.z);
   lower=Math.min(lower,(target.y+Math.sqrt(Math.max(0,reach*reach-horizontal*horizontal))-hip.y)*contact);
  }
  if(planner){
   planner.requiredLower=lower;
   const previous=planner.lower??0,frameDt=Math.min(dt,.05);
   planner.lower=lower<previous?Math.max(lower,previous-.4*frameDt):THREE.MathUtils.lerp(previous,lower,1-Math.exp(-16*frameDt));
   lower=planner.lower;
  }
  this.previousPelvis=this.bones.pelvis.position.clone();
  if(lower<0){
   const pelvis=this.bones.pelvis,saved=this.saved.find(([b])=>b===pelvis);
   if(saved)saved[2]??=pelvis.position.clone();else this.saved.push([pelvis,pelvis.quaternion.clone(),pelvis.position.clone()]);
   pelvis.position.copy(pelvis.parent.worldToLocal(point(pelvis).add(new THREE.Vector3(0,lower,0))));this.root.updateMatrixWorld(true);
  }
  for(const {side,thigh,calf,foot,target,q}of planned){
   for(const bone of [thigh,calf,foot])this.saved.push([bone,bone.quaternion.clone()]);
   const weight=recoveryWeight(planner?planner.animationPhase(side):phase+(side==='r'?0:.5),blend);
   const error=solveRecoveryLeg(thigh,calf,foot,target,q,this.anatomy[side],weight);reports.push({side,error});
  }
  this.previousBody=Object.fromEntries(TURN_BODY.map(name=>[name,rotation(this.bones[name])]));
  const actualDirection=new THREE.Vector3(0,0,1).applyQuaternion(this.previousBody.spine_01.clone().multiply(this.bodyFrames.spine_01.clone().invert()));
  this.previousActualHeading=Math.atan2(actualDirection.x,actualDirection.z);
  this.previousFeet=Object.fromEntries(['r','l'].map(side=>[side,{p:point(this.bones['foot_'+side]),q:planned.find(p=>p.side===side).q.clone(),phase:(phase+(side==='r'?0:.5))%1}]));
  this.report=reports;this.gaitContacts=planner?.contacts()??null;
  // The mixer has no knowledge of the corrected run pose. Crossfade from that
  // actual pose when running ends, rather than exposing its old diagonal blend.
  this.exitPose=new Map(this.saved.map(([bone,,p])=>[bone,{q:bone.quaternion.clone(),p:p?bone.position.clone():null}]));
  this.exitAge=undefined;
  if(blend>=1)this.resetEntry();
 }
}
