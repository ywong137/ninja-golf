import * as THREE from 'three';
import {alignedKnee,footForward,headingKnee} from './knee-alignment.js';
import {calibrateLegHinge,alignLegHinge} from './leg-hinge.js';
import {ArticulatedSole,captureFootSoles,sampleFootSole,soleSupportAnchors} from './foot-sole.js';
const UP=new THREE.Vector3(0,1,0),clamp=THREE.MathUtils.clamp;
// Native authoring and terrain correction must use the same extension reserve.
// A mismatch can turn a microscopic sole correction into a visible knee snap.
export const AUTHORED_LEG_REACH=.985;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function advancePelvisOffset(previous,wanted,limit,dt,enforceClearance){
 let step=(wanted-previous)*(1-Math.exp(-24*Math.min(dt,.05)));
 // A released support must not spring the body upright. Apply the recovery
 // speed limit to braking and turning as well as the running cycle.
 step=clamp(step,enforceClearance?-2.1*Math.min(dt,.05):-Infinity,1.5*Math.min(dt,.05));
 const offset=Math.min(limit,previous+step);
 // A residual below one micrometre must not keep solving a straight leg.
 // Near extension, that negligible distance can create visible angle noise.
 return Math.abs(offset)<1e-6?0:offset;
}
// Motion records are immutable. Join continuous sole/toe support once per clip.
const contactSchedules=new WeakMap();
// Imported clips can retime one character without changing the shared motion.
export function resolveFootSupport(animation,motion){
 const support=animation.userData?.footSupport;
 if(!support)return motion;
 if(!motion||!Number.isFinite(animation.duration)||Math.abs(animation.duration-motion.duration)>1e-5)
  throw Error(`Foot support requires a matching motion duration: ${animation.name}`);
 for(const key of ['footPlants','toePlants'])for(const side of ['r','l']){
  const ranges=support[key]?.[side];
  if(!Array.isArray(ranges)||ranges.some((range,i)=>!Array.isArray(range)||range.length!==2||
    !range.every(Number.isFinite)||range[0]<0||range[1]<range[0]||range[1]>animation.duration+1e-6||
    (i>0&&range[0]<ranges[i-1][1])))throw Error(`Invalid ${key}.${side} in ${animation.name}`);
 }
 return {...motion,footPlants:support.footPlants,toePlants:support.toePlants};
}
function contactIntervals(clip,side){
 if(!clip?.footPlants?.[side])return null;
 let schedule=contactSchedules.get(clip);if(!schedule){schedule={};contactSchedules.set(clip,schedule);}
 if(!schedule[side]){
  const ranges=[...clip.footPlants[side],...(clip.toePlants?.[side]??[]),...(clip.supportWindows?.[side]??[])].map(range=>[...range]).sort((a,b)=>a[0]-b[0]),merged=[];
  for(const range of ranges){const previous=merged.at(-1);if(previous&&range[0]<=previous[1]+1e-7)previous[1]=Math.max(previous[1],range[1]);else merged.push(range);}
  schedule[side]=merged;
 }
 return schedule[side];
}
function worldRotation(bone,rotation){bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)).normalize();bone.updateWorldMatrix(false,true);}

// Solve in world space so native proportions and arbitrary imported bone axes remain intact.
export function solveLeg(thigh,calf,foot,target,footRotation,{maxReach=AUTHORED_LEG_REACH,kneeSolver=alignedKnee}={}){
 const hip=thigh.getWorldPosition(new THREE.Vector3()),knee=calf.getWorldPosition(new THREE.Vector3()),ankle=foot.getWorldPosition(new THREE.Vector3());
 const upper=knee.distanceTo(hip),lower=ankle.distanceTo(knee),axis=target.clone().sub(hip),distance=clamp(axis.length(),Math.abs(upper-lower)+.015,(upper+lower)*maxReach);axis.normalize();
 const solvedAnkle=hip.clone().addScaledVector(axis,distance);
 const solvedKnee=kneeSolver(hip,solvedAnkle,upper,lower,footForward(foot,footRotation));
 const rotation=new THREE.Quaternion().setFromUnitVectors(knee.clone().sub(hip).normalize(),solvedKnee.clone().sub(hip).normalize()).multiply(thigh.getWorldQuaternion(new THREE.Quaternion()));worldRotation(thigh,rotation);
 const nowKnee=calf.getWorldPosition(new THREE.Vector3()),nowAnkle=foot.getWorldPosition(new THREE.Vector3());rotation.setFromUnitVectors(nowAnkle.sub(nowKnee).normalize(),solvedAnkle.clone().sub(nowKnee).normalize()).multiply(calf.getWorldQuaternion(new THREE.Quaternion()));worldRotation(calf,rotation);
 worldRotation(foot,footRotation);
 return solvedAnkle.distanceTo(target);
}

