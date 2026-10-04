import {withoutMusouTarget} from './without-musou-target.mjs';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from 'three';
import {refineVicePresidentOrbit,splitOrbitTriangle} from '../tools/refine-vice-president-orbit.mjs';
import {readModel,packedStream,serializeModel} from '../tools/preserve-vice-president-head.mjs';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {FacialPose,FACIAL_LIMITS} from '../src/facial-pose.js';
import {measureFace} from '../tools/audit-facial-pose.mjs';

const sourcePath=new URL('../public/models/monk.glb',import.meta.url);
const sourceBytes=fs.readFileSync(sourcePath),before=withoutMusouTarget(readModel(sourceBytes));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ninja-orbit-test-'));
const candidatePath=path.join(temporary,'refined.glb');
const generated=refineVicePresidentOrbit(withoutMusouTarget(readModel(sourceBytes)));
fs.writeFileSync(candidatePath,serializeModel(generated.model));
const result=readModel(fs.readFileSync(candidatePath));
after(()=>{fs.rmSync(temporary,{recursive:true,force:true});assert.deepEqual(fs.readFileSync(sourcePath),sourceBytes,'The published source must not change.');});

function head(model){
 const matches=model.doc.meshes.flatMap((mesh,mi)=>mesh.primitives.map((p,pi)=>({p,mi,pi}))).filter(({p})=>model.doc.materials[p.material]?.name==='m009_head');
 assert.equal(matches.length,1);return matches[0];
}
function values(model,id){
 const a=model.doc.accessors[id],bytes=packedStream(model,id),components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 const size={5121:1,5123:2,5125:4,5126:4}[a.componentType];
 return Array.from({length:a.count},(_,i)=>Array.from({length:components},(_,k)=>{
  const offset=(i*components+k)*size;
  return a.componentType===5126?bytes.readFloatLE(offset):size===1?bytes.readUInt8(offset):size===2?bytes.readUInt16LE(offset):bytes.readUInt32LE(offset);
 }));
}
function geometry(model){
 const {p,mi}=head(model),positions=values(model,p.attributes.POSITION).map(v=>new T.Vector3(...v)),indices=values(model,p.indices).flat();
 const triangles=Array.from({length:indices.length/3},(_,i)=>indices.slice(i*3,i*3+3));
 return {positions,triangles,faces:triangles.map(ids=>new T.Triangle(...ids.map(i=>positions[i]))),mi};
}
const source=geometry(before),refined=geometry(result),oldHead=head(before),newHead=head(result);
const triangleKey=ids=>ids.join(','),positionKey=p=>p.toArray().map(x=>Math.round(x*1e7)).join(',');
function geometricEdges(g){
 const edges=new Map();
 for(const tri of g.triangles)for(let k=0;k<3;k++){
  const a=g.positions[tri[k]],b=g.positions[tri[(k+1)%3]],ka=positionKey(a),kb=positionKey(b);
  if(ka===kb)continue;
  const key=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;
  if(!edges.has(key))edges.set(key,{a,b,count:0});edges.get(key).count++;
 }
 return edges;
}
const oldEdges=geometricEdges(source),newEdges=geometricEdges(refined);

test('Orbital refinement keeps original streams, unrelated payloads, and the complete rig',()=>{
 assert.ok(refined.positions.length>source.positions.length,'The test must exercise actual refinement.');
 assert.deepEqual(result.bin.subarray(0,before.bin.length),before.bin);
 assert.deepEqual(result.doc.accessors.slice(0,before.doc.accessors.length),before.doc.accessors);
 assert.deepEqual(result.doc.bufferViews.slice(0,before.doc.bufferViews.length),before.doc.bufferViews);
 for(const [name,id]of Object.entries(oldHead.p.attributes)){
  const old=packedStream(before,id),current=packedStream(result,newHead.p.attributes[name]);
  assert.deepEqual(current.subarray(0,old.length),old,`Original ${name} vertices changed.`);
 }
 for(const [key,value]of Object.entries(before.doc)){
  if(['meshes','accessors','bufferViews','buffers','extras'].includes(key))continue;
  assert.deepEqual(result.doc[key],value,`${key} changed outside the head refinement.`);
 }
 for(const [key,value]of Object.entries(before.doc.extras??{}))assert.deepEqual(result.doc.extras[key],value);
 const meshes=structuredClone(result.doc.meshes);meshes[newHead.mi].primitives[newHead.pi]=oldHead.p;
 assert.deepEqual(meshes,before.doc.meshes);
 const oldPrimitive={...oldHead.p},newPrimitive={...newHead.p};
 delete oldPrimitive.attributes;delete oldPrimitive.indices;delete newPrimitive.attributes;delete newPrimitive.indices;
 assert.deepEqual(newPrimitive,oldPrimitive);
});

