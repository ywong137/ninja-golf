import * as THREE from 'three';
import {alignedKnee,footForward} from './knee-alignment.js';
const UP=new THREE.Vector3(0,1,0),clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// Motion records are immutable. Join continuous sole/toe support once per clip.
const contactSchedules=new WeakMap();
function contactIntervals(clip,side){
 if(!clip?.footPlants?.[side])return null;
 let schedule=contactSchedules.get(clip);if(!schedule){schedule={};contactSchedules.set(clip,schedule);}
 if(!schedule[side]){
  const ranges=[...clip.footPlants[side],...(clip.toePlants?.[side]??[])].map(range=>[...range]).sort((a,b)=>a[0]-b[0]),merged=[];
  for(const range of ranges){const previous=merged.at(-1);if(previous&&range[0]<=previous[1]+1e-7)previous[1]=Math.max(previous[1],range[1]);else merged.push(range);}
  schedule[side]=merged;
 }
 return schedule[side];
}
function worldRotation(bone,rotation){bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)).normalize();bone.updateWorldMatrix(false,true);}

// Solve in world space so native proportions and arbitrary imported bone axes remain intact.
export function solveLeg(thigh,calf,foot,target,footRotation,{maxReach=.985}={}){
 const hip=thigh.getWorldPosition(new THREE.Vector3()),knee=calf.getWorldPosition(new THREE.Vector3()),ankle=foot.getWorldPosition(new THREE.Vector3());
 const upper=knee.distanceTo(hip),lower=ankle.distanceTo(knee),axis=target.clone().sub(hip),distance=clamp(axis.length(),Math.abs(upper-lower)+.015,(upper+lower)*maxReach);axis.normalize();
 const solvedAnkle=hip.clone().addScaledVector(axis,distance);
 const solvedKnee=alignedKnee(hip,solvedAnkle,upper,lower,footForward(foot,footRotation));
 const rotation=new THREE.Quaternion().setFromUnitVectors(knee.clone().sub(hip).normalize(),solvedKnee.clone().sub(hip).normalize()).multiply(thigh.getWorldQuaternion(new THREE.Quaternion()));worldRotation(thigh,rotation);
 const nowKnee=calf.getWorldPosition(new THREE.Vector3()),nowAnkle=foot.getWorldPosition(new THREE.Vector3());rotation.setFromUnitVectors(nowAnkle.sub(nowKnee).normalize(),solvedAnkle.clone().sub(nowKnee).normalize()).multiply(calf.getWorldQuaternion(new THREE.Quaternion()));worldRotation(calf,rotation);
 worldRotation(foot,footRotation);
 return solvedAnkle.distanceTo(target);
}

