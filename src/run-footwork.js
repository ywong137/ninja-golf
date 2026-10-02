import * as THREE from 'three';
import {calibrateLegAnatomy} from './leg-anatomy.js';
import {nativeRunSpec} from './native-stride.js';
import {RunTurnPlanner} from './run-turn-planner.js';
import {recoveryWeight,solveRecoveryLeg} from './leg-recovery.js';
import {captureLegPole,blendLegPole,solveLegWithPole} from './leg-pole.js';
import {RUN_ENTRY_CADENCE} from './run-cadence.js';

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
 const hinges=Object.fromEntries(['r','l'].map(side=>[side,calibrateLegAnatomy(...['thigh','calf','foot'].map(n=>proxy.getObjectByName(n+'_'+side))).hinge]));
 const mixer=new THREE.AnimationMixer(proxy),data={};
 for(const clip of clips.filter(c=>/^Run_|^Sprint_Forward$|_Ready$/.test(c.name))){
  const count=clip.name.endsWith('_Ready')?1:Math.ceil(clip.duration*240),rows=[];mixer.stopAllAction();
  const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce);action.clampWhenFinished=true;action.play();
  for(let i=0;i<=count;i++){
   action.time=i/count*clip.duration;mixer.update(0);proxy.updateMatrixWorld(true);
   const body=BODY.map(name=>proxy.getObjectByName(name).quaternion.clone().normalize());
   rows.push({...Object.fromEntries(['r','l'].map(side=>{const foot=proxy.getObjectByName('foot_'+side);return[side,{p:point(foot),q:rotation(foot),ballQ:body[BODY.indexOf('ball_'+side)],hipY:point(proxy.getObjectByName('thigh_'+side)).y,pole:captureLegPole(proxy.getObjectByName('thigh_'+side),proxy.getObjectByName('calf_'+side),foot,hinges[side])}];})),body,pelvis:proxy.getObjectByName('pelvis').position.clone()});
  }
  data[clip.name]={rows,count};
 }
 mixer.stopAllAction();mixer.uncacheRoot(proxy);caches.set(template,data);return data;
}
export class RunFootwork{
 constructor(root,model,bones,template,clips,contactGeometry){
  this.root=root;this.model=model;this.bones=bones;this.saved=[];this.data=sampleClips(template,clips);
  this.locomotion=Object.fromEntries(clips.map(clip=>[clip.name,nativeRunSpec(clip)]));
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
 seedContactEntry({feet,rootRotation,phase,elapsed=0,bodyHeading}){
  // The braking steps own real world footprints. Start the run at their latest
  // landing, retaining support until takeoff rather than fading between soles.
  this.resetDirection();this.entry=null;this.contactEntry=true;
  phase=(phase+elapsed*RUN_ENTRY_CADENCE)%1;
  feet=Object.fromEntries(['r','l'].map(side=>[side,{...feet[side],phase:(phase+(side==='l'?.5:0))%1}]));
  // The controller has already turned this frame's root. Feet and knee planes
  // still describe the previous world pose; keep the captured body in it too.
  const sourceFrame=rootRotation?rootRotation.clone().multiply(rotation(this.root).invert()):new THREE.Quaternion();
  this.entryPelvisRotation?.premultiply(sourceFrame);
  this.entryPoles=Object.fromEntries(['r','l'].map(s=>[s,{pole:feet[s].pole??captureLegPole(this.bones['thigh_'+s],this.bones['calf_'+s],this.bones['foot_'+s],this.anatomy[s].hinge),continuity:{}}]));
  const forward=new THREE.Vector3(0,0,1).applyQuaternion(sourceFrame.clone().multiply(rotation(this.model)));
  const rootYaw=Math.atan2(forward.x,forward.z),heading=bodyHeading??rootYaw;
  this.turnPlanner=new RunTurnPlanner({contactEntry:true,heading,feet,center:point(this.model),toeAxes:{r:this.bones.ball_r.position,l:this.bones.ball_l.position},contactGeometry:this.contactGeometry});
  this.previousBody=Object.fromEntries(TURN_BODY.map(name=>[name,sourceFrame.clone().multiply(rotation(this.bones[name]))]));
  this.previousPelvis=this.bones.pelvis.position.clone();
  this.previousRootYaw=rootYaw;this.previousActualHeading=heading;this.previousHeading=heading;this.previousAngle=0;
  this.previousFeet=feet;
  return phase;
 }
 resetEntry(){this.entryPoles=null;this.contactEntry=false;this.entry=null;this.entryBody=null;this.entryPelvis=null;this.entryPelvisRotation=null;}
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
 finalizeWorldContacts(dt){
  if(!this.worldFootTargets||!this.turnPlanner)return;
  for(const side of ['r','l']){
   const f=this.turnPlanner.feet[side],actual=point(this.bones['foot_'+side]);
   f.velocity=dt>0&&f.lastActual?actual.clone().sub(f.lastActual).divideScalar(dt):new THREE.Vector3();
   f.lastActual=actual.clone();f.last.copy(actual);
   if(this.previousFeet?.[side])this.previousFeet[side].p.copy(actual);
  }
 }
 applyEntryBody(actions,phase,blend){
  if(!this.entryBody||!actions?.length)return;
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
 }
 apply(actions,phase,blend,{dt=0,groundHeight,terrainPelvisOffset=0,strideScale=1,motionPrediction=null,movementHeading=null,focused=false}={}){
  this.report=null;this.worldFootTargets=null;if(!actions?.length||blend<=0)return;
  const active=actions.map(action=>({name:action.getClip().name,weight:action.getEffectiveWeight()})).filter(a=>a.weight>1e-6);
  if(!active.length)return;
  const total=active.reduce((sum,a)=>sum+a.weight,0);
  this.applyEntryBody(actions,phase,blend);
  this.root.updateMatrixWorld(true);
  const modelQ=rotation(this.model),reports=[],planned=[];
  const velocity=new THREE.Vector3();let sourceHeading=0;
  for(const a of active){
   const spec=this.locomotion[a.name];
   velocity.addScaledVector(new THREE.Vector3(Math.sin(spec.angle),0,Math.cos(spec.angle)),a.weight/total*spec.amplitude);
   sourceHeading+=(a.name==='Run_Right'?1:a.name==='Run_Left'?-1:0)*a.weight/total*85*Math.PI/180;
  }
  const angle=Math.atan2(velocity.x,velocity.z),amplitude=velocity.length()*strideScale;
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
   const hipHeightAt=(side,futurePhase)=>active.reduce((height,a)=>{
    const {rows,count}=this.data[a.name],at=((futurePhase%1)+1)%1*count,i=Math.min(count-1,Math.floor(at)),t=at-i;
    return height+THREE.MathUtils.lerp(rows[i][side].hipY,rows[i+1][side].hipY,t)*a.weight/total*this.root.scale.x;
   },0);
   heading=planner.begin({angle,phase,dt,sourceHeading,center:point(this.model),rootYaw,scale:this.root.scale.x,amplitude,groundHeight,motionPrediction,movementHeading,focused,hipHeightAt});
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
    // Match the pose transition's smooth start. Exponential removal of a
    // captured attack twist creates its greatest torso speed on frame one.
    const yawWeight=1-THREE.MathUtils.smootherstep(planner.age,0,.24);
    const actual=Math.atan2(direction.x,direction.z),wanted=planner.heading+planner.counterYaw*(1-TURN_WEIGHTS[i])+planner.yawOffsets[i]*yawWeight;
    // Contact entry already blends the source body and bounds the planned yaw.
    // A second fade lets the root twist the actual hips past the planted shoe.
    const Y=new THREE.Vector3(0,1,0),amount=Math.atan2(Math.sin(wanted-actual),Math.cos(wanted-actual))*(this.contactEntry?1:blend);
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

  // Resolve contact and liftoff before forecasting either airborne endpoint.
  // Otherwise a right-foot flight can retain a stale left support for one
  // frame and miss the safe retarget window at lower render rates.
  const sides=['r','l'];
  if(planner?.worldContacts)sides.sort((a,b)=>Number(planner.animationPhase(b)<.28)-Number(planner.animationPhase(a)<.28));
  for(const side of sides){
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
   // Blend the proposed flight before contact planning. A later Cartesian
   // blend would move a shoe which the planner has already planted.
   if(!this.contactEntry){target.lerp(this.entry?.[side].p??point(this.bones['foot_'+side]),1-blend);q.slerp(this.entry?.[side].q??rotation(this.bones['foot_'+side]),1-blend);}
   if(planner){
    const hip=point(this.bones['thigh_'+side]);
    // Grounded targets must use the hip height planned by the terrain layer.
    // Comparing them with the unlowered hip can release a reachable footprint.
    if(planner.worldContacts)hip.y+=terrainPelvisOffset;
    planner.place(side,target,q,{hip,reach:this.legLengths[side]});
   }
   const thigh=this.bones['thigh_'+side],calf=this.bones['calf_'+side],foot=this.bones['foot_'+side];
   planned.push({side,thigh,calf,foot,target,q});
  }
  // Keep support targets reachable before solving either leg. A free target
  // must not pull the whole pelvis into a squat during a quick turn.
  let lower=0;
  if(planner)for(const {side,thigh,calf,foot,target}of planned){
   const contact=planner.feet[side].anchor?1:THREE.MathUtils.smootherstep(planner.animationPhase(side),.84,1);
   if(!contact)continue;
   const hip=point(thigh),knee=point(calf),ankle=point(foot),reach=(hip.distanceTo(knee)+knee.distanceTo(ankle))*.98;
   if(planner.worldContacts)hip.y+=terrainPelvisOffset;
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
   const weight=recoveryWeight(planner?planner.recoveryPhase(side):phase+(side==='r'?0:.5),blend);
   let error=solveRecoveryLeg(thigh,calf,foot,target,q,this.anatomy[side],weight);
   if(this.entryPoles){
    const source=this.entryPoles[side],hinge=this.anatomy[side].hinge,native=captureLegPole(thigh,calf,foot,hinge),shoe=rotation(foot),axis=target.clone().sub(point(thigh)).normalize();
    const bend=blendLegPole(source.pole,native,axis,THREE.MathUtils.smootherstep(blend,0,1),source.continuity);
    // The recovery solver has already unfolded the free shoe. The pole blend
    // must retain that result instead of restoring the old planned rotation.
    error=solveLegWithPole(thigh,calf,foot,target,shoe,hinge,{axis,bend});
   }
   // Recovery changes the shoe's rotation after the path planner checks it.
   // Recheck the full oriented sole before recording the next frame's pose.
   let minimum=planner?.minimumSoleHeight(side);
   const contacts=this.contactGeometry?.[side]?.points;
   // The foot path blends from the outgoing attack. Its extra recovery
   // clearance must join at the same weight, rather than lifting the outgoing
   // shoe to a full airborne-run height on the first transition frame.
   if(minimum!=null&&!this.contactEntry)minimum=THREE.MathUtils.lerp(planner.center.y,minimum,blend);
   if(minimum!=null&&contacts){
    const shoe=rotation(foot),ankle=point(foot);
    const missing=planner.groundHeight?minimum-planner.center.y-planner.gap(side,ankle,shoe):minimum-Math.min(...contacts.map(v=>v.clone().applyQuaternion(shoe).add(ankle).y));
    if(missing>0){
     const pole=captureLegPole(thigh,calf,foot,this.anatomy[side].hinge);
     target.y+=missing;
     error=solveLegWithPole(thigh,calf,foot,target,shoe,this.anatomy[side].hinge,pole);
    }
    // Keep the path planner's orientation independent of the recovery solver.
    // Feeding the solved shoe back into its next target winds up the knee plane.
    planner.feet[side].last.copy(point(foot));
   }
   reports.push({side,error});
  }
  this.previousBody=Object.fromEntries(TURN_BODY.map(name=>[name,rotation(this.bones[name])]));
  const actualDirection=new THREE.Vector3(0,0,1).applyQuaternion(this.previousBody.spine_01.clone().multiply(this.bodyFrames.spine_01.clone().invert()));
  this.previousActualHeading=Math.atan2(actualDirection.x,actualDirection.z);
  this.previousFeet=Object.fromEntries(['r','l'].map(side=>[side,{p:point(this.bones['foot_'+side]),q:planned.find(p=>p.side===side).q.clone(),phase:(phase+(side==='r'?0:.5))%1}]));
  this.report=reports;this.gaitContacts=planner?.contacts()??null;
  // Terrain placement adjusts the pelvis after this first leg solve. Retain
  // the requested footprints so an interim reach clamp cannot move a contact.
  if(planner?.groundHeight)this.worldFootTargets=Object.fromEntries(planned.map(({side,target,foot})=>[side,{p:target.clone(),q:rotation(foot)}]));
  // The mixer has no knowledge of the corrected run pose. Crossfade from that
  // actual pose when running ends, rather than exposing its old diagonal blend.
  this.exitPose=new Map(this.saved.map(([bone,,p])=>[bone,{q:bone.quaternion.clone(),p:p?bone.position.clone():null}]));
  this.exitAge=undefined;
  if(blend>=1)this.resetEntry();
 }
}
