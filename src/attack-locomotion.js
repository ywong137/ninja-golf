import * as THREE from 'three';
import {solveLeg} from './foot-placement.js';

const DIRECTIONS=['Forward','Right','Backward','Left'];
const point=bone=>bone.getWorldPosition(new THREE.Vector3());
const rotation=bone=>bone.getWorldQuaternion(new THREE.Quaternion());

// Evaluate native combat steps separately from the weapon choreography. World-space
// targets keep the imported joint axes and each character's actual limb lengths.
export class AttackLocomotion {
 constructor(root,model,bones,clips,prefix,motionData){
  this.root=root;this.bones=bones;this.saved=[];this.weight=0;this.phase=0;this.angle=0;
  this.proxyRoot=new THREE.Group();this.proxy=model.clone(true);this.proxyRoot.add(this.proxy);
  const meshes=[];this.proxy.traverse(o=>{if(o.isMesh)meshes.push(o);});for(const mesh of meshes)mesh.removeFromParent();
  this.proxyBones={};this.proxy.traverse(o=>{if(o.isBone)this.proxyBones[o.name]=o;});
  this.mixer=new THREE.AnimationMixer(this.proxy);
  this.names=DIRECTIONS.map(direction=>`${prefix}_Guard_Walk_${direction}`);
  this.specs=this.names.map(name=>motionData[name]);
  this.actions=this.names.map(name=>{
   const clip=clips.find(c=>c.name===name);if(!clip)throw Error(`Missing attack footwork source: ${name}`);
   return this.mixer.clipAction(clip).setEffectiveTimeScale(0).play();
  });
 }
 restore(){for(const [bone,position,q]of this.saved){bone.position.copy(position);bone.quaternion.copy(q);}this.saved=[];}
 reset(){this.weight=0;this.report=null;}
 apply(dt,{active=false,speed=0,angle=0,runPhase=null,kneeSolver}={}){
  const wanted=active&&speed>.10?1:0;
  const previousWeight=this.weight;
  if(wanted&&!this.weight){this.phase=runPhase===null?0:(runPhase+.75)%1;this.angle=angle;}
  if(speed>.10)this.angle+=Math.atan2(Math.sin(angle-this.angle),Math.cos(angle-this.angle))*(1-Math.exp(-16*dt));
  angle=this.angle;
  this.weight=wanted?THREE.MathUtils.damp(this.weight,1,24,dt):Math.max(0,this.weight-dt/.22);
  if(this.weight<.001){this.reset();return null;}
  const weights=[Math.max(0,Math.cos(angle)),Math.max(0,Math.sin(angle)),Math.max(0,-Math.cos(angle)),Math.max(0,-Math.sin(angle))].map((v,i)=>v/this.specs[i].walkSpeed);
  const sum=weights.reduce((a,b)=>a+b,0),duration=this.specs[0].duration;
  this.phase=(this.phase+dt*speed*sum/(this.root.scale.x*duration))%1;
  this.actions.forEach((action,i)=>{action.time=this.phase*duration;action.setEffectiveWeight(weights[i]/sum);});
  this.proxyRoot.position.copy(this.root.position);this.proxyRoot.quaternion.copy(this.root.quaternion);this.proxyRoot.scale.copy(this.root.scale);
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
  const pelvis=this.bones.pelvis,p=point(pelvis),gait=point(this.proxyBones.pelvis);
  // Retain some attack compression and lean while moving the body over its steps.
  p.x=THREE.MathUtils.lerp(p.x,gait.x,this.weight*.85);p.z=THREE.MathUtils.lerp(p.z,gait.z,this.weight*.85);p.y=THREE.MathUtils.lerp(p.y,gait.y,this.weight*.6);
  pelvis.position.copy(pelvis.parent.worldToLocal(p));this.root.updateMatrixWorld(true);
  const contactWeights={},stance={},feet=[];
  for(const target of targets){
   const {side}=target,foot=this.bones['foot_'+side],proxyFoot=this.proxyBones['foot_'+side];
   target.ankle.lerp(point(proxyFoot),this.weight);target.q.slerp(rotation(proxyFoot),this.weight);
   const error=solveLeg(this.bones['thigh_'+side],this.bones['calf_'+side],foot,target.ankle,target.q,{kneeSolver});
   this.bones['ball_'+side].quaternion.slerp(this.proxyBones['ball_'+side].quaternion,this.weight);
   const phase=(this.phase+(side==='r'?.25:.75))%1;
   stance[side]=phase<.5;contactWeights[side]=phase<.5?1:phase<.6?1-THREE.MathUtils.smoothstep(phase,.5,.6):THREE.MathUtils.smoothstep(phase,.9,1);
   feet.push({side,error});
  }
  this.report={weight:this.weight,phase:this.phase,feet};
  return{weight:this.weight,contactWeights,stance};
 }
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.proxy);}
}
