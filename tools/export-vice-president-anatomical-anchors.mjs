#!/usr/bin/env node
// Explicit anatomical mesh anchors. These names are not MediaPipe identifiers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
const {values}=parseArgs({options:{model:{type:'string'},output:{type:'string'},fit:{type:'string'},labels:{type:'string'},'validate-detections':{type:'string'},help:{type:'boolean'}}});
if(values.help){console.log(`node tools/export-vice-president-anatomical-anchors.mjs --model MODEL.glb --output ANCHORS.json [--fit CAMERAS.json] [--labels /tmp/label-prefix] [--validate-detections DETECTIONS.json]
Exports manually reviewed native head vertex anchors at Naginata_Selection_Idle, time 0.1s.
Names describe physical geometry; they never silently reuse detector IDs. The eyelid anchors remain provisional margin controls.
--fit projects labels through the exact supplied cameras. Without it, use the documented standard portrait cameras.
--labels writes analytical SVG diagrams; no photographs or painted texture are included.
--validate-detections accepts {view:0|1|2,points:[{id,x,y}]} in standard 600x900 portrait pixels.
It fails when the first visible surface is an eyeball, rather than accepting the ray as a skin landmark.
No model or image asset is changed.`);process.exit(0);}
if(!values.model||!values.output)throw Error('Supply --model and --output. See --help.');
const raw=fs.readFileSync(values.model),g=await loadNativeSkin(values.model);
const clip=g.animations.find(c=>c.name==='Naginata_Selection_Idle');if(!clip)throw Error('Missing native selection clip.');
g.mixer.clipAction(clip).play();g.mixer.update(.1);g.scene.updateMatrixWorld(true);
let mesh;g.scene.traverse(o=>{if(o.isSkinnedMesh&&o.name==='Mesh_1')mesh=o;});
if(!mesh||mesh.geometry.attributes.position.count!==1713)throw Error('Expected the unchanged 1713-vertex Monk head topology.');
mesh.skeleton.update();const p=mesh.geometry.attributes.position,index=mesh.geometry.index,skinIndex=mesh.geometry.attributes.skinIndex,skinWeight=mesh.geometry.attributes.skinWeight;
const triangles=Array.from({length:index.count/3},(_,i)=>[0,1,2].map(k=>index.getX(i*3+k)));
const weights=id=>{const result={};for(let k=0;k<4;k++){const bone=mesh.skeleton.bones[skinIndex.getComponent(id,k)].name,w=skinWeight.getComponent(id,k);result[bone]=(result[bone]??0)+w;}return result;};
const eyeVertices=new Set();for(let i=0;i<p.count;i++){const w=weights(i);if((w.Bip01_REye??0)+(w.Bip01_LEye??0)>.6)eyeVertices.add(i);}
let prior=-1;while(prior!==eyeVertices.size){prior=eyeVertices.size;for(const t of triangles)if(t.some(i=>eyeVertices.has(i)))t.forEach(i=>eyeVertices.add(i));}
if(eyeVertices.size!==146)throw Error(`Expected two separate 73-vertex eyeballs, found ${eyeVertices.size}.`);
const posed=Array.from({length:p.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
// Each ID is a native vertex in mesh 0, primitive 1. Duplicate seam vertices
// have identical positions, but upper and lower lips use separate bones.
const definitions=[
 ['noseRoot',935,'Midline root of the geometric nasal bridge','reviewed',null],
 ['noseTip',926,'Most anterior midline nose-tip vertex','reviewed',null],
 ['columellaTip',946,'Inferior anterior columella, distinct from its recessed root','reviewed',null],
 ['subnasale',940,'Recessed midline junction from columella to philtrum','reviewed',null],
 ['philtrumMidline',952,'Midline philtrum surface below subnasale','reviewed',null],
 ['upperLipBorder',939,'Central upper vermilion border','reviewed','Bip01_MUpperLip'],
 ['upperLipSeam',1103,'Upper central oral-fissure margin','reviewed','Bip01_MUpperLip'],
 ['lowerLipSeam',947,'Lower central oral-fissure margin','reviewed','Bip01_MBottomLip'],
 ['lowerLipBorder',938,'Central lower vermilion border','reviewed','Bip01_MBottomLip'],
 ['chinAnterior',950,'Anterior midline chin prominence; not its bottom','reviewed','Bip01_MJaw'],
 ['chinInferior',919,'Inferior anterior chin ridge; submental vertices1182 and920 can project lower. Never substitute for a silhouette','reviewed','Bip01_MJaw'],
 ['rightMouthCommissure',907,'Right upper/lower lip junction at the oral corner','reviewed','Bip01_RMouthCorner'],
 ['leftMouthCommissure',1478,'Left upper/lower lip junction at the oral corner','reviewed','Bip01_LMouthCorner'],
 ['leftAlarCreaseOuter',1256,'Lateral alar attachment crease; distinct from protruding wing1319','reviewed',null],
 ['rightAlarCreaseOuter',681,'Lateral alar attachment crease; distinct from protruding wing738','reviewed',null],
 ['leftAlarCreaseRecess',1394,'Recessed middle of the alar-to-cheek crease','reviewed',null],
 ['rightAlarCreaseRecess',651,'Recessed middle of the alar-to-cheek crease','reviewed',null],
 ['leftAlarCreaseLower',1395,'Inferior end of the alar-to-cheek crease','reviewed',null],
 ['rightAlarCreaseLower',736,'Inferior end of the alar-to-cheek crease','reviewed',null],
 ['leftTragus',472,'Anterior tragus prominence beside the conchal entrance','reviewed',null],
 ['rightTragus',191,'Anterior tragus prominence beside the conchal entrance','reviewed',null],
 ['leftHelixSuperior',449,'Superior free helix rim; excludes scalp vertex326 above the ear','reviewed',null],
 ['rightHelixSuperior',168,'Superior free helix rim','reviewed',null],
 ['leftLobeFreeMargin',529,'Lower free lobule margin before its facial attachment; silhouette depends on view','reviewed',null],
 ['rightLobeFreeMargin',248,'Lower free lobule margin before its facial attachment; silhouette depends on view','reviewed',null],
 ['leftLobeAttachment',539,'Lowest lobule-to-face attachment; distinct from the free lower rim','reviewed',null],
 ['rightLobeAttachment',258,'Lowest lobule-to-face attachment; distinct from the free lower rim','reviewed',null],
 ['rightLateralLidMargin',824,'Right outer eyelid margin junction, on skin','provisional-margin-control',null],
 ['leftLateralLidMargin',1432,'Left outer eyelid margin junction, on skin','provisional-margin-control',null],
 ['rightMedialLidMargin',831,'Right medial eyelid margin beside the caruncle, on skin','provisional-margin-control',null],
 ['leftMedialLidMargin',1447,'Left medial eyelid margin beside the caruncle, on skin','provisional-margin-control',null],
];
const anchors=definitions.map(([name,vertex,description,status,bone])=>{
 if(eyeVertices.has(vertex))throw Error(`${name}: a skin landmark cannot use an eyeball vertex.`);
 const boneWeights=weights(vertex);if(bone&&(boneWeights[bone]??0)<.5)throw Error(`${name}: expected at least 50% ${bone} weight.`);
 const triangleIndices=[];triangles.forEach((t,i)=>{if(t.includes(vertex))triangleIndices.push(i);});if(!triangleIndices.length)throw Error(`${name}: isolated vertex.`);
 return{name,description,status,mesh:'Mesh_1',source:{mesh:0,primitive:1},vertex,triangleIndices,triangles:triangleIndices.map(i=>triangles[i]),bind:new T.Vector3().fromBufferAttribute(p,vertex).toArray(),posed:posed[vertex].toArray(),boneWeights};
});
const standardTarget=g.scene.getObjectByName('Bip01_REye').getWorldPosition(new T.Vector3()).add(g.scene.getObjectByName('Bip01_LEye').getWorldPosition(new T.Vector3())).multiplyScalar(.5).add(new T.Vector3(0,-.014,0));
const standard=[0,.6,1.45].map(angle=>{const c=new T.PerspectiveCamera(40,600/900,.01,20);c.position.copy(standardTarget).add(new T.Vector3(Math.sin(angle)*.72,0,Math.cos(angle)*.72));c.lookAt(standardTarget);c.updateMatrixWorld(true);return c;});
if(values['validate-detections']){
 const data=JSON.parse(fs.readFileSync(values['validate-detections'])),camera=standard[data.view??0],raycaster=new T.Raycaster(),point=new T.Vector3();
 for(const detection of data.points){raycaster.setFromCamera(new T.Vector2(detection.x/600*2-1,1-detection.y/900*2),camera);let first=null;triangles.forEach((ids,ti)=>{if(!raycaster.ray.intersectTriangle(...ids.map(i=>posed[i]),false,point))return;const distance=point.distanceTo(camera.position);if(!first||distance<first.distance)first={distance,ti,ids};});if(!first)throw Error(`Detection ${detection.id}: no head surface intersection.`);if(first.ids.some(i=>eyeVertices.has(i)))throw Error(`Detection ${detection.id}: the first visible surface is an eyeball (triangle ${first.ti}, vertices ${first.ids}). Mark the actual eyelid skin; do not fit this ray as a canthus.`);}
}
let cameras;
if(values.fit){const fit=JSON.parse(fs.readFileSync(values.fit));cameras=fit.photos.map(photo=>{const r=new T.Vector3().fromArray(photo.best.rotationVector),q=new T.Quaternion().setFromAxisAngle(r.clone().normalize(),r.length()),origin=new T.Vector3().fromArray(fit.modelOrigin),t=new T.Vector3().fromArray(photo.best.translation),K=photo.best.cameraMatrix;return{name:path.basename(photo.file,'.json'),width:photo.width,height:photo.height,position:origin.clone().sub(t.clone().applyQuaternion(q.clone().invert())),definition:{type:'fixed supplied fit',file:path.resolve(values.fit),origin:fit.modelOrigin,...photo.best},project(point){const v=point.clone().sub(origin).applyQuaternion(q).add(t);return{x:K[0][0]*v.x/v.z+K[0][2],y:K[1][1]*v.y/v.z+K[1][2],depth:v.z};}};});}
else cameras=standard.map((c,i)=>({name:['front','three-quarter','profile'][i],width:600,height:900,position:c.position.clone(),definition:{type:'standard portrait',position:c.position.toArray(),target:standardTarget.toArray(),matrixWorld:c.matrixWorld.toArray(),projectionMatrix:c.projectionMatrix.toArray()},project(point){const v=point.clone().project(c),depth=-point.clone().applyMatrix4(c.matrixWorldInverse).z;return{x:(v.x+1)*300,y:(1-v.y)*450,depth};}}));
function visibleOnHead(point,camera){const direction=point.clone().sub(camera),distance=direction.length(),ray=new T.Ray(camera,direction.normalize()),hit=new T.Vector3();for(const ids of triangles){if(ray.intersectTriangle(...ids.map(i=>posed[i]),false,hit)&&hit.distanceTo(camera)<distance-.00015)return false;}return true;}
const projections=cameras.map(c=>({name:c.name,width:c.width,height:c.height,camera:c.definition,visibilityIgnoresGlasses:true,anchors:anchors.map(a=>{const point=new T.Vector3().fromArray(a.posed);return{name:a.name,vertex:a.vertex,...c.project(point),visibleOnHead:visibleOnHead(point,c.position)};})}));
const result={model:path.resolve(values.model),modelSha256:crypto.createHash('sha256').update(raw).digest('hex'),clip:clip.name,time:.1,topology:{headVertexCount:p.count,headIndexSha256:crypto.createHash('sha256').update(Buffer.from(index.array.buffer,index.array.byteOffset,index.array.byteLength)).digest('hex'),excludedEyeballVertices:[...eyeVertices]},anchors,projections,limitations:['These physical names are not automatic MediaPipe correspondences. Click matching photographic anatomy independently.','Eyelid margin controls remain provisional. The visible aperture boundary depends on view, occlusion and expression.','Do not use a painted crease or iris edge as a physical canthus.','Chin and cheek silhouette points must be recomputed for each camera.','Mouth corners and fissure vary with expression.'],invalidLegacyAnchors:[{id:33,reason:'100% right eyeball; not an outer eyelid corner'},{id:263,reason:'100% left eyeball; not an outer eyelid corner'},{id:13,reason:'Upper-lip face, above the oral seam'},{id:14,reason:'Same upper-lip triangle as13; not the lower lip'},{id:152,reason:'Inside the anterior chin triangle, about8mm above the anterior ridge919; neither point defines the visible silhouette'}]};
fs.mkdirSync(path.dirname(path.resolve(values.output)),{recursive:true});fs.writeFileSync(values.output,JSON.stringify(result,null,2)+'\n');
if(values.labels){
 for(const c of cameras){const projected=posed.map(v=>c.project(v)),face=triangles.map((ids,ti)=>({ids,ti,depth:ids.reduce((s,i)=>s+projected[i].depth,0)/3})).sort((a,b)=>b.depth-a.depth);const shapes=face.map(({ids})=>{const gray=ids.some(i=>eyeVertices.has(i))?'#ebebeb':'#bcbcbc';return`<polygon points="${ids.map(i=>`${projected[i].x.toFixed(2)},${projected[i].y.toFixed(2)}`).join(' ')}" fill="${gray}" stroke="#969696" stroke-width=".35"/>`;}).join('');const marks=anchors.map((a,i)=>{const p=c.project(posed[a.vertex]),x=p.x+(i%2?18:-18),y=p.y+(i%2?9:-9);return`<circle cx="${p.x}" cy="${p.y}" r="2.8" fill="#e72222"/><path d="M${p.x},${p.y} L${x},${y}" stroke="#b30000"/><text x="${x}" y="${y}" font-size="10" fill="#7a0000">${a.vertex} ${a.name}</text>`;}).join('');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}"><rect width="100%" height="100%" fill="#eef0f2"/>${shapes}${marks}<text x="10" y="20" font-size="12">Anatomical vertex labels; ${c.name}; ${values.fit?'supplied fixed fit':'standard portrait'}; Selection0.1s</text></svg>`;fs.writeFileSync(`${values.labels}-${c.name}.svg`,svg);}
}
console.log(JSON.stringify({output:values.output,anchors:anchors.length,excludedEyeVertices:eyeVertices.size,cameras:projections.map(c=>c.name),labels:values.labels??null}));
