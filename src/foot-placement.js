import * as THREE from 'three';
const UP=new THREE.Vector3(0,1,0),clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function worldRotation(bone,rotation){bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation)).normalize();bone.updateWorldMatrix(false,true);}

// Solve in world space so native proportions and arbitrary imported bone axes remain intact.
export function solveLeg(thigh,calf,foot,target,footRotation){
 const hip=thigh.getWorldPosition(new THREE.Vector3()),knee=calf.getWorldPosition(new THREE.Vector3()),ankle=foot.getWorldPosition(new THREE.Vector3());
 const upper=knee.distanceTo(hip),lower=ankle.distanceTo(knee),axis=target.clone().sub(hip),distance=clamp(axis.length(),Math.abs(upper-lower)+.015,(upper+lower)*.985);axis.normalize();
 const previous=ankle.clone().sub(hip).normalize(),bend=knee.clone().sub(hip);bend.addScaledVector(previous,-bend.dot(previous));bend.addScaledVector(axis,-bend.dot(axis));
 if(bend.lengthSq()<1e-8)bend.set(0,0,1).addScaledVector(axis,-axis.z);bend.normalize();
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const solvedKnee=hip.clone().addScaledVector(axis,along).addScaledVector(bend,height),solvedAnkle=hip.clone().addScaledVector(axis,distance);
 const rotation=new THREE.Quaternion().setFromUnitVectors(knee.clone().sub(hip).normalize(),solvedKnee.clone().sub(hip).normalize()).multiply(thigh.getWorldQuaternion(new THREE.Quaternion()));worldRotation(thigh,rotation);
 const nowKnee=calf.getWorldPosition(new THREE.Vector3()),nowAnkle=foot.getWorldPosition(new THREE.Vector3());rotation.setFromUnitVectors(nowAnkle.sub(nowKnee).normalize(),solvedAnkle.clone().sub(nowKnee).normalize()).multiply(calf.getWorldQuaternion(new THREE.Quaternion()));worldRotation(calf,rotation);
 worldRotation(foot,footRotation);
 return solvedAnkle.distanceTo(target);
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
 apply(dt,groundHeight,{enabled=true,golf=false,contactWeights=null,stance=null}={}){
  if(!enabled||!groundHeight){this.reset();return;}
  const root=this.root,bones=this.bones;root.updateMatrixWorld(true);const response=1-Math.exp(-24*Math.min(dt,.05)),samples=[];
  for(const side of ['r','l']){
   const state=this.feet[side],foot=bones['foot_'+side],ankle=foot.getWorldPosition(new THREE.Vector3()),height=groundHeight(ankle.x,ankle.z);
   if(!Number.isFinite(height)){this.reset();return;}
   const lift=Math.max(0,ankle.y-root.position.y-state.clearance),weight=(1-smooth(.035,.18,lift))*(contactWeights?.[side]??1),terrainDelta=height-root.position.y;
   const e=.12,normal=new THREE.Vector3(groundHeight(ankle.x-e,ankle.z)-groundHeight(ankle.x+e,ankle.z),2*e,groundHeight(ankle.x,ankle.z-e)-groundHeight(ankle.x,ankle.z+e)).normalize();
   const tilt=Math.acos(clamp(normal.y,-1,1)),limit=.55;if(tilt>limit)normal.lerp(UP,1-limit/tilt).normalize();
   state.normal.lerp(normal,response).normalize();
   const rotation=foot.getWorldQuaternion(new THREE.Quaternion()),soleUp=state.soleUp.clone().applyQuaternion(rotation),slope=new THREE.Quaternion().setFromUnitVectors(soleUp,state.normal);slope.slerp(new THREE.Quaternion(),1-weight);rotation.premultiply(slope);
   // Sample both ends of the sole, so a bunker lip cannot cut through the toe or heel.
   const soleHeight=Math.max(...state.contacts.map(point=>{const relative=point.clone().applyQuaternion(rotation);return groundHeight(ankle.x+relative.x,ankle.z+relative.z)-relative.y;}));
   // Recovery stays free. Only lift a swinging foot if the ground would intersect its sole.
   const gap=soleHeight-ankle.y,wanted=clamp(Math.max(gap*weight,gap),-.32,.32);
   state.offset=(stance?.[side]||(contactWeights?.[side]??0)>.9)?wanted:THREE.MathUtils.lerp(state.offset,wanted,1-Math.exp(-90*Math.min(dt,.05)));
   const appliedOffset=state.offset*weight;
   samples.push({side,state,ankle,target:ankle.clone().add(new THREE.Vector3(0,Math.max(appliedOffset,gap>0?Math.min(.32,gap):-Infinity),0)),rotation,weight,lift,terrainDelta,groundTargetY:ankle.y+clamp(gap,-.32,.32)});
  }
  // Lower the pelvis only when needed to keep a supporting leg within its native reach.
  let pelvisWanted=0;
  if(!golf)for(const s of samples){if(s.lift>.25)continue;const hip=bones['thigh_'+s.side].getWorldPosition(new THREE.Vector3()),knee=bones['calf_'+s.side].getWorldPosition(new THREE.Vector3()),length=(hip.distanceTo(knee)+knee.distanceTo(s.ankle))*.985,horizontal=Math.hypot(s.target.x-hip.x,s.target.z-hip.z),available=Math.sqrt(Math.max(.01,length*length-horizontal*horizontal));pelvisWanted=Math.min(pelvisWanted,s.groundTargetY+available-hip.y);}
  pelvisWanted=clamp(pelvisWanted,-.20,0);this.pelvisOffset+=clamp((pelvisWanted-this.pelvisOffset)*response,-2.1*Math.min(dt,.05),1.5*Math.min(dt,.05));
  for(const name of ['pelvis','thigh_r','calf_r','foot_r','thigh_l','calf_l','foot_l']){const bone=bones[name];this.saved.push([bone,bone.position.clone(),bone.quaternion.clone()]);}
  if(!golf){const pelvis=bones.pelvis,point=pelvis.getWorldPosition(new THREE.Vector3());point.y+=this.pelvisOffset;pelvis.position.copy(pelvis.parent.worldToLocal(point));root.updateMatrixWorld(true);}
  this.report={pelvisOffset:golf?0:this.pelvisOffset,feet:[]};
  for(const s of samples){
   const foot=bones['foot_'+s.side],error=solveLeg(bones['thigh_'+s.side],bones['calf_'+s.side],foot,s.target,s.rotation);let toeRoll=0;
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
}
