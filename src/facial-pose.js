import {Vector3,Quaternion,MathUtils} from 'three';
const Y=new Vector3(0,1,0),Z=new Vector3(0,0,1);
const EYES=['REye','LEye'];
export const EXPRESSION={
 RInnerEyebrow:[.002,-.0055,.0018],LInnerEyebrow:[-.002,-.0055,.0018],
 MMiddleEyebrow:[0,-.004,.001],ROuterEyebrow:[0,.0003,0],LOuterEyebrow:[0,.0003,0],
 REyeBlinkTop:[0,.0002,.0002],LEyeBlinkTop:[0,.0002,.0002],
 REyeBlinkBottom:[0,.0009,.0004],LEyeBlinkBottom:[0,.0009,.0004],
 RMouthCorner:[-.0016,-.0008,-.0008],LMouthCorner:[.0016,-.0008,-.0008],
 MUpperLip:[0,.0012,.0005],MBottomLip:[0,-.0008,.0003],
 RCheek:[0,.0006,.0006],LCheek:[0,.0006,.0006],
};
const CLENCHED_GLARE={
 REyeBlinkTop:[0,-.001,.0005],LEyeBlinkTop:[0,-.001,.0005],
 REyeBlinkBottom:[0,.0017,.0004],LEyeBlinkBottom:[0,.0017,.0004],
 MUpperLip:[0,.0004,.0005],MBottomLip:[0,0,.0003],
 RMouthCorner:[-.0016,-.0004,-.0008],LMouthCorner:[.0016,-.0004,-.0008],
};
const EXECUTIVE_FROWN={
 RInnerEyebrow:[.0025,-.006,.0018],LInnerEyebrow:[-.0025,-.006,.0018],
 MUpperLip:[0,.0004,.0005],MBottomLip:[0,0,.0003],
 RMouthCorner:[-.001,-.001,0],LMouthCorner:[.001,-.001,0],
};
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
export const FACIAL_LIMITS=Object.freeze({gazeYaw:4*Math.PI/180,gazePitch:2*Math.PI/180,jaw:Math.PI/180,musouJaw:0,brow:Math.max(Math.hypot(...EXPRESSION.RInnerEyebrow),Math.hypot(...EXECUTIVE_FROWN.RInnerEyebrow))});
// Eyelid closure must preserve triangle orientation and eyeball clearance before it can ship.
export class FacialPose {
 constructor(bones,{identity=null}={}){
  this.expression=identity==='sora'?{...EXPRESSION,...CLENCHED_GLARE}:EXPRESSION;
  // This face has tightly packed corner triangles. A shorter outward pull
  // preserves their orientation while retaining the clenched mouth.
  if(identity==='ayame')this.expression={...EXPRESSION,RMouthCorner:[-.0004,-.0005,0],LMouthCorner:[.0004,-.0005,0]};
  if(identity==='monk')this.expression={...EXPRESSION,...EXECUTIVE_FROWN};
  this.head=bones.Head;this.entries=[];this.byName=new Map();
  for(const name of ['REye','LEye','MJaw',...Object.keys(EXPRESSION)]){const bone=bones[`Bip01_${name}`];if(bone){const entry={bone,position:bone.position.clone(),rotation:bone.quaternion.clone()};this.entries.push(entry);this.byName.set(name,entry);}}
  this.applied=false;this.yaw=0;this.pitch=0;this.effort=0;this.anger=0;this.rotation=new Quaternion();this.offset=new Vector3();this.headRotation=new Quaternion();this.parentInverse=new Quaternion();
  // Calibrate anatomical directions from facial landmarks, rather than the
  // arbitrary local axes of each imported facial bone.
  const point=name=>bones['Bip01_'+name].getWorldPosition(new Vector3());
  const inverse=this.head.getWorldQuaternion(new Quaternion()).invert();
  this.right=point('LEye').sub(point('REye'));
  this.faceScale=MathUtils.clamp(this.right.length()/.063,.85,1.15);this.right.normalize();
  this.up=point('MMiddleEyebrow').sub(point('MUpperLip'));this.up.addScaledVector(this.right,-this.up.dot(this.right)).normalize();
  this.forward=this.right.clone().cross(this.up).normalize();
  for(const axis of [this.right,this.up,this.forward])axis.applyQuaternion(inverse);
 }
 restore(){if(!this.applied)return;for(const e of this.entries){e.bone.position.copy(e.position);e.bone.quaternion.copy(e.rotation);}this.applied=false;}
 apply(dt,{gazeYaw=0,gazePitch=0,exertion=0,musou=0,enabled=true}={}){
  this.restore();if(!enabled)return;
  const blend=1-Math.exp(-MathUtils.clamp(finite(dt),0,.1)*12),limits=FACIAL_LIMITS;
  this.yaw=MathUtils.lerp(this.yaw,MathUtils.clamp(finite(gazeYaw),-limits.gazeYaw,limits.gazeYaw),blend);
  this.pitch=MathUtils.lerp(this.pitch,MathUtils.clamp(finite(gazePitch),-limits.gazePitch,limits.gazePitch),blend);
  this.effort=MathUtils.lerp(this.effort,MathUtils.clamp(finite(exertion),0,1),blend);this.anger=MathUtils.lerp(this.anger,MathUtils.clamp(finite(musou),0,1),blend);
  for(const e of this.entries){e.position.copy(e.bone.position);e.rotation.copy(e.bone.quaternion);}
  for(const name of EYES){const e=this.byName.get(name);if(e){e.bone.quaternion.multiply(this.rotation.setFromAxisAngle(Y,-this.yaw));e.bone.quaternion.multiply(this.rotation.setFromAxisAngle(Z,-this.pitch));}}
  const jaw=this.byName.get('MJaw');if(jaw)jaw.bone.quaternion.multiply(this.rotation.setFromAxisAngle(Z,MathUtils.lerp(limits.jaw*this.effort,limits.musouJaw,this.anger)));
  this.head.getWorldQuaternion(this.headRotation);
  for(const [name,[x,y,z]]of Object.entries(this.expression)){
   const e=this.byName.get(name);if(!e)continue;
   e.bone.parent.getWorldQuaternion(this.parentInverse).invert();
   this.offset.copy(this.right).multiplyScalar(x).addScaledVector(this.up,y).addScaledVector(this.forward,z).multiplyScalar(this.anger*this.faceScale).applyQuaternion(this.headRotation).applyQuaternion(this.parentInverse);
   e.bone.position.add(this.offset);
  }
  this.applied=true;
 }
}
