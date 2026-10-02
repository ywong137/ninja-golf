import {Matrix4,Quaternion,Vector3} from 'three';

const point=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();
function segmentFrame(direction,normal){
 const x=direction.clone().normalize(),z=normal.clone().addScaledVector(x,-normal.dot(x)).normalize();
 if(x.lengthSq()<.99||z.lengthSq()<.99)throw Error('Source leg retarget requires nonzero segments and a measurable bind knee bend.');
 return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z));
}
function legFrame(root,side){
 const names=['thigh','calf','foot','ball'].map(part=>`${part}_${side}`),bones=names.map(name=>root.getObjectByName(name));
 if(bones.some(b=>!b?.isBone))throw Error(`Source leg retarget requires ${names.join(', ')}.`);
 const points=bones.map(point),directions=points.slice(1).map((p,i)=>p.clone().sub(points[i]).normalize());
 const normal=directions[0].clone().cross(directions[1]);
 if(normal.lengthSq()<1e-10)throw Error(`Source leg retarget requires a measurable ${side} bind knee bend.`);
 normal.normalize();
 return {bones,frames:directions.map(d=>segmentFrame(d,normal)),rotations:bones.slice(0,3).map(rotation)};
}

/** Calibrate complete native leg frames in bind pose, before either mixer runs.
 * Segment direction alone leaves the target's native knee roll in place.
 * A recovering shoe can point backward, so it must not define the knee bend.
 */
export function createSourceLegRetarget(sourceRoot,targetRoot,{includeFeet=true}={}){
 sourceRoot.updateMatrixWorld(true,true);targetRoot.updateMatrixWorld(true,true);
 const entries=[];
 for(const side of ['r','l']){
  const source=legFrame(sourceRoot,side),target=legFrame(targetRoot,side);
  for(let i=0;i<(includeFeet?3:2);i++){
   const alignment=source.frames[i].clone().multiply(target.frames[i].clone().invert());
   const correction=source.rotations[i].clone().invert().multiply(alignment).multiply(target.rotations[i]);
   entries.push({source:source.bones[i],target:target.bones[i],correction});
  }
 }
 return {apply(){
  sourceRoot.updateMatrixWorld(true,true);targetRoot.updateMatrixWorld(true,true);
  for(const {source,target,correction} of entries){
   const desired=rotation(source).multiply(correction);
   target.quaternion.copy(rotation(target.parent).invert().multiply(desired)).normalize();
   target.updateWorldMatrix(false,true);
  }
 }};
}
