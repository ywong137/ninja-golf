import {AttachedBindMode,Box3,Matrix4,Sphere,Vector3} from 'three';

const prepared=new WeakMap();
const axes=['x','y','z'];
// Upper bound on the largest singular value. Unlike maximum column length,
// this remains conservative when rotated, nonuniform scales produce shear.
function stretch(matrix){
 const m=matrix.elements;
 const a=m[0]*m[0]+m[1]*m[1]+m[2]*m[2],b=m[4]*m[4]+m[5]*m[5]+m[6]*m[6],c=m[8]*m[8]+m[9]*m[9]+m[10]*m[10];
 const ab=Math.abs(m[0]*m[4]+m[1]*m[5]+m[2]*m[6]),ac=Math.abs(m[0]*m[8]+m[1]*m[9]+m[2]*m[10]),bc=Math.abs(m[4]*m[8]+m[5]*m[9]+m[6]*m[10]);
 return Math.sqrt(Math.max(a+ab+ac,b+ab+bc,c+ac+bc));
}
function prepare(mesh){
 const geometry=mesh.geometry,{position,skinIndex,skinWeight}=geometry.attributes;
 const fail=message=>{throw Error(`Cannot bound ${mesh.name||'skinned mesh'}: ${message}`);};
 if(!position||!skinIndex||!skinWeight)fail('position, skinIndex, and skinWeight are required.');
 if(geometry.morphAttributes.position?.length)fail('position morphs need bounds before enabling animated culling.');
 // Cloned enemies share immutable geometry and bind transforms. Process their
 // vertices once, not once per spawn or animation frame.
 const key=[position.version,skinIndex.version,skinWeight.version,...mesh.bindMatrix.elements,...mesh.skeleton.boneInverses.flatMap(m=>m.elements)].join(',');
 let cache=prepared.get(geometry);if(!cache){cache=new Map();prepared.set(geometry,cache);}if(cache.has(key))return cache.get(key);
 const boxes=mesh.skeleton.bones.map(()=>new Box3()),point=new Vector3(),local=new Vector3();let weightError=0;
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix);
  if(!point.toArray().every(Number.isFinite))fail(`vertex ${i} has a nonfinite position.`);
  let sum=0;
  for(let k=0;k<4;k++){
   const weight=skinWeight.getComponent(i,k),bone=skinIndex.getComponent(i,k);
   if(!Number.isFinite(weight)||weight<0)fail(`vertex ${i} has a negative or nonfinite skin weight.`);
   sum+=weight;if(weight===0)continue;
   if(!Number.isInteger(bone)||!boxes[bone])fail(`vertex ${i} references missing bone ${bone}.`);
   boxes[bone].expandByPoint(local.copy(point).applyMatrix4(mesh.skeleton.boneInverses[bone]));
  }
  if(Math.abs(sum-1)>.001)fail(`vertex ${i} has skin weights summing to ${sum}; normalize them first.`);
  weightError=Math.max(weightError,Math.abs(sum-1));
 }
 const data={weightError,bones:boxes.flatMap((box,index)=>box.isEmpty()?[]:[{index,center:box.getCenter(new Vector3()),half:box.getSize(new Vector3()).multiplyScalar(.5)}])};
 if(!data.bones.length)fail('the mesh has no weighted vertices.');
 cache.set(key,data);return data;
}

export class SkinnedBounds{
 constructor(mesh){
  if(!mesh.isSkinnedMesh)throw Error('SkinnedBounds requires a SkinnedMesh.');
  this.mesh=mesh;this.bindBounds=prepare(mesh);this.world=new Sphere();this.box=new Box3();this.point=new Vector3();this.padding=new Vector3();this.correction=new Matrix4();this.transform=new Matrix4();this.inverse=new Matrix4();
  this.previous={frustumCulled:mesh.frustumCulled,intersectsFrustum:mesh.intersectsFrustum,boundingSphere:mesh.boundingSphere};
  mesh.boundingSphere=new Sphere();mesh.frustumCulled=true;
  mesh.intersectsFrustum=frustum=>frustum.intersectsBox(this.box);
 }
 // Call after scene matrices update and before the renderer tests visibility.
 update(){
  const mesh=this.mesh,box=this.box,center=this.point;box.makeEmpty();
  if(mesh.bindMode!==AttachedBindMode)this.correction.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse);
  for(const {index,center:bindCenter,half}of this.bindBounds.bones){
   const bone=mesh.skeleton.bones[index],matrix=mesh.bindMode===AttachedBindMode?bone.matrixWorld:this.transform.multiplyMatrices(this.correction,bone.matrixWorld);
   center.copy(bindCenter).applyMatrix4(matrix);const m=matrix.elements;
   // Exact axis-aligned envelope of the transformed bone box, including shear.
   const x=Math.abs(m[0])*half.x+Math.abs(m[4])*half.y+Math.abs(m[8])*half.z,y=Math.abs(m[1])*half.x+Math.abs(m[5])*half.y+Math.abs(m[9])*half.z,z=Math.abs(m[2])*half.x+Math.abs(m[6])*half.y+Math.abs(m[10])*half.z;
   box.min.x=Math.min(box.min.x,center.x-x);box.min.y=Math.min(box.min.y,center.y-y);box.min.z=Math.min(box.min.z,center.z-z);
   box.max.x=Math.max(box.max.x,center.x+x);box.max.y=Math.max(box.max.y,center.y+y);box.max.z=Math.max(box.max.z,center.z+z);
  }
  // Positive normalized skin weights form a convex combination inside this
  // box. Account for float rounding in their sum and in GPU bone matrices.
  const origin=center.setFromMatrixPosition(mesh.matrixWorld),error=this.bindBounds.weightError+1e-7;
  for(const axis of axes)this.padding[axis]=Math.max(Math.abs(box.min[axis]-origin[axis]),Math.abs(box.max[axis]-origin[axis]))*error+Math.max(1,Math.abs(box.min[axis]),Math.abs(box.max[axis]))*2e-6;
  box.expandByVector(this.padding);box.getBoundingSphere(this.world);
  this.inverse.copy(mesh.matrixWorld).invert();mesh.boundingSphere.center.copy(this.world.center).applyMatrix4(this.inverse);mesh.boundingSphere.radius=this.world.radius*stretch(this.inverse);
 }
 dispose(){Object.assign(this.mesh,this.previous);}
}

export function installSkinnedBounds(model){
 const bounds=[];model.traverse(mesh=>{if(mesh.isSkinnedMesh)bounds.push(new SkinnedBounds(mesh));});
 return{bounds,update(){for(const bound of bounds)if(bound.mesh.visible)bound.update();},dispose(){for(const bound of bounds)bound.dispose();}};
}
