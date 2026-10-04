import * as T from 'three';

const point=new T.Vector3(),delta=new T.Vector3(),axis=new T.Vector3(),closest=new T.Vector3(),normal=new T.Vector3();
const originalPoint=new T.Vector3(),outwardPoint=new T.Vector3();
const inverse=new T.Matrix4(),worldScale=new T.Vector3();
const garmentMaterials=/coat|lining|piping|linen|jade woven|Lilac woven/i;
// Some outfits merge the tunic and trousers into one material. Connected
// surface pieces distinguish hanging hems from the legs below them.
export function hangingBodyVertices(mesh,hipHeight,kneeHeight){
 const count=mesh.geometry.attributes.position.count,parent=Int32Array.from({length:count},(_,i)=>i),index=mesh.geometry.index;
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{parent[find(a)]=find(b);};
 for(let i=0;i<(index?.count??count);i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;join(a,b);join(b,c);}
 const bounds=new Map(),vertices=[];mesh.skeleton.update();
 for(let i=0;i<count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);const key=find(i),range=bounds.get(key)??{min:Infinity,max:-Infinity};range.min=Math.min(range.min,point.y);range.max=Math.max(range.max,point.y);bounds.set(key,range);vertices.push(key);}
 return new Set(vertices.flatMap((key,i)=>{const r=bounds.get(key);return r.min>kneeHeight+.025&&r.min<hipHeight&&r.max>hipHeight?[i]:[];}));
}