export function attackFootContacts(clip,time,motion){
 const weights={},stance={};
 for(const side of ['r','l']){
  // A heel pivot still supports the body through its planted toe. The native
  // sole orientation remains intact while terrain adjusts that support.
  const intervals=contactIntervals(clip,side);
  if(intervals){
   let weight=0;
   for(const [start,end]of intervals)if(time>=start&&time<=end){
    const blend=Math.min(.04,(end-start)/3);
    weight=Math.max(weight,(start===0?1:smooth(start,start+blend,time))*(end>=clip.duration?1:1-smooth(end-blend,end,time)));
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
  this.root=root;this.bones=bones;this.saved=[];this.pelvisOffset=0;this.feet={};root.updateMatrixWorld(true);
  for(const side of ['r','l']){
   const foot=bones['foot_'+side],ankle=foot.getWorldPosition(new THREE.Vector3()),clearance=ankle.y-root.position.y,inverse=foot.getWorldQuaternion(new THREE.Quaternion()).invert(),toe=bones['ball_'+side].getWorldPosition(new THREE.Vector3()).sub(ankle),forward=toe.clone().setY(0).normalize();
   const heel=forward.multiplyScalar(-.065).addScaledVector(UP,-clearance);
   this.feet[side]={clearance,offset:0,toeRoll:0,normal:UP.clone(),soleUp:UP.clone().applyQuaternion(inverse),contacts:[toe.applyQuaternion(inverse),heel.applyQuaternion(inverse)]};
  }
 }
 restore(){for(const [bone,position,rotation]of this.saved){bone.position.copy(position);bone.quaternion.copy(rotation);}this.saved=[];}
 reset(){this.report=null;this.pelvisOffset=0;for(const foot of Object.values(this.feet)){foot.offset=0;foot.toeRoll=0;foot.normal.copy(UP);}}
 apply(dt,groundHeight,{enabled=true,golf=false,contactWeights=null,stance=null,preserveAuthored=false}={}){
  if(!enabled||!groundHeight){this.reset();return;}
  if(preserveAuthored){this.applyAuthored(dt,groundHeight,contactWeights,stance);return;}
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
   samples.push({side,state,ankle,target:ankle.clone().add(new THREE.Vector3(0,Math.max(appliedOffset,gap>0?Math.min(.32,gap):-Infinity),0)),rotation,weight,lift,terrainDelta});
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
   const foot=bones['foot_'+s.side],error=solveLeg(bones['thigh_'+s.side],bones['calf_'+s.side],foot,s.target,s.rotation,{maxReach:golf?.999:.985});let toeRoll=0;
   // On a steep downhill stance, use the toe before asking the native leg to stretch.
   if(error>.01&&s.weight>.7&&foot.getWorldPosition(new THREE.Vector3()).y>s.target.y){
    const ankle=foot.getWorldPosition(new THREE.Vector3()),toe=bones['ball_'+s.side].getWorldPosition(new THREE.Vector3()),relative=toe.clone().sub(ankle),forward=relative.clone().setY(0).normalize(),axis=UP.clone().cross(forward).normalize();
    const gap=angle=>{const point=relative.clone().applyAxisAngle(axis,angle).add(ankle);return point.y-groundHeight(point.x,point.z);};
    if(gap(0)>.005){let lo=0,hi=.42;for(let i=0;i<10;i++){const mid=(lo+hi)/2;if(gap(mid)>0)lo=mid;else hi=mid;}toeRoll=(lo+hi)/2;}
   }
   s.state.toeRoll=THREE.MathUtils.lerp(s.state.toeRoll,toeRoll,1-Math.exp(-90*Math.min(dt,.05)));
   if(s.state.toeRoll>1e-5){const forward=bones['ball_'+s.side].getWorldPosition(new THREE.Vector3()).sub(foot.getWorldPosition(new THREE.Vector3())).setY(0).normalize(),axis=UP.clone().cross(forward).normalize();worldRotation(foot,new THREE.Quaternion().setFromAxisAngle(axis,s.state.toeRoll).multiply(s.rotation));}
   this.report.feet.push({side:s.side,offset:s.target.y-s.ankle.y,lift:s.lift,weight:s.weight,stance:stance?.[s.side]??s.weight>.95,reachError:error,toeRoll,terrainDelta:s.terrainDelta});
  }
 }
 // Attack animation supplies the foot lift and pivot. Only terrain deviation from
 // the actor's reference plane changes that pose; flat ground is an exact no-op.
 applyAuthored(dt,groundHeight,contactWeights,stance){
  const previousPelvisOffset=this.pelvisOffset;this.reset();const {root,bones}=this;root.updateMatrixWorld(true);const samples=[];
  for(const side of ['r','l']){
   const state=this.feet[side],foot=bones['foot_'+side],ankle=foot.getWorldPosition(new THREE.Vector3()),rotation=foot.getWorldQuaternion(new THREE.Quaternion()),original=rotation.clone(),weight=contactWeights?.[side]??0;
   const e=.12,heights=[groundHeight(ankle.x-e,ankle.z),groundHeight(ankle.x+e,ankle.z),groundHeight(ankle.x,ankle.z-e),groundHeight(ankle.x,ankle.z+e)];
   if(!heights.every(Number.isFinite)){this.reset();return;}
   const normal=new THREE.Vector3(heights[0]-heights[1],2*e,heights[2]-heights[3]).normalize(),tilt=Math.acos(clamp(normal.y,-1,1));
   if(tilt>.55)normal.lerp(UP,1-.55/tilt).normalize();
   rotation.premultiply(new THREE.Quaternion().setFromUnitVectors(UP,normal).slerp(new THREE.Quaternion(),1-weight));
   let terrainDelta=-Infinity,penetration=-Infinity,sourceSoleGap=Infinity;
   for(const point of state.contacts){
    const old=point.clone().applyQuaternion(original),relative=point.clone().applyQuaternion(rotation),height=groundHeight(ankle.x+relative.x,ankle.z+relative.z);
    if(!Number.isFinite(height)){this.reset();return;}
    terrainDelta=Math.max(terrainDelta,height-root.position.y);
    // Do not reinterpret a source pivot's calibrated sole proxy as penetration.
    sourceSoleGap=Math.min(sourceSoleGap,ankle.y+old.y-root.position.y);
    penetration=Math.max(penetration,height-ankle.y-relative.y);
   }
   const supportOffset=penetration+sourceSoleGap;
   const offset=clamp(Math.max(supportOffset*weight,penetration-Math.max(0,-sourceSoleGap)),-.32,.32);
   samples.push({side,ankle,target:ankle.clone().addScaledVector(UP,offset),rotation,weight,offset,terrainDelta,sourceSoleGap,changed:Math.abs(offset)>1e-7||original.clone().normalize().angleTo(rotation.clone().normalize())>1e-6});
  }
  let pelvisLimit=0;
  const terrainChanged=samples.some(s=>s.changed);
  if(terrainChanged)for(const s of samples){
   const hip=bones['thigh_'+s.side].getWorldPosition(new THREE.Vector3()),knee=bones['calf_'+s.side].getWorldPosition(new THREE.Vector3());
   const length=(hip.distanceTo(knee)+knee.distanceTo(s.ankle))*.985,horizontal=Math.hypot(s.target.x-hip.x,s.target.z-hip.z);
   const available=Math.sqrt(Math.max(.01,length*length-horizontal*horizontal));
   pelvisLimit=Math.min(pelvisLimit,s.target.y+available-hip.y);
  }
  pelvisLimit=clamp(pelvisLimit,-.20,0);
  // Prepare the body for the next support before a clip changes contact weights.
  // The probes depend on terrain, not the current attack phase or crossfade.
  let downhill=0;const reach=.7*root.scale.x;
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,height=groundHeight(root.position.x+Math.cos(a)*reach,root.position.z+Math.sin(a)*reach);
   if(Number.isFinite(height))downhill=Math.min(downhill,height-root.position.y);
  }
  const pelvisWanted=clamp(Math.min(downhill,pelvisLimit),-.20,0);
  // Reach remains a hard bound; the terrain reserve avoids a late support snap.
  this.pelvisOffset=terrainChanged||pelvisWanted<-.0000001?Math.min(pelvisLimit,THREE.MathUtils.lerp(previousPelvisOffset,pelvisWanted,1-Math.exp(-24*Math.min(dt,.05)))):0;
  if(Math.abs(this.pelvisOffset)>1e-7){
   const pelvis=bones.pelvis;this.saved.push([pelvis,pelvis.position.clone(),pelvis.quaternion.clone()]);
   const position=pelvis.getWorldPosition(new THREE.Vector3()).addScaledVector(UP,this.pelvisOffset);
   pelvis.position.copy(pelvis.parent.worldToLocal(position));root.updateMatrixWorld(true);
  }
  this.report={pelvisOffset:this.pelvisOffset,pelvisWanted,pelvisLimit,preserveAuthored:true,feet:[]};
  for(const s of samples){
   let error=0;
   if(s.changed||Math.abs(this.pelvisOffset)>1e-7){
    for(const name of ['thigh_','calf_','foot_']){const bone=bones[name+s.side];this.saved.push([bone,bone.position.clone(),bone.quaternion.clone()]);}
    error=solveLeg(bones['thigh_'+s.side],bones['calf_'+s.side],bones['foot_'+s.side],s.target,s.rotation);
   }
   this.report.feet.push({side:s.side,offset:s.offset,weight:s.weight,stance:stance?.[s.side]??s.weight>.95,reachError:error,terrainDelta:s.terrainDelta,sourceSoleGap:s.sourceSoleGap});
  }
 }

}