test('The unchanged crease and eyeballs retain their triangles, and no new geometric boundary appears',()=>{
 const resultTriangles=new Set(refined.triangles.map(triangleKey));
 const protectedTriangles=source.triangles.filter(ids=>Math.max(...ids.map(i=>source.positions[i].y))<=1.6876);
 assert.ok(protectedTriangles.length>100);
 for(const ids of protectedTriangles){
  assert.ok(resultTriangles.has(triangleKey(ids)),`Protected crease triangle ${ids} changed.`);
  for(let k=0;k<3;k++){
   const a=positionKey(source.positions[ids[k]]),b=positionKey(source.positions[ids[(k+1)%3]]);if(a===b)continue;
   const key=a<b?`${a}|${b}`:`${b}|${a}`;
   assert.equal(newEdges.get(key)?.count,oldEdges.get(key).count,'A protected shared edge split or opened.');
  }
 }
 // Classify the rigid eye components from the actual rig, independently of
 // the author's exclusion list or report.
 const skin=before.doc.skins[before.doc.nodes.find(n=>n.mesh===source.mi).skin];
 const joints=values(before,oldHead.p.attributes.JOINTS_0),weights=values(before,oldHead.p.attributes.WEIGHTS_0);
 const eye=new Set();
 joints.forEach((js,i)=>{let amount=0;js.forEach((j,k)=>{if(/^Bip01[ _][RL]Eye$/.test(before.doc.nodes[skin.joints[j]].name))amount+=weights[i][k];});if(amount>.9)eye.add(i);});
 assert.ok(eye.size>100);
 const eyeTriangles=g=>g.triangles.filter(t=>t.every(i=>eye.has(i)));
 assert.ok(eyeTriangles(source).length>200);assert.deepEqual(eyeTriangles(refined),eyeTriangles(source));
 // A T-junction leaves an unmatched long edge and unmatched smaller edges.
 // Every output boundary must instead lie on an original boundary with the
 // same incidence. Weld only coincident geometry, keeping UV seams separate.
 const oldSpecial=[...oldEdges.values()].filter(e=>e.count!==2);
 for(const [key,e]of newEdges){
  if(e.count===2)continue;
  assert.ok(oldSpecial.some(old=>{
   if(old.count!==e.count)return false;
   const line=new T.Line3(old.a,old.b);
   return line.closestPointToPoint(e.a,true,new T.Vector3()).distanceTo(e.a)<2e-7&&line.closestPointToPoint(e.b,true,new T.Vector3()).distanceTo(e.b)<2e-7;
  }),`New unmatched or nonmanifold geometric edge ${key}, incidence ${e.count}.`);
 }
});

// Recover ancestry from the serialized geometry, not from newVertexParents or
// the author's sourceSurface assertions. This also catches a wrong report.
let correspondence;
function sourceCorrespondence(){
 if(correspondence)return correspondence;
 const exact=new Map(source.triangles.map((t,i)=>[triangleKey(t),i]));
 const boxes=source.faces.map(t=>new T.Box3().setFromPoints([t.a,t.b,t.c]).expandByScalar(2e-7));
 const parent=[],vertexParent=new Map(),areas=new Float64Array(source.faces.length);
 for(let i=0;i<refined.faces.length;i++){
  const tri=refined.faces[i],ids=refined.triangles[i],center=tri.getMidpoint(new T.Vector3());
  let found=exact.get(triangleKey(ids));
  if(found===undefined){
   const candidates=[];
   source.faces.forEach((old,j)=>{
    if(!boxes[j].containsPoint(center))return;
    const distances=[tri.a,tri.b,tri.c].map(p=>old.closestPointToPoint(p,new T.Vector3()).distanceTo(p));
    if(Math.max(...distances)>2e-7)return;
    if(old.getNormal(new T.Vector3()).dot(tri.getNormal(new T.Vector3()))<.99999)return;
    candidates.push({j,error:Math.max(...distances)});
   });
   candidates.sort((a,b)=>a.error-b.error);assert.ok(candidates.length,`Triangle ${i} left its source surface or reversed winding.`);found=candidates[0].j;
  }
  const old=source.faces[found],normal=old.getNormal(new T.Vector3());
  if(old.getArea()>1e-14)assert.ok(normal.dot(tri.getNormal(new T.Vector3()))>.99999,`Triangle ${i} reversed winding.`);
  areas[found]+=tri.getArea();parent.push(found);
  ids.forEach(id=>{if(id>=source.positions.length&&!vertexParent.has(id))vertexParent.set(id,{triangle:found,barycentric:old.getBarycoord(refined.positions[id],new T.Vector3())});});
 }
 source.faces.forEach((old,i)=>{
  const perimeter=old.a.distanceTo(old.b)+old.b.distanceTo(old.c)+old.c.distanceTo(old.a);
  assert.ok(Math.abs(areas[i]-old.getArea())<perimeter*2e-7+1e-12,`Source triangle ${i} gained overlapping area or lost area.`);
 });
 correspondence={parent,vertexParent};return correspondence;
}