// A unilateral cloth constraint: a front panel cannot cross to the back of
// its thigh. The collision direction follows that thigh through a raised knee.
export function projectGarmentPoint(p,a,b,r0,r1,outward,clearance=.012){
 axis.subVectors(b,a);const t=T.MathUtils.clamp(delta.subVectors(p,a).dot(axis)/axis.lengthSq(),0,1);
 closest.copy(a).addScaledVector(axis,t);delta.subVectors(p,closest);
 normal.copy(outward).addScaledVector(axis,-outward.dot(axis)/axis.lengthSq()).normalize();
 const radius=T.MathUtils.lerp(r0,r1,t)+clearance,d=delta.dot(normal);
 const tangent=Math.max(0,delta.lengthSq()-d*d);
 if(tangent>=radius*radius)return 0;
 const required=Math.sqrt(radius*radius-tangent),shift=Math.max(0,required-d);
 p.addScaledVector(normal,shift);return shift;
}
function shaderOffset(material){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{previous?.(shader);
  shader.vertexShader='attribute vec3 garmentOffset;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>','#include <skinning_vertex>\ntransformed += garmentOffset;');
 };
 material.customProgramCacheKey=()=>key+'-garment-collision-v1';material.needsUpdate=true;
}
export class GarmentCollision{
 constructor(model,bones){
  this.model=model;this.bones=bones;this.plans=[];this.proxies=[];
  this.report={vertices:0,corrected:0,maximumOffset:0};
  model.updateWorldMatrix(true,true);this.baseScale=model.getWorldScale(new T.Vector3()).x;
  const hips=['r','l'].map(s=>bones['thigh_'+s].getWorldPosition(new T.Vector3()));
  const hipHeight=(hips[0].y+hips[1].y)*.5;
  const candidates=[],kneeHeight=(bones.calf_r.getWorldPosition(new T.Vector3()).y+bones.calf_l.getWorldPosition(new T.Vector3()).y)*.5;
  model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;
   const bodyFabric=/body fabric/i.test(mesh.material.name);
   if(!bodyFabric&&!garmentMaterials.test(mesh.material.name))return;
   const hanging=bodyFabric?hangingBodyVertices(mesh,hipHeight,kneeHeight):null;
   const entries=[];mesh.skeleton.update();
   for(let v=0;v<mesh.geometry.attributes.position.count;v++){
    if(hanging&&!hanging.has(v))continue;
    mesh.getVertexPosition(v,point).applyMatrix4(mesh.matrixWorld);
    if(point.y>hipHeight+.08*this.baseScale)continue;
    const side=point.distanceToSquared(hips[0])<point.distanceToSquared(hips[1])?'r':'l';
    const bone=bones['thigh_'+side],a=bone.getWorldPosition(new T.Vector3()),b=bones['calf_'+side].getWorldPosition(new T.Vector3());
    axis.subVectors(b,a);const t=T.MathUtils.clamp(delta.subVectors(point,a).dot(axis)/axis.lengthSq(),0,1);
    const radial=point.clone().sub(a).addScaledVector(axis,-t);
    if(radial.length()<.025*this.baseScale)continue;
    radial.normalize().applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert());
    entries.push({id:v,side,outward:radial,clearance:/lining/i.test(mesh.material.name)?.010:/piping/i.test(mesh.material.name)?.022:.016,weight:T.MathUtils.smoothstep(hipHeight+.08*this.baseScale-point.y,0,.12*this.baseScale)});
   }
   if(entries.length)candidates.push({mesh,entries,ids:new Set(entries.map(e=>e.id))});
  });
  for(const side of ['r','l']){
   const bone=bones['thigh_'+side],a=bone.getWorldPosition(new T.Vector3()),b=bones['calf_'+side].getWorldPosition(new T.Vector3());
   const radii=[[],[]];axis.subVectors(b,a);
   model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const garment=candidates.find(p=>p.mesh===mesh)?.ids;
    const {skinIndex,skinWeight}=mesh.geometry.attributes,index=mesh.geometry.index,used=new Set(index?index.array:[]);mesh.skeleton.update();
    for(const v of used){if(garment?.has(v))continue;let weight=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[skinIndex.getComponent(v,k)].name==='thigh_'+side)weight+=skinWeight.getComponent(v,k);if(weight<.6)continue;
     mesh.getVertexPosition(v,point).applyMatrix4(mesh.matrixWorld);delta.subVectors(point,a);const t=delta.dot(axis)/axis.lengthSq();if(t<.06||t>.85)continue;
     const distance=delta.addScaledVector(axis,-t).length();radii[t<.45?0:1].push(distance);
    }
   });
   const quantile=(list,fallback)=>{list.sort((a,b)=>a-b);return list.length?list[Math.floor((list.length-1)*.96)]:fallback*this.baseScale;};
   this.proxies.push({side,bone,lower:bones['calf_'+side],a,b,r0:quantile(radii[0],.135),r1:quantile(radii[1],.105),q:new T.Quaternion()});
  }
  for(const {mesh,entries}of candidates){
   const original={geometry:mesh.geometry,material:mesh.material,depth:mesh.customDepthMaterial,distance:mesh.customDistanceMaterial};
   const geometry=mesh.geometry.clone(),material=mesh.material.clone();material.onBeforeCompile=mesh.material.onBeforeCompile;material.customProgramCacheKey=mesh.material.customProgramCacheKey;
   geometry.setAttribute('garmentOffset',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3),3).setUsage(T.DynamicDrawUsage));
   mesh.geometry=geometry;mesh.material=material;shaderOffset(material);
   mesh.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:material.side});
   mesh.customDistanceMaterial=new T.MeshDistanceMaterial({side:material.side});shaderOffset(mesh.customDepthMaterial);shaderOffset(mesh.customDistanceMaterial);
   this.plans.push({mesh,entries,original});this.report.vertices+=entries.length;
  }
  this.update();
 }
 update(){
  if(!this.plans.length)return;
  this.model.updateWorldMatrix(true,true);const scale=this.model.getWorldScale(worldScale).x/this.baseScale;
  for(const p of this.proxies){p.bone.getWorldPosition(p.a);p.lower.getWorldPosition(p.b);p.bone.getWorldQuaternion(p.q);}
  this.report.corrected=0;this.report.maximumOffset=0;
  for(const {mesh,entries}of this.plans){
   mesh.skeleton.update();inverse.copy(mesh.matrixWorld).invert();const offset=mesh.geometry.attributes.garmentOffset;
   for(const entry of entries){
    mesh.getVertexPosition(entry.id,point).applyMatrix4(mesh.matrixWorld);const original=originalPoint.copy(point),proxy=this.proxies[entry.side==='r'?0:1];
    const outward=outwardPoint.copy(entry.outward).applyQuaternion(proxy.q);
    const shift=projectGarmentPoint(point,proxy.a,proxy.b,proxy.r0*scale,proxy.r1*scale,outward,entry.clearance*this.baseScale*scale);
    point.lerp(original,1-entry.weight);const changed=point.distanceTo(original);this.report.maximumOffset=Math.max(this.report.maximumOffset,changed);
    if(shift>.0001)this.report.corrected++;
    point.applyMatrix4(inverse);original.applyMatrix4(inverse);point.sub(original);offset.setXYZ(entry.id,point.x,point.y,point.z);
   }
   offset.needsUpdate=true;
  }
 }
 dispose(){for(const {mesh,original}of this.plans){mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial.dispose();mesh.customDistanceMaterial.dispose();mesh.geometry=original.geometry;mesh.material=original.material;mesh.customDepthMaterial=original.depth;mesh.customDistanceMaterial=original.distance;}this.plans=[];}
}
