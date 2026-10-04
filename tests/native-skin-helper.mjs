// CPU-only deformation checks. Bind weights identify central limb surfaces.
// Exclude the elbow crease and shared vertices from self-intersection checks.
import fs from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

globalThis.ProgressEvent??=class{};
const point=(g,name)=>g.scene.getObjectByName(name).getWorldPosition(new T.Vector3());

export async function loadNativeSkin(file,{materialNames=false}={}){
 const raw=fs.readFileSync(file),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));
 for(const key of ['images','textures','samplers'])delete doc[key];
 if(materialNames)doc.materials=doc.materials.map(m=>({name:m.name}));
 else{delete doc.materials;for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;}
 const bin=raw.subarray(28+size);
 doc.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];
 const g=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
 g.mixer=new T.AnimationMixer(g.scene);
 return g;
}

export function skinGroups(g){
 g.scene.updateMatrixWorld(true);
 const triangles=[],meshes=[];
 g.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  mesh.skeleton.update();
  const {skinIndex:ids,skinWeight:weights,position}=mesh.geometry.attributes;
  const index=mesh.geometry.index,names=mesh.skeleton.bones.map(b=>b.name);
  const base=Array.from({length:position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
  const vertexWeight=(vertex,predicate)=>{
   let sum=0;
   for(let k=0;k<4;k++)if(predicate(names[ids.getComponent(vertex,k)]))sum+=weights.getComponent(vertex,k);
   return sum;
  };
  const meshId=meshes.length;meshes.push(mesh);
  for(let i=0;i<(index?index.count:position.count);i+=3){
   const vertices=[0,1,2].map(k=>index?index.getX(i+k):i+k);
   const center=vertices.reduce((p,v)=>p.add(base[v]),new T.Vector3()).multiplyScalar(1/3);
   const weight=predicate=>vertices.reduce((sum,v)=>sum+vertexWeight(v,predicate),0)/3;
   let group=weight(name=>/^spine_|^pelvis$/.test(name))>.65?'torso':null;
   for(const side of ['r','l'])for(const part of ['upperarm','lowerarm']){
    const belongs=name=>name===part+'_'+side||name===part+'_skin_base_'+side||name===part+'_skin_mid_'+side;
    if(weight(belongs)<=.65)continue;
    const start=point(g,part+'_'+side),end=point(g,(part==='upperarm'?'lowerarm':'hand')+'_'+side);
    const axis=end.sub(start),fraction=center.clone().sub(start).dot(axis)/axis.lengthSq();
    if(fraction>.15&&fraction<.8)group=part+'_'+side;
   }
   if(group)triangles.push({meshId,vertices,group});
  }
 });
 return{triangles,meshes};
}

const hit=new T.Vector3(),ray=new T.Ray(),direction=new T.Vector3();
function crosses(a,b){
 if(a.max.x<b.min.x||b.max.x<a.min.x||a.max.y<b.min.y||b.max.y<a.min.y||a.max.z<b.min.z||b.max.z<a.min.z)return false;
 if(a.meshId===b.meshId&&a.vertices.some(v=>b.vertices.includes(v)))return false;
 for(const [p,q]of [[a,b],[b,a]])for(let k=0;k<3;k++){
  const start=p.points[k],end=p.points[(k+1)%3];direction.subVectors(end,start);
  const length=direction.length();if(length<1e-9)continue;
  ray.set(start,direction.multiplyScalar(1/length));
  if(ray.intersectTriangle(...q.points,false,hit)&&hit.distanceTo(start)>1e-6&&hit.distanceTo(start)<length-1e-6)return true;
 }
 return false;
}

function radialInset(g,upper,lower,side,details){
 const shoulder=point(g,'upperarm_'+side),axis=point(g,'lowerarm_'+side).sub(shoulder),axisLength=axis.length();
 axis.normalize();
 let depth=0,inside=0;const witnesses=[];
 const examined=new Set();
 for(const triangle of lower)for(let k=0;k<3;k++){
  const key=triangle.meshId+':'+triangle.vertices[k];if(examined.has(key))continue;examined.add(key);
  const p=triangle.points[k],along=p.clone().sub(shoulder).dot(axis);
  if(along<axisLength*.2||along>axisLength*.75)continue;
  const center=shoulder.clone().addScaledVector(axis,along),radial=p.clone().sub(center),radius=radial.length();
  if(radius<1e-8)continue;
  ray.set(center,radial.multiplyScalar(1/radius));
  let surface=Infinity;
  for(const triangle of upper)if(ray.intersectTriangle(...triangle.points,false,hit))surface=Math.min(surface,hit.distanceTo(center));
  if(Number.isFinite(surface)&&surface>radius+.001){inside++;depth=Math.max(depth,surface-radius);if(details)witnesses.push({meshId:triangle.meshId,vertex:triangle.vertices[k],depth:surface-radius});}
 }
 return{interiorForearmVertices:inside,maxRadialPenetration:depth,...(details?{radialWitnesses:witnesses}:{})};
}

export function measureArmSkin(g,metadata,side,{details=false}={}){
 g.scene.updateMatrixWorld(true);
 const cache=metadata.meshes.map(mesh=>{mesh.skeleton.update();return new Map();});
 const triangles=metadata.triangles.map(triangle=>{
  const mesh=metadata.meshes[triangle.meshId],vertices=cache[triangle.meshId];
  const points=triangle.vertices.map(i=>{
   if(!vertices.has(i))vertices.set(i,mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
   return vertices.get(i);
  });
  const box=new T.Box3().setFromPoints(points);
  return{...triangle,points,min:box.min,max:box.max};
 });
 const torso=triangles.filter(t=>t.group==='torso'),upper=triangles.filter(t=>t.group==='upperarm_'+side),lower=triangles.filter(t=>t.group==='lowerarm_'+side);
 const counts={};
 for(const [name,a,b]of [['fold_'+side,upper,lower],['forearmTorso_'+side,lower,torso],['upperarmTorso_'+side,upper,torso]]){
  let pairs=0;const uniqueA=new Set(),uniqueB=new Set(),crossingPairs=[];
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(crosses(a[i],b[j])){pairs++;uniqueA.add(i);uniqueB.add(j);if(details)crossingPairs.push({a:{meshId:a[i].meshId,vertices:a[i].vertices},b:{meshId:b[j].meshId,vertices:b[j].vertices}});}
  counts[name]={pairs,trianglesA:uniqueA.size,trianglesB:uniqueB.size,...(details?{crossingPairs}:{})};
 }
 Object.assign(counts['fold_'+side],radialInset(g,upper,lower,side,details));
 return counts;
}
