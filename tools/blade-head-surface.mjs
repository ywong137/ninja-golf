// Browser-safe geometry checks for skinned head surfaces.
import * as T from 'three';

const boxGap=(a,b)=>Math.hypot(Math.max(a.min.x-b.max.x,b.min.x-a.max.x,0),Math.max(a.min.y-b.max.y,b.min.y-a.max.y,0),Math.max(a.min.z-b.max.z,b.min.z-a.max.z,0));
const surfaceCaches=new WeakMap();

function buildTree(triangles){
 const box=new T.Box3();for(const triangle of triangles)box.union(triangle.box);
 if(triangles.length<=8)return{box,triangles};
 const extent=box.getSize(new T.Vector3()),axis=extent.x>=extent.y&&extent.x>=extent.z?'x':extent.y>=extent.z?'y':'z';
 const ordered=triangles.slice().sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis])),middle=Math.floor(ordered.length/2);
 return{box,left:buildTree(ordered.slice(0,middle)),right:buildTree(ordered.slice(middle))};
}
function refitTree(node){
 node.box.makeEmpty();
 if(node.triangles)for(const triangle of node.triangles)node.box.union(triangle.box);
 else node.box.union(refitTree(node.left)).union(refitTree(node.right));
 return node.box;
}
function deformHead(surfaces){
 let cache=surfaceCaches.get(surfaces);
 if(!cache){
  const meshes=surfaces.map(({mesh,triangles})=>{
   const vertices=new Map();
   for(const ids of triangles)for(const id of ids)if(!vertices.has(id))vertices.set(id,new T.Vector3());
   return{mesh,vertices,triangles:triangles.map(ids=>({points:ids.map(id=>vertices.get(id)),box:new T.Box3(),mesh:mesh.name}))};
  });
  cache={meshes,triangles:meshes.flatMap(mesh=>mesh.triangles),tree:null};surfaceCaches.set(surfaces,cache);
 }
 for(const {mesh,vertices,triangles}of cache.meshes){
  mesh.skeleton.update();
  for(const [id,point]of vertices)mesh.getVertexPosition(id,point).applyMatrix4(mesh.matrixWorld);
  for(const triangle of triangles)triangle.box.setFromPoints(triangle.points);
 }
 // Topology stays fixed. Refit every bound after skin deformation; never reuse
 // a bind-pose box to reject a possible contact in an animated pose.
 if(cache.tree)refitTree(cache.tree);else cache.tree=buildTree(cache.triangles);
 return cache;
}
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

// Each named query contains world-space triangles: {name: [[Vector3, Vector3, Vector3], ...]}.
// The caller owns query deformation; this function updates the head skin and BVH.
export function measureTriangleHeadClearance(surfaces,triangleSets,{distanceCap=.03,bruteForce=false}={}){
 if(!(distanceCap>0&&Number.isFinite(distanceCap)))throw Error('distanceCap must be a positive finite distance.');
 const head=deformHead(surfaces),headBox=head.tree.box;
 let minimum=distanceCap,closest=null,crossings=0;
 for(const [source,triangles]of Object.entries(triangleSets)){
  const queryBox=new T.Box3();
  for(const points of triangles){
   if(points.length!==3||points.some(p=>!p?.isVector3||![p.x,p.y,p.z].every(Number.isFinite)))throw Error(source+': supply three finite world-space Vector3 points per triangle.');
   for(const point of points)queryBox.expandByPoint(point);
  }
  if(boxGap(queryBox,headBox)>=distanceCap)continue;
  for(const points of triangles){
   const box=new T.Box3().setFromPoints(points);
   const compare=surface=>{
    if(boxGap(box,surface.box)>Math.max(minimum,1e-8))return;
    const distance=triangleDistance(points,surface.points);
    if(distance<1e-7)crossings++;
    if(distance<minimum){minimum=distance;closest={source,headMesh:surface.mesh};}
   };
   if(bruteForce){for(const surface of head.triangles)compare(surface);continue;}
   const stack=[head.tree];
   while(stack.length){
    const node=stack.pop();if(boxGap(box,node.box)>Math.max(minimum,1e-8))continue;
    if(node.triangles)for(const surface of node.triangles)compare(surface);
    else stack.push(node.left,node.right);
   }
  }
 }
 return{minimumClearance:minimum,clearanceCappedAt:distanceCap,crossings,closest};
}

export function measureBladeHeadClearance(surfaces,weapons,options={}){
 const triangles={};
 for(const [side,weapon]of Object.entries(weapons)){
  const blade=weapon.getObjectByName('Flat steel blade');if(!blade)throw Error('Weapon lacks its actual blade mesh.');
  const pos=blade.geometry.attributes.position,index=blade.geometry.index,vertices=Array.from({length:pos.count},(_,i)=>new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(blade.matrixWorld));
  triangles[side]=[];
  for(let i=0;i<(index?index.count:pos.count);i+=3)triangles[side].push([0,1,2].map(k=>vertices[index?index.getX(i+k):i+k]));
 }
 const result=measureTriangleHeadClearance(surfaces,triangles,options);
 if(result.closest)result.closest={side:result.closest.source,headMesh:result.closest.headMesh};
 return result;
}
