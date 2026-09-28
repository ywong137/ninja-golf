#!/usr/bin/env node
// Export an exact, posed surface for local photo-to-model camera fitting.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
const {values}=parseArgs({options:{model:{type:'string'},output:{type:'string'},landmarks:{type:'string'},anchors:{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log('node tools/export-vice-president-landmarks.mjs --model MODEL.glb --output SURFACE.json [--landmarks DETECTIONS.json]\nExports the exact three portrait cameras, posed head triangles, and local mesh coordinates on CPU.\nUse --anchors PREVIOUS_EXPORT.json to track the same barycentric points after a sculpt.\nOptional detections: {view: 0|1|2, points: [{id, x, y}]} in local 600 x 900 image pixels.\nThe raw photographs are never embedded. Glasses are excluded from surface intersections.');process.exit(0);}
if(values.landmarks&&values.anchors)throw Error('Choose --landmarks or --anchors, not both.');
if(!values.model||!values.output)throw Error('Supply --model and --output. See --help.');
const raw=fs.readFileSync(values.model),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
const g=await loadNativeSkin(values.model),clip=g.animations.find(c=>c.name==='Naginata_Selection_Idle');if(!clip)throw Error('Missing Naginata_Selection_Idle.');
g.mixer.clipAction(clip).play();g.mixer.update(.1);g.scene.updateMatrixWorld(true);
const world=name=>{const b=g.scene.getObjectByName(name);if(!b)throw Error('Missing '+name);return b.getWorldPosition(new T.Vector3());};
const eye=world('Bip01_REye').add(world('Bip01_LEye')).multiplyScalar(.5),target=eye.clone().add(new T.Vector3(0,-.014,0));
const cameras=[0,.6,1.45].map((angle,view)=>{const camera=new T.PerspectiveCamera(40,600/900,.01,20);camera.position.copy(target).add(new T.Vector3(Math.sin(angle)*.72,0,Math.cos(angle)*.72));camera.lookAt(target);camera.updateMatrixWorld(true);return camera;});
const meshes=[];g.scene.traverse(mesh=>{
 if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
 const position=mesh.geometry.attributes.position,index=mesh.geometry.index,points=Array.from({length:position.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
 const triangles=[];for(let i=0;i<(index?index.count:position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.every(id=>position.getY(id)>1.48))triangles.push(ids);}
 if(!triangles.length)return;
 const source=[];for(let meshIndex=0;meshIndex<doc.meshes.length;meshIndex++)for(let primitiveIndex=0;primitiveIndex<doc.meshes[meshIndex].primitives.length;primitiveIndex++){const p=doc.meshes[meshIndex].primitives[primitiveIndex];if(doc.accessors[p.attributes.POSITION].count===position.count)source.push({meshIndex,primitiveIndex,positionAccessor:p.attributes.POSITION});}
 if(source.length!==1)throw Error(`Ambiguous source correspondence for ${mesh.name}.`);
 meshes.push({name:mesh.name,source:source[0],vertexCount:position.count,bind:position.array,posed:points,triangles,matrixWorld:mesh.matrixWorld.toArray()});
});
const report={model:values.model,clip:clip.name,time:.1,coordinateSystem:'glTF metres; +X right on front image, +Y up, +Z forward',image:{width:600,height:900},cameras:cameras.map((c,i)=>({view:i,position:c.position.toArray(),target:target.toArray(),fov:c.fov,aspect:c.aspect,matrixWorld:c.matrixWorld.toArray(),projectionMatrix:c.projectionMatrix.toArray()})),meshes:meshes.map(m=>({...m,bind:Array.from(m.bind),posed:m.posed.map(p=>p.toArray())}))};
if(values.landmarks){
 const data=JSON.parse(fs.readFileSync(values.landmarks)),camera=cameras[data.view??0],raycaster=new T.Raycaster(),hit=new T.Vector3();
 if(!Array.isArray(data.points))throw Error('Detections must contain points: [{id,x,y}].');
 report.landmarks=data.points.map(p=>{
  raycaster.setFromCamera(new T.Vector2(p.x/600*2-1,1-p.y/900*2),camera);let best=null;
  for(let meshIndex=0;meshIndex<meshes.length;meshIndex++){
   const m=meshes[meshIndex];for(const ids of m.triangles){
    if(!raycaster.ray.intersectTriangle(...ids.map(i=>m.posed[i]),false,hit))continue;
    const distance=hit.distanceTo(camera.position);if(best&&distance>=best.distance)continue;
    const bary=T.Triangle.getBarycoord(hit,...ids.map(i=>m.posed[i]),new T.Vector3());
    const bind=ids.reduce((sum,id,k)=>sum.addScaledVector(new T.Vector3().fromArray(m.bind,id*3),bary.getComponent(k)),new T.Vector3());
    best={id:p.id,pixel:[p.x,p.y],meshIndex,mesh:m.name,source:m.source,vertices:ids,barycentric:bary.toArray(),posed:hit.toArray(),bind:bind.toArray(),distance};
   }
  }
  return best??{id:p.id,pixel:[p.x,p.y],missing:true};
 });
}
if(values.anchors){
 const original=JSON.parse(fs.readFileSync(values.anchors));
 report.landmarks=original.landmarks.map(p=>{
  if(p.missing)return p;const m=meshes.find(m=>m.name===p.mesh);if(!m)throw Error('Missing anchor mesh '+p.mesh);
  const posed=new T.Vector3(),bind=new T.Vector3();p.vertices.forEach((id,k)=>{posed.addScaledVector(m.posed[id],p.barycentric[k]);bind.addScaledVector(new T.Vector3().fromArray(m.bind,id*3),p.barycentric[k]);});
  return{...p,posed:posed.toArray(),bind:bind.toArray()};
 });
 report.anchorSource=values.anchors;
}
fs.writeFileSync(values.output,JSON.stringify(report));console.log(JSON.stringify({output:values.output,meshes:meshes.map(m=>({name:m.name,vertices:m.vertexCount,triangles:m.triangles.length})),landmarks:report.landmarks?.length,missing:report.landmarks?.filter(p=>p.missing).map(p=>p.id)}));
