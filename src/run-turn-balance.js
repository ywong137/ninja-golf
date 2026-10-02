import {MathUtils,Quaternion,Vector3} from 'three';
import {captureLegPole} from './leg-pole.js';

const UP=new Vector3(0,1,0),MAX_LEAN=22*Math.PI/180;
const position=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();

// The source capture supplies the stride. This layer supplies the change in
// body balance when gameplay bends that stride's trajectory. It never edits a
// calf or assumes that different rigs share local joint axes.
export class RunTurnBalance{
 constructor(root,bones,anatomy){
  this.root=root;this.bones=bones;this.anatomy=anatomy;
  this.lean=new Vector3();this.previousVelocity=null;this.saved=null;this.report=null;
 }
 restore(){
  if(!this.saved)return;
  this.bones.pelvis.position.copy(this.saved.p);this.bones.pelvis.quaternion.copy(this.saved.q);this.saved=null;
 }
 reset(){this.restore();this.lean.set(0,0,0);this.previousVelocity=null;this.report=null;}
 observe(velocity){
  if(![velocity?.x,velocity?.z].every(Number.isFinite))throw Error('Turn balance requires a finite horizontal velocity.');
  this.previousVelocity={x:velocity.x,z:velocity.z};
 }
 apply(dt,{velocity,active=false,groundHeight,targets=null,contactWeights=null}={}){
  this.restore();
  if(!active||!groundHeight){this.reset();return null;}
  if(!Number.isFinite(dt)||dt<0)throw Error('Turn balance requires a finite, nonnegative frame duration.');
  const previous=this.previousVelocity;this.observe(velocity);
  const speed=Math.hypot(velocity.x,velocity.z),wanted=new Vector3();
  if(previous&&dt>0&&speed>.5&&Math.hypot(previous.x,previous.z)>.5){
   const right=new Vector3(velocity.z/speed,0,-velocity.x/speed);
   const lateral=((velocity.x-previous.x)*right.x+(velocity.z-previous.z)*right.z)/dt;
   // atan(a/g) supplies direction and scale. Limit the artistic response so an
   // instantaneous input change cannot throw the torso beyond leg support.
   wanted.copy(right).multiplyScalar(MathUtils.clamp(Math.atan(lateral/9.81),-MAX_LEAN,MAX_LEAN)*MathUtils.smoothstep(speed,.8,3));
  }
  this.lean.lerp(wanted,1-Math.exp(-14*dt));
  if(this.lean.length()<1e-5)this.lean.set(0,0,0);
  const angle=this.lean.length();this.report={angle,lateralTarget:wanted.length()};
  if(angle===0)return null;
  this.root.updateMatrixWorld(true);
  const feet=targets??Object.fromEntries(['r','l'].map(side=>[side,{
   p:position(this.bones['foot_'+side]),q:rotation(this.bones['foot_'+side]),
   pole:captureLegPole(this.bones['thigh_'+side],this.bones['calf_'+side],this.bones['foot_'+side],this.anatomy[side].hinge),
  }]));
  const pelvis=this.bones.pelvis,p=position(pelvis),pivot=p.clone();
  const totalSupport=['r','l'].reduce((sum,side)=>sum+(contactWeights?.[side]??0),0);
  if(totalSupport>0){
   const loaded=new Vector3();
   for(const side of ['r','l'])loaded.addScaledVector(feet[side].p,(contactWeights?.[side]??0)/totalSupport);
   pivot.lerp(loaded,Math.min(1,totalSupport));
  }
  // Transfer weight around the loaded shoe. Rotating around a point directly
  // below the hips pulls a planted leg away and forces the pelvis downward.
  pivot.y=groundHeight(pivot.x,pivot.z);
  if(!Number.isFinite(pivot.y))throw Error('Turn balance received a non-finite ground height.');
  const axis=UP.clone().cross(this.lean).normalize(),turn=new Quaternion().setFromAxisAngle(axis,angle);
  this.saved={p:pelvis.position.clone(),q:pelvis.quaternion.clone()};
  const q=turn.clone().multiply(rotation(pelvis));
  p.sub(pivot).applyQuaternion(turn).add(pivot);
  pelvis.position.copy(pelvis.parent.worldToLocal(p));
  pelvis.quaternion.copy(rotation(pelvis.parent).invert().multiply(q)).normalize();
  pelvis.updateWorldMatrix(false,true);
  return feet;
 }
}
