import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import * as T from 'three';
import {applyVicePresidentBrowWeights,restoreVicePresidentLegacyBrowWeights,loadVicePresidentBrowRecipe} from '../tools/author-vice-president-brow-weights.mjs';
import {readModel,packedStream,replaceStream,serializeModel} from '../tools/preserve-vice-president-head.mjs';
import {loadNativeSkin} from './native-skin-helper.mjs';
import {FacialPose,FACIAL_LIMITS} from '../src/facial-pose.js';
import {measureFace} from '../tools/audit-facial-pose.mjs';

const publishedPath=fileURLToPath(new URL('../public/models/monk.glb',import.meta.url)),publishedBytes=fs.readFileSync(publishedPath),recipe=loadVicePresidentBrowRecipe();
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ninja-brow-weights-'));
const source=readModel(publishedBytes);
if(source.doc.extras?.vicePresidentBrowWeights)restoreVicePresidentLegacyBrowWeights(source,recipe);
const sourceBytes=serializeModel(source),candidate=applyVicePresidentBrowWeights(readModel(sourceBytes),recipe).model,candidateBytes=serializeModel(candidate);
const sourcePath=path.join(temporary,'source.glb'),candidatePath=path.join(temporary,'candidate.glb');
fs.writeFileSync(sourcePath,sourceBytes);fs.writeFileSync(candidatePath,candidateBytes);
after(()=>{fs.rmSync(temporary,{recursive:true,force:true});assert.deepEqual(fs.readFileSync(publishedPath),publishedBytes,'The published asset must stay unchanged.');});
const head=model=>model.doc.meshes.flatMap(m=>m.primitives).find(p=>model.doc.materials[p.material]?.name==='m009_head');
const sourceHead=head(source),candidateHead=head(candidate),vertices=[700,706,755,756,1275,1281,1331,1334];

function validGates(g){
 assert.equal(g.flippedTriangles,0,JSON.stringify(g.flippedRegions));
 assert.ok(g.penetrationIncrease<.0005);assert.ok(g.maxLidDisplacement<.0015);
 assert.ok(g.maxLongEdgeStretch<1.5);assert.ok(g.minEdgeRatio>.5);
 assert.ok(Object.values(g.eyes).every(e=>e.openFraction>.92));
}
async function rig(file){
 const g=await loadNativeSkin(file),bones={},meshes=[];
 g.scene.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh)meshes.push(o);});
 const update=()=>{g.scene.updateMatrixWorld(true);meshes.forEach(m=>m.skeleton.update());};update();
 return {...g,bones,meshes,update};
}

test('The brow recipe changes only the eight reviewed skin rows and preserves every other payload',()=>{
 const changed=[];
 for(const name of ['JOINTS_0','WEIGHTS_0']){
  const a=packedStream(source,sourceHead.attributes[name]),b=packedStream(candidate,candidateHead.attributes[name]),size=name==='JOINTS_0'?4:16;
  const altered=[];for(let i=0;i<1713;i++)if(!a.subarray(i*size,(i+1)*size).equals(b.subarray(i*size,(i+1)*size)))altered.push(i);
  assert.ok(altered.length>0);assert.ok(altered.every(i=>vertices.includes(i)));changed.push(...altered);
 }
 assert.deepEqual([...new Set(changed)].sort((a,b)=>a-b),vertices);
 const mutable=new Set([sourceHead.attributes.JOINTS_0,sourceHead.attributes.WEIGHTS_0]);
 for(let i=0;i<source.doc.accessors.length;i++)if(!mutable.has(i))assert.deepEqual(packedStream(candidate,i),packedStream(source,i),`Unowned accessor ${i} changed.`);
 const doc=structuredClone(candidate.doc);delete doc.extras.vicePresidentBrowWeights;assert.deepEqual(doc,source.doc);
 const reversed=restoreVicePresidentLegacyBrowWeights(readModel(candidateBytes),recipe).model;
 assert.deepEqual(reversed,source,'Legacy restoration must exactly reverse the two skin streams and its marker.');
 // Future animation edits must survive. The author must not fingerprint an
 // entire asset and silently restore old clips when it applies head weights.
 const future=readModel(sourceBytes),clip=future.doc.animations[0];clip.name+=' future revision';
 const output=clip.samplers[0].output,bytes=packedStream(future,output);bytes.writeFloatLE(bytes.readFloatLE(0)+.0001,0);replaceStream(future,output,bytes);
 const expected=Buffer.from(bytes);applyVicePresidentBrowWeights(future,recipe);
 assert.equal(future.doc.animations[0].name,clip.name);assert.deepEqual(packedStream(future,output),expected);
});

