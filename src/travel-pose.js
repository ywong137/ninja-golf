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
function aim(bone,from,to){setWorld(bone,new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));}
function solveArm(upper,lower,hand,target,pole,reach=.96){
 const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=lower.getWorldPosition(new THREE.Vector3()),wrist=hand.getWorldPosition(new THREE.Vector3()),a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),axis=target.clone().sub(shoulder),d=THREE.MathUtils.clamp(axis.length(),Math.abs(a-b)+.015,(a+b)*reach);axis.normalize();
 const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize(),along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),wantedElbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height),wantedWrist=shoulder.clone().addScaledVector(axis,d);
 aim(upper,elbow.sub(shoulder),wantedElbow.clone().sub(shoulder));
 const nowElbow=lower.getWorldPosition(new THREE.Vector3());aim(lower,hand.getWorldPosition(new THREE.Vector3()).sub(nowElbow),wantedWrist.sub(nowElbow));
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
     solveArm(upper,lower,hand,wrist,pole,.9995);
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
    solveArm(upper,lower,hand,wrist,pole);setWorld(hand,rotation);
    this.shaftDirections[side]=shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootQ.clone().invert()).normalize();
    continue;
   }

   const shoulder=upper.getWorldPosition(new THREE.Vector3()),length=shoulder.distanceTo(lower.getWorldPosition(new THREE.Vector3()))+lower.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()));
   const swing=Math.sin((runPhase+(side==='r'?0:.5))*Math.PI*2)*p.swing;
   const palm=vector([sign*p.out*length,-p.drop*length,(p.forward+swing)*length]).applyQuaternion(rootQ).add(shoulder),shaft=vector([p.shaft[0]*(side==='r'?1:-1),p.shaft[1],p.shaft[2]]).normalize().applyQuaternion(rootQ),pole=vector([sign*.35,-.75,-.35]).applyQuaternion(rootQ);
   let rotation=hand.getWorldQuaternion(new THREE.Quaternion());
   // Recompute wrist offset after orienting the palm; the handle stays in the finger cavity.
   for(let i=0;i<3;i++){
    const wrist=palm.clone().sub(palmGrips[side].clone().multiplyScalar(scale).applyQuaternion(rotation));solveArm(upper,lower,hand,wrist,pole);
    const forearm=hand.getWorldPosition(new THREE.Vector3()).sub(lower.getWorldPosition(new THREE.Vector3())).normalize();
    // Forearm rotation presents the blade. Keep the wrist in its imported
    // neutral pose; the palm's offset is not an anatomical hand direction.
    rollForearm(lower,hand,this.actor.neutralHandRotations[side],shaftAxes[side],shaft,forearm,this.actor.selectionArmRest?.[side]?.lower);
    rotation=hand.getWorldQuaternion(new THREE.Quaternion());
   }
   const solved=chain.map(b=>b.quaternion.clone());chain.forEach((b,i)=>b.quaternion.copy(before[i]).slerp(solved[i],this.weight));root.updateMatrixWorld(true);
   this.carry[side]={palm:root.worldToLocal(hand.localToWorld(palmGrips[side].clone())),wrist:root.worldToLocal(hand.getWorldPosition(new THREE.Vector3())),elbow:root.worldToLocal(lower.getWorldPosition(new THREE.Vector3())),axis:shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootQ.clone().invert()),rotation:rootQ.clone().invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()))};
  }
 }
}
