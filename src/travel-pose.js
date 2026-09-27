import * as THREE from 'three';

// Targets are shoulder-relative. Their size follows each native arm, not a shared skeleton.
export const TRAVEL_POSES={
 odachi:{out:.18,drop:.84,forward:.20,shaft:[-.18,.12,-1],swing:.035},
 twin:{out:.22,drop:.86,forward:.10,shaft:[-.22,-.12,-1],swing:.045},
 naginata:{out:.23,drop:.84,forward:.08,shaft:[-.34,.76,-.55],swing:.025},
 fan:{out:.25,drop:.90,forward:.08,shaft:[-.58,-.55,-.60],swing:.055},
 ring:{out:.27,drop:.86,forward:.13,shaft:[-.55,-.55,-.63],swing:.045},
 sickle:{out:.16,drop:.90,forward:.23,shaft:[-.24,-.20,-1],swing:.04},
};
const vector=a=>new THREE.Vector3(...a);
function setWorld(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);}
function aim(bone,from,to){setWorld(bone,new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(bone.getWorldQuaternion(new THREE.Quaternion())));}
function solveArm(upper,lower,hand,target,pole){
 const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=lower.getWorldPosition(new THREE.Vector3()),wrist=hand.getWorldPosition(new THREE.Vector3()),a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),axis=target.clone().sub(shoulder),d=THREE.MathUtils.clamp(axis.length(),Math.abs(a-b)+.015,(a+b)*.96);axis.normalize();
 const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize(),along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),wantedElbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height),wantedWrist=shoulder.clone().addScaledVector(axis,d);
 aim(upper,elbow.sub(shoulder),wantedElbow.clone().sub(shoulder));
 const nowElbow=lower.getWorldPosition(new THREE.Vector3());aim(lower,hand.getWorldPosition(new THREE.Vector3()).sub(nowElbow),wantedWrist.sub(nowElbow));
}
function gripRotation(axis,palm,shaft,forearm){
 const y=axis.clone().normalize(),z=palm.clone().addScaledVector(y,-palm.dot(y)).normalize(),x=y.clone().cross(z).normalize();
 const worldY=shaft.clone().normalize(),worldZ=forearm.clone().addScaledVector(worldY,-forearm.dot(worldY)).normalize(),worldX=worldY.clone().cross(worldZ).normalize();
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(worldX,worldY,worldZ)).multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)).invert());
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
 apply(dt,active,{motion=null,exitDuration=.16}={}){
  this.shaftDirections={};
  this.weight=THREE.MathUtils.clamp(this.weight+(active?1:-1)*Math.min(dt,.05)/(active?.12:exitDuration),0,1);
  if(!this.weight)return;
  const {root,bones,palmGrips,shaftAxes,offhand,runPhase}=this.actor,p=this.profile;root.updateMatrixWorld(true);
  const rootQ=root.getWorldQuaternion(new THREE.Quaternion()),scale=root.getWorldScale(new THREE.Vector3()).x;
  for(const side of offhand?['r','l']:['r']){
   const sign=side==='r'?-1:1,upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side],chain=[upper,lower,hand];
   const before=chain.map(b=>b.quaternion.clone());chain.forEach((b,i)=>this.saved.push([b,before[i]]));
   if(!active&&this.carry[side]){
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
    const forearm=hand.getWorldPosition(new THREE.Vector3()).sub(lower.getWorldPosition(new THREE.Vector3())).normalize(),dot=shaft.dot(forearm),limit=Math.sin(Math.PI/4);
    const comfortableShaft=shaft.clone();
    if(Math.abs(dot)>limit)comfortableShaft.addScaledVector(forearm,-dot).normalize().multiplyScalar(Math.sqrt(1-limit*limit)).addScaledVector(forearm,Math.sign(dot)*limit);
    rotation=gripRotation(shaftAxes[side],palmGrips[side],comfortableShaft,forearm);setWorld(hand,rotation);
   }
   const solved=chain.map(b=>b.quaternion.clone());chain.forEach((b,i)=>b.quaternion.copy(before[i]).slerp(solved[i],this.weight));root.updateMatrixWorld(true);
   this.carry[side]={palm:root.worldToLocal(hand.localToWorld(palmGrips[side].clone())),elbow:root.worldToLocal(lower.getWorldPosition(new THREE.Vector3())),axis:shaftAxes[side].clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(rootQ.clone().invert()),rotation:rootQ.clone().invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()))};
  }
 }
}
