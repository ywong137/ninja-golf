import {Vector3} from 'three';

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
 const inverse=held.matrixWorld.clone().invert(),groups={};
 for(const mesh of new Set(rows.map(row=>row.mesh)))mesh.skeleton.update();
 const point=new Vector3();
 for(const row of rows){
  row.mesh.getVertexPosition(row.index,point).applyMatrix4(row.mesh.matrixWorld).applyMatrix4(inverse);
  const distance=Math.hypot(point.x,point.z),gap=distance-radius;
  const group=groups[row.group]??={count:0,penetration:0,contactGap:Infinity,deepVertices:0};
  group.count++;group.penetration=Math.max(group.penetration,-gap);group.contactGap=Math.min(group.contactGap,Math.abs(gap));
  if(gap<-.002)group.deepVertices++;
 }
 return {groups,maxPenetration:Math.max(...Object.values(groups).map(g=>g.penetration))};
}