test('Every serialized triangle preserves the original surface, area, and winding',()=>{
 const {vertexParent}=sourceCorrespondence();
 assert.equal(vertexParent.size,refined.positions.length-source.positions.length);
});

test('Every edge-split case preserves a skewed triangle without reversing winding',()=>{
 for(let mask=0;mask<8;mask++){
  const p=[[0,0,0],[1,0,0],[.2,.8,0]],mids=new Map();
  for(let k=0;k<3;k++)if(mask&(1<<k)){
   const a=k,b=(k+1)%3,key=a<b?`${a}:${b}`:`${b}:${a}`;mids.set(key,p.length);p.push(p[a].map((v,j)=>(v+p[b][j])/2));
  }
  const output=splitOrbitTriangle([0,1,2],mids,p);let area=0;
  for(const ids of output){const tri=new T.Triangle(...ids.map(i=>new T.Vector3(...p[i])));assert.ok(tri.getNormal(new T.Vector3()).z>.99999);area+=tri.getArea();}
  assert.ok(Math.abs(area-.4)<1e-12,`Split mask ${mask} lost or duplicated area.`);
 }
});

async function facialRig(file){
 const g=await loadNativeSkin(file),bones={},meshes=[];
 g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh)meshes.push(o);});
 const update=()=>{g.scene.updateMatrixWorld(true);meshes.forEach(m=>m.skeleton.update());};update();
 return {scene:g.scene,bones,meshes,update};
}

test('The refined face passes real expression limits and keeps the original posed vertices',async()=>{
 const rigs=await Promise.all([facialRig(sourcePath),facialRig(candidatePath)]);
 const poses=rigs.map(r=>new FacialPose(r.bones,{identity:'monk'})),meshes=rigs.map(r=>r.meshes.find(m=>m.name==='Mesh_1'));
 const meter=measureFace(rigs[1]),rest=meter.measure();
 for(const side of ['R','L'])assert.ok(rest.eyes[side].restSamples>200);
 const {vertexParent}=sourceCorrespondence();
 for(const [ys,ps]of [[-1,-1],[-1,1],[1,-1],[1,1]]){
  for(let frame=0;frame<90;frame++)for(const pose of poses){pose.restore();pose.apply(1/60,{gazeYaw:ys*FACIAL_LIMITS.gazeYaw,gazePitch:ps*FACIAL_LIMITS.gazePitch,exertion:1,musou:1});}
  rigs.forEach(r=>r.update());const measured=meter.measure();
  assert.equal(measured.flippedTriangles,0,JSON.stringify(measured.flippedRegions));
  assert.ok(measured.penetrationIncrease<.0005);
  assert.ok(measured.maxLidDisplacement<.0015);
  assert.ok(measured.maxLongEdgeStretch<1.5);
  assert.ok(measured.minEdgeRatio>.5);
  for(const side of ['R','L'])assert.ok(measured.eyes[side].openFraction>.92,`${side}: eye aperture regressed.`);
  const posed=meshes.map((mesh,j)=>Array.from({length:j?refined.positions.length:source.positions.length},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld)));
  for(let i=0;i<source.positions.length;i++)assert.ok(posed[0][i].distanceTo(posed[1][i])<1e-10,`Original vertex ${i} changed under facial animation.`);
  for(const [i,{triangle,barycentric:b}]of vertexParent){
   const ids=source.triangles[triangle],expected=new T.Vector3().addScaledVector(posed[0][ids[0]],b.x).addScaledVector(posed[0][ids[1]],b.y).addScaledVector(posed[0][ids[2]],b.z);
   assert.ok(expected.distanceTo(posed[1][i])<.0005,`New vertex ${i} exceeds the existing half-millimetre facial clearance scale.`);
  }
 }
 poses.forEach(p=>p.restore());rigs.forEach(r=>r.update());assert.deepEqual(meter.measure(),rest);
});
