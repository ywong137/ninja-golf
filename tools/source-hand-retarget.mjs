import {Matrix4,Quaternion,Vector3} from 'three';

const point=bone=>bone.getWorldPosition(new Vector3());
const rotation=bone=>bone.getWorldQuaternion(new Quaternion()).normalize();

function hands(root){
 root.updateMatrixWorld(true);
 const bones={};root.traverse(bone=>{if(bone.isBone)bones[bone.name]=bone;});
 for(const side of ['r','l'])for(const part of ['hand','middle_01','index_01','pinky_01'])
  if(!bones[part+'_'+side])throw Error('Hand retarget requires '+part+'_'+side+'.');
 return bones;
}

function palmFrame(bones,side){
 const length=point(bones['middle_01_'+side]).sub(point(bones['hand_'+side]));
 const width=point(bones['index_01_'+side]).sub(point(bones['pinky_01_'+side]));
 if(length.lengthSq()<1e-10)throw Error('Hand retarget requires a distinct middle knuckle.');
 length.normalize();width.addScaledVector(length,-width.dot(length));
 if(width.lengthSq()<1e-10)throw Error('Hand retarget requires distinct index and pinky knuckles.');
 width.normalize();
 return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(width,length,width.clone().cross(length)));
}

/** Match both palm axes. Matching wrist-to-knuckle alone leaves roll undefined. */
export function createSourceHandRetarget(sourceRoot,targetRoot){
 const source=hands(sourceRoot),target=hands(targetRoot),corrections={};
 for(const side of ['r','l']){
  corrections[side]=rotation(source['hand_'+side]).invert().multiply(palmFrame(source,side))
   .multiply(palmFrame(target,side).invert()).multiply(rotation(target['hand_'+side]));
 }
 return {apply(){
  for(const side of ['r','l']){
   const hand=target['hand_'+side];
   hand.quaternion.copy(rotation(hand.parent).invert().multiply(rotation(source['hand_'+side])).multiply(corrections[side]));
   hand.updateWorldMatrix(false,true);
  }
 }};
}
