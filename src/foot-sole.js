import {Quaternion,Vector3} from 'three';

/** Exact two-bone sole skinning, independent of the rest of the rendered mesh. */
export class ArticulatedSole {
 constructor(foot,ball,vertices){
  if(ball.parent!==foot)throw Error('The toe joint must be a direct child of the foot.');
  this.foot=foot;this.ball=ball;
  this.vertices=vertices.map(({mesh,vertex})=>{
   if(mesh.bindMode!=='attached')throw Error('Articulated sole requires an attached skinned mesh.');
   const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
   const bind=new Vector3().fromBufferAttribute(position,vertex).applyMatrix4(mesh.bindMatrix),weights=[];
   let total=0;
   for(let k=0;k<4;k++){
    const weight=skinWeight.getComponent(vertex,k);if(!weight)continue;
    const index=skinIndex.getComponent(vertex,k),bone=mesh.skeleton.bones[index];
    if(bone!==foot&&bone!==ball)throw Error(`Unexpected sole influence: ${bone.name}`);
    weights.push({toe:bone===ball,weight,point:bind.clone().applyMatrix4(mesh.skeleton.boneInverses[index])});total+=weight;
   }
   if(Math.abs(total-1)>1e-5)throw Error('Sole skin weights must sum to one.');
   return weights;
  });
 }
 // Return offsets in the foot's world scale, before its world rotation.
 // A predicted source frame can supply its own local toe rotation.
 points(toeRotation=this.ball.quaternion){
  const ankle=this.foot.getWorldPosition(new Vector3()),inverse=this.foot.getWorldQuaternion(new Quaternion()).normalize().invert(),ball=this.ball;
  return this.vertices.map(weights=>{
   const result=new Vector3();
   for(const {toe,weight,point}of weights){
    const p=point.clone();if(toe)p.multiply(ball.scale).applyQuaternion(toeRotation).add(ball.position);
    result.addScaledVector(p,weight);
   }
   // Imported hierarchies can contain tiny nonuniform scales. Retain their
   // complete linear transform instead of reducing it to three scale values.
   return result.applyMatrix4(this.foot.matrixWorld).sub(ankle).applyQuaternion(inverse);
  });
 }
}

/** Capture the visible sole in bind pose. Retain the original skin weights. */
export function captureFootSoles(root){
 root.updateMatrixWorld(true);const sides={r:[],l:[]};
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<position.count;i++)for(const side of ['r','l']){
   let weight=0;
   for(let k=0;k<4;k++)if(['foot_'+side,'ball_'+side].includes(mesh.skeleton.bones[skinIndex.getComponent(i,k)].name))weight+=skinWeight.getComponent(i,k);
   if(weight<.90-1e-6)continue;
   const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
   sides[side].push({mesh,vertex:i,bind:p});
  }
 });
 for(const side of ['r','l']){
  const vertices=sides[side];if(!vertices.length)throw Error('Missing foot surface for '+side);
  const floor=Math.min(...vertices.map(v=>v.bind.y));
  sides[side]=vertices.filter(v=>v.bind.y<floor+.018);
 }
 return sides;
}

export function sampleFootSole(vertices){
 for(const mesh of new Set(vertices.map(v=>v.mesh)))mesh.skeleton.update();
 return vertices.map(v=>v.mesh.getVertexPosition(v.vertex,new Vector3()).applyMatrix4(v.mesh.matrixWorld));
}

/** Bind-space support spans the shoe, not the toe joint inside it. */
export function soleSupportAnchors(foot,ball,vertices){
 const ankle=foot.getWorldPosition(new Vector3());
 const forward=ball.getWorldPosition(new Vector3()).sub(ankle).setY(0).normalize();
 if(forward.lengthSq()<.99||!vertices.length)throw Error('Sole support needs a measurable foot direction and surface.');
 const right=new Vector3(0,1,0).cross(forward);
 const points=vertices.map(v=>({p:v.bind,along:v.bind.clone().sub(ankle).dot(forward),across:v.bind.clone().sub(ankle).dot(right)}));
 const front=Math.max(...points.map(v=>v.along)),back=Math.min(...points.map(v=>v.along));
 const floor=Math.min(...points.map(v=>v.p.y)),width=(front-back)*.06;
 const inverse=foot.getWorldQuaternion(new Quaternion()).invert();
 return [front,back].map(station=>{
  const edge=points.filter(v=>Math.abs(v.along-station)<=width);
  const across=(Math.min(...edge.map(v=>v.across))+Math.max(...edge.map(v=>v.across)))*.5;
  const contact=ankle.clone().addScaledVector(forward,station).addScaledVector(right,across);contact.y=floor;
  return contact.sub(ankle).applyQuaternion(inverse);
 });
}
