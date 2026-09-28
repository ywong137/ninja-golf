import * as THREE from 'three';

// Targets are shoulder-relative. Their size follows each native arm, not a shared skeleton.
export const TRAVEL_POSES={
 odachi:{out:.18,drop:.45,forward:.60,shaft:[-.12,1,.15],swing:.035},
 twin:{out:.22,drop:.45,forward:.60,shaft:[-.15,1,.12],swing:.045},
 naginata:{out:.32,drop:.45,forward:.60,shaft:[-.12,1,.15],swing:.025,gripStation:-.40},
 fan:{out:.25,drop:.40,forward:.58,shaft:[-.12,1,.12],swing:.055},
 ring:{out:.28,drop:.40,forward:.55,shaft:[-.10,1,.15],swing:.045},
 sickle:{out:.30,drop:.42,forward:.52,shaft:[-.10,1,.12],swing:.04},
};
const vector=a=>new THREE.Vector3(...a);
function setWorld(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
// Match both native segment axes. Independent shortest-arc aims can reach the
// same wrist while bending the elbow sideways through the skin.
function solveArm(upper,lower,hand,target,pole,reach=.96,rest,chest,soften=false){
 if(!rest?.hinge||rest.hinge.lengthSq()<1e-8)throw Error('Travel arm needs a calibrated native hinge.');
 const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=lower.getWorldPosition(new THREE.Vector3()),wrist=hand.getWorldPosition(new THREE.Vector3()),a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),axis=target.clone().sub(shoulder),d=THREE.MathUtils.clamp(axis.length(),Math.abs(a-b)+.015,(a+b)*reach);
 if(axis.lengthSq()<1e-12)axis.copy(wrist).sub(shoulder);
 if(axis.lengthSq()<1e-12)throw Error('Travel arm has no valid reach direction.');
 axis.normalize();
 let bend=pole.clone().addScaledVector(axis,-pole.dot(axis));
 if(bend.lengthSq()<1e-8){bend.copy(elbow).sub(shoulder);bend.addScaledVector(axis,-bend.dot(axis));}
 if(bend.lengthSq()<1e-8){const nativeH=rest.hinge.clone().applyQuaternion(chest.getWorldQuaternion(new THREE.Quaternion()).multiply(rest.upperInChest));bend.crossVectors(axis,nativeH);}
 if(bend.lengthSq()<1e-8)throw Error('Travel elbow pole and native hinge are degenerate.');
 bend.normalize();const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
 // Map an orthonormal native arm frame onto the requested elbow plane.
 const nativeU=lower.position.clone().normalize(),nativeH=rest.hinge.clone().normalize(),local=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(nativeU,nativeH,nativeU.clone().cross(nativeH))),reference=chest.getWorldQuaternion(new THREE.Quaternion()).multiply(rest.upperInChest);
 const choose=bend=>{
  const e=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height),u=e.clone().sub(shoulder).normalize(),f=shoulder.clone().addScaledVector(axis,d).sub(e).normalize(),hinge=u.clone().cross(f).normalize(),world=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,hinge,u.clone().cross(hinge))).multiply(local.clone().invert());
  const minimum=new THREE.Quaternion().setFromUnitVectors(nativeU.clone().applyQuaternion(reference),u).multiply(reference),delta=world.clone().multiply(minimum.invert()),roll=2*Math.atan2(delta.x*u.x+delta.y*u.y+delta.z*u.z,delta.w),magnitude=Math.abs(Math.atan2(Math.sin(roll),Math.cos(roll)));
  return{world,flexion:u.angleTo(f),magnitude};
 };
 let selected=choose(bend);
 // Apply the soft limit once, when choosing the primary carry pose.
 // Transition re-solves preserve that result with only the hard anatomical cap.
 // Reapplying the soft limit would move the elbow again at the fade boundary.
 const softStart=50*Math.PI/180,softRange=18*Math.PI/180,limit=soften&&selected.magnitude>softStart?softStart+softRange*Math.tanh((selected.magnitude-softStart)/softRange):68*Math.PI/180;
 if(selected.magnitude>limit+1e-9)outer:for(let i=1;i<=36;i++)for(const sign of [1,-1]){
  const candidate=choose(bend.clone().applyAxisAngle(axis,sign*i*Math.PI/36));
  if(candidate.magnitude<selected.magnitude)selected=candidate;
  if(candidate.magnitude<=limit){
   // Refine the first feasible plane instead of stepping between 5-degree bins.
   let lo=(i-1)*Math.PI/36,hi=i*Math.PI/36;
   for(let k=0;k<9;k++){const mid=(lo+hi)/2,refined=choose(bend.clone().applyAxisAngle(axis,sign*mid));if(refined.magnitude<=limit){hi=mid;selected=refined;}else lo=mid;}
   break outer;
  }
 }
 setWorld(upper,selected.world);
 lower.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(nativeH,selected.flexion-rest.flexion)).multiply(rest.lower);lower.updateWorldMatrix(false,true);
}
function rollForearm(lower,hand,neutral,axis,shaft,forearm,restLower=null){
 hand.quaternion.copy(neutral);hand.updateWorldMatrix(true,true);
 const current=axis.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
 current.addScaledVector(forearm,-current.dot(forearm)).normalize();
 const target=shaft.clone().addScaledVector(forearm,-shaft.dot(forearm)).normalize();
 if(current.lengthSq()<1e-8||target.lengthSq()<1e-8)return;
 const turn=Math.atan2(current.clone().cross(target).dot(forearm),current.dot(target));
 setWorld(lower,new THREE.Quaternion().setFromAxisAngle(forearm,turn).multiply(lower.getWorldQuaternion(new THREE.Quaternion())));
 if(restLower){
  // Carry targets may ask for an impossible palm roll. Limit pronation and
  // supination around the native forearm; never compensate by bending the wrist.
  const localAxis=hand.position.clone().normalize(),relative=restLower.clone().invert().multiply(lower.quaternion).normalize();
  const angle=2*Math.atan2(relative.x*localAxis.x+relative.y*localAxis.y+relative.z*localAxis.z,relative.w),roll=Math.atan2(Math.sin(angle),Math.cos(angle));
  const bounded=THREE.MathUtils.clamp(roll,-Math.PI/2,Math.PI/2);
  lower.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(localAxis,bounded-roll));lower.updateWorldMatrix(false,true);
 }
}
function endpointTwist(fromRotation,fromAxis,toRotation,toAxis,localAxis,prior=0){
 const from=fromRotation.clone().premultiply(new THREE.Quaternion().setFromUnitVectors(fromAxis,toAxis));
 const relative=from.invert().multiply(toRotation).normalize();
 const angle=2*Math.atan2(relative.x*localAxis.x+relative.y*localAxis.y+relative.z*localAxis.z,relative.w);
 return prior+Math.atan2(Math.sin(angle-prior),Math.cos(angle-prior));
}
export class TravelPose {
 constructor(actor,kind){this.actor=actor;this.profile=TRAVEL_POSES[kind];this.weight=0;this.saved=[];this.carry={};this.shaftDirections={};}
 reset(){this.weight=0;this.shaftDirections={};}
 restore(){for(const [bone,q]of this.saved)bone.quaternion.copy(q);this.saved=[];}
 apply(dt,active,{motion=null,exitDuration=.16,nativeAttachment=false}={}){
  this.shaftDirections={};
  this.weight=THREE.MathUtils.clamp(this.weight+(active?1:-1)*Math.min(dt,.05)/(active?.12:exitDuration),0,1);
  if(!this.weight)return;
  const {root,bones,palmGrips,shaftAxes,offhand,runPhase}=this.actor,p=this.profile;root.updateMatrixWorld(true);
  const rootQ=root.getWorldQuaternion(new THREE.Quaternion()),scale=root.getWorldScale(new THREE.Vector3()).x;
  if(!offhand){
   // The free arm follows the source wrist and preferred elbow path. Correct
   // its segment frames so the elbow bends around the imported native hinge.
   const upper=bones.upperarm_l,lower=bones.lowerarm_l,hand=bones.hand_l;
   const before=[upper,lower,hand].map(b=>b.quaternion.clone());
   [upper,lower,hand].forEach((b,i)=>this.saved.push([b,before[i]]));
   const wrist=hand.getWorldPosition(new THREE.Vector3()),pole=lower.getWorldPosition(new THREE.Vector3()).sub(upper.getWorldPosition(new THREE.Vector3()));
   const shaft=shaftAxes.l.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
   solveArm(upper,lower,hand,wrist,pole,.9995,this.actor.selectionArmRest.l,bones.spine_03,true);
   const forearm=hand.getWorldPosition(new THREE.Vector3()).sub(lower.getWorldPosition(new THREE.Vector3())).normalize();
   rollForearm(lower,hand,before[2],shaftAxes.l,shaft,forearm,this.actor.selectionArmRest.l.lower);
  }
  for(const side of offhand?['r','l']:['r']){
   const sign=side==='r'?-1:1,upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side],chain=[upper,lower,hand];
   const before=chain.map(b=>b.quaternion.clone());chain.forEach((b,i)=>this.saved.push([b,before[i]]));
   if(!active&&this.carry[side]){
    if(nativeAttachment&&this.carry[side].wrist){
     // Blend elbow and wrist positions, then turn the forearm. Independent
     // joint slerps can switch their half-turn and invert the arm mid-fade.
     const carry=this.carry[side],nativeAxis=shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
     const carryAxis=carry.axis.clone().applyQuaternion(rootQ),turn=new THREE.Quaternion().setFromUnitVectors(carryAxis,nativeAxis);
     const shaft=carryAxis.applyQuaternion(new THREE.Quaternion().slerp(turn,1-this.weight));
     const wrist=hand.getWorldPosition(new THREE.Vector3()).lerp(root.localToWorld(carry.wrist.clone()),this.weight);
     const pole=lower.getWorldPosition(new THREE.Vector3()).lerp(root.localToWorld(carry.elbow.clone()),this.weight).sub(upper.getWorldPosition(new THREE.Vector3()));
     const handPose=before[2].clone().slerp(this.actor.neutralHandRotations[side],this.weight);
     solveArm(upper,lower,hand,wrist,pole,.9995,this.actor.selectionArmRest[side],this.actor.bones.spine_03);
     const forearm=hand.getWorldPosition(new THREE.Vector3()).sub(lower.getWorldPosition(new THREE.Vector3())).normalize();
     rollForearm(lower,hand,handPose,shaftAxes[side],shaft,forearm);
     root.updateMatrixWorld(true);
     this.shaftDirections[side]=shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootQ.clone().invert()).normalize();
     continue;
    }
    const carry=this.carry[side],nativePalm=hand.localToWorld(palmGrips[side].clone()),nativeRotation=hand.getWorldQuaternion(new THREE.Quaternion()),nativeAxis=shaftAxes[side].clone().applyQuaternion(nativeRotation),from=side==='r'?motion?.grip:motion?.offGrip,to=side==='r'?motion?.tip:motion?.offTip;
    const targetAxis=from&&to?vector([to[0]-from[0],to[2]-from[2],from[1]-to[1]]).normalize().applyQuaternion(rootQ):nativeAxis;
    const carryAxis=carry.axis.clone().applyQuaternion(rootQ),turn=new THREE.Quaternion().setFromUnitVectors(carryAxis,targetAxis),shaft=carryAxis.clone().applyQuaternion(new THREE.Quaternion().slerp(turn,1-this.weight));
    const palm=nativePalm.lerp(root.localToWorld(carry.palm.clone()),this.weight),rotation=carry.rotation.clone().premultiply(rootQ);
    // Blend swing and palm twist separately. A shortest-path quaternion blend
    // can reverse its chosen half-turn as the destination attack wrist moves.
    rotation.premultiply(new THREE.Quaternion().setFromUnitVectors(shaftAxes[side].clone().applyQuaternion(rotation),shaft));
    nativeRotation.premultiply(new THREE.Quaternion().setFromUnitVectors(nativeAxis,targetAxis));
    // Measure at the full destination, independently of the fade weight.
    const localAxis=shaftAxes[side],twist=endpointTwist(carry.rotation.clone().premultiply(rootQ),carryAxis,nativeRotation,targetAxis,localAxis,carry.exitTwist??0);
    carry.exitTwist=twist;
    rotation.multiply(new THREE.Quaternion().setFromAxisAngle(localAxis,twist*(1-this.weight)));
    const pole=lower.getWorldPosition(new THREE.Vector3()).lerp(root.localToWorld(carry.elbow.clone()),this.weight).sub(upper.getWorldPosition(new THREE.Vector3())),wrist=palm.sub(palmGrips[side].clone().multiplyScalar(scale).applyQuaternion(rotation));
    solveArm(upper,lower,hand,wrist,pole,.96,this.actor.selectionArmRest[side],this.actor.bones.spine_03);setWorld(hand,rotation);
    this.shaftDirections[side]=shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootQ.clone().invert()).normalize();
    continue;
   }

   const shoulder=upper.getWorldPosition(new THREE.Vector3()),length=shoulder.distanceTo(lower.getWorldPosition(new THREE.Vector3()))+lower.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()));
   const swing=Math.sin((runPhase+(side==='r'?0:.5))*Math.PI*2)*p.swing;
   const palm=vector([sign*p.out*length,-p.drop*length,(p.forward+swing)*length]).applyQuaternion(rootQ).add(shoulder),shaft=vector([p.shaft[0]*(side==='r'?1:-1),p.shaft[1],p.shaft[2]]).normalize().applyQuaternion(rootQ),pole=vector([sign*.35,-.75,-.35]).applyQuaternion(rootQ);
   let rotation=hand.getWorldQuaternion(new THREE.Quaternion());
   // Recompute wrist offset after orienting the palm; the handle stays in the finger cavity.
   for(let i=0;i<3;i++){
    const wrist=palm.clone().sub(palmGrips[side].clone().multiplyScalar(scale).applyQuaternion(rotation));solveArm(upper,lower,hand,wrist,pole,.96,this.actor.selectionArmRest[side],this.actor.bones.spine_03,true);
    const forearm=hand.getWorldPosition(new THREE.Vector3()).sub(lower.getWorldPosition(new THREE.Vector3())).normalize();
    // Forearm rotation presents the blade. Keep the wrist in its imported
    // neutral pose; the palm's offset is not an anatomical hand direction.
    rollForearm(lower,hand,this.actor.neutralHandRotations[side],shaftAxes[side],shaft,forearm,this.actor.selectionArmRest?.[side]?.lower);
    rotation=hand.getWorldQuaternion(new THREE.Quaternion());
   }
   const solved=chain.map(b=>b.quaternion.clone());chain.forEach((b,i)=>b.quaternion.copy(before[i]).slerp(solved[i],this.weight));root.updateMatrixWorld(true);
   if(this.weight<1){
    const target=hand.getWorldPosition(new THREE.Vector3()),elbowPole=lower.getWorldPosition(new THREE.Vector3()).sub(upper.getWorldPosition(new THREE.Vector3())),mixedShaft=shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())),handPose=before[2].clone().slerp(this.actor.neutralHandRotations[side],this.weight);
    solveArm(upper,lower,hand,target,elbowPole,.9995,this.actor.selectionArmRest[side],this.actor.bones.spine_03);
    const forearm=hand.getWorldPosition(new THREE.Vector3()).sub(lower.getWorldPosition(new THREE.Vector3())).normalize();
    rollForearm(lower,hand,handPose,shaftAxes[side],mixedShaft,forearm,this.actor.selectionArmRest[side].lower);
   }
   this.carry[side]={palm:root.worldToLocal(hand.localToWorld(palmGrips[side].clone())),wrist:root.worldToLocal(hand.getWorldPosition(new THREE.Vector3())),elbow:root.worldToLocal(lower.getWorldPosition(new THREE.Vector3())),axis:shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootQ.clone().invert()),rotation:rootQ.clone().invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()))};
  }
 }
}
