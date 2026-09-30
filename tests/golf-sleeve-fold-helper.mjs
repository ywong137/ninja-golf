import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Vector3,Ray} from 'three';
const reviewed=JSON.parse(fs.readFileSync(new URL('./fixtures/monk-golf-sleeve.json',import.meta.url)));
const point=(rig,name)=>rig.scene.getObjectByName(name).getWorldPosition(new Vector3());
const key=(a,b)=>a.join(',')+' / '+b.join(',');
const allowedPairs=new Set(reviewed.pairs.map(pair=>key(pair.upper,pair.lower)));
const pairLimits=new Map(reviewed.pairs.map(pair=>[key(pair.upper,pair.lower),pair.maxIntersectionLength]));

// The radial proxy samples vertices. This separate edge/face check bounds the
// length of each non-coplanar intersection, including crossings between vertices.
export function intersectionSegmentLength(a,b) {
 const points=[],ray=new Ray(),hit=new Vector3();
 for(const [edges,face] of [[a,b],[b,a]])for(let k=0;k<3;k++){
  const start=edges[k],delta=edges[(k+1)%3].clone().sub(start),length=delta.length();
  if(length<1e-9)continue;
  ray.set(start,delta.multiplyScalar(1/length));
  if(ray.intersectTriangle(...face,false,hit)&&hit.distanceTo(start)<=length+1e-8&&
     !points.some(p=>p.distanceToSquared(hit)<1e-16))points.push(hit.clone());
 }
 let length=0;
 for(const a of points)for(const b of points)length=Math.max(length,a.distanceTo(b));
 return length;
}

export function measureSleeveIntersection(surfaces,pair) {
 const posed=part=>{
  const mesh=surfaces.meshes[part.meshId];mesh.skeleton.update();
  return part.vertices.map(id=>mesh.getVertexPosition(id,new Vector3()).applyMatrix4(mesh.matrixWorld));
 };
 return intersectionSegmentLength(posed(pair.a),posed(pair.b));
}

export function captureSleeveShape(rig,surfaces) {
 const mesh=surfaces.meshes[reviewed.meshId],origin=point(rig,'lowerarm_l');
 const vector=point(rig,'hand_l').sub(origin),length=vector.length(),axis=vector.normalize();
 mesh.skeleton.update();
 return {length,vertices:Object.fromEntries(Object.keys(reviewed.radiusVertices).map(id=>{
  const offset=mesh.getVertexPosition(Number(id),new Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin);
  const axial=offset.dot(axis),radius=offset.addScaledVector(axis,-axial).length();
  return[id,{radius,axial}];
 }))};
}

export function assertSleeveVolume(bind,current) {
 assert.ok(Math.abs(current.length-bind.length)<1e-5,'The reviewed sleeve changed forearm length.');
 for(const [id,rest]of Object.entries(bind.vertices)){
  assert.ok(Math.abs(rest.radius-reviewed.radiusVertices[id])<1e-5,'Sleeve topology changed; review the vertex fixture.');
  assert.ok(rest.radius-current.vertices[id].radius<.001,`Sleeve vertex ${id} loses radius through axial collapse.`);
  assert.ok(Math.abs(rest.axial-current.vertices[id].axial)<1e-4,`Sleeve vertex ${id} changed its native axial position.`);
 }
}

export function checkReviewedSleeve({hero,side,frame,fold,bind,current,surfaces}) {
 if(hero!=='monk'||side!==reviewed.side||frame<reviewed.frames[0]||frame>reviewed.frames[1])return false;
 assert.ok(fold.maxRadialPenetration<=reviewed.maxRadialProxy,'The reviewed sleeve overlap grew.');
 for(const witness of fold.radialWitnesses)assert.ok(witness.meshId===reviewed.meshId&&reviewed.radialWitnessVertices.includes(witness.vertex),'A new sleeve vertex entered the overlap.');
 for(const pair of fold.crossingPairs){
  const id=key(pair.a.vertices,pair.b.vertices);
  assert.ok(pair.a.meshId===reviewed.meshId&&pair.b.meshId===reviewed.meshId&&allowedPairs.has(id),'A new sleeve face pair intersects.');
  assert.ok(Number.isFinite(pairLimits.get(id)),'Review an intersection-length bound for each sleeve pair.');
  assert.ok(measureSleeveIntersection(surfaces,pair)<=pairLimits.get(id),`The reviewed sleeve intersection grew: ${id}.`);
 }
 assertSleeveVolume(bind,current);
 return true;
}