test('Duplicate, corrupt, incompatible, and unsupported inputs fail before any mutation',()=>{
 const fail=(model,r,pattern)=>{const doc=structuredClone(model.doc),bin=Buffer.from(model.bin);assert.throws(()=>applyVicePresidentBrowWeights(model,r),pattern);assert.deepEqual(model.doc,doc);assert.deepEqual(model.bin,bin);};
 fail(readModel(candidateBytes),recipe,/already/);
 for(const name of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0','indices']){
  const model=readModel(sourceBytes),p=head(model),id=name==='indices'?p.indices:p.attributes[name],bytes=packedStream(model,id);bytes[0]^=1;replaceStream(model,id,bytes);fail(model,recipe,/differs/);
 }
 const wrongRig=readModel(sourceBytes);wrongRig.doc.nodes[wrongRig.doc.skins[0].joints[0]].name+=' incompatible';fail(wrongRig,recipe,/joint mapping/);
 const badTopology=readModel(sourceBytes);head(badTopology).mode=1;fail(badTopology,recipe,/primitive/);
 const corrupt=structuredClone(recipe);const bytes=Buffer.from(corrupt.rows[0].WEIGHTS_0.result,'base64');bytes[0]^=1;corrupt.rows[0].WEIGHTS_0.result=bytes.toString('base64');fail(readModel(sourceBytes),corrupt,/fingerprint/);
 const badRow=structuredClone(recipe);badRow.rows[1].vertex=badRow.rows[0].vertex;fail(readModel(sourceBytes),badRow,/eight/);
 const badPayload=structuredClone(recipe);badPayload.rows[0].JOINTS_0.result='';fail(readModel(sourceBytes),badPayload,/payload/);
 const invalidView=readModel(sourceBytes);invalidView.doc.bufferViews[invalidView.doc.accessors[sourceHead.attributes.POSITION].bufferView].byteLength=1;fail(invalidView,recipe,/binary view/);
 assert.throws(()=>restoreVicePresidentLegacyBrowWeights(readModel(sourceBytes),recipe),/requires/);
});

test('The CLI rejects file aliases and corrupt data without overwriting outputs',()=>{
 const tool=fileURLToPath(new URL('../tools/author-vice-president-brow-weights.mjs',import.meta.url)),run=args=>spawnSync(process.execPath,[tool,...args],{encoding:'utf8'});
 assert.equal(run(['--help']).status,0);
 const symlink=path.join(temporary,'alias.glb');fs.symlinkSync(sourcePath,symlink);
 const hardlink=path.join(temporary,'hardlink.glb');fs.linkSync(sourcePath,hardlink);
 for(const alias of [sourcePath,symlink,hardlink]){const r=run(['--input',sourcePath,'--output',alias]);assert.notEqual(r.status,0);assert.match(r.stderr,/distinct/);}
 const output=path.join(temporary,'protected.glb'),report=path.join(temporary,'protected.json');fs.writeFileSync(output,'keep output');fs.writeFileSync(report,'keep report');
 const bad=path.join(temporary,'bad.glb');fs.writeFileSync(bad,sourceBytes.subarray(0,sourceBytes.length-1));
 const r=run(['--input',bad,'--output',output,'--report',report]);assert.notEqual(r.status,0);assert.match(r.stderr,/complete GLB/);
 assert.equal(fs.readFileSync(output,'utf8'),'keep output');assert.equal(fs.readFileSync(report,'utf8'),'keep report');
 const same=run(['--input',sourcePath,'--output',output,'--report',sourcePath]);assert.notEqual(same.status,0);assert.match(same.stderr,/json|distinct/);
 assert.deepEqual(fs.readFileSync(sourcePath),sourceBytes);
});

