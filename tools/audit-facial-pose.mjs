import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FacialPose,EXPRESSION} from '../src/facial-pose.js';
globalThis.ProgressEvent??=class{};
export async function loadFace(hero){
 const file=fs.readFileSync(new URL(`../public/models/${hero}.glb`,import.meta.url)),length=file.readUInt32LE(12),json=JSON.parse(file.subarray(20,20+length)),bin=file.subarray(28+length);
 json.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');delete json.images;delete json.textures;delete json.materials;for(const mesh of json.meshes)for(const p of mesh.primitives)delete p.material;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),''),scene=gltf.scene,bones={},meshes=[];
 scene.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh)meshes.push(o);});
 const update=()=>{scene.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();};update();return {scene,bones,meshes,update};
}
// Front-facing surface depth at a projected point, using actual skinned triangles.
function depthAt(points,triangles,x,y){let depth=-Infinity;for(const [a,b,c]of triangles){const p=points[a],q=points[b],r=points[c],det=(q.y-r.y)*(p.x-r.x)+(r.x-q.x)*(p.y-r.y);if(Math.abs(det)<1e-12)continue;const u=((q.y-r.y)*(x-r.x)+(r.x-q.x)*(y-r.y))/det,v=((r.y-p.y)*(x-r.x)+(p.x-r.x)*(y-r.y))/det;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)depth=Math.max(depth,u*p.z+v*q.z+(1-u-v)*r.z);}return depth;}
export function measureFace(rig){
 const mesh=rig.meshes.find(m=>m.name==='Mesh_1');if(!mesh)throw Error('Native head mesh Mesh_1 is missing');
 const p=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,index=mesh.geometry.index;
 const points=()=>Array.from({length:p.count},(_,i)=>mesh.localToWorld(mesh.getVertexPosition(i,new T.Vector3())));
 const rest=points(),eye=[],skin=[],lid=[],expression=[];
 const weight=(i,pattern)=>{let w=0;for(let k=0;k<4;k++)if(pattern.test(mesh.skeleton.bones[si.getComponent(i,k)].name))w+=sw.getComponent(i,k);return w;};
 for(let i=0;i<p.count;i++)if(weight(i,/EyeBlink/)>0.05)lid.push(i);
 const expressionPattern=new RegExp(`_(?:MJaw|${Object.keys(EXPRESSION).join('|')})$`);
 for(let i=0;i<p.count;i++)if(weight(i,expressionPattern)>0.05)expression.push(i);
 for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];(tri.every(v=>weight(v,/_[RL]Eye$/)>.9)?eye:skin).push(tri);}
 const eyeIds=[...new Set(eye.flat())],box=new T.Box3().setFromPoints(eyeIds.map(i=>rest[i]));
 const samples=[];for(let x=box.min.x;x<=box.max.x;x+=.00075)for(let y=box.min.y;y<=box.max.y;y+=.00075){const e=depthAt(rest,eye,x,y),s=depthAt(rest,skin,x,y);if(Number.isFinite(e))samples.push([x,y]);}
 const restOpen=samples.filter(([x,y])=>depthAt(rest,eye,x,y)>depthAt(rest,skin,x,y)+.00001).length;const expressionSet=new Set(expression),affected=skin.filter(tri=>tri.some(i=>expressionSet.has(i)));
 function measure(){rig.update();const posed=points();let open=0,maxDisplacement=0,penetrationIncrease=0;for(const [x,y]of samples)if(depthAt(posed,eye,x,y)>depthAt(posed,skin,x,y)+.00001)open++;
 for(const i of lid)maxDisplacement=Math.max(maxDisplacement,posed[i].distanceTo(rest[i]));
 const regionDisplacement={};
 for(const i of expression){
  for(const [region,pattern]of [['brow',/Eyebrow/],['lid',/EyeBlink/],['mouth',/Mouth|Lip|MJaw/],['cheek',/Cheek/]])if(weight(i,pattern)>.05)regionDisplacement[region]=Math.max(regionDisplacement[region]||0,posed[i].distanceTo(rest[i]));
  // Only orbital skin can intersect the eyeball. Jaw and mouth triangles can
  // project behind it without being near the eye surface.
  if(weight(i,/Eyebrow|EyeBlink/)<=.05)continue;
  const baseDepth=depthAt(rest,eye,rest[i].x,rest[i].y),newDepth=depthAt(posed,eye,posed[i].x,posed[i].y);if(Number.isFinite(newDepth))penetrationIncrease=Math.max(penetrationIncrease,newDepth-posed[i].z-Math.max(0,Number.isFinite(baseDepth)?baseDepth-rest[i].z:0));
 }
 let flippedTriangles=0,maxEdgeStretch=1,minEdgeRatio=1,maxEdgeGrowth=0,maxLongEdgeStretch=1,worstEdge=null;const flippedRegions=[];
 for(const [a,b,c]of affected){
  const oldNormal=new T.Vector3().subVectors(rest[b],rest[a]).cross(new T.Vector3().subVectors(rest[c],rest[a])),newNormal=new T.Vector3().subVectors(posed[b],posed[a]).cross(new T.Vector3().subVectors(posed[c],posed[a]));if(oldNormal.dot(newNormal)<0){flippedTriangles++;if(flippedRegions.length<12)flippedRegions.push({vertices:[a,b,c],bones:[...new Set([a,b,c].flatMap(i=>[0,1,2,3].filter(k=>sw.getComponent(i,k)>.05).map(k=>mesh.skeleton.bones[si.getComponent(i,k)].name)))]});}
  for(const [u,v]of [[a,b],[b,c],[c,a]]){
   const length=rest[u].distanceTo(rest[v]);if(length<1e-8)continue;
   const posedLength=posed[u].distanceTo(posed[v]),ratio=posedLength/length;
   minEdgeRatio=Math.min(minEdgeRatio,ratio);
   maxEdgeGrowth=Math.max(maxEdgeGrowth,posedLength-length);
   if(length>=.001)maxLongEdgeStretch=Math.max(maxLongEdgeStretch,ratio);
   if(ratio>maxEdgeStretch){maxEdgeStretch=ratio;worstEdge={vertices:[u,v],restLength:length,posedLength};}
  }
 }
 return {openSamples:open,restSamples:restOpen,openFraction:open/Math.max(1,restOpen),maxLidDisplacement:maxDisplacement,penetrationIncrease,flippedTriangles,flippedRegions,maxEdgeStretch,minEdgeRatio,maxEdgeGrowth,maxLongEdgeStretch,worstEdge,regionDisplacement};}
 return {measure,eyeTriangles:eye.length,lidVertices:lid.length};
}
export async function auditHero(hero){const rig=await loadFace(hero),meter=measureFace(rig),pose=new FacialPose(rig.bones,{identity:hero}),result={hero,eyeTriangles:meter.eyeTriangles,lidVertices:meter.lidVertices,rest:meter.measure(),closures:[]};
 for(const mm of [2,5,10,15,20]){pose.restore();const saved=[];for(const side of ['R','L'])for(const [part,amount]of [['Top',mm/1000],['Bottom',-mm/4000]]){const b=rig.bones[`Bip01_${side}EyeBlink${part}`];saved.push([b,b.position.clone()]);b.position.add(new T.Vector3(0,amount,0).applyQuaternion(b.quaternion));}result.closures.push({upperTranslationMm:mm,...meter.measure()});for(const [b,p]of saved)b.position.copy(p);}
 for(const [name,state]of [['gaze',{gazeYaw:.07,gazePitch:.035}],['exertion',{exertion:1,musou:1}]]){pose.restore();for(let i=0;i<60;i++){pose.restore();pose.apply(1/60,state);}result[name]=meter.measure();}pose.restore();return result;}
if(process.argv[1]===fileURLToPath(import.meta.url)){const result=[];for(const hero of ['ronin','shinobi','monk','kaede','ayame','sora'])result.push(await auditHero(hero));fs.writeFileSync(process.argv[2]||'/tmp/facial-pose-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
