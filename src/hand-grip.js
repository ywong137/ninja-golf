import {MathUtils,Quaternion,Vector3} from 'three';
import {alignWeaponShaft,palmWeaponBasis} from './weapon-frame.js';

const Y=new Vector3(0,1,0);
const position=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion());
function setWorldRotation(bone,q){
 bone.quaternion.copy(rotation(bone.parent).invert().multiply(q)).normalize();
 bone.updateWorldMatrix(false,true);
}

// The animated elbow supplies the bend plane. The solver preserves native lengths.
export function solveGripArm(upper,lower,hand,target,handRotation){
 const shoulder=position(upper),elbow=position(lower),wrist=position(hand);
 const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),axis=target.clone().sub(shoulder);
 const distance=MathUtils.clamp(axis.length(),Math.abs(a-b)+.001,(a+b)*.9995);axis.normalize();
 const bend=elbow.clone().sub(shoulder);bend.addScaledVector(axis,-bend.dot(axis));
 if(bend.lengthSq()<1e-8)bend.set(0,-1,0).addScaledVector(axis,axis.y);
 if(bend.lengthSq()<1e-8)bend.set(1,0,0).addScaledVector(axis,-axis.x);
 bend.normalize();
 const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
 const wantedElbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,height);
 const wantedWrist=shoulder.clone().addScaledVector(axis,distance);
 setWorldRotation(upper,new Quaternion().setFromUnitVectors(elbow.sub(shoulder).normalize(),wantedElbow.clone().sub(shoulder).normalize()).multiply(rotation(upper)));
 const nowElbow=position(lower);
 setWorldRotation(lower,new Quaternion().setFromUnitVectors(position(hand).sub(nowElbow).normalize(),wantedWrist.clone().sub(nowElbow).normalize()).multiply(rotation(lower)));
 setWorldRotation(hand,handRotation);
 return position(hand).distanceTo(target);
}

export function gripFrame(bones,entry,side,reference=null){
 const hand=bones['hand_'+side],axis=new Vector3().fromArray(entry.axis);
 const forward=hand.worldToLocal(position(bones['middle_01_'+side]));
 const frame=reference?alignWeaponShaft(reference.clone(),axis):palmWeaponBasis(axis,forward);
 return {center:new Vector3().fromArray(entry.center),axis,frame,radius:entry.radius,
  fingers:Object.entries(entry.rotations).map(([name,q])=>[bones[name],new Quaternion().fromArray(q)])};
}

export function applyFingerGrip(profile,weight=1){
 for(const [bone,q]of profile.fingers)bone.quaternion.slerp(q,weight);
}