test('All facial brow channels remain static, and neutral skin stays unchanged across all native clips',async()=>{
 const a=await rig(sourcePath),b=await rig(candidatePath),names=['Bip01_RInnerEyebrow','Bip01_LInnerEyebrow','Bip01_MMiddleEyebrow'];
 for(const name of names)assert.equal(a.bones[name].parent.name,'Head');
 const native=Object.fromEntries(names.map(name=>[name,{position:a.bones[name].position.clone(),quaternion:a.bones[name].quaternion.clone(),scale:a.bones[name].scale.clone()}]));
 const face=[a,b].map(r=>r.scene.getObjectByName('Mesh_1'));
 for(let c=0;c<a.animations.length;c++){
  const clip=a.animations[c];
  for(const track of clip.tracks){
   const match=names.find(name=>track.name.startsWith(name+'.'));if(!match)continue;
   const property=track.name.slice(match.length+1),size=track.getValueSize();
   assert.ok(['position','quaternion','scale'].includes(property),`Review new brow track ${track.name}.`);
   for(let k=0;k<track.values.length;k+=size){const value=property==='quaternion'?new T.Quaternion().fromArray(track.values,k).normalize():new T.Vector3().fromArray(track.values,k),base=native[match][property];const delta=property==='quaternion'?value.angleTo(base.clone().normalize()):value.distanceTo(base);assert.ok(delta<1e-6,`Review animated brow motion in ${clip.name}/${track.name}: ${delta}.`);}
  }
  for(const r of [a,b]){r.mixer.stopAllAction();r.mixer.clipAction(r.animations[c]).reset().play();}
  for(const fraction of [0,.5,1]){
   for(const r of [a,b]){r.mixer.setTime(clip.duration*fraction);r.update();}
   for(let i=0;i<1713;i++){
    const points=face.map(m=>m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrixWorld));
    assert.ok(points[0].distanceTo(points[1])<1e-6,`Neutral skin moved in ${clip.name}, vertex ${i}.`);
   }
  }
 }
 assert.equal(a.animations.length,40,'Review the brow channels when the native roster gains clips.');
});

test('The local weights preserve eyes and valid expressions, including the full former movement',async()=>{
 const rigs=await Promise.all([rig(sourcePath),rig(candidatePath)]),faces=rigs.map(r=>r.scene.getObjectByName('Mesh_1')),poses=rigs.map(r=>new FacialPose(r.bones,{identity:'monk'})),meter=measureFace(rigs[1]);
 const eye=[];const mesh=faces[0],si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
 for(let i=0;i<1713;i++){let w=0;for(let k=0;k<4;k++)if(/^Bip01_[RL]Eye$/.test(mesh.skeleton.bones[si.getComponent(i,k)].name))w+=sw.getComponent(i,k);if(w>.9)eye.push(i);}
 assert.ok(eye.length>100);
 for(const descent of [.003,.006])for(const ys of [-1,1])for(const ps of [-1,1])for(const strength of [0,.25,.5,.75,1]){
  for(const pose of poses){pose.restore();pose.expression={...pose.expression,RInnerEyebrow:[.0025,-descent,.0018],LInnerEyebrow:[-.0025,-descent,.0018]};pose.anger=strength;pose.effort=1;pose.yaw=ys*FACIAL_LIMITS.gazeYaw;pose.pitch=ps*FACIAL_LIMITS.gazePitch;pose.apply(0,{musou:strength,exertion:1});}
  rigs.forEach(r=>r.update());validGates(meter.measure());
  for(const i of [...eye,705,1280]){
   const points=faces.map(m=>m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrixWorld));
   assert.equal(points[0].distanceTo(points[1]),0,`Eye or upper-brow movement changed at ${i}.`);
  }
 }
});

test('Restoring the legacy weights recovers the known 6 mm overhang negative control',async()=>{
 const legacyPath=path.join(temporary,'legacy.glb');fs.writeFileSync(legacyPath,serializeModel(restoreVicePresidentLegacyBrowWeights(readModel(candidateBytes),recipe).model));
 async function scan(file){
  const r=await rig(file);r.mixer.clipAction(r.animations.find(c=>c.name==='Naginata_Selection_Idle')).play();r.mixer.update(.1);r.update();
  const mesh=r.scene.getObjectByName('Mesh_1'),pose=new FacialPose(r.bones,{identity:'monk'}),vector=new T.Vector3(-3.109502500739543,-.008424192554161623,.22747098566030852),q=new T.Quaternion().setFromAxisAngle(vector.clone().normalize(),vector.length()),origin=new T.Vector3(.044977052250795894,1.6662760188486123,.14324361654387896),translation=new T.Vector3(-.008758120586365443,-.023085117663649922,1.0616441693694938);
  const project=i=>{const p=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin).applyQuaternion(q).add(translation);return[p.x/p.z,p.y/p.z];};
  const triangles=[[755,700,706],[706,756,755],[1334,1331,1281],[1281,1275,1334]],area=ids=>{const[a,b,c]=ids.map(project);return((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;},base=triangles.map(area);let minimum=Infinity;
  pose.expression={...pose.expression,RInnerEyebrow:[.0025,-.006,.0018],LInnerEyebrow:[-.0025,-.006,.0018]};
  for(let i=0;i<=40;i++){pose.restore();pose.anger=i/40;pose.apply(0,{musou:i/40});r.update();triangles.forEach((ids,k)=>{minimum=Math.min(minimum,area(ids)/base[k]);});}return minimum;
 }
 assert.ok(await scan(candidatePath)>0,'The reviewed weight correction must preserve the visible crease faces.');
 assert.ok(await scan(legacyPath)<0,'The exact old skin rows must still reproduce the known overhang.');
});
