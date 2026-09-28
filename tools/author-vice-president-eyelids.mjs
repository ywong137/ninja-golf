#!/usr/bin/env node
// Offline hooded-lid candidate. Preserve the lid margin and eyeball surfaces.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseArgs} from 'node:util';
import * as T from 'three';
import {loadNativeSkin} from '../tests/native-skin-helper.mjs';
import {readModel,packedStream,replaceStream,serializeModel} from './preserve-vice-president-head.mjs';
const {values:a}=parseArgs({options:{input:{type:'string'},output:{type:'string'},'fold-mm':{type:'string'},'forward-mm':{type:'string'},help:{type:'boolean'}}});
if(a.help){console.log('node tools/author-vice-president-eyelids.mjs --input MODEL.glb --output CANDIDATE.glb --fold-mm 1.5 --forward-mm 0.8\nCreates an offline hooded-lid candidate. Only skin above the outer eyelid moves. The physical margin, eyes, bones, weights, textures and clips remain unchanged.');process.exit(0);}
if(!a.input||!a.output||!a['fold-mm']||!a['forward-mm'])throw Error('Supply --input, --output --fold-mm and --forward-mm. See --help.');
if(path.resolve(a.input)===path.resolve(a.output))throw Error('Use a separate output candidate.');
const fold=Number(a['fold-mm']),forward=Number(a['forward-mm']);
if(!Number.isFinite(fold)||fold<=0||fold>3||!Number.isFinite(forward)||forward<0||forward>2)throw Error('Use a fold between zero and three millimetres, and forward volume from zero to two.');
const raw=fs.readFileSync(a.input),model=readModel(raw);
if(model.doc.extras?.vicePresidentLidCandidate)throw Error('This model already contains an upper-lid candidate.');
if(!model.doc.extras?.vicePresidentLikeness)throw Error('Expected the reviewed Ethan head.');
const g=await loadNativeSkin(a.input);let mesh;g.scene.traverse(o=>{if(o.name==='Mesh_1'&&o.isSkinnedMesh)mesh=o;});
if(!mesh||mesh.geometry.attributes.position.count<1713)throw Error('Expected the native Ethan head with its original vertex prefix.');
const {position:p,normal:n}=mesh.geometry.attributes;
const before=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i)),after=before.map(p=>p.clone());
const anatomy=JSON.parse(fs.readFileSync(new URL('../assets/characters/vice-president-fit-reference.json',import.meta.url)));
const eyes=new Set(anatomy.excludedEyeVertices);
const moves=[];
function smooth(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
function influenceAt(v){
 const x=Math.abs(v.x);
 // A rounded outer hood, rather than a constant-width horizontal strip.
 // The lower window ends above every physical lid-margin vertex.
 const volume=Math.exp(-.5*(((x-.045)/.010)**2+((v.y-1.696)/.0055)**2+((v.z-.116)/.012)**2));
 return volume*smooth(.024,.030,x)*(1-smooth(.056,.063,x))
  *smooth(1.6876,1.6906,v.y)*(1-smooth(1.704,1.713,v.y))*smooth(.097,.112,v.z);
}
const primitive=model.doc.meshes.flatMap(m=>m.primitives).find(p=>model.doc.materials[p.material]?.name==='m009_head');
const positions=packedStream(model,primitive.attributes.POSITION),normals=packedStream(model,primitive.attributes.NORMAL);
const displacement=new T.Vector3(0,-fold*.001,forward*.001),epsilon=.00001;
let minimumJacobian=1;
for(let i=0;i<p.count;i++){
 if(eyes.has(i))continue;
 const v=before[i],influence=influenceAt(v),gradient=new T.Vector3();
 for(let k=0;k<3;k++){
  const step=new T.Vector3().setComponent(k,epsilon);
  gradient.setComponent(k,(influenceAt(v.clone().add(step))-influenceAt(v.clone().sub(step)))/(2*epsilon));
 }
 // J = I + displacement * gradient^T. Its determinant and inverse transpose
 // follow the matrix determinant lemma and Sherman-Morrison identity.
 const determinant=1+gradient.dot(displacement);minimumJacobian=Math.min(minimumJacobian,determinant);
 if(determinant<=0)throw Error(`The fold field reverses the surface at vertex ${i}.`);
 if(influence>0){
  after[i].addScaledVector(displacement,influence);
  for(let k=0;k<3;k++)positions.writeFloatLE(after[i].getComponent(k),i*12+k*4);
  moves.push({vertex:i,influence,movementMetres:after[i].distanceTo(before[i])});
 }
 if(gradient.lengthSq()===0)continue;
 const normal=new T.Vector3().fromBufferAttribute(n,i);
 normal.addScaledVector(gradient,-displacement.dot(normal)/determinant).normalize();
 for(let k=0;k<3;k++)normals.writeFloatLE(normal.getComponent(k),i*12+k*4);
}
replaceStream(model,primitive.attributes.POSITION,positions);replaceStream(model,primitive.attributes.NORMAL,normals);
const bounds=new T.Box3().setFromPoints(after),accessor=model.doc.accessors[primitive.attributes.POSITION];accessor.min=bounds.min.toArray();accessor.max=bounds.max.toArray();
const report={sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),foldMillimetres:fold,forwardMillimetres:forward,minimumJacobian,moves,maximumMovementMetres:Math.max(...moves.map(m=>m.movementMetres)),method:'A smooth field lowers and advances the outer supra-palpebral skin. Inverse-transpose Jacobians transport normals. The physical lid margin, eyeballs and all rig streams remain unchanged.'};
model.doc.extras.vicePresidentLidCandidate=report;
fs.writeFileSync(a.output,serializeModel(model));fs.writeFileSync(a.output+'.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output:a.output,vertices:moves.length,maximumMovementMetres:report.maximumMovementMetres}));
