import {Box3,Ray,Triangle,Vector3} from 'three';

const fittingCache=new WeakMap(),rayDirection=new Vector3(.917,.311,.252).normalize();
function fittingSurfaces(geometry){
 if(fittingCache.has(geometry))return fittingCache.get(geometry);
 const surfaces=(geometry.userData.fittingParts||[]).map(({start,count})=>{
  const triangles=[],box=new Box3();
  for(let i=start;i<start+count;i+=3){
   const vertices=[0,1,2].map(j=>new Vector3().fromBufferAttribute(geometry.attributes.position,i+j));
   vertices.forEach(v=>box.expandByPoint(v));triangles.push(new Triangle(...vertices));
  }
  return{triangles,box};
 });fittingCache.set(geometry,surfaces);return surfaces;
}

// Test utility. Skin weights select the hand; deformed vertices measure contact.
export function handSurface(model,side){
 const rows=[];
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex,skinWeight,position}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++){
   let total=0,largest=0,group='palm';
   for(let k=0;k<4;k++){
    const name=mesh.skeleton.bones[skinIndex.getComponent(i,k)].name;
    if(!name.endsWith('_'+side)||! /^(hand|thumb|index|middle|ring|pinky)_/.test(name))continue;
    const w=skinWeight.getComponent(i,k);total+=w;
    if(w>largest){largest=w;group=name.startsWith('hand_')?'palm':name.split('_')[0];}
   }
   if(total>.5)rows.push({mesh,index:i,group});
  }
 });
 return rows;
}

export function measureGripSurface(rows,held,radius){
 held.updateWorldMatrix(true,false);
 const inverse=held.matrixWorld.clone().invert(),groups={},fittings=[];
 held.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry.userData.fittingParts){mesh.updateWorldMatrix(true,false);fittings.push({matrix:mesh.matrixWorld.clone().invert().multiply(held.matrixWorld),surfaces:fittingSurfaces(mesh.geometry)});}});
 for(const mesh of new Set(rows.map(row=>row.mesh)))mesh.skeleton.update();
 const point=new Vector3(),local=new Vector3(),hit=new Vector3(),nearest=new Vector3(),ray=new Ray();
 let fittingPenetration=0,fittingVertices=0;
 for(const row of rows){
  row.mesh.getVertexPosition(row.index,point).applyMatrix4(row.mesh.matrixWorld).applyMatrix4(inverse);
  const distance=Math.hypot(point.x,point.z),gap=distance-radius;
  const group=groups[row.group]??={count:0,penetration:0,contactGap:Infinity,deepVertices:0};
  group.count++;group.penetration=Math.max(group.penetration,-gap);group.contactGap=Math.min(group.contactGap,Math.abs(gap));
  if(gap<-.002)group.deepVertices++;
  // Test actual closed fitting triangles separately. An infinite cylinder
  // cannot detect fingers through a guard, collar, or end ring.
  for(const fitting of fittings){
   local.copy(point).applyMatrix4(fitting.matrix);
   for(const {box,triangles}of fitting.surfaces){
    if(!box.containsPoint(local))continue;
    const distances=[];ray.set(local,rayDirection);
    for(const triangle of triangles)if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit))distances.push(local.distanceTo(hit));
    distances.sort((a,b)=>a-b);const crossings=distances.filter((v,i)=>i===0||v-distances[i-1]>1e-7);
    if(crossings.length%2===0)continue;
    let depth=Infinity;for(const triangle of triangles){triangle.closestPointToPoint(local,nearest);depth=Math.min(depth,local.distanceTo(nearest));}
    fittingPenetration=Math.max(fittingPenetration,depth);if(depth>.001)fittingVertices++;
   }
  }
 }
 return {groups,maxPenetration:Math.max(...Object.values(groups).map(g=>g.penetration)),fittingPenetration,fittingVertices};
}
