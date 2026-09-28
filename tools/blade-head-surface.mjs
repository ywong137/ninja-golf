// Browser-safe geometry checks for skinned head surfaces.
import * as T from 'three';

const boxGap=(a,b)=>Math.hypot(...['x','y','z'].map(k=>Math.max(a.min[k]-b.max[k],b.min[k]-a.max[k],0)));
function segmentDistance(a,b,c,d){
 const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w),den=aa*cc-bb*bb;
 let distance=Math.min(...[[a,c,d],[b,c,d],[c,a,b],[d,a,b]].map(([p,a,b])=>new T.Line3(a,b).closestPointToPoint(p,true,new T.Vector3()).distanceTo(p)));
 if(den>1e-12){const s=(bb*ee-cc*dd)/den,t=(aa*ee-bb*dd)/den;if(s>=0&&s<=1&&t>=0&&t<=1)distance=Math.min(distance,a.clone().addScaledVector(u,s).distanceTo(c.clone().addScaledVector(v,t)));}
 return distance;
}
function triangleDistance(a,b){
 const ray=new T.Ray(),hit=new T.Vector3();
 for(const [p,q]of [[a,b],[b,a]])for(let k=0;k<3;k++){
  const direction=p[(k+1)%3].clone().sub(p[k]),length=direction.length();if(length<1e-12)continue;
  ray.set(p[k],direction.divideScalar(length));
  if(ray.intersectTriangle(...q,false,hit)&&hit.distanceTo(p[k])<=length+1e-9)return 0;
 }
 const ta=new T.Triangle(...a),tb=new T.Triangle(...b);let distance=Infinity;
 for(const p of a)distance=Math.min(distance,p.distanceTo(tb.closestPointToPoint(p,new T.Vector3())));
 for(const p of b)distance=Math.min(distance,p.distanceTo(ta.closestPointToPoint(p,new T.Vector3())));
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)distance=Math.min(distance,segmentDistance(a[i],a[(i+1)%3],b[j],b[(j+1)%3]));
 return distance;
}

export function headSurfaceMetadata(g){
 const head=g.scene.getObjectByName('Head');if(!head)throw Error('Missing Head bone.');
 const descendants=new Set();head.traverse(b=>{if(b.isBone)descendants.add(b.name);});
 const surfaces=[];
 g.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex:ids,skinWeight:weights}=mesh.geometry.attributes,names=mesh.skeleton.bones.map(b=>b.name),index=mesh.geometry.index;
  const headWeight=Array.from({length:ids.count},(_,i)=>{let sum=0;for(let k=0;k<4;k++)if(descendants.has(names[ids.getComponent(i,k)]))sum+=weights.getComponent(i,k);return sum;});
  const triangles=[];
  for(let i=0;i<(index?index.count:ids.count);i+=3){const vertices=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(vertices.some(v=>headWeight[v]>.5))triangles.push(vertices);}
  if(triangles.length)surfaces.push({mesh,triangles});
 });
 if(!surfaces.length)throw Error('No skinned head surfaces found.');
 return surfaces;
}

export function measureBladeHeadClearance(surfaces,weapons,{distanceCap=.03}={}){
 const head=[],headBox=new T.Box3();
 for(const {mesh,triangles}of surfaces){
  mesh.skeleton.update();const cache=new Map();
  for(const ids of triangles){const points=ids.map(i=>{if(!cache.has(i))cache.set(i,mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));return cache.get(i);});for(const p of points)headBox.expandByPoint(p);head.push({points,box:new T.Box3().setFromPoints(points),mesh:mesh.name});}
 }
 let minimum=distanceCap,closest=null,crossings=0;
 for(const [side,weapon]of Object.entries(weapons)){
  const blade=weapon.getObjectByName('Flat steel blade');if(!blade)throw Error('Weapon lacks its actual blade mesh.');
  const pos=blade.geometry.attributes.position,index=blade.geometry.index,vertices=Array.from({length:pos.count},(_,i)=>new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(blade.matrixWorld));
  if(boxGap(new T.Box3().setFromPoints(vertices),headBox)>=distanceCap)continue;
  for(let i=0;i<(index?index.count:pos.count);i+=3){
   const points=[0,1,2].map(k=>vertices[index?index.getX(i+k):i+k]),box=new T.Box3().setFromPoints(points);
   for(const surface of head){
    if(boxGap(box,surface.box)>Math.max(minimum,1e-8))continue;
    const distance=triangleDistance(points,surface.points);
    if(distance<1e-7)crossings++;
    if(distance<minimum){minimum=distance;closest={side,headMesh:surface.mesh};}
   }
  }
 }
 return{minimumClearance:minimum,clearanceCappedAt:distanceCap,crossings,closest};
}

