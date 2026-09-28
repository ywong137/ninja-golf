import {Vector3,Triangle} from 'three';

// Conservative capsule clearance around the finite handle. Dense axis samples
// query actual deformed body triangles, including the trousers and vest.
export function selectionHandleClearance(actor,held=actor.weapon){
 const grip=held.getObjectByName('Wrapped hand grip');
 if(!grip)throw Error('A finite handle mesh is required');
 actor.root.updateMatrixWorld(true);grip.geometry.computeBoundingBox();
 const box=grip.geometry.boundingBox,low=held.worldToLocal(grip.localToWorld(new Vector3(0,box.min.y,0))),high=held.worldToLocal(grip.localToWorld(new Vector3(0,box.max.y,0)));
 const radius=Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),inverse=held.matrixWorld.clone().invert(),triangles=[];
 actor.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes,index=mesh.geometry.index;
  const weight=i=>{let value=0;for(let k=0;k<4;k++)if(/^(pelvis|spine_|thigh_|calf_)/.test(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))value+=skinWeight.getComponent(i,k);return value;};
  const points=new Map(),point=i=>{if(!points.has(i))points.set(i,mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));return points.get(i);};
  for(let i=0;i<(index?.count??position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.reduce((sum,j)=>sum+weight(j),0)/3>.5)triangles.push(new Triangle(...ids.map(point)));}
 });
 let clearance=Infinity;const sample=new Vector3(),closest=new Vector3(),count=Math.ceil(low.distanceTo(high)/.005);
 for(let i=0;i<=count;i++){
  sample.copy(low).lerp(high,i/count);
  for(const triangle of triangles){triangle.closestPointToPoint(sample,closest);clearance=Math.min(clearance,sample.distanceTo(closest)-radius);}
 }
 return {clearance,axisSamples:count+1,bodyTriangles:triangles.length};
}
