import {Vector3,Quaternion,MathUtils} from 'three';
const Y=new Vector3(0,1,0),Z=new Vector3(0,0,1);
const EYES=['REye','LEye'],BROWS=['RInnerEyebrow','LInnerEyebrow'];
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
export const FACIAL_LIMITS=Object.freeze({gazeYaw:4*Math.PI/180,gazePitch:2*Math.PI/180,jaw:Math.PI/180,brow:.0003});
// Eyelid closure must preserve triangle orientation and eyeball clearance before it can ship.
export class FacialPose {
 constructor(bones){this.entries=[];this.byName=new Map();for(const name of ['REye','LEye','MJaw','RInnerEyebrow','LInnerEyebrow']){const bone=bones[`Bip01_${name}`];if(bone){const entry={bone,position:bone.position.clone(),rotation:bone.quaternion.clone()};this.entries.push(entry);this.byName.set(name,entry);}}this.applied=false;this.yaw=0;this.pitch=0;this.effort=0;this.anger=0;this.rotation=new Quaternion();this.offset=new Vector3();}
 restore(){if(!this.applied)return;for(const e of this.entries){e.bone.position.copy(e.position);e.bone.quaternion.copy(e.rotation);}this.applied=false;}
 apply(dt,{gazeYaw=0,gazePitch=0,exertion=0,musou=0,enabled=true}={}){
  this.restore();if(!enabled)return;
  const blend=1-Math.exp(-MathUtils.clamp(finite(dt),0,.1)*12),limits=FACIAL_LIMITS;
  this.yaw=MathUtils.lerp(this.yaw,MathUtils.clamp(finite(gazeYaw),-limits.gazeYaw,limits.gazeYaw),blend);
  this.pitch=MathUtils.lerp(this.pitch,MathUtils.clamp(finite(gazePitch),-limits.gazePitch,limits.gazePitch),blend);
  this.effort=MathUtils.lerp(this.effort,MathUtils.clamp(finite(exertion),0,1),blend);this.anger=MathUtils.lerp(this.anger,MathUtils.clamp(finite(musou),0,1),blend);
  for(const e of this.entries){e.position.copy(e.bone.position);e.rotation.copy(e.bone.quaternion);}
  for(const name of EYES){const e=this.byName.get(name);if(e){e.bone.quaternion.multiply(this.rotation.setFromAxisAngle(Y,-this.yaw));e.bone.quaternion.multiply(this.rotation.setFromAxisAngle(Z,-this.pitch));}}
  const jaw=this.byName.get('MJaw');if(jaw)jaw.bone.quaternion.multiply(this.rotation.setFromAxisAngle(Z,limits.jaw*this.effort*(1-.6*this.anger)));
  for(const name of BROWS){const e=this.byName.get(name);if(e)e.bone.position.add(this.offset.copy(Y).multiplyScalar(limits.brow*this.anger).applyQuaternion(e.rotation));}
  this.applied=true;
 }
}
