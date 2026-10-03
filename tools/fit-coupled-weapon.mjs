import {Quaternion,Vector3,MathUtils} from 'three';
import {solveGripArm} from '../src/hand-grip.js';
import {captureArmPose,measureArmAnatomy} from '../src/arm-anatomy.js';
import {captureWristPose,measureWristAnatomy} from '../src/wrist-anatomy.js';

const D=Math.PI/180,Y=new Vector3(0,1,0),X=new Vector3(1,0,0),Z=new Vector3(0,0,1);
const p=b=>b.getWorldPosition(new Vector3());
const q=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const principal=a=>MathUtils.euclideanModulo(a+180,360)-180;
const excess=(x,max)=>Math.max(0,Math.abs(x)-max);

// Offline study: one shaft frame and two fixed hand stations. The source owns
// the clock, torso, and footwork. The fit only changes weapon tilt and arm poles.
export function fitCoupledWeapon({bones,profiles,arms,wrists,spacing,state,dt}){
 if(!(dt>0)||!state||!Number.isFinite(spacing)||spacing===0)throw Error('Supply a positive dt, state, and grip spacing.');
 const sides=['r','l'];
 for(const side of sides){
  const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
  if(lower.parent!==upper||hand.parent!==lower)throw Error('The coupled fit needs direct upperarm, lowerarm, and hand parents.');
  if(upper.getWorldScale(new Vector3()).distanceTo(new Vector3(1,1,1))>1e-5)throw Error('The coupled fit needs native metre-space joints at unit scale.');
 }
 const initial=Object.fromEntries(sides.map(s=>[s,['upperarm_','lowerarm_','hand_'].map(n=>bones[n+s].quaternion.clone())]));
 const elbows=Object.fromEntries(sides.map(s=>[s,p(bones['lowerarm_'+s])]));
 const palms=sides.map(s=>bones['hand_'+s].localToWorld(profiles[s].center.clone()));
 const frames=sides.map(s=>q(bones['hand_'+s]).multiply(profiles[s].frame));
 const directions=frames.map(f=>Y.clone().applyQuaternion(f));
 const sourceDisagreement=directions[0].angleTo(directions[1])/D;
 const axis=directions[0].clone().add(directions[1]);
 if(axis.lengthSq()<1e-8)throw Error('Opposed source fist axes.');
 axis.normalize();
 if(axis.dot(palms[0].clone().sub(palms[1]))*spacing<0)axis.negate();
 const center=palms[0].clone().add(palms[1]).multiplyScalar(.5);
 const aligned=frames.map((f,i)=>new Quaternion().setFromUnitVectors(directions[i],axis).multiply(f));
 if(state.station===undefined){
  const delta=aligned[0].clone().invert().multiply(aligned[1]);
  state.station=principal(2*Math.atan2(delta.y,delta.w)/D);
 }
 const base=aligned[0];
 const previous=state.parameters;
 const constrain=values=>{
  const a=[...values],length=Math.hypot(a[0],a[1]);
  if(length>12){a[0]*=12/length;a[1]*=12/length;}
  a[2]=MathUtils.clamp(a[2],-90,90);a[3]=MathUtils.clamp(a[3],-85,85);a[4]=MathUtils.clamp(a[4],-85,85);
  if(previous){
   // A line segment between two points in the tilt disk remains in the disk.
   // Component-wise clamps after radial projection can leave that disk.
   const change=Math.hypot(a[0]-previous[0],a[1]-previous[1]),weight=Math.min(1,240*dt/(change||1));
   for(let i=0;i<2;i++)a[i]=previous[i]+(a[i]-previous[i])*weight;
   for(let i=2;i<5;i++)a[i]=MathUtils.clamp(a[i],previous[i]-900*dt,previous[i]+900*dt);
  }
  return a;
 };
 const evaluate=raw=>{
  const v=constrain(raw),tiltAxis=X.clone().multiplyScalar(v[0]).addScaledVector(Z,v[1]),tilt=tiltAxis.length();
  const localTilt=tilt?new Quaternion().setFromAxisAngle(tiltAxis.normalize(),tilt*D):new Quaternion();
  const frame=base.clone().multiply(localTilt).multiply(new Quaternion().setFromAxisAngle(Y,v[2]*D));
  const shaft=Y.clone().applyQuaternion(frame);
  const result={parameters:v,tilt,sourceDisagreement,cost:(tilt/6)**2,gap:0,wrists:{},arms:{}};
  for(const [index,s]of sides.entries()){
   const upper=bones['upperarm_'+s],lower=bones['lowerarm_'+s],hand=bones['hand_'+s];
   for(const [j,b]of [upper,lower,hand].entries())b.quaternion.copy(initial[s][j]);upper.updateWorldMatrix(false,true);
   const palm=center.clone().addScaledVector(shaft,(s==='r'?1:-1)*spacing*.5);
   const handWorld=frame.clone().multiply(new Quaternion().setFromAxisAngle(Y,(s==='l'?state.station:0)*D)).multiply(profiles[s].frame.clone().invert());
   const target=palm.clone().sub(profiles[s].center.clone().applyQuaternion(handWorld));
   const reach=target.clone().sub(p(upper)).normalize();
   const upperWorld=q(upper).premultiply(new Quaternion().setFromAxisAngle(reach,v[3+index]*D));
   upper.quaternion.copy(q(upper.parent).invert().multiply(upperWorld));upper.updateWorldMatrix(false,true);
   solveGripArm(upper,lower,hand,target,handWorld);
   const upperDirection=p(lower).sub(p(upper)).normalize(),forearmDirection=p(hand).sub(p(lower)).normalize();
   const normal=upperDirection.clone().cross(forearmDirection);
   if(normal.lengthSq()>1e-10){
    normal.normalize();const u=q(upper),l=q(lower),hinge=arms[s].hingeAxisLocal.clone().applyQuaternion(u);
    const turn=Math.atan2(upperDirection.dot(hinge.clone().cross(normal)),hinge.dot(normal));
    u.premultiply(new Quaternion().setFromAxisAngle(upperDirection,turn));
    upper.quaternion.copy(q(upper.parent).invert().multiply(u));upper.updateWorldMatrix(false,true);
    lower.quaternion.copy(q(lower.parent).invert().multiply(l));lower.updateWorldMatrix(false,true);
   }
   const forearm=q(lower);
   const delta=handWorld.clone().multiply(wrists[s].referenceHandInForearm.clone().invert()).multiply(forearm.clone().invert());
   const twist=principal(2*Math.atan2(new Vector3(delta.x,delta.y,delta.z).dot(forearmDirection),delta.w)/D);
   const before=measureArmAnatomy(arms[s],captureArmPose(bones,s));
   const wanted=MathUtils.clamp(before.forearmTwistDegrees+twist,-70,70);
   forearm.premultiply(new Quaternion().setFromAxisAngle(forearmDirection,(wanted-before.forearmTwistDegrees)*D));
   lower.quaternion.copy(q(lower.parent).invert().multiply(forearm));lower.updateWorldMatrix(false,true);
   hand.quaternion.copy(forearm.clone().invert().multiply(handWorld));hand.updateWorldMatrix(false,true);
   const arm=measureArmAnatomy(arms[s],captureArmPose(bones,s)),wrist=measureWristAnatomy(wrists[s],captureWristPose(bones,s));
   const gap=hand.localToWorld(profiles[s].center.clone()).distanceTo(palm);
   result.gap=Math.max(result.gap,gap);result.wrists[s]=wrist;result.arms[s]=arm;
   result.cost+=wrist.axialTwistDegrees**2+excess(wrist.flexionDegrees,35)**2*.1+excess(wrist.ulnarDeviationDegrees,20)**2*.1
    +excess(wrist.totalDegrees,38)**2*10+excess(arm.humeralRollDegrees,70)**2+excess(arm.signedFlexionDegrees,130)**2
    +Math.min(0,arm.signedFlexionDegrees)**2*100+arm.hingeDeviationDegrees**2*100+gap**2*1e7
    +p(lower).distanceToSquared(elbows[s])*25+v[3+index]**2*.0001;
  }
  if(previous)result.cost+=v.reduce((sum,x,i)=>sum+(x-previous[i])**2*.002,0);
  return result;
 };
 let best=evaluate(previous??[0,0,0,0,0]);
 const steps=previous?[4,2,.5]:[24,12,6,2,.5];
 for(const step of steps)for(let pass=0;pass<3;pass++){
  let changed=false;
  for(let k=0;k<5;k++)for(const sign of [-1,1]){
   const next=[...best.parameters];next[k]+=sign*step;const candidate=evaluate(next);
   if(candidate.cost<best.cost-1e-9){best=candidate;changed=true;}
  }
  if(!changed)break;
 }
 best=evaluate(best.parameters);state.parameters=best.parameters;
 return best;
}