export function attackFootContacts(clip,time,motion){
 const weights={},stance={};
 // The mixer can end a few floating-point units beyond the record's duration.
 // Hold the final contact instead of treating that clamped pose as airborne.
 const contactTime=Number.isFinite(clip?.duration)?clamp(time,0,clip.duration):time;
 for(const side of ['r','l']){
  // A heel pivot still supports the body through its planted toe. The native
  // sole orientation remains intact while terrain adjusts that support.
  const intervals=contactIntervals(clip,side);
  if(intervals){
   let weight=0;
   for(const [start,end]of intervals)if(contactTime>=start&&contactTime<=end){
    const blend=Math.min(.04,(end-start)/3);
    weight=Math.max(weight,blend===0?1:(start===0?1:smooth(start,start+blend,contactTime))*(end>=clip.duration?1:1-smooth(end-blend,end,contactTime)));
   }
   weights[side]=weight;
  }else{
   // Old clips have no support schedule. Any authored lift remains free.
   const lift=motion?.[side==='r'?'footR':'footL']?.[2];
   weights[side]=Number.isFinite(lift)?1-smooth(.001,.006,lift):0;
  }
  stance[side]=weights[side]>.95;
 }
 return {contactWeights:weights,stance};
}

export class FootPlacement {
 constructor(root,bones){
  this.root=root;this.bones=bones;this.saved=[];this.pelvisOffset=0;this.feet={};this.hinges={};root.updateMatrixWorld(true);
  this.soles=captureFootSoles(root);
  for(const side of ['r','l']){
   this.hinges[side]=calibrateLegHinge(bones['thigh_'+side],bones['calf_'+side],bones['foot_'+side]);
   const foot=bones['foot_'+side],ankle=foot.getWorldPosition(new THREE.Vector3()),clearance=ankle.y-root.position.y,inverse=foot.getWorldQuaternion(new THREE.Quaternion()).invert();
   this.feet[side]={clearance,offset:0,toeRoll:0,normal:UP.clone(),soleUp:UP.clone().applyQuaternion(inverse),contacts:soleSupportAnchors(foot,bones['ball_'+side],this.soles[side]),surface:new ArticulatedSole(foot,bones['ball_'+side],this.soles[side])};
  }
 }
 restore(){for(const [bone,position,rotation]of this.saved){bone.position.copy(position);bone.quaternion.copy(rotation);}this.saved=[];}
 reset(){this.report=null;this.pelvisOffset=0;for(const foot of Object.values(this.feet)){foot.offset=0;foot.toeRoll=0;foot.normal.copy(UP);}}
 planTerrainPelvis(dt,groundHeight,{enforceClearance=false,referencePlane=null}={}){
  // Preview the terrain reserve without moving the rig or advancing state.
  // The final foot targets can require additional lowering for leg reach.
  const {root}=this,reach=.7*root.scale.x;let reserve=0;
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,height=groundHeight(root.position.x+Math.cos(a)*reach,root.position.z+Math.sin(a)*reach);
   if(Number.isFinite(height))reserve=Math.min(reserve,height-(referencePlane?.height(root.position.x+Math.cos(a)*reach,root.position.z+Math.sin(a)*reach)??root.position.y));
  }
  reserve=clamp(reserve,-.20,0);
  return {previousOffset:this.pelvisOffset,reserve,offset:advancePelvisOffset(this.pelvisOffset,reserve,0,dt,enforceClearance)};
 }
 apply(dt,groundHeight,{enabled=true,golf=false,contactWeights=null,stance=null,preserveAuthored=false,preserveHinge=false,enforceClearance=false,worldFootTargets=null,pelvisPlan=null,referencePlane=null,kneeSolver=alignedKnee}={}){
  if(!enabled||!groundHeight){this.reset();return;}
  // A zero-time rebuild retains the outgoing solver and its support frame.
  // Reinterpreting a scaled ankle with the idle solver shifts its toe.
  if(dt===0&&!preserveAuthored&&this.report?.preserveAuthored&&this.authoredHandoff){
   const h=this.authoredHandoff;this.applyAuthored(0,groundHeight,h.contactWeights,h.stance,h.options);return;
  }
  if(preserveAuthored){this.applyAuthored(dt,groundHeight,contactWeights,stance,{golf,preserveHinge,enforceClearance,worldFootTargets,pelvisPlan,referencePlane,kneeSolver});return;}
  const root=this.root,bones=this.bones;root.updateMatrixWorld(true);const response=1-Math.exp(-24*Math.min(dt,.05)),samples=[];
  for(const side of ['r','l']){
   const state=this.feet[side],foot=bones['foot_'+side],ankle=foot.getWorldPosition(new THREE.Vector3()),height=groundHeight(ankle.x,ankle.z);
   if(!Number.isFinite(height)){this.reset();return;}
   const lift=Math.max(0,ankle.y-root.position.y-state.clearance),weight=(1-smooth(.035,.18,lift))*(contactWeights?.[side]??1),terrainDelta=height-root.position.y;
   const e=.12,normal=new THREE.Vector3(groundHeight(ankle.x-e,ankle.z)-groundHeight(ankle.x+e,ankle.z),2*e,groundHeight(ankle.x,ankle.z-e)-groundHeight(ankle.x,ankle.z+e)).normalize();
   const tilt=Math.acos(clamp(normal.y,-1,1)),limit=.55;if(tilt>limit)normal.lerp(UP,1-limit/tilt).normalize();
   state.normal.lerp(normal,response).normalize();
   const rotation=foot.getWorldQuaternion(new THREE.Quaternion()),soleUp=golf?UP:state.soleUp.clone().applyQuaternion(rotation),slope=new THREE.Quaternion().setFromUnitVectors(soleUp,state.normal);slope.slerp(new THREE.Quaternion(),1-weight);rotation.premultiply(slope);
   // Sample both ends of the sole, so a bunker lip cannot cut through the toe or heel.
   const soleHeight=Math.max(...state.contacts.map(point=>{const relative=point.clone().applyQuaternion(rotation);return groundHeight(ankle.x+relative.x,ankle.z+relative.z)-relative.y;}));
   // Recovery stays free. Only lift a swinging foot if the ground would intersect its sole.
   const gap=soleHeight-ankle.y,wanted=clamp(Math.max(gap*weight,gap),-.32,.32);
   state.offset=(stance?.[side]||(contactWeights?.[side]??0)>.9)?wanted:THREE.MathUtils.lerp(state.offset,wanted,1-Math.exp(-90*Math.min(dt,.05)));
   const appliedOffset=state.offset*weight;
   // A zero-time rebuild retains the outgoing support. Start collision
   // correction on the next advancing frame, alongside offset smoothing.
   samples.push({side,state,ankle,target:ankle.clone().add(new THREE.Vector3(0,Math.max(appliedOffset,dt>0&&gap>0?Math.min(.32,gap):-Infinity),0)),rotation,weight,lift,terrainDelta});
  }
  // Keep current targets reachable and prepare the pelvis for downhill support.
  let pelvisWanted=0,pelvisLimit=0;
  if(!golf&&stance){
   // Lower before the downhill foot loads; fixed probes do not depend on gait phase.
   const reach=.7*root.scale.x,x=root.position.x,z=root.position.z;
   for(const [dx,dz]of [[reach,0],[-reach,0],[0,reach],[0,-reach]])pelvisWanted=Math.min(pelvisWanted,groundHeight(x+dx,z+dz)-root.position.y);
  }
  if(!golf)for(const s of samples){const hip=bones['thigh_'+s.side].getWorldPosition(new THREE.Vector3()),knee=bones['calf_'+s.side].getWorldPosition(new THREE.Vector3()),length=(hip.distanceTo(knee)+knee.distanceTo(s.ankle))*.985,horizontal=Math.hypot(s.target.x-hip.x,s.target.z-hip.z),available=Math.sqrt(Math.max(.01,length*length-horizontal*horizontal));pelvisLimit=Math.min(pelvisLimit,s.target.y+available-hip.y);}
  pelvisLimit=clamp(pelvisLimit,-.20,0);pelvisWanted=clamp(Math.min(pelvisWanted,pelvisLimit),-.20,0);this.pelvisOffset=Math.min(pelvisLimit,this.pelvisOffset+clamp((pelvisWanted-this.pelvisOffset)*response,-2.1*Math.min(dt,.05),1.5*Math.min(dt,.05)));
  for(const name of ['pelvis','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l']){const bone=bones[name];this.saved.push([bone,bone.position.clone(),bone.quaternion.clone()]);}
  if(!golf){const pelvis=bones.pelvis,point=pelvis.getWorldPosition(new THREE.Vector3());point.y+=this.pelvisOffset;pelvis.position.copy(pelvis.parent.worldToLocal(point));root.updateMatrixWorld(true);}
  this.report={pelvisOffset:golf?0:this.pelvisOffset,pelvisWanted,pelvisLimit,feet:[]};
  for(const s of samples){
   // Golf keeps its authored toe pivot and nearly straight backswing leg.
   const foot=bones['foot_'+s.side],error=solveLeg(bones['thigh_'+s.side],bones['calf_'+s.side],foot,s.target,s.rotation,{maxReach:golf?.999:.985,kneeSolver});let toeRoll=0;
   // On a steep downhill stance, use the toe before asking the native leg to stretch.
   if(error>.01&&s.weight>.7&&foot.getWorldPosition(new THREE.Vector3()).y>s.target.y){
    const ankle=foot.getWorldPosition(new THREE.Vector3()),relative=s.state.contacts[0].clone().applyQuaternion(s.rotation),forward=footForward(foot,s.rotation),axis=UP.clone().cross(forward).normalize();
    const gap=angle=>{const point=relative.clone().applyAxisAngle(axis,angle).add(ankle);return point.y-groundHeight(point.x,point.z);};
    if(gap(0)>.005){let lo=0,hi=.42;for(let i=0;i<10;i++){const mid=(lo+hi)/2;if(gap(mid)>0)lo=mid;else hi=mid;}toeRoll=(lo+hi)/2;}
   }
   s.state.toeRoll=THREE.MathUtils.lerp(s.state.toeRoll,toeRoll,1-Math.exp(-90*Math.min(dt,.05)));
   if(s.state.toeRoll>1e-5){const forward=bones['ball_'+s.side].getWorldPosition(new THREE.Vector3()).sub(foot.getWorldPosition(new THREE.Vector3())).setY(0).normalize(),axis=UP.clone().cross(forward).normalize();worldRotation(foot,new THREE.Quaternion().setFromAxisAngle(axis,s.state.toeRoll).multiply(s.rotation));}
   this.report.feet.push({side:s.side,offset:s.target.y-s.ankle.y,lift:s.lift,weight:s.weight,stance:stance?.[s.side]??s.weight>.95,reachError:error,toeRoll,terrainDelta:s.terrainDelta});
  }
 }
 // Attack animation supplies the foot lift and pivot. Terrain changes support
 // relative to the actor's plane. An opted-in hinge correction also fixes blends.
 applyAuthored(dt,groundHeight,contactWeights,stance,{golf=false,preserveHinge=false,enforceClearance=false,worldFootTargets=null,pelvisPlan=null,referencePlane=null,kneeSolver=alignedKnee}={}){
  pelvisPlan??=golf?{previousOffset:this.pelvisOffset,reserve:0}:this.planTerrainPelvis(dt,groundHeight,{enforceClearance,referencePlane});
  this.authoredHandoff={contactWeights,stance,options:{golf,preserveHinge,enforceClearance,worldFootTargets,referencePlane,kneeSolver}};
  const previousPelvisOffset=pelvisPlan.previousOffset;this.reset();const {root,bones}=this;root.updateMatrixWorld(true);const samples=[];
  for(const side of ['r','l']){
   const state=this.feet[side],foot=bones['foot_'+side],ankle=foot.getWorldPosition(new THREE.Vector3()),worldTarget=worldFootTargets?.[side],rotation=worldTarget?.q.clone()??foot.getWorldQuaternion(new THREE.Quaternion()),original=foot.getWorldQuaternion(new THREE.Quaternion()),weight=contactWeights?.[side]??0;
   const e=.12,heights=[groundHeight(ankle.x-e,ankle.z),groundHeight(ankle.x+e,ankle.z),groundHeight(ankle.x,ankle.z-e),groundHeight(ankle.x,ankle.z+e)];
   if(!heights.every(Number.isFinite)){this.reset();return;}
   const normal=new THREE.Vector3(heights[0]-heights[1],2*e,heights[2]-heights[3]).normalize(),tilt=Math.acos(clamp(normal.y,-1,1));
   if(tilt>.55)normal.lerp(UP,1-.55/tilt).normalize();
   if(!worldFootTargets)rotation.premultiply(new THREE.Quaternion().setFromUnitVectors(referencePlane?.normal??UP,normal).slerp(new THREE.Quaternion(),1-weight));
   let terrainDelta=-Infinity,penetration=-Infinity,sourceSoleGap=Infinity;
   // Captured movement needs the visible sole, including its outer corners.
   // Keep planner anchors separate: those encode support, not shoe geometry.
   const solePoints=enforceClearance&&referencePlane&&!worldTarget
    ?sampleFootSole(this.soles[side]).map(p=>p.sub(ankle).applyQuaternion(original.clone().invert()))
    :state.contacts;
   for(const point of solePoints){
    const old=point.clone().applyQuaternion(original),relative=point.clone().applyQuaternion(rotation),height=groundHeight(ankle.x+relative.x,ankle.z+relative.z);
    if(!Number.isFinite(height)){this.reset();return;}
    terrainDelta=Math.max(terrainDelta,height-(referencePlane?.height(ankle.x+relative.x,ankle.z+relative.z)??root.position.y));
    // Do not reinterpret a source pivot's calibrated sole proxy as penetration.
    sourceSoleGap=Math.min(sourceSoleGap,ankle.y+old.y-(referencePlane?.height(ankle.x+old.x,ankle.z+old.z)??root.position.y));
    penetration=Math.max(penetration,height-ankle.y-relative.y);
   }
   // Running must clear the actual ground even if an older source clip dips
   // its sole below the native floor. Combat keeps its calibrated source pivot.
   if(enforceClearance)sourceSoleGap=Math.max(0,sourceSoleGap);
   const supportOffset=penetration+sourceSoleGap;
   // A step planner can supply feet already projected onto the real ground.
   // Keep those world targets; applying the height and tilt twice breaks contact.
   const offset=worldTarget?worldTarget.p.y-ankle.y:clamp(Math.max(supportOffset*weight,penetration-Math.max(0,-sourceSoleGap)),-.32,.32);
   let kneeForward=null;
   if(preserveHinge&&kneeSolver===headingKnee){
    // Transport the authored bend with the shoe's terrain tilt. A horizontal
    // heading loses the bend plane when the recovering foot points downward.
    const hip=bones['thigh_'+side].getWorldPosition(new THREE.Vector3());
    const knee=bones['calf_'+side].getWorldPosition(new THREE.Vector3()),axis=ankle.clone().sub(hip);
    kneeForward=knee.sub(hip);kneeForward.addScaledVector(axis,-kneeForward.dot(axis)/axis.lengthSq());
    kneeForward.applyQuaternion(rotation.clone().multiply(original.clone().invert()));
   }
   samples.push({side,ankle,target:worldTarget?.p.clone()??ankle.clone().addScaledVector(UP,offset),rotation,weight,offset,terrainDelta,sourceSoleGap,kneeForward,worldPole:worldTarget?.pole,
    poseRelative:!worldTarget,minimumY:ankle.y+penetration,freeWorldTarget:!!worldTarget&&contactWeights?.[side]===0,
    changed:!!worldTarget||Math.abs(offset)>1e-7||original.clone().normalize().angleTo(rotation.clone().normalize())>1e-6});
  }
  let pelvisLimit=0;
  const terrainChanged=samples.some(s=>s.changed);
  // Captured terrain already carries the legs onto the broad slope. Residual
  // corrections must not impose a fixed knee bend on nearly extended legs.
  const maxReach=referencePlane?1:AUTHORED_LEG_REACH;
  if(!golf&&(terrainChanged||worldFootTargets))for(const s of samples){
   // A released shoe does not support the body. Its outgoing trajectory can
   // briefly exceed reach while the root accelerates into the next gait.
   // Correct that free target after placing the pelvis from actual support.
   if(s.freeWorldTarget)continue;
   const hip=bones['thigh_'+s.side].getWorldPosition(new THREE.Vector3()),knee=bones['calf_'+s.side].getWorldPosition(new THREE.Vector3());
   const length=(hip.distanceTo(knee)+knee.distanceTo(s.ankle))*maxReach,horizontal=Math.hypot(s.target.x-hip.x,s.target.z-hip.z);
   const available=Math.sqrt(Math.max(.01,length*length-horizontal*horizontal));
   pelvisLimit=Math.min(pelvisLimit,s.target.y+available-hip.y);
  }
  pelvisLimit=clamp(pelvisLimit,-.20,0);
  // Prepare the body for the next support before a clip changes contact weights.
  // The probes depend on terrain, not the current attack phase or crossfade.
  const pelvisWanted=clamp(Math.min(pelvisPlan.reserve,pelvisLimit),-.20,0);
  // Reach remains a hard bound; the terrain reserve avoids a late support snap.
  // Golf's calibrated hands and club require the authored pelvis height.
  // Terrain can adjust the legs without shifting the club away from the ball.
  this.pelvisOffset=!golf&&(terrainChanged||pelvisWanted<-.0000001||(enforceClearance&&Math.abs(previousPelvisOffset)>1e-7))?advancePelvisOffset(previousPelvisOffset,pelvisWanted,pelvisLimit,dt,enforceClearance):0;
  if(Math.abs(this.pelvisOffset)>1e-7){
   const pelvis=bones.pelvis;this.saved.push([pelvis,pelvis.position.clone(),pelvis.quaternion.clone()]);
   const position=pelvis.getWorldPosition(new THREE.Vector3()).addScaledVector(UP,this.pelvisOffset);
   pelvis.position.copy(pelvis.parent.worldToLocal(position));root.updateMatrixWorld(true);
  }
  this.report={pelvisOffset:this.pelvisOffset,pelvisWanted,pelvisLimit,preserveAuthored:true,feet:[]};
  for(const s of samples){
   let error=0,freeTargetCorrection=0,freePelvisShift=0;
   if(!golf&&enforceClearance&&s.poseRelative&&s.weight<1&&Math.abs(this.pelvisOffset)>1e-7){
    // A source-pose foot travels with its hip while airborne. Holding it in
    // world space after lowering the pelvis compresses the knee and ankle.
    // Fade to the fixed contact as the foot loads; explicit planner targets
    // already own their world trajectory and must not receive this shift.
    const before=s.target.y;
    s.target.y=Math.max(s.minimumY,s.target.y+this.pelvisOffset*(1-s.weight));
    freePelvisShift=s.target.y-before;
   }
   if(!golf&&s.freeWorldTarget){
    const hip=bones['thigh_'+s.side].getWorldPosition(new THREE.Vector3());
    const knee=bones['calf_'+s.side].getWorldPosition(new THREE.Vector3());
    const ankle=bones['foot_'+s.side].getWorldPosition(new THREE.Vector3());
    const reach=(hip.distanceTo(knee)+knee.distanceTo(ankle))*.999;
    const axis=s.target.clone().sub(hip),distance=axis.length();
    if(distance>reach){
     freeTargetCorrection=distance-reach;
     s.target.copy(hip).addScaledVector(axis,reach/distance);
    }
   }
   if(golf){
    const thigh=bones['thigh_'+s.side],calf=bones['calf_'+s.side],foot=bones['foot_'+s.side];
    const hip=thigh.getWorldPosition(new THREE.Vector3()),knee=calf.getWorldPosition(new THREE.Vector3());
    const reach=(hip.distanceTo(knee)+knee.distanceTo(s.ankle))*.999;
    if(hip.distanceTo(s.target)>reach){
     // A nearly straight backswing leg can run out of reach on a slope.
     // Raise its heel around the supported toe instead of shifting the club.
     const relative=this.feet[s.side].contacts[0].clone().applyQuaternion(s.rotation);
     const toe=s.target.clone().add(relative),axis=UP.clone().cross(footForward(foot,s.rotation)).normalize();
     const target=angle=>toe.clone().sub(relative.clone().applyAxisAngle(axis,angle));
     let lo=0,hi=.45;
     if(hip.distanceTo(target(hi))<reach){
      for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(hip.distanceTo(target(mid))>reach)lo=mid;else hi=mid;}
      const turn=new THREE.Quaternion().setFromAxisAngle(axis,hi);
      s.target.copy(target(hi));s.rotation.premultiply(turn);s.kneeForward?.applyQuaternion(turn);s.changed=true;
     }
    }
   }
   if(s.changed||Math.abs(this.pelvisOffset)>1e-7||preserveHinge){
    for(const name of ['thigh_','calf_','foot_']){const bone=bones[name+s.side];this.saved.push([bone,bone.position.clone(),bone.quaternion.clone()]);}
    if(s.changed||Math.abs(this.pelvisOffset)>1e-7){
     const solveKnee=s.worldPole?(hip,ankle,upper,lower)=>{
      const axis=ankle.clone().sub(hip).normalize(),turn=new THREE.Quaternion().setFromUnitVectors(s.worldPole.axis,axis);
      return headingKnee(hip,ankle,upper,lower,s.worldPole.bend.clone().applyQuaternion(turn));
     }:s.kneeForward?(hip,ankle,upper,lower)=>headingKnee(hip,ankle,upper,lower,s.kneeForward):kneeSolver;
     error=solveLeg(bones['thigh_'+s.side],bones['calf_'+s.side],bones['foot_'+s.side],s.target,s.rotation,{maxReach:(golf||worldFootTargets) ? .999 : maxReach,kneeSolver:solveKnee});
    }
    if(preserveHinge)alignLegHinge(bones['thigh_'+s.side],bones['calf_'+s.side],bones['foot_'+s.side],this.hinges[s.side]);
   }
   // Seed the next procedural frame from the actual authored support. Resetting
   // these values makes the downhill foot jump when an attack returns to idle.
   const state=this.feet[s.side];state.offset=s.offset;
   state.normal.copy(state.soleUp).applyQuaternion(bones['foot_'+s.side].getWorldQuaternion(new THREE.Quaternion())).normalize();
   this.report.feet.push({side:s.side,offset:s.offset,weight:s.weight,stance:stance?.[s.side]??s.weight>.95,reachError:error,freeTargetCorrection,freePelvisShift,terrainDelta:s.terrainDelta,sourceSoleGap:s.sourceSoleGap});
  }
 }

}
