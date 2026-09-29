import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
const reviewed=JSON.parse(fs.readFileSync(new URL('./fixtures/monk-golf-sleeve.json',import.meta.url)));
const point=(rig,name)=>rig.scene.getObjectByName(name).getWorldPosition(new Vector3());
const key=(a,b)=>a.join(',')+' / '+b.join(',');
const allowedPairs=new Set(reviewed.pairs.map(pair=>key(pair.upper,pair.lower)));

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

export function checkReviewedSleeve({hero,side,frame,fold,bind,current}) {
 if(hero!=='monk'||side!==reviewed.side||frame<reviewed.frames[0]||frame>reviewed.frames[1])return false;
 assert.ok(fold.maxRadialPenetration<=reviewed.maxRadialProxy,'The reviewed sleeve overlap grew.');
 for(const witness of fold.radialWitnesses)assert.ok(witness.meshId===reviewed.meshId&&reviewed.radialWitnessVertices.includes(witness.vertex),'A new sleeve vertex entered the overlap.');
 for(const pair of fold.crossingPairs)assert.ok(pair.a.meshId===0&&pair.b.meshId===0&&allowedPairs.has(key(pair.a.vertices,pair.b.vertices)),'A new sleeve face pair intersects.');
 assertSleeveVolume(bind,current);
 return true;
}