// This module never fits a mesh during play. The offline profiles contain the fit.
export class HandGrip {
 constructor(actor,data){
  this.actor=actor;this.profiles={};this.saved=new Map();this.weight=0;this.goal=0;this.transition=null;
  actor.root.updateMatrixWorld(true);
  for(const [kind,sides]of Object.entries(data)){
   this.profiles[kind]={};
   for(const side of ['r','l'])this.profiles[kind][side]=gripFrame(actor.bones,sides[side],side,actor.palmWeaponFrames?.[side]);
  }
  this.prepare(false);
 }
 remember(bone){if(!this.saved.has(bone))this.saved.set(bone,bone.quaternion.clone());}
 restore(){for(const [bone,q]of this.saved)bone.quaternion.copy(q);this.saved.clear();}
 prepare(golf){
  this.kind=golf?'golf':'sword';this.active=this.profiles[this.kind];
  for(const side of ['r','l']){
   this.actor.palmGrips[side].copy(this.active[side].center);
   this.actor.shaftAxes[side].copy(this.active[side].axis);
  }
 }
 engage(value,fade=0){
  const goal=value?1:0;
  if(!fade){this.weight=goal;this.goal=goal;this.transition=null;return;}
  if(this.goal===goal)return;
  this.goal=goal;this.transition={start:this.actor.mixer.time,duration:fade,from:this.weight};
 }
 selectionCarry(side){
  const {actor}=this,{bones}=actor,upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
  for(const bone of [upper,lower,hand])this.remember(bone);
  const sign=side==='r'?-1:1,chest=rotation(bones.spine_03),rest=actor.selectionArmRest[side];
  const rootQ=rotation(actor.root),kind=actor.weapon.userData.kind;
  // Author the upper arm and forearm first. The neutral hand determines the
  // resulting blade direction; no independent shaft target bends the wrist.
  const upperDirection=new Vector3(sign*.22,-.974,.145).normalize().applyQuaternion(rootQ);
  const shortBlade=kind==='wakizashi'||kind==='twin';
  const inward=shortBlade?-.05:-.12;
  const pitch=kind==='naginata'?.11:kind==='twin'?(side==='r'?-.22:-.45):shortBlade?-.36:.04;
  const forearmDirection=new Vector3(-sign*inward,pitch,1).normalize().applyQuaternion(rootQ);
  const upperReference=chest.multiply(rest.upperInChest);
  const upperAxis=lower.position.clone().normalize().applyQuaternion(upperReference);
  setWorldRotation(upper,new Quaternion().setFromUnitVectors(upperAxis,upperDirection).multiply(upperReference));
  const lowerReference=rotation(lower.parent).multiply(rest.lower);
  const lowerAxis=hand.position.clone().normalize().applyQuaternion(lowerReference);
  setWorldRotation(lower,new Quaternion().setFromUnitVectors(lowerAxis,forearmDirection).multiply(lowerReference));
  hand.quaternion.copy(actor.neutralHandRotations[side]);hand.updateWorldMatrix(true,true);
  // Calibrate a thumb-up forearm frame geometrically. This removes inherited
  // animation roll before applying a modest presentation roll.
  const shaft=this.active[side].axis.clone().applyQuaternion(rotation(hand));
  const up=Y.clone().applyQuaternion(rootQ);
  shaft.addScaledVector(forearmDirection,-shaft.dot(forearmDirection)).normalize();
  up.addScaledVector(forearmDirection,-up.dot(forearmDirection)).normalize();
  const turn=Math.atan2(shaft.clone().cross(up).dot(forearmDirection),shaft.dot(up));
  setWorldRotation(lower,new Quaternion().setFromAxisAngle(forearmDirection,turn).multiply(rotation(lower)));
  this.selectionReport??={};
  this.selectionReport[side]={wristNeutralError:hand.quaternion.clone().normalize().angleTo(actor.neutralHandRotations[side].clone().normalize()),elbowFlexion:upperDirection.angleTo(forearmDirection),forearmFrameCorrection:turn};
 }
 orient(side,from,to,golf,nativeAttachment=false){
  const {actor}=this,hand=actor.bones['hand_'+side],profile=this.active[side];
  this.remember(hand);
  if(actor.current.includes('_Selection_Idle')){
   this.selectionCarry(side);
   return;
  }
  // A native attack authors the complete wrist frame. Its weapon follows the
  // blended hand; a second shaft target must not replace that performance.
  if(nativeAttachment)return;
  const rootQ=rotation(actor.root),local=rotation(hand).premultiply(rootQ.clone().invert()).multiply(profile.frame);
  const travel=actor.travelPose?.shaftDirections[side];
  if(!golf&&travel)alignWeaponShaft(local,travel);
  else if(from&&to&&!(actor.travelPose?.weight>0&&!golf)){
   const direction=new Vector3(to[0]-from[0],to[2]-from[2],from[1]-to[1]).normalize();
   alignWeaponShaft(local,direction);
   const blend=actor.heldBlend;
   if(!golf&&blend?.[side])local.slerp(blend[side],1-MathUtils.clamp((actor.mixer.time-blend.start)/blend.duration,0,1));
  }
  // Orient the hand and its fingers with the handle, never the handle alone.
  setWorldRotation(hand,rootQ.multiply(local).multiply(profile.frame.clone().invert()));
 }
 attach(held,side,station){
  const {root,bones}=this.actor,hand=bones['hand_'+side],profile=this.active[side];
  if(held.parent!==root)root.add(held);
  const world=rotation(hand).multiply(profile.frame);
  const center=hand.localToWorld(profile.center.clone());
  const scale=root.getWorldScale(new Vector3()).x;
  held.position.copy(root.worldToLocal(center.addScaledVector(Y.clone().applyQuaternion(world),-station*scale)));
  held.quaternion.copy(rotation(root).invert().multiply(world));held.scale.setScalar(1);
  held.updateWorldMatrix(true,true);
 }
 attachPair(held,station,spacing){
  const {root,bones}=this.actor,scale=root.getWorldScale(new Vector3()).x;
  const palms=['r','l'].map(side=>bones['hand_'+side].localToWorld(this.active[side].center.clone()));
  const axis=palms[0].clone().sub(palms[1]);
  if(axis.lengthSq()<1e-8)throw Error('A two-handed weapon needs separate palm positions.');
  axis.normalize();
  const world=rotation(bones.hand_r).multiply(this.active.r.frame);
  alignWeaponShaft(world,axis);
  const center=palms[0].clone().add(palms[1]).multiplyScalar(.5);
  if(held.parent!==root)root.add(held);
  held.position.copy(root.worldToLocal(center.addScaledVector(axis,-(station-spacing*.5)*scale)));
  held.quaternion.copy(rotation(root).invert().multiply(world));held.scale.setScalar(1);
  held.updateWorldMatrix(true,true);
  this.report={secondaryWeight:this.secondaryWeight,pairedGrip:true,palmGap:Math.abs(palms[0].distanceTo(palms[1])-spacing*scale)*.5};
 }
 solveSecondary(held,spacing,weight=this.weight){
  const {actor}=this,{bones,root}=actor,scale=root.getWorldScale(new Vector3()).x;
  const primary=position(bones.hand_r).add(this.active.r.center.clone().multiplyScalar(scale).applyQuaternion(rotation(bones.hand_r)));
  const shaft=Y.clone().applyQuaternion(rotation(held)),left=this.active.l;
  const handQ=rotation(bones.hand_l),handleQ=handQ.clone().multiply(left.frame);
  alignWeaponShaft(handleQ,shaft);handQ.copy(handleQ).multiply(left.frame.clone().invert());
  const rightQ=rotation(bones.hand_r),rightOffset=this.active.r.center.clone().multiplyScalar(scale).applyQuaternion(rightQ);
  const leftOffset=left.center.clone().multiplyScalar(scale).applyQuaternion(handQ).addScaledVector(shaft,spacing*scale);
  const origin=primary.clone(),chains=['r','l'].map(side=>{
   const upper=bones['upperarm_'+side],lower=bones['lowerarm_'+side],hand=bones['hand_'+side];
   return{side,upper,lower,hand,shoulder:position(upper),reach:(position(upper).distanceTo(position(lower))+position(lower).distanceTo(position(hand)))*.9995};
  });
  // Tiny shared translations keep both wrists reachable without stretching bones.
  for(let i=0;i<12;i++)for(const chain of chains){
   const offset=chain.side==='r'?rightOffset:leftOffset;
   const delta=origin.clone().sub(offset).sub(chain.shoulder),d=delta.length();
   if(d>chain.reach)origin.addScaledVector(delta,(chain.reach-d)/d);
  }
  const errors={};
  for(const chain of chains){
   const {side,upper,lower,hand}=chain;
   if(side==='r'&&origin.distanceToSquared(primary)<1e-12)continue;
   const before=[upper,lower,hand].map(b=>b.quaternion.clone());
   for(const b of [upper,lower,hand])this.remember(b);
   const target=origin.clone().sub(side==='r'?rightOffset:leftOffset);
   errors[side]=solveGripArm(upper,lower,hand,target,side==='r'?rightQ:handQ);
   if(weight<1){[upper,lower,hand].forEach((b,i)=>{const solved=b.quaternion.clone();b.quaternion.copy(before[i]).slerp(solved,weight);});upper.updateWorldMatrix(true,true);}
  }
  this.report={secondaryWeight:weight,reachErrors:errors,translation:origin.distanceTo(primary)};
 }
 apply(motion,golf,clip){
  const {actor}=this;this.prepare(golf);actor.root.updateMatrixWorld(true);
  if(this.transition){const t=MathUtils.clamp((actor.mixer.time-this.transition.start)/this.transition.duration,0,1);this.weight=MathUtils.lerp(this.transition.from,this.goal,t*t*(3-2*t));if(t===1)this.transition=null;}
  // The free hand closes after the carry arm approaches its authored pose.
  // An early full-strength grab can pull both elbows across the torso.
  // Release it before running resumes; a fading grab would bend the free wrist.
  const secondaryWeight=actor.running&&!golf?0:clip?.nativeAttachment&&!golf?this.weight*MathUtils.smoothstep(1-(actor.travelPose?.weight??0),.4,1):this.weight;
  this.secondaryWeight=secondaryWeight;
  const holdingLeft=actor.offhand&&!golf?1:secondaryWeight;
  for(const side of ['r','l']){
   const weight=side==='r'?1:holdingLeft;if(!weight)continue;
   for(const [bone]of this.active[side].fingers)this.remember(bone);
   applyFingerGrip(this.active[side],weight);
  }
  this.orient('r',motion?.grip,motion?.tip,golf,!!clip?.nativeAttachment);
  const held=golf?actor.club:actor.weapon;
  if(!golf){
   // A long polearm balances at the middle of its wrapped shaft during travel.
   // Slide back to the attack grip with the carry fade, before contact.
   let resting=clip?.primaryGrip??held.userData.defaultGrip;
   const blend=actor.heldBlend;
   if(blend?.station!==undefined)resting=MathUtils.lerp(blend.station,resting,MathUtils.smoothstep((actor.mixer.time-blend.start)/blend.duration,0,1));
   held.userData.primaryGrip=MathUtils.lerp(resting,actor.travelPose?.profile.gripStation??resting,actor.travelPose?.weight??0);
  }
  const station=golf?0:held.userData.primaryGrip;
  this.attach(held,'r',station);
  if(actor.offhand&&!golf){this.orient('l',motion?.offGrip,motion?.offTip,false,!!clip?.nativeAttachment);this.attach(actor.offhand,'l',actor.offhand.userData.primaryGrip);}
  else if(clip?.pairedGrip&&secondaryWeight>.999&&(!actor.heldBlend||actor.mixer.time>=actor.heldBlend.start+actor.heldBlend.duration)){this.attachPair(held,station,clip.gripSpacing);}
  else if(secondaryWeight>0){this.solveSecondary(held,clip?.gripSpacing??.09,secondaryWeight);this.attach(held,'r',station);}
  if(golf){
   const length=motion?.grip&&motion?.tip?Math.hypot(...motion.tip.map((v,i)=>v-motion.grip[i])):1.12;
   actor.clubShaft.scale.y=Math.max(.1,length-.17);actor.clubShaft.position.y=.17+actor.clubShaft.scale.y*.5;
   actor.clubHead.position.y=length;
  }
  actor.root.updateMatrixWorld(true);
 }
}
