import {Quaternion,Vector3} from 'three';

const UP=new Vector3(0,1,0);

// Adapt a captured stride to a broad terrain plane before correcting individual
// feet. The same rigid transform preserves the source knees and paired grip.
// FootPlacement uses this plane as its reference, so it only solves residuals.
export class SourceTerrainFrame{
 constructor(root,model,bones){
  this.root=root;this.model=model;this.normal=UP.clone();this.saved=null;this.plane=null;
  this.torso=bones?[['spine_02',.65],['spine_03',.35]].map(([name,weight])=>({bone:bones[name],weight})):[];
  if(this.torso.some(({bone})=>!bone))throw Error('Captured terrain adaptation requires spine_02 and spine_03.');
  for(const {bone}of this.torso)for(const side of ['r','l'])for(let parent=bones['thigh_'+side];parent;parent=parent.parent)
   if(parent===bone)throw Error('Torso terrain compensation cannot rotate a thigh ancestor.');
 }
 restore(){
  if(!this.saved)return;
  this.model.position.copy(this.saved.position);this.model.quaternion.copy(this.saved.quaternion);
  for(const [bone,q]of this.saved.torso)bone.quaternion.copy(q);
  this.saved=null;
 }
 reset(){this.restore();this.normal.copy(UP);this.plane=null;}
 apply(dt,groundHeight,{active=false,enabled=true}={}){
  this.restore();
  if(!enabled||!groundHeight){this.reset();return null;}
  const origin=this.root.getWorldPosition(new Vector3()),wanted=UP.clone();
  if(active){
   const radius=.55*this.root.scale.x;
   const h=[groundHeight(origin.x-radius,origin.z),groundHeight(origin.x+radius,origin.z),
    groundHeight(origin.x,origin.z-radius),groundHeight(origin.x,origin.z+radius)];
   if(!h.every(Number.isFinite)){this.reset();return null;}
   wanted.set(h[0]-h[1],2*radius,h[2]-h[3]).normalize();
   const turn=new Quaternion().setFromUnitVectors(UP,wanted),angle=UP.angleTo(wanted),limit=12*Math.PI/180;
   if(angle>limit)wanted.copy(UP).applyQuaternion(new Quaternion().slerp(turn,limit/angle));
  }
  const response=1-Math.exp(-12*Math.max(0,dt));
  const rotation=new Quaternion().setFromUnitVectors(this.normal,wanted),angle=this.normal.angleTo(wanted);
  const weight=angle>0?Math.min(response,Math.max(0,dt)*1.2/angle):1;
  this.normal.applyQuaternion(new Quaternion().slerp(rotation,weight)).normalize();
  if(this.normal.distanceToSquared(wanted)<1e-12)this.normal.copy(wanted);
  if(!active&&this.normal.distanceToSquared(UP)<1e-12){this.plane=null;return null;}
  const worldTilt=new Quaternion().setFromUnitVectors(UP,this.normal),rootRotation=this.root.getWorldQuaternion(new Quaternion()).normalize();
  const localTilt=rootRotation.clone().invert().multiply(worldTilt).multiply(rootRotation);
  this.saved={position:this.model.position.clone(),quaternion:this.model.quaternion.clone(),torso:[]};
  this.model.position.applyQuaternion(localTilt);this.model.quaternion.premultiply(localTilt).normalize();
  this.root.updateMatrixWorld(true);
  // Preserve the captured chest attitude. Distribute the small compensating
  // bend through the abdomen; both arms and their common handle follow it.
  for(const {bone,weight}of this.torso){
   this.saved.torso.push([bone,bone.quaternion.clone()]);
   const compensation=new Quaternion().slerp(worldTilt.clone().invert(),weight);
   const desired=bone.getWorldQuaternion(new Quaternion()).premultiply(compensation);
   bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(desired)).normalize();
   bone.updateWorldMatrix(false,true);
  }
  const normal=this.normal.clone(),slopeX=-normal.x/normal.y,slopeZ=-normal.z/normal.y;
  this.plane={normal,height:(x,z)=>origin.y+slopeX*(x-origin.x)+slopeZ*(z-origin.z)};
  return this.plane;
 }
}
