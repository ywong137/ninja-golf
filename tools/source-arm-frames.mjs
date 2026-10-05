import {AnimationMixer,LoopOnce,Matrix4,Quaternion,Vector3} from 'three';
const point=b=>b.getWorldPosition(new Vector3());
const rotation=b=>b.getWorldQuaternion(new Quaternion()).normalize();
const finite=v=>v?.isVector3&&v.toArray().every(Number.isFinite)&&v.lengthSq()>1e-12;

/** Measure an elbow plane from a bent source pose, preserving the source state. */
export function captureSourceArmHinges(asset,clip,time=0){
 if(!asset?.scene?.isObject3D||!Array.isArray(clip?.tracks)||!Number.isFinite(clip?.duration)||clip.duration<=0||!Number.isFinite(time)||time<0||time>clip.duration)throw Error('Supply a source scene, clip, and in-range reference time.');
 const saved=[];asset.scene.traverse(b=>saved.push([b,b.position.clone(),b.quaternion.clone(),b.scale.clone()]));
 // A private mixer cannot change an existing source action's clock or weight.
 const mixer=new AnimationMixer(asset.scene),action=mixer.clipAction(clip).setLoop(LoopOnce);action.clampWhenFinished=true;action.play();
 try{
  action.time=time;mixer.update(0);asset.scene.updateMatrixWorld(true);const result={};
  for(const side of ['r','l']){
   const [upper,lower,hand]=['upperarm','lowerarm','hand'].map(n=>asset.scene.getObjectByName(n+'_'+side));
   if(!upper?.isBone||!lower?.isBone||!hand?.isBone)throw Error('Missing source arm '+side+'.');
   const u=point(lower).sub(point(upper)),v=point(hand).sub(point(lower));
   if(!finite(u)||!finite(v))throw Error('Source '+side+' arm has invalid joint positions.');
   u.normalize();v.normalize();const degrees=u.angleTo(v)*180/Math.PI;
   if(degrees<15||degrees>150)throw Error('Source '+side+' elbow reference must bend 15–150 degrees; measured '+degrees+'. Choose another source time.');
   result[side]=u.cross(v).normalize().applyQuaternion(rotation(upper).invert());
  }
  return result;
 }finally{
  mixer.stopAllAction();mixer.uncacheRoot(asset.scene);
  for(const [b,p,q,s]of saved){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}asset.scene.updateMatrixWorld(true);
 }
}
function frame(direction,normal){
 if(!finite(direction)||!finite(normal))throw Error('Arm reference vectors must be finite and nonzero.');
 const x=direction.clone().normalize(),z=normal.clone().addScaledVector(x,-normal.dot(x));
 if(z.lengthSq()<1e-8)throw Error('Arm reference plane is degenerate.');
 z.normalize();return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z));
}
function chain(root,side,hinge){
 const bones=['upperarm','lowerarm','hand'].map(n=>root.getObjectByName(n+'_'+side));
 if(bones.some(b=>!b?.isBone))throw Error('Missing arm bones for '+side+'.');
 const p=bones.map(point),directions=[p[1].clone().sub(p[0]),p[2].clone().sub(p[1])];
 if(directions.some(d=>!finite(d)))throw Error('Arm joint positions must be finite and distinct.');
 directions.forEach(d=>d.normalize());let normal;
 if(hinge!==undefined){if(!finite(hinge))throw Error('Supply a finite nonzero local hinge vector.');normal=hinge.clone().normalize().applyQuaternion(rotation(bones[0]));}
 else{normal=directions[0].clone().cross(directions[1]);if(normal.lengthSq()<Math.sin(3*Math.PI/180)**2)throw Error('A near-straight bind arm needs a measured bent-pose reference.');normal.normalize();}
 return {bones,frames:directions.map(d=>frame(d,normal)),rotations:bones.map(rotation)};
}

/** Transfer full segment frames. A straight source bind pose needs explicit hinges. */
export function createSourceArmFrames(sourceRoot,targetRoot,{sourceHinges}={}){
 sourceRoot.updateMatrixWorld(true);targetRoot.updateMatrixWorld(true);const entries=[];
 for(const side of ['r','l']){
  const a=chain(sourceRoot,side,sourceHinges?.[side]),b=chain(targetRoot,side);
  for(let i=0;i<2;i++)entries.push({source:a.bones[i],target:b.bones[i],correction:a.rotations[i].clone().invert().multiply(a.frames[i]).multiply(b.frames[i].clone().invert()).multiply(b.rotations[i])});
 }
 return {apply(){sourceRoot.updateMatrixWorld(true);for(const {source,target,correction}of entries){target.quaternion.copy(rotation(target.parent).invert().multiply(rotation(source)).multiply(correction)).normalize();target.updateWorldMatrix(false,true);}}};
}
